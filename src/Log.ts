/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Logger } from './options.js'

export interface Options {
  silent: boolean
  debug: boolean
}

export class Log implements Logger {
  private options: Options
  constructor(options: Options) {
    this.options = options
  }

  public isDebug() {
    return this.options.debug
  }

  public debug(...args: any[]) {
    if (this.options.debug && !this.options.silent) {
      this.writeLog('debug', ...args)
    }
  }

  public info(...args: any[]) {
    if (!this.options.silent) {
      this.writeLog('info', ...args)
    }
  }

  public error(...args: any[]) {
    this.writeLog('error', ...args)
  }

  private writeLog(level: string, ...args: any[]) {
    console.log(`${level}: `, ...args)
  }
}
