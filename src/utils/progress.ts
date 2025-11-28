import chalk from 'chalk'

/**
 * 命令行进度指示器
 */
export class ProgressIndicator {
  private spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  private currentFrame = 0
  private intervalId: NodeJS.Timeout | null = null
  private currentMessage: string = ''
  private isActive: boolean = false

  /**
   * 开始旋转进度指示器
   */
  start(message: string = ''): void {
    this.currentMessage = message
    this.isActive = true

    // 初始显示
    process.stdout.write(chalk.blue(this.spinnerChars[this.currentFrame]) + ' ' + this.currentMessage)

    this.intervalId = setInterval(() => {
      if (!this.isActive) return

      this.currentFrame = (this.currentFrame + 1) % this.spinnerChars.length
      process.stdout.write('\r' + chalk.blue(this.spinnerChars[this.currentFrame]) + ' ' + this.currentMessage)
    }, 100)
  }

  /**
   * 更新进度消息（保持在同一行）
   */
  update(message: string): void {
    if (!this.isActive) return

    this.currentMessage = message

    // 清除当前行，然后重新写入
    process.stdout.write('\r' + ' '.repeat(process.stdout.columns - 1) + '\r')
    process.stdout.write(chalk.blue(this.spinnerChars[this.currentFrame]) + ' ' + this.currentMessage)
  }

  /**
   * 停止进度指示器并显示结果
   */
  stop(message?: string): void {
    this.isActive = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    // 清除当前行，显示最终消息
    if (message !== undefined) {
      process.stdout.write('\r' + ' '.repeat(process.stdout.columns - 1) + '\r')
      process.stdout.write(message + '\n')
    } else {
      process.stdout.write('\n')
    }

    // 重置状态
    this.currentMessage = ''
    this.currentFrame = 0
  }

  /**
   * 暂停进度指示器（保持显示）
   */
  pause(): void {
    this.isActive = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * 恢复进度指示器
   */
  resume(): void {
    if (!this.isActive && this.currentMessage) {
      this.isActive = true
      this.start(this.currentMessage)
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): { isActive: boolean; message: string } {
    return {
      isActive: this.isActive,
      message: this.currentMessage
    }
  }
}
