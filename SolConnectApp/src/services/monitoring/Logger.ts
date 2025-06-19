/**
 * Structured Logging Service for SolConnect
 * Provides consistent, contextual logging with metadata and categorization
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  category: string;
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
  correlationId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxEntries: number;
  categories: string[];
  components: string[];
}

/**
 * Structured logger with contextual information
 */
export class Logger {
  private logs: LogEntry[] = [];
  private config: LoggerConfig;
  private context: Partial<LogEntry> = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableStorage: true,
      maxEntries: 1000,
      categories: [],
      components: [],
      ...config
    };
  }

  /**
   * Set global context for all log entries
   */
  setContext(context: Partial<LogEntry>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear global context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const logMetadata = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.log('error', message, logMetadata, error?.stack);
  }

  /**
   * Log a critical message
   */
  critical(message: string, error?: Error, metadata?: Record<string, any>): void {
    const logMetadata = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.log('critical', message, logMetadata, error?.stack);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Partial<LogEntry>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }

  /**
   * Get all log entries
   */
  getLogs(filter?: {
    level?: LogLevel;
    category?: string;
    component?: string;
    since?: number;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level) {
        const levelOrder = ['debug', 'info', 'warn', 'error', 'critical'];
        const minLevelIndex = levelOrder.indexOf(filter.level);
        filteredLogs = filteredLogs.filter(log => 
          levelOrder.indexOf(log.level) >= minLevelIndex
        );
      }

      if (filter.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filter.category);
      }

      if (filter.component) {
        filteredLogs = filteredLogs.filter(log => log.component === filter.component);
      }

      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.since);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get log statistics
   */
  getStats(timeWindow = 3600000): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
    byComponent: Record<string, number>;
    recentErrorRate: number;
  } {
    const cutoff = Date.now() - timeWindow;
    const recentLogs = this.logs.filter(log => log.timestamp > cutoff);

    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0
    };

    const byCategory: Record<string, number> = {};
    const byComponent: Record<string, number> = {};

    recentLogs.forEach(log => {
      byLevel[log.level]++;
      
      if (log.category) {
        byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      }

      if (log.component) {
        byComponent[log.component] = (byComponent[log.component] || 0) + 1;
      }
    });

    const errorCount = byLevel.error + byLevel.critical;
    const recentErrorRate = (errorCount / (timeWindow / 60000)); // errors per minute

    return {
      total: recentLogs.length,
      byLevel,
      byCategory,
      byComponent,
      recentErrorRate
    };
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      config: this.config,
      exportTime: Date.now()
    }, null, 2);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clear();
  }

  // Private methods

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    stackTrace?: string
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      category: this.context.category || 'general',
      component: this.context.component,
      action: this.context.action,
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      metadata: { ...this.context.metadata, ...metadata },
      stackTrace,
      correlationId: this.generateCorrelationId()
    };

    this.logs.push(entry);
    this.trimLogs();

    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    if (this.config.enableStorage) {
      this.logToStorage(entry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levelOrder = ['debug', 'info', 'warn', 'error', 'critical'];
    const configLevelIndex = levelOrder.indexOf(this.config.level);
    const logLevelIndex = levelOrder.indexOf(level);
    return logLevelIndex >= configLevelIndex;
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    const context = entry.component ? ` [${entry.component}]` : '';
    const fullMessage = `${prefix}${context} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(fullMessage, entry.metadata);
        break;
      case 'info':
        console.info(fullMessage, entry.metadata);
        break;
      case 'warn':
        console.warn(fullMessage, entry.metadata);
        break;
      case 'error':
      case 'critical':
        console.error(fullMessage, entry.metadata);
        if (entry.stackTrace) {
          console.error(entry.stackTrace);
        }
        break;
    }
  }

  private logToStorage(entry: LogEntry): void {
    // In a real implementation, this would send logs to a remote service
    // For now, we just store locally
    try {
      const storageKey = 'solconnect_logs';
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      existing.push(entry);
      
      // Keep only recent logs in storage
      const maxStorageLogs = 100;
      if (existing.length > maxStorageLogs) {
        existing.splice(0, existing.length - maxStorageLogs);
      }
      
      localStorage.setItem(storageKey, JSON.stringify(existing));
    } catch (error) {
      // Storage failed, continue silently
    }
  }

  private trimLogs(): void {
    if (this.logs.length > this.config.maxEntries) {
      this.logs.splice(0, this.logs.length - this.config.maxEntries);
    }
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Category-specific loggers
 */
export class CategoryLogger extends Logger {
  constructor(category: string, config?: Partial<LoggerConfig>) {
    super(config);
    this.setContext({ category });
  }
}

/**
 * Component-specific loggers
 */
export class ComponentLogger extends Logger {
  constructor(
    component: string, 
    category: string = 'component',
    config?: Partial<LoggerConfig>
  ) {
    super(config);
    this.setContext({ category, component });
  }
}

/**
 * Global logger instances
 */
const loggers = new Map<string, Logger>();

/**
 * Get a logger for a specific category
 */
export function getLogger(category: string): Logger {
  if (!loggers.has(category)) {
    loggers.set(category, new CategoryLogger(category));
  }
  return loggers.get(category)!;
}

/**
 * Get a component-specific logger
 */
export function getComponentLogger(
  component: string,
  category: string = 'component'
): Logger {
  const key = `${category}:${component}`;
  if (!loggers.has(key)) {
    loggers.set(key, new ComponentLogger(component, category));
  }
  return loggers.get(key)!;
}

/**
 * Default application logger
 */
export const appLogger = getLogger('app');

/**
 * SDK logger
 */
export const sdkLogger = getLogger('sdk');

/**
 * Network logger
 */
export const networkLogger = getLogger('network');

/**
 * UI logger
 */
export const uiLogger = getLogger('ui');

/**
 * Performance logger
 */
export const perfLogger = getLogger('performance');

/**
 * Convenience functions for common logging patterns
 */
export const Log = {
  /**
   * Log with automatic error context
   */
  withError: (logger: Logger, message: string, error: Error): void => {
    logger.error(message, error, {
      errorName: error.name,
      errorMessage: error.message
    });
  },

  /**
   * Log with timing information
   */
  withTiming: async <T>(
    logger: Logger,
    message: string,
    fn: () => Promise<T> | T
  ): Promise<T> => {
    const start = performance.now();
    logger.debug(`Starting: ${message}`);
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      logger.info(`Completed: ${message}`, { duration: `${duration.toFixed(2)}ms` });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`Failed: ${message}`, error as Error, { 
        duration: `${duration.toFixed(2)}ms` 
      });
      throw error;
    }
  },

  /**
   * Log with user context
   */
  withUser: (logger: Logger, userId: string, sessionId?: string): Logger => {
    return logger.child({ userId, sessionId });
  },

  /**
   * Log API operations
   */
  api: {
    request: (logger: Logger, method: string, url: string, metadata?: Record<string, any>): void => {
      logger.info(`API Request: ${method} ${url}`, { method, url, ...metadata });
    },

    response: (logger: Logger, method: string, url: string, status: number, duration: number): void => {
      const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
      logger[level](`API Response: ${method} ${url} ${status}`, {
        method,
        url,
        status,
        duration: `${duration.toFixed(2)}ms`
      });
    }
  }
};