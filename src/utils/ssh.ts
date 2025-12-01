import chalk from 'chalk'
import { join } from 'path'
import { ServerConfig } from '../types/config.js'
import { ProgressIndicator } from './progress.js'
import { readdirSync, statSync, existsSync } from 'fs'
import { Client, ConnectConfig, SFTPWrapper } from 'ssh2'
import _PathUtils from './pathUtils.js'
import { IntelligentCommandConverter } from './intelligent-command-converter.js'

const Progress1 = new ProgressIndicator()
const Progress2 = new ProgressIndicator()

export interface SSHConnectionConfig extends ConnectConfig {
  host: string
  port?: number
  username: string
  password?: string
  hostKey?: string
  readyTimeout?: number
}

export interface SSHCommandResult {
  code: number
  stdout: string
  stderr: string
  success: boolean
}

export class SSHTool {
  public client: Client
  private serverType: 'unix' | 'windows' | undefined
  private config: SSHConnectionConfig
  private connected: boolean = false
  private sftp: SFTPWrapper | null = null
  private pendingOperations = 0
  constructor(serverConfig: ServerConfig) {
    this.config = this.prepareSSHConfig(serverConfig)
    this.client = new Client()
  }

  /**
   * 格式化参数
   * @param serverConfig
   * @returns
   */
  private prepareSSHConfig(serverConfig: ServerConfig): SSHConnectionConfig {
    const config: SSHConnectionConfig = {
      host: serverConfig.host,
      port: serverConfig.port || 22,
      username: serverConfig.userName,
      password: serverConfig.password,
      hostKey: serverConfig.sshKey,
      readyTimeout: 30000,
      algorithms: {
        kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521', 'diffie-hellman-group14-sha256']
      }
    }
    return config
  }

  /**
   * 执行脚本
   * @param command  脚本
   * @param timeout
   * @returns
   */
  public async executeCommand(command: string, timeout = 30000): Promise<SSHCommandResult> {
    return new Promise((resolve, reject) => {
      console.log(chalk.cyan('⚡ 执行命令:'), command)

      const timeoutId = setTimeout(() => {
        reject(new Error('命令执行超时'))
      }, timeout)

      this.client.exec(IntelligentCommandConverter.convertCommand(command, this.serverType), (err, stream) => {
        if (err) {
          clearTimeout(timeoutId)
          reject(err)
          return
        }

        let stdout = ''
        let stderr = ''

        stream.on('data', (data: Buffer) => (stdout += data))
        stream.stderr.on('data', data => (stderr += data))

        stream.on('close', (code: number) => {
          clearTimeout(timeoutId)
          const result = { code, stdout: stdout.trim(), stderr: stderr.trim(), success: code === 0 }

          if (code === 0) {
            console.log(chalk.green('✅ 命令执行成功'))
          } else {
            console.log(chalk.yellow(`⚠️ 命令退出码: ${code}`))
          }

          resolve(result)
        })
        stream.on('error', (err: Error) => {
          console.log(chalk.red('命令执行失败：' + err))
          clearTimeout(timeoutId)
          reject(err)
        })
      })
    })
  }
  /**
   * 开启链接状态
   * @returns
   */
  public async connect() {
    return new Promise<void>(async (resolve, reject) => {
      if (this.connected) {
        console.log(chalk.red('SSH 连接已存在\n'))
        resolve()
      }

      this.client.on('ready', async () => {
        this.connected = true
        console.log(chalk.green('✅ SSH 连接成功'))
        await this.detectServerType()
        resolve()
      })

      this.client.on('error', error => {
        reject(new Error(`SSH 连接失败: ${error.message}`))
      })

      this.client.on('close', () => {})

      this.client.connect(this.config)
    })
  }
  // 安全断开连接
  disconnect() {
    if (this.connected) {
      this.client.end()
      this.connected = false
      Progress1.stop('')
      Progress2.stop()
      console.log(chalk.yellow('🔌 SSH 连接已关闭'))
    }
  }
  /**
   * 测试连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.connect()
      const result = await this.executeCommand('echo "SSHSUCCED"')
      return result.success && result.stdout.includes('SSHSUCCED')
    } catch (error) {
      return false
    } finally {
      // 关闭链接
      this.disconnect()
    }
  }
  /**
   * 获取 SFTP 连接
   */
  private async getSFTP(): Promise<SFTPWrapper> {
    if (this.sftp) return this.sftp
    return new Promise((resolve, reject) => {
      this.client.sftp((error, sftp) => {
        if (error) {
          reject(new Error(`SFTP 初始化失败: ${error.message}`))
        } else {
          this.sftp = sftp
          resolve(sftp)
        }
      })
    })
  }
  /**
   * 检查远程目录是否存在
   */
  public async directoryExists(escapedPath: string): Promise<boolean> {
    try {
      const _path = _PathUtils.normalizeRemotePath(escapedPath, this.serverType)
      const psCommand = `powershell -Command "Test-Path -Path '${_path}'"`
      const result = await this.executeCommand(psCommand)
      return result.stdout == 'True'
    } catch (error) {
      return false
    }
  }
  /**
   * 创建远程目录（递归创建）
   */
  public async createDirectory(remotePath: string): Promise<void> {
    const _path = _PathUtils.normalizeRemotePath(remotePath, this.serverType)
    const command = `powershell -Command "New-Item -ItemType Directory -Path '${_path}' -Force"`
    const result = await this.executeCommand(command)
    if (!result.success) {
      if (result.stderr.includes('Cannot create path')) {
        throw new Error(`创建目录失败: 路径无效或权限不足`)
      }
      throw new Error(`创建目录失败: ${result.stderr}`)
    }
  }

  /**
   * 修改文件名称
   */
  public async editDirectoryName(path: string, newName: string) {
    if (!(await this.directoryExists(path))) return console.log(chalk.yellow('未找到要修改的文件目录'))

    const _path = _PathUtils.normalizeRemotePath(path, this.serverType)

    const command = `powershell -Command "Rename-Item -Path '${_path}' -NewName '${newName}' -Force"`
    const result = await this.executeCommand(command)
    console.log(result, 'result')

    if (!result.success) {
      if (result.stderr.includes('Cannot create path')) {
        throw new Error(`修改目录失败: 路径无效或权限不足`)
      }
      throw new Error(`修改目录失败: ${result.stderr}`)
    }
  }

  /**
   * 删除文件
   * @param path
   * @param newName
   */
  public async delFile(path: string) {
    if (!(await this.directoryExists(path))) return console.log(chalk.yellow('未找到文件，无需删除'))
    const _path = _PathUtils.normalizeRemotePath(path, this.serverType)
    const command = `powershell -Command "Remove-Item -path "${_path}"  -Recurse -Force"`
    const result = await this.executeCommand(command)
    if (!result.success) {
      if (result.stderr.includes('Cannot create path')) {
        throw new Error(`删除文件失败: 路径无效或权限不足`)
      }
      throw new Error(`删除文件失败: ${result.stderr}`)
    }
  }
  /**
   * 上传单个文件
   */
  public async uploadFile(localPath: string, remotePath: string): Promise<void> {
    if (!this.connected) await this.connect()
    this.pendingOperations++
    try {
      Progress2.update(chalk.blue('📤 上传文件:') + chalk.gray(`${localPath} → ${remotePath}`))
      if (!existsSync(localPath)) throw new Error(`本地文件不存在: ${localPath}`)
      const sftp = await this.getSFTP()
      const windowsRemotePath = remotePath.replace(/\//g, '\\')

      await new Promise<void>((resolve, reject) => {
        sftp.fastPut(
          localPath,
          windowsRemotePath,
          {
            step: (totalTransferred: number, chunk: number, total: number) => {
              const percent = ((totalTransferred / total) * 100).toFixed(1)
              const transferredMB = (totalTransferred / 1024 / 1024).toFixed(2)
              const totalMB = (total / 1024 / 1024).toFixed(2)
              Progress2.update(`\r📤 上传进度: ${percent}% (${transferredMB}MB/${totalMB}MB)`)
            }
          },
          (error?: Error | null) => {
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          }
        )
      })
    } finally {
      this.pendingOperations--
    }
  }

  /**
   * 获取目录数量
   * @param dir
   * @returns
   */
  private countFiles(dir: string): number {
    let count = 0
    try {
      const items = readdirSync(dir)
      for (const item of items) {
        const fullPath = join(dir, item)
        const stats = statSync(fullPath)
        if (stats.isFile()) {
          count++
        } else if (stats.isDirectory()) {
          count += this.countFiles(fullPath)
        }
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️ 统计文件时跳过目录: ${dir}`))
    }
    return count
  }
  /**
   * 上传整个目录
   */
  public async uploadDirectory(localPath: string, remotePath: string): Promise<void> {
    if (!existsSync(localPath)) {
      throw new Error(`本地目录不存在: ${localPath}`)
    }

    console.log(chalk.blue('📦 上传目录:'), chalk.gray(`${localPath} → ${remotePath}`))

    // 确保远程目录存在
    if (!(await this.directoryExists(remotePath))) await this.createDirectory(remotePath)

    // 统计文件数量
    const totalFiles = this.countFiles(localPath)
    if (totalFiles === 0) {
      console.log(chalk.yellow('⚠️ 目录为空，跳过上传'))
      return
    }

    console.log(chalk.cyan(`📊 总共需要上传 ${totalFiles} 个文件`))

    let uploadedFiles = 0
    Progress1.start('')
    Progress2.start('')

    // 递归上传函数
    const uploadRecursive = async (currentLocalPath: string, currentRemotePath: string): Promise<void> => {
      const items = readdirSync(currentLocalPath)
      for (const item of items) {
        const localItemPath = join(currentLocalPath, item)
        const remoteItemPath = join(currentRemotePath, item).replace(/\//g, '\\')
        const stats = statSync(localItemPath)

        if (stats.isFile()) {
          try {
            await this.uploadFile(localItemPath, remoteItemPath)
            uploadedFiles++
            Progress1.update(`进度: ${uploadedFiles}/${totalFiles} 个文件`)
          } catch (error) {
            console.log(chalk.red(`❌ 文件上传失败: ${localItemPath}`))
            throw error
          }
        } else if (stats.isDirectory()) {
          if (!(await this.directoryExists(remoteItemPath))) await this.createDirectory(remoteItemPath)
          await uploadRecursive(localItemPath, remoteItemPath)
        }
      }
    }

    try {
      await uploadRecursive(localPath, remotePath)
      Progress1.stop(`进度: ${totalFiles}/${totalFiles} 个文件`)
      Progress2.stop(chalk.green(`✅ 目录上传完成，共上传 ${uploadedFiles} 个文件`))
    } catch (error) {
      Progress1.stop(chalk.red('❌ 目录上传失败'))
      Progress2.stop('')
      throw error
    }
  }

  /**
   * 探测服务器类型
   */
  public async detectServerType(): Promise<'unix' | 'windows' | undefined> {
    if (this.serverType) return this.serverType

    // 方法1：快速探测
    const quickProbes = [
      { command: 'uname -s', type: 'unix' },
      { command: 'ver', type: 'windows' },
      { command: 'ls --version', type: 'unix' },
      { command: 'dir', type: 'windows' }
    ]

    for (const probe of quickProbes) {
      try {
        const result = await this.executeCommand(probe.command, 3000)
        if (result.success) {
          this.serverType = probe.type as 'unix' | 'windows'
          console.log(chalk.green(`✅ 检测到 ${this.serverType} 服务器`))
          return this.serverType
        }
      } catch (error) {
        // 继续尝试下一个探测命令
      }
    }

    // 方法2：路径风格探测
    try {
      const pathResult = await this.executeCommand('echo $PATH')
      if (pathResult.success) {
        if (pathResult.stdout.includes('/usr/bin') || pathResult.stdout.includes('/bin')) {
          this.serverType = 'unix'
        } else if (pathResult.stdout.includes(':\\')) {
          this.serverType = 'windows'
        }
      }
    } catch (error) {
      // 路径探测失败
    }

    return this.serverType
  }
}
