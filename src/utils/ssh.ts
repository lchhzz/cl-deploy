import chalk from 'chalk'
import { join } from 'path'
import { Client, ConnectConfig } from 'ssh2'
import { ServerConfig } from '../types/config.js'
import { createReadStream, readdirSync, statSync, existsSync } from 'fs'

/**
 * SSH 连接配置
 */
export interface SSHConnectionConfig extends ConnectConfig {
  host: string
  port?: number
  username: string
  password?: string
  hostKey?: string
  readyTimeout?: number
}

/**
 * SSH 命令执行结果
 */
export interface SSHCommandResult {
  code: number
  stdout: string
  stderr: string
  success: boolean
}

/**
 * SSH 文件传输工具类
 */
export class SSHTool {
  private client: Client
  private config: SSHConnectionConfig
  private connected: boolean = false // 重命名属性

  constructor(serverConfig: ServerConfig) {
    this.config = this.prepareSSHConfig(serverConfig)
    this.client = new Client()
  }

  /**
   * 准备 SSH 连接配置
   */
  private prepareSSHConfig(serverConfig: ServerConfig): SSHConnectionConfig {
    const config: SSHConnectionConfig = {
      host: serverConfig.host,
      port: serverConfig.port || 22,
      username: serverConfig.username,
      password: serverConfig.password,
      readyTimeout: 30000 // 30秒超时
    }

    // 添加私钥支持
    if (serverConfig.hostKey) config.hostKey = serverConfig.hostKey
    return config
  }

  /**
   * 建立 SSH 连接
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        console.log(chalk.yellow('⚠️ SSH 连接已存在'))
        resolve()
        return
      }

      console.log(chalk.blue('🔗 连接 SSH 服务器...'))
      console.log(chalk.gray(`  主机: ${this.config.host}:${this.config.port}`))
      console.log(chalk.gray(`  用户: ${this.config.username}`))

      this.client.on('ready', () => {
        this.connected = true
        console.log(chalk.green('✅ SSH 连接成功'))
        resolve()
      })

      this.client.on('error', error => {
        console.log(chalk.red('❌ SSH 连接失败:'), error.message)
        reject(new Error(`SSH 连接失败: ${error.message}`))
      })

      this.client.on('close', () => {
        this.connected = false
        console.log(chalk.yellow('🔌 SSH 连接已关闭'))
      })

      // 建立连接
      this.client.connect(this.config)
    })
  }

  /**
   * 关闭 SSH 连接
   */
  public disconnect(): void {
    if (this.connected) {
      this.client.end()
      this.connected = false
    }
  }

  /**
   * 检查连接状态
   */
  public isConnected(): boolean {
    return this.connected
  }

  /**
   * 执行远程命令
   */
  public async executeCommand(command: string): Promise<SSHCommandResult> {
    if (!this.connected) {
      throw new Error('SSH 连接未建立，请先调用 connect() 方法')
    }

    return new Promise((resolve, reject) => {
      console.log(chalk.cyan('⚡ 执行命令:'), chalk.gray(command))

      this.client.exec(command, (error, stream) => {
        if (error) {
          reject(new Error(`命令执行失败: ${error.message}`))
          return
        }

        let stdout = ''
        let stderr = ''

        stream.on('data', (data: Buffer) => {
          stdout += data.toString()
        })

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })

        stream.on('close', (code: number) => {
          const result: SSHCommandResult = {
            code,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            success: code === 0
          }

          if (code === 0) {
            console.log(chalk.green('✅ 命令执行成功'))
            if (stdout) {
              console.log(chalk.gray('  输出:'), stdout)
            }
          } else {
            console.log(chalk.yellow('⚠️ 命令执行完成，但返回非零状态码:', code))
            if (stderr) {
              console.log(chalk.red('  错误:'), stderr)
            }
          }

          resolve(result)
        })

        stream.on('error', (error: any) => {
          reject(new Error(`命令执行错误: ${error.message}`))
        })
      })
    })
  }

  /**
   * 检查远程目录是否存在
   */
  public async directoryExists(remotePath: string): Promise<boolean> {
    try {
      // 转义路径中的特殊字符
      const escapedPath = remotePath.replace(/(["$`\\])/g, '\\$1')
      const result = await this.executeCommand(`[ -d "${escapedPath}" ] && echo "exists"`)
      return result.stdout.includes('exists')
    } catch (error) {
      return false
    }
  }

  /**
   * 创建远程目录（递归创建）
   */
  public async createDirectory(remotePath: string): Promise<void> {
    console.log(chalk.blue('📁 创建远程目录:'), chalk.gray(remotePath))

    // 转义路径
    const escapedPath = remotePath.replace(/(["$`\\])/g, '\\$1')
    const result = await this.executeCommand(`mkdir -p "${escapedPath}"`)

    if (!result.success) {
      throw new Error(`创建目录失败: ${result.stderr}`)
    }

    console.log(chalk.green('✅ 目录创建成功'))
  }

  /**
   * 上传单个文件
   */
  public async uploadFile(localPath: string, remotePath: string): Promise<void> {
    if (!this.connected) {
      throw new Error('SSH 连接未建立')
    }

    if (!existsSync(localPath)) {
      throw new Error(`本地文件不存在: ${localPath}`)
    }

    console.log(chalk.blue('⬆️  上传文件:'), chalk.gray(`${localPath} → ${remotePath}`))

    return new Promise((resolve, reject) => {
      try {
        const stats = statSync(localPath)
        console.log(chalk.gray(`  文件大小: ${(stats.size / 1024).toFixed(2)} KB`))

        this.client.sftp((sftpError, sftp) => {
          if (sftpError) {
            reject(new Error(`SFTP 初始化失败: ${sftpError.message}`))
            return
          }

          const readStream = createReadStream(localPath)

          // 转义远程路径
          const escapedRemotePath = remotePath.replace(/(["$`\\])/g, '\\$1')
          const writeStream = sftp.createWriteStream(escapedRemotePath)

          let uploadedBytes = 0
          const totalBytes = stats.size

          // 进度监控
          readStream.on('data', chunk => {
            uploadedBytes += chunk.length
            if (totalBytes > 1024 * 1024) {
              const percent = ((uploadedBytes / totalBytes) * 100).toFixed(1)
              process.stdout.write(`\r📤 上传进度: ${percent}%`)
            }
          })

          writeStream.on('close', () => {
            if (totalBytes > 1024 * 1024) {
              process.stdout.write('\n')
            }
            console.log(chalk.green('✅ 文件上传成功'))
            resolve()
          })

          writeStream.on('error', (error: any) => {
            reject(new Error(`文件上传失败: ${error.message}`))
          })

          readStream.pipe(writeStream)
        })
      } catch (error: any) {
        reject(new Error(`读取本地文件失败: ${error.message}`))
      }
    })
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
    if (!(await this.directoryExists(remotePath))) {
      await this.createDirectory(remotePath)
    }

    // 统计文件数量
    const countFiles = (dir: string): number => {
      let count = 0
      const items = readdirSync(dir)

      for (const item of items) {
        const fullPath = join(dir, item)
        const stats = statSync(fullPath)

        if (stats.isFile()) {
          count++
        } else if (stats.isDirectory()) {
          count += countFiles(fullPath)
        }
      }
      return count
    }

    const totalFiles = countFiles(localPath)
    console.log(chalk.cyan(`📊 总共需要上传 ${totalFiles} 个文件`))

    let uploadedFiles = 0

    // 递归上传函数
    const uploadRecursive = async (currentLocalPath: string, currentRemotePath: string): Promise<void> => {
      const items = readdirSync(currentLocalPath)

      for (const item of items) {
        const localItemPath = join(currentLocalPath, item)
        const remoteItemPath = join(currentRemotePath, item.replace(/(["$`\\])/g, '\\$1'))
        const stats = statSync(localItemPath)

        if (stats.isFile()) {
          try {
            await this.uploadFile(localItemPath, remoteItemPath)
            uploadedFiles++
            console.log(chalk.gray(`  进度: ${uploadedFiles}/${totalFiles} 个文件`))
          } catch (error) {
            console.log(chalk.red(`❌ 文件上传失败: ${localItemPath}`))
            throw error
          }
        } else if (stats.isDirectory()) {
          // 创建远程子目录
          if (!(await this.directoryExists(remoteItemPath))) {
            await this.createDirectory(remoteItemPath)
          }
          // 递归上传子目录
          await uploadRecursive(localItemPath, remoteItemPath)
        }
      }
    }

    await uploadRecursive(localPath, remotePath)
    console.log(chalk.green(`✅ 目录上传完成，共上传 ${uploadedFiles} 个文件`))
  }

  /**
   * 备份远程目录
   */
  public async backupDirectory(remotePath: string, backupName: string = new Date().toISOString().replace(/[:.]/g, '-')): Promise<void> {
    console.log(chalk.blue('💾 创建备份...'))

    // 检查源目录是否存在
    if (!(await this.directoryExists(remotePath))) {
      console.log(chalk.yellow('⚠️ 源目录不存在，跳过备份'))
      return
    }

    const backupPath = `${remotePath}_backup_${backupName}`

    // 删除已存在的备份
    if (await this.directoryExists(backupPath)) {
      console.log(chalk.gray('  删除旧备份...'))
      await this.executeCommand(`rm -rf "${backupPath.replace(/(["$`\\])/g, '\\$1')}"`)
    }

    // 创建备份
    console.log(chalk.gray(`  备份: ${remotePath} → ${backupPath}`))
    const result = await this.executeCommand(`cp -r "${remotePath.replace(/(["$`\\])/g, '\\$1')}" "${backupPath.replace(/(["$`\\])/g, '\\$1')}"`)

    if (!result.success) {
      throw new Error(`备份创建失败: ${result.stderr}`)
    }

    console.log(chalk.green('✅ 备份创建成功'))
  }

  /**
   * 测试连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.connect()
      const result = await this.executeCommand('echo "SSH连接测试成功"')
      await this.disconnect()
      return result.success && result.stdout.includes('SSH连接测试成功')
    } catch (error) {
      return false
    }
  }

  /**
   * 安全关闭连接
   */
  public async destroy(): Promise<void> {
    if (this.connected) {
      this.disconnect()
    }
    // 可以添加其他清理逻辑
  }
}
