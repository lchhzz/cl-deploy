// src/utils/progress.ts
import chalk from 'chalk'

/**
 * 命令行进度指示器
 */
export class ProgressIndicator {
  private spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  private currentFrame = 0
  private intervalId: NodeJS.Timeout | null = null

  /**
   * 开始旋转进度指示器
   */
  start(message: string): void {
    process.stdout.write(chalk.blue('⠋') + ' ' + message)

    this.intervalId = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.spinnerChars.length
      process.stdout.write('\r' + chalk.blue(this.spinnerChars[this.currentFrame]) + ' ' + message)
    }, 100)
  }

  /**
   * 停止进度指示器并显示结果
   */
  stop(message?: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    const finalMessage = message || ''

    process.stdout.write('\r' + ' ' + finalMessage + '\n')
  }

  /**
   * 更新进度消息
   */
  update(message: string): void {
    process.stdout.write('\r' + chalk.blue(this.spinnerChars[this.currentFrame]) + ' ' + message)
  }
}
