// src/utils/config.ts
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { dirname, extname, join, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { EnvironmentConfig } from '../types/config'
import chalk from 'chalk'
import { tmpdir } from 'os'
import { ConfigValidator } from './configValidator.js'
import { ConfigError, ValidationError } from '../types/errors.js'
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
    try {
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)

      // 检查是否是打包后的环境
      const possiblePaths = [
        resolve(__dirname, '../../'), // 默认情况
        resolve(__dirname, '../'), // 其他可能的结构
        __dirname // 当前目录
      ]

      for (const path of possiblePaths) {
        if (existsSync(resolve(path, 'package.json'))) {
          return path
        }
      }

      // 回退方案
      return resolve(__dirname, '../../')
    } catch (error) {
      console.warn('无法自动检测包路径，使用回退方案')
      return process.cwd() // 返回当前工作目录
    }
  }

  /**
   * 查找配置文件
   */
  private findConfigFile(cwd: string = join(process.cwd(), 'deploy')): string | null {
    // 配置文件的查找优先级
    const configFiles = ['deploy.config.js', 'deploy.config.ts']
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
    let deploy_path
    if (existsSync(this._settingPath)) {
      const fileUrl = pathToFileURL(resolve(this._settingPath)).href

      const setting = JSON.parse(readFileSync(new URL(fileUrl), 'utf8'))
      const setting_info = setting.default || setting

      deploy_path = setting_info.config_path
    }

    const configPath = this.findConfigFile(deploy_path) || ''

    if (!configPath) throw new Error(chalk.red('\r未找到配置文件'))
    // 加载配置
    const config = await this.loadConfigFile(configPath, model)
    // 验证配置
    this.validateConfig(config)

    return config
  }
  async loadTSConfig(filePath: string) {
    const content = readFileSync(filePath, 'utf8')
    // 简单移除 TypeScript 语法
    const jsCode = content
      // 移除 import type 行
      .replace(/import\s+type\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*/g, '')

      // 移除类型注解
      .replace(/\:\s*Array\<[^>]+\>/g, '')

      // 转换导出
      .replace(/export\s+default\s+config/, 'module.exports = config')

      // 清理多余空行
      .replace(/\n\s*\n/g, '\n')
    // 创建临时文件
    const tempFile = join(tmpdir(), `temp-config-${Date.now()}.js`)

    writeFileSync(tempFile, jsCode, 'utf8')

    try {
      const fileUrl = pathToFileURL(tempFile).href

      const module = await import(fileUrl)
      return module.default || module
    } finally {
      try {
        unlinkSync(tempFile)
      } catch {}
    }
  }
  /**
   * 加载具体的配置文件
   */
  private async loadConfigFile(configPath: string, model?: string): Promise<Array<EnvironmentConfig>> {
    const ext = extname(configPath)
    const fileUrl = pathToFileURL(resolve(configPath)).href
    let data = []
    if (ext === '.js') {
      const importedModule = await import(fileUrl)
      data = importedModule.default || importedModule
    } else if (ext === '.ts') {
      data = await this.loadTSConfig(configPath)
    } else {
      throw new Error(chalk.red(`不支持的配置文件格式: ${ext}`))
    }

    const ls: Array<EnvironmentConfig> = data.filter((v: EnvironmentConfig) => (model ? v.name == model : v.name))
    return ls
  }

  /**
   * 验证配置是否完整
   */
  private validateConfig(config: Array<EnvironmentConfig>): void {
    try {
      ConfigValidator.validateEnvironmentConfigs(config)
      console.log(chalk.green('✅ 配置验证通过'))
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConfigError) {
        console.log(chalk.red(`❌ 配置验证失败: ${error.message}`))
        if (process.env.DEBUG && error.stack) {
          console.log(chalk.gray(`错误详情: ${error.stack}`))
        }
        throw error
      }
      throw new ConfigError('配置验证失败', 'CONFIG_VALIDATION_ERROR')
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
    const properties = key.split('.')
    let result = data
    for (const prop of properties) {
      if (result && typeof result === 'object' && prop in result) result = result[prop]
    }
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

  public getFile() {}
}
