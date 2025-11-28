#!/usr/bin/env node

import chalk from 'chalk'
import { Command } from 'commander'
import { ConfigManager } from './utils/config.js'
import { Deployer } from './index.js'
import { join, resolve } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import inquirer from 'inquirer'
import { EnvironmentConfig, handleInitOptions, OptionsModel } from './types/config.js'
import { ProgressIndicator } from './utils/progress.js'
const progress = new ProgressIndicator()
//通用方法实例
const configManager = new ConfigManager()
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

    // init 命令 - 创建配置文件模板
    this.program.command('init').description('创建配置文件模板').option('-p, --path <path>', '配置文件位置', 'deploy').option('-t, --type <type>', '配置文件类型', 'ts').action(this.handleInit.bind(this))

    // deploy 命令 - 执行部署
    this.program.command('deploy').description('执行部署操作').option('-m, --model <model>', '部署模式', 'development').action(this.handleDeploy.bind(this))

    // test 命令 - 测试连接
    this.program.command('test').description('测试服务器连接').option('-e, --model <model>', '环境名称', 'development').action(this.handleTest.bind(this))

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
  private async handleDeploy(options: OptionsModel): Promise<void> {
    try {
      progress.start('加载配置...')
      const config: Array<EnvironmentConfig> | void = await configManager.loadConfig(options.model)
      if (!config) return
      progress.stop('配置加载完成...')

      for (const setting of config) {
        // 显示配置信息
        this.displayConfigInfo(setting)
        // 确认
        const confirmed = await this.confirmDeployment(config)
        if (!confirmed) {
          console.log(chalk.yellow('❌ 部署已取消'))
          return
        }
        // 执行部署
        const deployer = new Deployer(setting)
        await deployer.deploy()
      }
    } catch (error: any) {
      this.handleError(error)
    }
  }

  /**
   * 初始化命令 生成配置文件
   */
  private async handleInit(options: handleInitOptions): Promise<void> {
    // 目标文件夹
    const configPath = options.path ? resolve(process.cwd(), options.path) : join(process.cwd(), 'deploy')
    const configFile = join(configPath, 'deploy.config.' + options.type)

    progress.start(chalk.blue('初始化配置...🎯 文件路径:' + configFile))
    try {
      // 检查文件是否已存在
      if (existsSync(configFile)) {
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

      // 检查并创建 deploy 文件夹
      if (!existsSync(configPath)) mkdirSync(configPath, { recursive: true })

      // 模板文件路径
      // 写入配置文件
      console.log(configManager.RootPath, 'configManager.RootPath')

      let temp = readFileSync(join(configManager.RootPath, 'deploy.config.ts'), 'utf-8')

      if (options.type == 'js') {
        const tempJs = temp.replace(': Array<EnvironmentConfig>', '').replace("import { EnvironmentConfig } from './types/config'", '')
        writeFileSync(configFile, tempJs, 'utf-8')
      } else {
        const tempTs = temp.replace("import { EnvironmentConfig } from './types/config'", "import type { EnvironmentConfig } from '@cl/view-deploy'")
        writeFileSync(configFile, tempTs, 'utf-8')
      }

      progress.stop(chalk.green(`✅ 配置文件已创建: ${configFile}`))
      // 保存一个路径 包使用
      configManager.createdSetting(configPath)
    } catch (error: any) {
      this.handleError(error)
      progress.stop(chalk.red('配置生成失败'))
    }
  }

  /**
   * 处理测试命令
   */
  // 更新测试命令
  private async handleTest(options: OptionsModel): Promise<void> {
    try {
      const config: Array<EnvironmentConfig> | void = await configManager.loadConfig(options.model)
      if (!config) return
      progress.stop(chalk.cyan('🔗 测试连接中...'))
      const ErrerServe: Array<string> = []
      const SuccessServe: Array<string> = []
      for (const c of config) {
        try {
          const deployer = new Deployer(c)
          const success = await deployer.testConnection()
          if (!success) {
            ErrerServe.push(c.server.host)
          } else {
            SuccessServe.push(c.server.host)
          }
        } catch (error: any) {
          ErrerServe.push(c.server.host)
        }
      }
      if (ErrerServe.length) {
        progress.stop(chalk.red('❌ 连接失败：' + ErrerServe) + '\n')
        process.exit(1)
      } else {
        progress.stop(chalk.green('✅ 连接成功：' + SuccessServe) + '\n')
      }
    } catch (error: any) {
      this.handleError(error)
    }
  }

  /**
   * 显示配置信息
   */
  private displayConfigInfo(config: EnvironmentConfig): void {
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
      console.log(chalk.yellow('⚠️  请输入 "y" 确认部署:'))

      const readline = (await import('readline')).createInterface({
        input: process.stdin,
        output: process.stdout
      })

      return new Promise(resolve => {
        readline.question('', answer => {
          readline.close()
          resolve(answer.toLowerCase() === 'y')
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
