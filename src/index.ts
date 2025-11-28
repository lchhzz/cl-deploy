export { SSHTool } from './utils/ssh.js'
import { Deployer } from './commands/deploy.js'
import { EnvironmentConfig, OptionsModel } from './types/config.js'
export { Deployer } from './commands/deploy.js'
import { ConfigManager } from './utils/config.js'
export { ConfigManager } from './utils/config.js'
export type { ServerConfig, PathConfig } from './types/config.js'

/**
 * 主要的部署类 - 简化使用
 */
export class ViewDeploy {
  /**
   * 快速部署方法
   */
  static async deploy(config: Array<EnvironmentConfig>, options: any): Promise<void> {
    for (const setting of config) {
      const deployer = new Deployer(setting)
      await deployer.deploy()
    }
  }

  /**
   * 从配置文件部署
   */
  static async deployFromConfig(options: OptionsModel): Promise<void> {
    const configManager = new ConfigManager()
    const config = await configManager.loadConfig(options.model)
    if (config) await ViewDeploy.deploy(config, options)
  }

  /**
   * 测试服务器连接
   */
  static async testConnection(config: EnvironmentConfig): Promise<boolean> {
    const deployer = new Deployer(config)
    return await deployer.testConnection()
  }
}

// 默认导出
export default ViewDeploy
