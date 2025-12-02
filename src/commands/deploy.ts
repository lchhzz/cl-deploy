import { existsSync, readdirSync } from 'fs'
import path, { join, resolve } from 'path'
import chalk from 'chalk'
import { SSHTool } from '../utils/ssh.js'
import { DeployOptions, EnvironmentConfig } from '../types/config.js'
/**
 * 部署器类
 * 职责：执行具体的部署操作
 */
export class Deployer {
  private sshTool: SSHTool
  private options: DeployOptions

  constructor(private config: EnvironmentConfig) {
    this.sshTool = new SSHTool(config.server)
    this.options = config.options
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

        const result = await this.sshTool.executeCommand(command)
        if (!result.success) {
          console.log(chalk.yellow(`⚠️ 命令执行警告: ${result.stderr}`))
        }
      }
    }
  }

  /**
   * 修改文件名称
   * @param newName 新文件夹名称
   */
  private async laterUpdate(newName: string) {
    const remotePath = this.config.paths.remotePath
    // 新文件路径
    const _newPath = join(remotePath, newName)
    // 项目文件路径
    const _projectPath = join(remotePath, this.config.paths.projectName)

    // 交替更换文件名称
    if (this.options.dichromatic) {
      // 删除原本旧目录
      await this.sshTool.delFile(join(remotePath, 'old_' + this.config.paths.projectName))
      // 原本项目修改为备份
      await this.sshTool.editDirectoryName(_projectPath, 'old_' + this.config.paths.projectName)
    }
    // 是否备份
    if (!this.options.backup) await this.sshTool.delFile(join(remotePath, 'old_' + this.config.paths.projectName))

    await this.sshTool.editDirectoryName(_newPath, this.config.paths.projectName)
  }
  /**
   * 上传新文件
   */
  private async uploadNewFiles(): Promise<void> {
    let newProjectName = ''
    // 获取交替执行的新文件夹名称
    if (this.options.dichromatic) newProjectName = 'new_' + this.config.paths.projectName

    console.log(chalk.cyan('⬆️  上传新文件...'))
    // 本地上传文件
    const localPath = resolve(process.cwd(), this.config.paths.localDist)
    // 上传路径
    const remotePath = join(this.config.paths.remotePath, newProjectName || this.config.paths.projectName)

    // 确保远程目录存在
    if (!(await this.sshTool.directoryExists(remotePath))) await this.sshTool.createDirectory(remotePath)

    // 上传整个目录
    await this.sshTool.uploadDirectory(localPath, remotePath)

    // 上传后
    await this.laterUpdate(newProjectName)
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

        const result = await this.sshTool.executeCommand(command)
        if (!result.success) {
          console.log(chalk.yellow(`⚠️ 命令执行警告: ${result.stderr}`))
        }
      }
    }
  }
  /**
   * 完成部署
   */
  private async completeDeployment(): Promise<void> {
    console.log(chalk.gray('='.repeat(50)))
    console.log(chalk.green('🎉 部署完成！'))
    console.log(chalk.blue(`🌐 访问地址: http://${this.config.server.host}/${this.config.paths.remotePath}/${this.config.paths.projectName}`))
  }

  /**
   * 重置部署
   */
  public async resetDeployment() {
    try {
      const _projectName = this.config.paths.projectName
      const fileName = join(_projectName, this.config.paths.projectName)
      await this.sshTool.delFile(fileName)
      await this.sshTool.editDirectoryName(join(_projectName, 'old_' + this.config.paths.projectName), this.config.paths.projectName)
    } catch {
      throw new Error('重置部署失败，需要手动操作')
    }
  }

  /**
   * 处理部署错误
   */
  private async handleDeploymentError(error: any): Promise<void> {
    console.log(chalk.red('❌ 部署失败:'), error.message)
    console.log(chalk.gray('错误详情:'))
    console.log(chalk.gray(error.stack))
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

      // 5. 上传文件
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

    if (!existsSync(localPath)) {
      throw new Error(`本地目录不存在: ${localPath}`)
    }

    // 检查目录是否为空
    const files = readdirSync(localPath)
    if (files.length === 0) {
      throw new Error(`本地目录为空: ${localPath}`)
    }
    console.log('✅ 验证通过')
  }
}
