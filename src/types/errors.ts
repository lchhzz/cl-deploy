/**
 * 自定义错误类的基类
 */
export class BaseError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * 配置相关错误
 */
export class ConfigError extends BaseError {
  constructor(message: string, code?: string) {
    super(message, code || 'CONFIG_ERROR')
  }
}

/**
 * 验证相关错误
 */
export class ValidationError extends BaseError {
  constructor(message: string, code?: string) {
    super(message, code || 'VALIDATION_ERROR')
  }
}

/**
 * SSH连接相关错误
 */
export class SSHError extends BaseError {
  constructor(message: string, code?: string) {
    super(message, code || 'SSH_ERROR')
  }
}

/**
 * 部署相关错误
 */
export class DeployError extends BaseError {
  constructor(message: string, code?: string) {
    super(message, code || 'DEPLOY_ERROR')
  }
}

/**
 * 文件操作相关错误
 */
export class FileError extends BaseError {
  constructor(message: string, code?: string) {
    super(message, code || 'FILE_ERROR')
  }
}

/**
 * 命令执行相关错误
 */
export class CommandError extends BaseError {
  constructor(message: string, public exitCode?: number, code?: string) {
    super(message, code || 'COMMAND_ERROR')
  }
}
