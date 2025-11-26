#!/usr/bin/env node

import chalk from 'chalk'
import { Command } from 'commander'
import { ConfigManager } from './utils/config.js'
import { Deployer } from './index.js'
import { ProgressIndicator } from './utils/progress.js'
import { dirname, join, resolve } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import inquirer from 'inquirer'
import { fileURLToPath } from 'url'
import { handleDeployOptions, handleInitOptions } from './types/config.js'
//通用方法实例
const configManager = new ConfigManager()
// 进度实例
const progress = new ProgressIndicator()
/**
 * 主 CLI 类
 * 职责：处理命令行参数，调用相应的功能
 */
class ViewDeployCLI {
  private program: Command

  constructor() {
    this.program = new Command()
    this.setupCLI()
  }

  /**
   * 设置 CLI 命令和选项
   */
  private setupCLI(): void {
    // 基础信息
    this.program.name('view-deploy').description('🚀 前端项目 SSH 部署工具').version('1.0.0')

    // deploy 命令 - 执行部署
    this.program.command('deploy').description('执行部署操作').option('-m, --model <model>', '部署模式', 'dev').option('-c, --config <path>', '配置文件路径').option('--dry-run', '干跑模式（只显示将要执行的操作，不实际执行）').action(this.handleDeploy.bind(this))

    // init 命令 - 创建配置文件模板
    this.program.command('init').description('创建配置文件模板').option('-p, --path <path>', '部署模式', 'deploy').action(this.handleInit.bind(this))

    // test 命令 - 测试连接
    this.program.command('test').description('测试服务器连接').option('-e, --model <model>', '环境名称', 'dev').action(this.handleTest.bind(this))

    // 默认命令（当没有提供子命令时）
    this.program.action(() => {
      console.log(chalk.blue('📦 @cl/view-deploy'))
      console.log('使用 --help 查看可用命令')
      this.program.outputHelp()
    })
  }

  /**
   * 处理部署命令
   */
  private async handleDeploy(options: handleDeployOptions): Promise<void> {
    console.log(options, 'optionsoptionsoptions')

    try {
      // 显示选项信息
      this.displayOptions(options)

      progress.start('加载配置...')

      const config = await configManager.loadConfig(options.model)

      progress.stop(true, '配置加载完成')

      // 显示配置信息
      this.displayConfigInfo(config)

      // 确认部署（除非是干跑模式）
      if (!options.dryRun) {
        const confirmed = await this.confirmDeployment(config)
        if (!confirmed) {
          console.log(chalk.yellow('❌ 部署已取消'))
          return
        }
      }

      // 执行部署
      const deployer = new Deployer(config, options)
      await deployer.deploy()
    } catch (error: any) {
      this.handleError(error)
    }
  }

  /**
   * 初始化命令  生成配置文件
   */
  private async handleInit(options: handleInitOptions): Promise<void> {
    console.log(configManager.RootPath, 'RootPath')
    const configPath = options.path ? resolve(process.cwd(), options.path) : join(process.cwd(), 'deploy.config.js')
    const deployDir = dirname(configPath)
    progress.start(chalk.blue('初始化配置...🎯 文件路径:' + deployDir))
    try {
      const configPath = join(deployDir, 'deploy.config.js')
      // 检查文件是否已存在
      if (existsSync(configPath)) {
        progress.stop()
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: '配置文件已存在，是否覆盖？',
            default: false
          }
        ])
        if (!answers.overwrite) return progress.stop(chalk.yellow('取消配置文件生成...'))
        progress.start(chalk.blue('🔄 覆盖配置文件...'))
      }
      // 检查并创建 deploy 文件夹p
      if (!existsSync(deployDir)) mkdirSync(deployDir, { recursive: true })

      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      // 模板文件路径
      const templatePath = join(__dirname, 'deploy.config.js')
      const templateContent = readFileSync(templatePath, 'utf-8')
      // 写入配置文件
      writeFileSync(configPath, templateContent, 'utf-8')
      progress.stop(chalk.green(`✅ 配置文件已创建: ${configPath}`))
    } catch (error: any) {
      this.handleError(error)
      progress.stop(chalk.red('配置生成失败'))
    }
  }

  /**
   * 处理测试命令
   */
  // 更新测试命令
  private async handleTest(options: CliOptions): Promise<void> {
    try {
      console.log(chalk.blue('🧪 测试服务器连接...'))

      const configManager = new ConfigManager()
      const config = await configManager.loadConfig(options)

      console.log(chalk.cyan('🔗 测试连接中...'))

      const deployer = new Deployer(config, options)
      const success = await deployer.testConnection()

      if (success) {
        console.log(chalk.green('✅ 服务器连接测试成功'))
      } else {
        console.log(chalk.red('❌ 服务器连接测试失败'))
        process.exit(1)
      }
    } catch (error: any) {
      this.handleError(error)
    }
  }

  /**
   * 显示命令行选项
   */
  private displayOptions(options: CliOptions): void {
    console.log(chalk.cyan('⚙️  命令行选项:'))
    console.log(`  环境: ${chalk.white(options.env || 'default')}`)
    console.log(`  配置文件: ${chalk.white(options.config || '自动检测')}`)
    console.log(`  干跑模式: ${chalk.white(options.dryRun ? '是' : '否')}`)
    console.log(`  跳过备份: ${chalk.white(options.noBackup ? '是' : '否')}`)
    console.log(chalk.gray('-'.repeat(30)))
  }

  /**
   * 显示配置信息
   */
  private displayConfigInfo(config: any): void {
    console.log(chalk.cyan('📋 部署配置:'))
    console.log(`  服务器: ${chalk.white(config.server.host)}`)
    console.log(`  项目: ${chalk.white(config.paths.projectName)}`)
    console.log(`  远程路径: ${chalk.white(config.paths.remotePath)}`)
    console.log(chalk.gray('-'.repeat(30)))
  }

  /**
   * 确认部署操作
   */
  private async confirmDeployment(config: any): Promise<boolean> {
    try {
      const { default: inquirer } = await import('inquirer')

      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `确认部署到 ${chalk.yellow(config.server.host)}？`,
          default: false
        }
      ])

      return answers.confirm
    } catch (error) {
      // 如果 inquirer 不可用，使用简单的确认方式
      console.log(chalk.yellow('⚠️  请输入 "yes" 确认部署:'))

      const readline = (await import('readline')).createInterface({
        input: process.stdin,
        output: process.stdout
      })

      return new Promise(resolve => {
        readline.question('', answer => {
          readline.close()
          resolve(answer.toLowerCase() === 'yes')
        })
      })
    }
  }

  /**
   * 统一错误处理
   */
  private handleError(error: any): void {
    console.log(chalk.red('❌ 错误:'), error.message)

    // 如果是配置文件相关的错误，给出提示
    if (error.message.includes('未找到配置文件')) {
      console.log(chalk.yellow('💡 提示: 运行 view-deploy init 创建配置文件'))
    }

    if (error.message.includes('配置验证失败')) {
      console.log(chalk.yellow('💡 提示: 请检查配置文件中的必填字段'))
    }

    // 调试模式显示详细错误
    if (process.env.DEBUG) {
      console.log(chalk.gray(error.stack))
    }

    process.exit(1)
  }

  /**
   * 启动 CLI
   */
  public run(): void {
    this.program.parse()
  }
}

// 创建并运行 CLI
const cli = new ViewDeployCLI()
cli.run()
