// src/utils/config.ts
import { readFileSync, existsSync, writeFileSync } from 'fs'
import path, { dirname, join, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { EnvironmentConfig } from '../types/config'
import { ProgressIndicator } from './progress'
import chalk from 'chalk'

/**
 * 配置管理器类
 * 职责：加载、验证、管理部署配置
 */
export class ConfigManager {
  // 配置文件地址
  private _settingPath = join(process.cwd(), 'setting.json')


  /**
   * 包路径
   */
  public get RootPath() {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    // src/utils -> 包根目录
    return resolve(__dirname, '..', '..')
  }


  /**
   * 查找配置文件
   * 支持多种配置文件格式和位置
   */
  private findConfigFile(cwd: string = process.cwd()): string | null {
    // 配置文件的查找优先级
    const configFiles = ['deploy.config.js']
    for (const configFile of configFiles) {
      const fullPath = join(cwd, configFile)
      if (existsSync(fullPath)) {
        console.log(`找到配置文件: ${fullPath}`)
        return fullPath
      }
    }
    return null
  }

  /**
   * 加载配置
   */
  public async loadConfig(model?: string): Promise<any> {
    // 自动查找配置文件路径
    const configPath = this.findConfigFile() || ''
    if (!configPath) return console.log(chalk.red('未找到配置文件'))

    // 加载配置文件内容
    const config = await this.loadConfigFile(configPath, model)

    // 验证配置
    this.validateConfig(config)

    return config
  }

  /**
   * 加载具体的配置文件
   */
  private async loadConfigFile(configPath: string, env?: string): Promise<EnvironmentConfig | void> {
    const ext = path.extname(configPath)
    if (ext === '.js') {
      const fileUrl = pathToFileURL(resolve(configPath)).href
      const importedModule = await import(fileUrl)
      console.log(importedModule, 'importedModuleimportedModuleimportedModule')

      return importedModule.default || importedModule
    } else {
      return console.log(chalk.red(`不支持的配置文件格式: ${ext}`))
    }
  }

  /**
   * 验证配置是否完整
   */
  private validateConfig(config: DeployConfig): void {
    const errors: string[] = []

    if (!config.server.host) errors.push('服务器地址 (server.host) 不能为空')
    if (!config.server.username) errors.push('用户名 (server.username) 不能为空')
    if (!config.server.password) errors.push('密码 (server.password) 不能为空')
    if (!config.paths.remotePath) errors.push('远程路径 (paths.remotePath) 不能为空')
    if (!config.paths.projectName) errors.push('项目名称 (paths.projectName) 不能为空')

    if (errors.length > 0) {
      throw new Error(`配置验证失败:\n- ${errors.join('\n- ')}`)
    }
  }

  /**
   * 创建配置文件
   */
  private createdSetting() {
    if (!existsSync(this._settingPath)) writeFileSync(this._settingPath, JSON.stringify({ config_path: }))
  }

  /**
   * 获取配置文件
   * @param key 属性
   */
  public getSetting(key: string) {
    const content = readFileSync(this._settingPath, 'utf-8')
    const data = JSON.parse(content)
    // 支持点分隔的属性路径，如 'user.name'
    const properties = key.split('.')
    let result = data
    for (const prop of properties) {
      if (result && typeof result === 'object' && prop in result) result = result[prop]
    }
    console.log(result, 'result')

    return result
  }

  /**
   * 设置配置
   * @param key 属性
   */
  public setSetting(key: string) {
    // 创建配置文件
    // const content = readFileSync(this._settingPath, 'utf-8')
    // const data = JSON.parse(content)
    // console.log(data, 'data')
  }
}
