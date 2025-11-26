// src/types/config.ts

/**
 * 服务器配置接口
 */
export interface ServerConfig {
  /** 服务器地址 */
  host: string
  /** SSH 端口，默认 22 */
  port?: number
  /** 登陆信息 环境变量 格式为 userName\password */
  sshInfo: string
  /** 可选：使用密钥认证 有密钥不使用 sshInfo */
  sshKey?: string
}

/**
 * 路径配置接口
 */
export interface PathConfig {
  /** 本地路径 */
  localDist: string
  /** 上传路径 */
  remotePath: string
  /** 上传文件夹 */
  projectName: string
  /** 红绿模式切换文件夹 默认：old_{projectName} */
  oldName: string
}

/**
 * 部署选项接口
 */
export interface DeployOptions {
  /** 是否启用备份 */
  backup: boolean
  /** 是否跳过备份（红绿模式） */
  noBackup?: boolean
}

/**
 * 环境配置接口
 */
export interface EnvironmentConfig {
  /** 环境名称 */
  name: string
  /** 服务器配置 */
  server: ServerConfig
  /** 路径配置 */
  paths: PathConfig
  /** 部署选项 */
  options: DeployOptions
}

export interface handleInitOptions {
  // 指定相对于项目的生成配置文件路径
  path?: string
}
export interface handleDeployOptions {
  /**
   * 不传为全部执行
   * 使用指定{name}的配置
   */
  model?: string
}
