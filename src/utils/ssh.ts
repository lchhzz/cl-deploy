import chalk from 'chalk'
import { join } from 'path'
import { ServerConfig } from '../types/config.js'
import { ProgressIndicator } from './progress.js'
import { readdirSync, statSync, existsSync } from 'fs'
import { Client, ConnectConfig, SFTPWrapper } from 'ssh2'
import _PathUtils from './pathUtils.js'
import { IntelligentCommandConverter } from './intelligent-command-converter.js'
import { CommandError, SSHError, FileError } from '../types/errors.js'

// 独立的进度指示器：命令 & 上传互不干扰
const CommandProgress = new ProgressIndicator()
const UploadProgress = new ProgressIndicator()

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
      privateKey: serverConfig.sshKey,
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
      // 命令进度：总是显示当前正在执行的命令
      CommandProgress.start(chalk.cyan(`⚡ 执行命令: ${command}`))

      const timeoutId = setTimeout(() => {
        reject(new CommandError('命令执行超时', undefined, 'COMMAND_TIMEOUT'))
      }, timeout)

      this.client.exec(IntelligentCommandConverter.convertCommand(command, this.serverType), (err, stream) => {
        if (err) {
          clearTimeout(timeoutId)
          reject(new SSHError(`命令执行失败: ${err.message}`, 'COMMAND_EXEC_ERROR'))
          return
        }

        let stdout = ''
        let stderr = ''

        stream.on('data', (data: Buffer) => (stdout += data))
        stream.stderr.on('data', data => (stderr += data))

        stream.on('close', (code: number) => {
          clearTimeout(timeoutId)
          const result = { code, stdout: stdout.trim(), stderr: stderr.trim(), success: code === 0 }

          CommandProgress.stop(
            code === 0
              ? chalk.green(`✅ 命令完成 (exit ${code})`)
              : chalk.yellow(`⚠️ 命令退出码: ${code}`)
          )

          resolve(result)
        })
        stream.on('error', (err: Error) => {
          console.log(chalk.red('命令执行失败：' + err))
          clearTimeout(timeoutId)
          CommandProgress.stop(chalk.red(`❌ 命令执行失败: ${err.message}`))
          reject(new SSHError(`命令执行失败: ${err.message}`, 'COMMAND_STREAM_ERROR'))
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
        return
      }

      this.client.on('ready', async () => {
        this.connected = true
        console.log(chalk.green('✅ SSH 连接成功'))
        await this.detectServerType()
        resolve()
      })

      this.client.on('error', error => {
        reject(new SSHError(`SSH 连接失败: ${error.message}`, 'SSH_CONNECTION_ERROR'))
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
      // 结束可能存在的命令/上传进度行
      CommandProgress.stop()
      UploadProgress.stop()
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
          reject(new SSHError(`SFTP 初始化失败: ${error.message}`, 'SFTP_INIT_ERROR'))
        } else {
          this.sftp = sftp
          resolve(sftp)
        }
      })
    })
  }
  /**
   * 根据服务器类型选择命令
   */
  private platformCommand(windowsCmd: string, unixCmd: string) {
    return this.serverType === 'windows' ? windowsCmd : unixCmd
  }
  /**
   * 检查远程目录是否存在
   */
  public async directoryExists(escapedPath: string): Promise<boolean> {
    try {
      const serverType = this.serverType || 'unix'
      const _path = _PathUtils.normalizeRemotePath(escapedPath, serverType)
      const command = this.platformCommand(`powershell -Command "Test-Path -Path '${_path}'"`, `test -d '${_path}' && echo 'true' || echo 'false'`)
      const result = await this.executeCommand(command)
      return serverType === 'windows' ? result.stdout === 'True' : result.stdout.includes('true')
    } catch (error) {
      return false
    }
  }
  /**
   * 创建远程目录（递归创建）
   */
  public async createDirectory(remotePath: string): Promise<void> {
    const serverType = this.serverType || 'unix'
    const _path = _PathUtils.normalizeRemotePath(remotePath, serverType)
    const command = this.platformCommand(`powershell -Command "New-Item -ItemType Directory -Path '${_path}' -Force"`, `mkdir -p '${_path}'`)
    const result = await this.executeCommand(command)
    if (!result.success) {
      if (result.stderr.includes('Cannot create path') || result.stderr.includes('Permission denied')) {
        throw new FileError(`创建目录失败: 路径无效或权限不足`, 'DIRECTORY_CREATE_PERMISSION_ERROR')
      }
      throw new FileError(`创建目录失败: ${result.stderr}`, 'DIRECTORY_CREATE_ERROR')
    }
  }

  /**
   * 修改文件名称
   */
  public async editDirectoryName(path: string, newName: string) {
    if (!(await this.directoryExists(path))) return console.log(chalk.yellow('未找到要修改的文件目录'))

    const serverType = this.serverType || 'unix'
    const _path = _PathUtils.normalizeRemotePath(path, serverType)
    const parentPath = _PathUtils.dirname(_path)
    const newPath = _PathUtils.join(parentPath, newName)

    const command = this.platformCommand(`powershell -Command "Rename-Item -Path '${_path}' -NewName '${newName}' -Force"`, `mv '${_path}' '${newPath}'`)
    const result = await this.executeCommand(command)

    if (!result.success) {
      if (result.stderr.includes('Cannot create path') || result.stderr.includes('Permission denied')) {
        throw new FileError(`修改目录失败: 路径无效或权限不足`, 'DIRECTORY_RENAME_PERMISSION_ERROR')
      }
      throw new FileError(`修改目录失败: ${result.stderr}`, 'DIRECTORY_RENAME_ERROR')
    }
  }

  /**
   * 删除文件
   * @param path
   * @param newName
   */
  public async delFile(path: string) {
    if (!(await this.directoryExists(path))) return console.log(chalk.yellow('未找到文件，无需删除'))
    const serverType = this.serverType || 'unix'
    const _path = _PathUtils.normalizeRemotePath(path, serverType)
    const command = this.platformCommand(
      `powershell -Command "Remove-Item -Path '${_path}' -Recurse -Force"`,
      `rm -rf '${_path}'`
    )
    const result = await this.executeCommand(command)
    if (!result.success) {
      if (result.stderr.includes('Cannot create path') || result.stderr.includes('Permission denied')) {
        throw new FileError(`删除文件失败: 路径无效或权限不足`, 'FILE_DELETE_PERMISSION_ERROR')
      }
      throw new FileError(`删除文件失败: ${result.stderr}`, 'FILE_DELETE_ERROR')
    }
  }
  /**
   * 上传单个文件
   */
  public async uploadFile(localPath: string, remotePath: string, progressCallback?: (percent: number, transferred: number, total: number) => void): Promise<void> {
    if (!this.connected) await this.connect()
    this.pendingOperations++
    try {
      if (!existsSync(localPath)) throw new FileError(`本地文件不存在: ${localPath}`, 'LOCAL_FILE_NOT_FOUND')
      const sftp = await this.getSFTP()
      const windowsRemotePath = remotePath.replace(/\//g, '\\')

      await new Promise<void>((resolve, reject) => {
        sftp.fastPut(
          localPath,
          windowsRemotePath,
          {
            chunkSize: 32768, // 32KB块大小，可根据网络情况调整
            step: (totalTransferred: number, chunk: number, total: number) => {
              const percent = (totalTransferred / total) * 100
              progressCallback?.(percent, totalTransferred, total)
            }
          },
          (error?: Error | null) => {
            if (error) {
              reject(new SSHError(`文件上传失败: ${error.message}`, 'FILE_UPLOAD_ERROR'))
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
  public async uploadDirectory(localPath: string, remotePath: string, concurrency: number = 5): Promise<void> {
    if (!existsSync(localPath)) {
      throw new FileError(`本地目录不存在: ${localPath}`, 'LOCAL_DIR_NOT_FOUND')
    }

    console.log(chalk.blue('📦 上传目录:'), chalk.gray(`${localPath} → ${remotePath}`))

    // 确保远程目录存在
    if (!(await this.directoryExists(remotePath))) await this.createDirectory(remotePath)

    // 统计文件数量并收集所有文件路径
    const totalFiles = this.countFiles(localPath)
    if (totalFiles === 0) {
      console.log(chalk.yellow('⚠️ 目录为空，跳过上传'))
      return
    }

    console.log(chalk.cyan(`📊 总共需要上传 ${totalFiles} 个文件`))
    console.log(chalk.cyan(`⚡ 使用并发数: ${concurrency}`))

    // 上传进度：独立于命令进度
    UploadProgress.start('准备上传...')

    let uploadedFiles = 0
    // 收集所有需要上传的文件
    const filesToUpload: Array<{ local: string; remote: string }> = []
    const collectFiles = (currentLocalPath: string, currentRemotePath: string) => {
      const items = readdirSync(currentLocalPath)
      for (const item of items) {
        const localItemPath = join(currentLocalPath, item)
        const remoteItemPath = join(currentRemotePath, item).replace(/\//g, '\\')
        const stats = statSync(localItemPath)

        if (stats.isFile()) {
          filesToUpload.push({ local: localItemPath, remote: remoteItemPath })
        } else if (stats.isDirectory()) {
          filesToUpload.push({ local: localItemPath, remote: remoteItemPath })
          collectFiles(localItemPath, remoteItemPath)
        }
      }
    }

    // 先创建所有远程目录
    const createRemoteDirs = async () => {
      for (const fileInfo of filesToUpload) {
        if (existsSync(fileInfo.local) && statSync(fileInfo.local).isDirectory()) {
          if (!(await this.directoryExists(fileInfo.remote))) {
            await this.createDirectory(fileInfo.remote)
          }
        }
      }
    }

    // 并行上传文件
    const uploadFilesInParallel = async () => {
      const queue: Array<{ local: string; remote: string }> = filesToUpload.filter(f => existsSync(f.local) && statSync(f.local).isFile())
      let currentFileName = ''
      let currentFilePercent = 0
      let lastLoggedFile = ''

      // 统一的进度更新函数：只在“切换到新的文件”时输出一次
      const updateProgress = () => {
        // 只显示正在处理的文件，跳过已完成的
        if (currentFilePercent >= 100) return
        // 同一个文件只输出一次，避免多行
        if (currentFileName === lastLoggedFile) return

        const filesText = `文件数：${uploadedFiles}/${totalFiles}`
        const percentText = `当前文件上传百分比：${currentFilePercent.toFixed(1)}%`
        const fileText = `文件名：${currentFileName}`
        // 单行展示当前进行中的文件和进度，避免刷屏
        UploadProgress.update(`上传中 ${filesText} | ${percentText} | ${fileText}`)
        lastLoggedFile = currentFileName
      }

      // 使用更简单的并发控制方式
      if (concurrency <= 1) {
        // 串行上传
        for (const fileInfo of queue) {
          currentFileName = fileInfo.local
          currentFilePercent = 0
          updateProgress()
          await this.uploadFile(fileInfo.local, fileInfo.remote, percent => {
            currentFilePercent = percent
            updateProgress()
          })
          uploadedFiles++
          currentFilePercent = 100
          updateProgress()
        }
      } else {
        // 并行上传
        const results = []
        for (const fileInfo of queue) {
          const task = (async () => {
            currentFileName = fileInfo.local
            currentFilePercent = 0
            updateProgress()
            await this.uploadFile(fileInfo.local, fileInfo.remote, percent => {
              currentFilePercent = percent
              updateProgress()
            })
            uploadedFiles++
            currentFilePercent = 100
            updateProgress()
          })().catch(error => {
            console.log(chalk.red(`❌ 文件上传失败: ${fileInfo.local}`))
            throw error
          })

          results.push(task)

          // 当达到并发限制时，等待所有任务完成
          if (results.length >= concurrency) {
            await Promise.all(results)
            results.length = 0
          }
        }

        // 等待剩余任务完成
        if (results.length > 0) {
          await Promise.all(results)
        }
      }
    }

    try {
      collectFiles(localPath, remotePath)
      await createRemoteDirs()
      await uploadFilesInParallel()

      UploadProgress.stop(chalk.green(`✅ 目录上传完成，共上传 ${uploadedFiles} 个文件`))
    } catch (error) {
      UploadProgress.stop(chalk.red('❌ 目录上传失败'))
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
