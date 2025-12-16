export class IntelligentCommandConverter {
  /**
   * 智能转换命令（自动检测源命令类型）
   */
  static convertCommand(command: string, targetType?: 'windows' | 'unix'): string {
    // 已经是 PowerShell 包装且目标为 windows 时，直接返回，避免重复包装
    if (targetType === 'windows' && /^powershell\s+-Command/i.test(command.trim())) {
      return command
    }

    // 检测命令类型
    const sourceType = this.detectCommandType(command)

    // 如果是目标类型，直接返回
    if (sourceType === targetType || !targetType) {
      return command
    }

    // 转换命令
    return this.convertCommandByType(command, sourceType, targetType)
  }

  /**
   * 检测命令类型
   */
  private static detectCommandType(command: string): 'windows' | 'unix' {
    const unixIndicators = [/^ls\b/, /^cd\b/, /^pwd\b/, /^mkdir\b/, /^rm\b/, /^cp\b/, /^mv\b/, /^cat\b/, /^grep\b/, /^find\b/, /^chmod\b/, /^chown\b/, /^sudo\b/, /^uname\b/, /^df\b/, /^free\b/, /^ps\b/, /^systemctl\b/, /^service\b/, /^ip\b/, /^ss\b/]

    const windowsIndicators = [
      /^powershell\s+-Command/i,
      /^Get-/,
      /^Set-/,
      /^New-/,
      /^Remove-/,
      /^Rename-/,
      /^Copy-/,
      /^Move-/,
      /^Test-/,
      /^Start-/,
      /^Stop-/,
      /^Restart-/,
      /^Import-/,
      /^Export-/,
      /^Write-/,
      /^Read-/,
      /^Select-/
    ]

    for (const indicator of unixIndicators) {
      if (indicator.test(command)) return 'unix'
    }

    for (const indicator of windowsIndicators) {
      if (indicator.test(command)) return 'windows'
    }

    // 默认假设为 Unix
    return 'unix'
  }

  /**
   * 按类型转换命令
   */
  private static convertCommandByType(command: string, sourceType: 'windows' | 'unix', targetType: 'windows' | 'unix'): string {
    if (sourceType === 'unix' && targetType === 'windows') {
      return this.unixToWindows(command)
    } else if (sourceType === 'windows' && targetType === 'unix') {
      return this.windowsToUnix(command)
    }
    return command
  }

  /**
   * Unix → Windows 转换
   */
  private static unixToWindows(unixCommand: string): string {
    let converted = unixCommand

    // 基本命令转换
    const conversions = [
      // 文件操作
      { regex: /^ls\s+(-[la]*)?\s*(\S*)/, replace: 'Get-ChildItem $2 | Format-Table Name,Length,LastWriteTime -AutoSize' },
      { regex: /^pwd/, replace: 'Get-Location' },
      { regex: /^mkdir\s+-p\s+(\S+)/, replace: 'New-Item -ItemType Directory -Force -Path "$1"' },
      { regex: /^mkdir\s+(\S+)/, replace: 'New-Item -ItemType Directory -Path "$1"' },
      { regex: /^rm\s+-rf\s+(\S+)/, replace: 'Remove-Item -Recurse -Force -Path "$1"' },
      { regex: /^rm\s+(\S+)/, replace: 'Remove-Item -Path "$1"' },
      { regex: /^cp\s+-r\s+(\S+)\s+(\S+)/, replace: 'Copy-Item -Recurse -Path "$1" -Destination "$2"' },
      { regex: /^cp\s+(\S+)\s+(\S+)/, replace: 'Copy-Item -Path "$1" -Destination "$2"' },
      { regex: /^mv\s+(\S+)\s+(\S+)/, replace: 'Move-Item -Path "$1" -Destination "$2"' },
      { regex: /^cat\s+(\S+)/, replace: 'Get-Content -Path "$1"' },

      // 系统信息
      { regex: /^uname\s+-a/, replace: 'systeminfo | Select-String "OS Name","OS Version"' },
      { regex: /^df\s+-h/, replace: 'Get-PSDrive C | Format-List Used,Free,Size' },
      { regex: /^ps\s+aux/, replace: 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 10' },

      // 查找
      { regex: /^find\s+\.\s+-name\s+['"]([^'"]+)['"]/, replace: 'Get-ChildItem -Recurse -Filter "$1"' },
      { regex: /^grep\s+(-[riv]*)?\s*['"]([^'"]+)['"]\s+(\S+)/, replace: 'Select-String -Pattern "$2" -Path "$3"' }
    ]

    for (const conversion of conversions) {
      if (conversion.regex.test(converted)) {
        converted = converted.replace(conversion.regex, conversion.replace)
        break
      }
    }

    // 路径转换
    converted = converted.replace(/\/([a-zA-Z])[/\\]/g, '$1:\\')
    converted = converted.replace(/\//g, '\\')

    // 转义PowerShell命令中的特殊字符
    const escapedCommand = converted.replace(/["`\$]/g, '`$&')
    return `powershell -Command "${escapedCommand}"`
  }

  /**
   * Windows → Unix 转换
   */
  private static windowsToUnix(windowsCommand: string): string {
    let converted = windowsCommand

    // 移除 PowerShell 包装
    if (converted.startsWith('powershell -Command')) {
      converted = converted.replace(/^powershell\s+-Command\s+["']?/, '').replace(/["']?$/, '')
    }

    // 基本命令转换
    const conversions = [
      // 文件操作
      { regex: /Get-ChildItem/, replace: 'ls -la' },
      { regex: /Get-Location/, replace: 'pwd' },
      { regex: /New-Item\s+-ItemType\s+Directory\s+-Force\s+-Path\s+(\S+)/, replace: 'mkdir -p $1' },
      { regex: /Remove-Item\s+-Recurse\s+-Force\s+-Path\s+(\S+)/, replace: 'rm -rf $1' },
      { regex: /Copy-Item\s+-Recurse\s+-Path\s+(\S+)\s+-Destination\s+(\S+)/, replace: 'cp -r $1 $2' },
      { regex: /Move-Item\s+-Path\s+(\S+)\s+-Destination\s+(\S+)/, replace: 'mv $1 $2' },
      { regex: /Get-Content\s+-Path\s+(\S+)/, replace: 'cat $1' },
      { regex: /Test-Path\s+(\S+)/, replace: 'test -e $1' },

      // 系统信息
      { regex: /Get-Process/, replace: 'ps aux' },
      { regex: /Get-Service/, replace: 'systemctl list-units --type=service' }
    ]

    for (const conversion of conversions) {
      converted = converted.replace(conversion.regex, conversion.replace)
    }

    // 路径转换
    converted = converted.replace(/([a-zA-Z]):\\/g, '/$1/')
    converted = converted.replace(/\\/g, '/')

    return converted
  }
}
