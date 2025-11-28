// src/utils/config.ts
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { dirname, extname, join, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { EnvironmentConfig } from '../types/config'
import chalk from 'chalk'

/**
 * 配置管理器类
 * 职责：加载、验证、管理部署配置
 */
export class ConfigManager {
  // 配置文件地址
  private _settingPath = join(this.RootPath, 'setting.json')

  /**
   * 包路径
   */
  public get RootPath() {
    // 基于当前文件位置计算
    const __filename = fileURLToPath(import.meta.url)

    const __dirname = dirname(__filename)

    // 直接返回 dist 的父级（包根目录）
    return resolve(__dirname, '../../')
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
        console.log(`\r找到配置文件: ${fullPath}`)
        return fullPath
      }
    }
    return null
  }

  /**
   * 加载配置
   */
  public async loadConfig(model?: string): Promise<Array<EnvironmentConfig> | void> {
    const fileUrl = pathToFileURL(resolve(this._settingPath)).href
    // 获取保存的配置路径
    const setting = await import(fileUrl)
    const setting_info = setting.default || setting
    const deploy_path = setting_info.config_path
    const configPath = this.findConfigFile(deploy_path) || ''
    if (!configPath) return console.log(chalk.red('\r未找到配置文件'))

    const config = await this.loadConfigFile(configPath, model)
    // 验证配置
    this.validateConfig(config)

    return config
  }

  /**
   * 加载具体的配置文件
   */
  private async loadConfigFile(configPath: string, model?: string): Promise<Array<EnvironmentConfig>> {
    const ext = extname(configPath)
    if (ext === '.js') {
      const fileUrl = pathToFileURL(resolve(configPath)).href
      const importedModule = await import(fileUrl)
      const data = importedModule.default || importedModule
      const ls: Array<EnvironmentConfig> = data.filter((v: EnvironmentConfig) => (model ? v.name == model : v.name))
      return ls
    } else {
      throw new Error(chalk.red(`不支持的配置文件格式: ${ext}`))
    }
  }

  /**
   * 验证配置是否完整
   */
  private validateConfig(config: Array<EnvironmentConfig>): void {
    if (!config.length) throw new Error(`配置验证失败:\n- 文件内容未配置`)

    const errors: Map<string, Array<string> | []> = new Map()
    config.forEach(val => {
      const ls: Array<string> = []
      if (!val.server.host) ls.push('服务器地址 (server.host) 不能为空')
      if (!val.server.userName) ls.push('未配置登陆用户(val.server.userName)')
      if (!val.server.password && !val.server.sshKey) ls.push('未配置登陆凭证(val.server.password)|(val.server.sshKey)')
      if (!val.paths.localDist) ls.push('上传路径 (paths.localDist) 不能为空')
      if (!val.paths.remotePath) ls.push('远程路径 (paths.projectName) 不能为空')
      if (!val.paths.projectName) ls.push('远程文件夹名称 (paths.projectName) 不能为空')
      if (ls.length) errors.set(val.name, ls)
    })
    if (errors.size) {
      errors.forEach((val, key) => {
        console.log(val, key)
      })
      throw new Error(chalk.redBright(`配置验证失败:请填写必填项`))
    }
  }

  /**
   * 创建配置文件
   */
  public createdSetting(path?: string) {
    writeFileSync(this._settingPath, JSON.stringify({ config_path: path }))
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
