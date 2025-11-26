export { SSHTool } from './utils/ssh.js'
import { Deployer } from './commands/deploy.js'
export { Deployer } from './commands/deploy.js'
import { ConfigManager } from './utils/config.js'
export { ConfigManager } from './utils/config.js'
import { CliOptions, DeployConfig } from './types/config.js'
export type { DeployConfig, ServerConfig, PathConfig, CliOptions } from './types/config.js'

/**
 * 主要的部署类 - 简化使用
 */
export class ViewDeploy {
  /**
   * 快速部署方法
   */
  static async deploy(config: DeployConfig, options: CliOptions = {}): Promise<void> {
    const deployer = new Deployer(config, options)
    await deployer.deploy()
  }

  /**
   * 从配置文件部署
   */
  static async deployFromConfig(options: CliOptions = {}): Promise<void> {
    const configManager = new ConfigManager()
    const config = await configManager.loadConfig(options)
    await ViewDeploy.deploy(config, options)
  }

  /**
   * 测试服务器连接
   */
  static async testConnection(config: DeployConfig): Promise<boolean> {
    const deployer = new Deployer(config)
    return await deployer.testConnection()
  }
}

// 默认导出
export default ViewDeploy
