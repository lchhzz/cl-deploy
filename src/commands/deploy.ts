import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { SSHTool } from '../utils/ssh.js'
import { CliOptions, DeployConfig } from '../types/config.js'

/**
 * 部署器类
 * 职责：执行具体的部署操作
 */
export class Deployer {
  private sshTool: SSHTool
  private options: CliOptions

  constructor(private config: DeployConfig, options: CliOptions = {}) {
    this.sshTool = new SSHTool(config.server)
    this.options = options
  }

  /**
   * 执行部署前命令
   */
  private async executePreDeployCommands(): Promise<void> {
    const commands = this.config.options?.preDeploy || []

    if (commands.length > 0) {
      console.log(chalk.cyan('⚡ 执行部署前命令...'))

      for (const command of commands) {
        console.log(chalk.gray(`  执行: ${command}`))

        if (!this.options.dryRun) {
          const result = await this.sshTool.executeCommand(command)
          if (!result.success) {
            console.log(chalk.yellow(`⚠️ 命令执行警告: ${result.stderr}`))
          }
        }
      }
    }
  }
  /**
   * 检查是否应该备份
   */
  private shouldBackup(): boolean {
    return this.config.options?.backup !== false && this.options.noBackup !== true
  }

  /**
   * 备份现有文件
   */
  private async backupExistingFiles(): Promise<void> {
    const remoteProjectPath = `${this.config.paths.remotePath}/${this.config.paths.projectName}`

    // 检查远程项目目录是否存在
    const exists = await this.sshTool.directoryExists(remoteProjectPath)
    if (!exists) {
      console.log(chalk.yellow('⚠️ 远程目录不存在，跳过备份'))
      return
    }

    // 生成备份名称
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = `backup-${timestamp}`

    await this.sshTool.backupDirectory(remoteProjectPath, backupName)
  }
  /**
   * 上传新文件
   */
  private async uploadNewFiles(): Promise<void> {
    console.log(chalk.cyan('⬆️  上传新文件...'))

    const { resolve } = await import('path')
    const localPath = resolve(process.cwd(), this.config.paths.localDist)
    const remotePath = `${this.config.paths.remotePath}/${this.config.paths.projectName}`

    if (this.options.dryRun) {
      console.log(chalk.yellow('🏃 干跑模式 - 模拟上传:'))
      console.log(chalk.gray(`  从: ${localPath}`))
      console.log(chalk.gray(`  到: ${remotePath}`))
      return
    }

    // 确保远程目录存在
    if (!(await this.sshTool.directoryExists(remotePath))) {
      await this.sshTool.createDirectory(remotePath)
    }

    // 上传整个目录
    await this.sshTool.uploadDirectory(localPath, remotePath)
  }
  /**
   * 执行部署后命令
   */
  private async executePostDeployCommands(): Promise<void> {
    const commands = this.config.options?.postDeploy || []

    if (commands.length > 0) {
      console.log(chalk.cyan('⚡ 执行部署后命令...'))

      for (const command of commands) {
        console.log(chalk.gray(`  执行: ${command}`))

        if (!this.options.dryRun) {
          const result = await this.sshTool.executeCommand(command)
          if (!result.success) {
            console.log(chalk.yellow(`⚠️ 命令执行警告: ${result.stderr}`))
          }
        }
      }
    }
  }
  /**
   * 完成部署
   */
  private async completeDeployment(): Promise<void> {
    console.log(chalk.gray('='.repeat(50)))

    if (this.options.dryRun) {
      console.log(chalk.green('🎯 干跑模式完成 - 所有操作已模拟'))
    } else {
      console.log(chalk.green('🎉 部署完成！'))
      console.log(chalk.blue(`🌐 访问地址: http://${this.config.server.host}/${this.config.paths.projectName}/`))
    }
  }

  /**
   * 处理部署错误
   */
  private async handleDeploymentError(error: any): Promise<void> {
    console.log(chalk.red('❌ 部署失败:'), error.message)

    if (this.options.verbose) {
      console.log(chalk.gray('错误详情:'))
      console.log(chalk.gray(error.stack))
    }

    throw error // 重新抛出错误，让上层处理
  }

  /**
   * 测试 SSH 连接
   */
  public async testConnection(): Promise<boolean> {
    return await this.sshTool.testConnection()
  }
  /**
   * 执行部署
   */
  public async deploy(): Promise<void> {
    try {
      console.log(chalk.blue('🚀 开始部署流程...'))
      console.log(chalk.gray('='.repeat(50)))

      // 1. 验证准备
      await this.validatePreparation()

      // 2. 建立 SSH 连接
      await this.sshTool.connect()

      // 3. 执行部署前命令
      await this.executePreDeployCommands()

      // 4. 备份现有文件（如果启用）
      if (this.shouldBackup()) {
        await this.backupExistingFiles()
      }

      // 5. 上传新文件
      await this.uploadNewFiles()

      // 6. 执行部署后命令
      await this.executePostDeployCommands()

      // 7. 完成部署
      await this.completeDeployment()
    } catch (error) {
      await this.handleDeploymentError(error)
    } finally {
      // 确保关闭连接
      this.sshTool.disconnect()
    }
  }

  /**
   * 验证部署准备
   * 验证编译文件是否存在
   */
  private async validatePreparation(): Promise<void> {
    console.log('🔍 验证部署准备...')
    // 检查本地目录是否存在
    const localPath = path.resolve(process.cwd(), this.config.paths.localDist)
    if (!fs.existsSync(localPath)) {
      throw new Error(`本地目录不存在: ${localPath}`)
    }

    // 检查目录是否为空
    const files = fs.readdirSync(localPath)
    if (files.length === 0) {
      throw new Error(`本地目录为空: ${localPath}`)
    }
    console.log('✅ 验证通过')
  }

  /**
   * 模拟延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
