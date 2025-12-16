import chalk from 'chalk'

/**
 * 轻量进度指示器：单行覆盖输出，节流避免刷屏
 */
export class ProgressIndicator {
  private currentMessage = ''
  private isActive = false
  private lastUpdateTs = 0
  private readonly throttleMs = 200
  private readonly width = process.stdout.columns || 120

  /**
   * 开始显示一行进度
   */
  start(message: string = ''): void {
    this.isActive = true
    this.currentMessage = message
    this.writeLine(this.currentMessage)
    this.lastUpdateTs = Date.now()
  }

  /**
   * 更新进度消息（单行覆盖，节流）
   */
  update(message: string): void {
    if (!this.isActive) return
    const now = Date.now()
    if (now - this.lastUpdateTs < this.throttleMs && message === this.currentMessage) return
    this.currentMessage = message
    this.writeLine(this.currentMessage)
    this.lastUpdateTs = now
  }

  /**
   * 停止进度显示
   */
  stop(message?: string): void {
    if (!this.isActive) return
    this.isActive = false
    this.clearLine()
    if (message !== undefined) {
      process.stdout.write(message + '\n')
    }
    this.currentMessage = ''
  }

  pause(): void {
    this.isActive = false
  }

  resume(): void {
    if (this.currentMessage) {
      this.isActive = true
      this.writeLine(this.currentMessage)
    }
  }

  getStatus(): { isActive: boolean; message: string } {
    return {
      isActive: this.isActive,
      message: this.currentMessage
    }
  }

  private clearLine() {
    process.stdout.write('\r' + ' '.repeat(this.width - 1) + '\r')
  }

  private writeLine(message: string) {
    this.clearLine()
    process.stdout.write(chalk.blue(message))
  }
}
