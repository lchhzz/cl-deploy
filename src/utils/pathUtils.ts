import path from 'path'

class PathUtils {
  /**
   * 将路径转换为当前平台的格式
   */
  public static toPlatformPath(inputPath: string) {
    return inputPath.replace(/[\\/]/g, path.sep)
  }

  /**
   * 转换为 Unix 风格路径（正斜杠）
   */
  public static toUnixPath(inputPath: string) {
    return inputPath.replace(/\\/g, '/')
  }

  /**
   * 转换为 Windows 风格路径（反斜杠）
   */
  public static toWindowsPath(inputPath: string) {
    return inputPath.replace(/\//g, '\\')
  }

  /**
   * 标准化远程路径（用于 SSH 命令）
   */
  public static normalizeRemotePath(inputPath: string, isServer = 'windows') {
    let normalized = this.toUnixPath(inputPath)
    if (isServer == 'windows') {
      // 对于 Windows 服务器，确保驱动器号
      if (!normalized.includes(':')) {
        normalized = `C:${normalized}`
      }
      normalized = this.toWindowsPath(normalized)
    }

    return normalized
  }

  /**
   * 转义路径中的特殊字符（用于命令行）
   */
  public static escapePath(inputPath: string, forPowerShell = true) {
    let escaped = inputPath.replace(/'/g, "''")

    if (forPowerShell) {
      escaped = escaped.replace(/\$/g, '`$')
    }

    return escaped
  }

  /**
   * 检测路径格式
   */
  public static detectPathFormat(inputPath: string) {
    if (inputPath.includes('\\')) {
      return 'windows'
    } else if (inputPath.includes('/')) {
      return 'unix'
    } else {
      return 'unknown'
    }
  }

  /**
   * 路径连接（跨平台安全）
   */
  public static join(...paths: Array<string>) {
    return path.join(...paths.map(p => this.toPlatformPath(p)))
  }

  /**
   * 获取路径的目录名（跨平台）
   */
  public static dirname(inputPath: string) {
    return path.dirname(this.toPlatformPath(inputPath))
  }

  /**
   * 获取路径的文件名（跨平台）
   */
  public static basename(inputPath: string, ext = '') {
    return path.basename(this.toPlatformPath(inputPath), ext)
  }

  /**
   * 获取路径的扩展名（跨平台）
   */
  public static extname(inputPath: string) {
    return path.extname(this.toPlatformPath(inputPath))
  }
}
export default PathUtils
