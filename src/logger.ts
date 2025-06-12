import { Notice } from 'obsidian';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private debugMode: boolean;
  private logLevel: LogLevel;

  constructor(
    private pluginName: string, 
    debugMode = false,
    logLevel: LogLevel = LogLevel.INFO
  ) {
    this.debugMode = debugMode;
    this.logLevel = logLevel;
  }

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  debug(message: string, data?: unknown) {
    if (this.debugMode && this.logLevel <= LogLevel.DEBUG) {
      console.debug(`[${this.pluginName}] DEBUG: ${message}`, data || '');
    }
  }

  info(message: string, data?: unknown) {
    if (this.debugMode && this.logLevel <= LogLevel.INFO) {
      console.info(`[${this.pluginName}] INFO: ${message}`, data || '');
    }
  }

  /**
   * Log a warning message, depending on the log level. 
   * 
   * @param message - The message to log
   * @param data - The data to log
   */
  warn(message: string, data?: unknown) {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(`[${this.pluginName}] WARN: ${message}`, data || '');
    }
  }

  /**
   * Log an error message, depending on the log level. 
   * If showToUser is true, a notice will be shown to the user.
   * 
   * @param message - The message to log
   * @param error - The error to log
   * @param showToUser - Whether to show the error to the user
   */
  error(message: string, error?: unknown, showToUser = false) {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(`[${this.pluginName}] ERROR: ${message}`, error || '');
    }
    
    if (showToUser) {
      new Notice(`${this.pluginName}: ${message}`);
    }
  }

  /**
   * Log an error message, and show a notice to the user, 
   * if showToUser is true and the log level is ERROR.
   * 
   * @param message - The message to log
   * @param error - The error to log
   */
  userError(message: string, error?: unknown) {
    this.error(message, error, true);
  }
}