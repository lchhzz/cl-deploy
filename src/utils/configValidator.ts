import { EnvironmentConfig, ServerConfig, PathConfig, DeployOptions } from '../types/config.js'
import { ConfigError, ValidationError } from '../types/errors.js'

/**
 * 配置验证工具类
 * 职责：验证部署配置的完整性和正确性
 */
export class ConfigValidator {
  /**
   * 验证完整的环境配置
   * @param config 环境配置
   * @returns 验证通过的配置
   */
  static validateEnvironmentConfig(config: EnvironmentConfig): EnvironmentConfig {
    if (!config) {
      throw new ConfigError('配置对象不能为空', 'CONFIG_EMPTY')
    }

    // 验证环境名称
    if (!config.name || typeof config.name !== 'string') {
      throw new ValidationError('环境名称必须是有效的字符串', 'CONFIG_NAME_INVALID')
    }

    // 验证服务器配置
    this.validateServerConfig(config.server)

    // 验证路径配置
    this.validatePathConfig(config.paths)

    // 验证部署选项
    this.validateDeployOptions(config.options)

    return config
  }

  /**
   * 验证服务器配置
   * @param serverConfig 服务器配置
   */
  static validateServerConfig(serverConfig: ServerConfig): void {
    if (!serverConfig) {
      throw new ValidationError('服务器配置不能为空', 'SERVER_CONFIG_EMPTY')
    }

    // 验证主机地址
    if (!serverConfig.host || typeof serverConfig.host !== 'string') {
      throw new ValidationError('服务器地址必须是有效的字符串', 'SERVER_HOST_INVALID')
    }

    // 验证端口号
    if (serverConfig.port !== undefined) {
      if (typeof serverConfig.port !== 'number' || serverConfig.port < 1 || serverConfig.port > 65535) {
        throw new ValidationError('服务器端口必须是1-65535之间的数字', 'SERVER_PORT_INVALID')
      }
    }

    // 验证用户名
    if (!serverConfig.userName || typeof serverConfig.userName !== 'string') {
      throw new ValidationError('服务器用户名必须是有效的字符串', 'SERVER_USER_INVALID')
    }

    // 验证认证方式：必须提供密码或密钥之一
    if (!serverConfig.password && !serverConfig.sshKey) {
      throw new ValidationError('必须提供密码或SSH密钥进行认证', 'SERVER_AUTH_MISSING')
    }

    // 验证SSH密钥格式
    if (serverConfig.sshKey && typeof serverConfig.sshKey !== 'string') {
      throw new ValidationError('SSH密钥必须是有效的字符串', 'SERVER_SSH_KEY_INVALID')
    }
  }

  /**
   * 验证路径配置
   * @param pathConfig 路径配置
   */
  static validatePathConfig(pathConfig: PathConfig): void {
    if (!pathConfig) {
      throw new ValidationError('路径配置不能为空', 'PATH_CONFIG_EMPTY')
    }

    // 验证本地路径
    if (!pathConfig.localDist || typeof pathConfig.localDist !== 'string') {
      throw new ValidationError('本地构建目录路径必须是有效的字符串', 'PATH_LOCAL_INVALID')
    }

    // 验证远程路径
    if (!pathConfig.remotePath || typeof pathConfig.remotePath !== 'string') {
      throw new ValidationError('远程部署路径必须是有效的字符串', 'PATH_REMOTE_INVALID')
    }

    // 验证项目名称
    if (!pathConfig.projectName || typeof pathConfig.projectName !== 'string') {
      throw new ValidationError('项目名称必须是有效的字符串', 'PATH_PROJECT_NAME_INVALID')
    }
  }

  /**
   * 验证部署选项
   * @param deployOptions 部署选项
   */
  static validateDeployOptions(deployOptions: DeployOptions): void {
    if (!deployOptions) {
      throw new ValidationError('部署选项不能为空', 'OPTIONS_CONFIG_EMPTY')
    }

    // 验证预部署命令
    if (deployOptions.preDeploy && !Array.isArray(deployOptions.preDeploy)) {
      throw new ValidationError('预部署命令必须是字符串数组', 'OPTIONS_PRE_DEPLOY_INVALID')
    }

    // 验证部署后命令
    if (deployOptions.postDeploy && !Array.isArray(deployOptions.postDeploy)) {
      throw new ValidationError('部署后命令必须是字符串数组', 'OPTIONS_POST_DEPLOY_INVALID')
    }

    // 验证备份选项
    if (deployOptions.backup !== undefined && typeof deployOptions.backup !== 'boolean') {
      throw new ValidationError('备份选项必须是布尔值', 'OPTIONS_BACKUP_INVALID')
    }

    // 验证红绿模式选项
    if (deployOptions.dichromatic !== undefined && typeof deployOptions.dichromatic !== 'boolean') {
      throw new ValidationError('红绿模式选项必须是布尔值', 'OPTIONS_DICHROMATIC_INVALID')
    }
  }

  /**
   * 验证多个环境配置
   * @param configs 环境配置数组
   * @returns 验证通过的配置数组
   */
  static validateEnvironmentConfigs(configs: EnvironmentConfig[]): EnvironmentConfig[] {
    if (!Array.isArray(configs)) {
      throw new ConfigError('配置必须是数组格式', 'CONFIGS_NOT_ARRAY')
    }

    if (configs.length === 0) {
      throw new ConfigError('至少需要一个环境配置', 'CONFIGS_EMPTY')
    }

    // 验证每个环境配置
    const validatedConfigs = configs.map(config => this.validateEnvironmentConfig(config))

    // 检查环境名称唯一性
    const environmentNames = validatedConfigs.map(config => config.name)
    const uniqueNames = new Set(environmentNames)
    if (environmentNames.length !== uniqueNames.size) {
      throw new ValidationError('环境名称必须唯一', 'CONFIG_NAMES_DUPLICATE')
    }

    return validatedConfigs
  }
}
