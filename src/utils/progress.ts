import chalk from 'chalk'
import logUpdate from 'log-update'
import cliCursor from 'cli-cursor'

/**
 * 使用 log-update 库的进度指示器
 * 更可靠，解决覆盖问题
 */
export class ProgressIndicator {
  private currentMessage = ''
  private isActive = false
  private lastUpdateTs = 0
  private readonly throttleMs = 200

  constructor() {
    // 隐藏光标
    cliCursor.hide()
  }

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

    // 清除当前行
    logUpdate.clear()

    if (message !== undefined) {
      console.log(message)
    }

    this.currentMessage = ''

    // 恢复光标
    cliCursor.show()
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

  private writeLine(message: string): void {
    logUpdate(chalk.blue(message))
  }
}