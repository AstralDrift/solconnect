/**
 * Error Tracking and Reporting Service for SolConnect
 * Collects, categorizes, and reports errors across the application
 */

import { SolConnectError, ErrorCategory, ErrorCode } from '../../types/errors';
import { getMetricsCollector } from './MetricsCollector';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  userAgent?: string;
  url?: string;
  timestamp: number;
  stackTrace?: string;
  breadcrumbs?: Breadcrumb[];
  deviceInfo?: DeviceInfo;
  networkInfo?: NetworkInfo;
}

export interface Breadcrumb {
  timestamp: number;
  message: string;
  category: 'navigation' | 'user_action' | 'network' | 'console' | 'dom';
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface DeviceInfo {
  platform: string;
  browser: string;
  version: string;
  screen: {
    width: number;
    height: number;
  };
  memory?: number;
  connection?: string;
}

export interface NetworkInfo {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export interface ErrorReport {
  error: SolConnectError | Error;
  context: ErrorContext;
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fingerprint: string;
}

export interface ErrorAggregation {
  fingerprint: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  errors: ErrorReport[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Central error tracking and reporting service
 */
export class ErrorTracker {
  private errors: ErrorReport[] = [];
  private breadcrumbs: Breadcrumb[] = [];
  private maxErrors = 100;
  private maxBreadcrumbs = 50;
  private userId?: string;
  private sessionId?: string;
  private errorObservers: Set<(report: ErrorReport) => void> = new Set();

  constructor() {
    this.initializeGlobalHandlers();
    this.initializeBreadcrumbTracking();
    this.sessionId = this.generateSessionId();
  }

  /**
   * Set current user context
   */
  setUser(userId: string): void {
    this.userId = userId;
    this.addBreadcrumb('User identified', 'user_action', 'info', { userId });
  }

  /**
   * Track an error
   */
  captureError(
    error: SolConnectError | Error,
    context: Partial<ErrorContext> = {}
  ): string {
    const errorContext: ErrorContext = {
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      breadcrumbs: [...this.breadcrumbs],
      deviceInfo: this.getDeviceInfo(),
      networkInfo: this.getNetworkInfo(),
      ...context
    };

    if (error.stack) {
      errorContext.stackTrace = error.stack;
    }

    const report: ErrorReport = {
      error,
      context: errorContext,
      id: this.generateErrorId(),
      severity: this.calculateSeverity(error),
      fingerprint: this.generateFingerprint(error)
    };

    this.errors.push(report);
    this.trimErrors();

    // Record metrics
    getMetricsCollector().recordBusiness('error_count', 1, {
      category: error instanceof SolConnectError ? error.category : 'system',
      severity: report.severity,
      component: context.component || 'unknown'
    });

    // Add breadcrumb for this error
    this.addBreadcrumb(
      `Error: ${error.message}`,
      'console',
      'error',
      {
        errorId: report.id,
        category: error instanceof SolConnectError ? error.category : 'system'
      }
    );

    // Notify observers
    this.notifyObservers(report);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorTracker] Error captured:', {
        error,
        context: errorContext,
        id: report.id
      });
    }

    return report.id;
  }

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(
    message: string,
    category: Breadcrumb['category'],
    level: Breadcrumb['level'] = 'info',
    data?: Record<string, any>
  ): void {
    const breadcrumb: Breadcrumb = {
      timestamp: Date.now(),
      message,
      category,
      level,
      data
    };

    this.breadcrumbs.push(breadcrumb);
    this.trimBreadcrumbs();
  }

  /**
   * Get error aggregations
   */
  getErrorAggregations(): ErrorAggregation[] {
    const aggregations = new Map<string, ErrorAggregation>();

    this.errors.forEach(error => {
      const existing = aggregations.get(error.fingerprint);
      if (existing) {
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, error.context.timestamp);
        existing.errors.push(error);
      } else {
        aggregations.set(error.fingerprint, {
          fingerprint: error.fingerprint,
          count: 1,
          firstSeen: error.context.timestamp,
          lastSeen: error.context.timestamp,
          errors: [error],
          trend: 'stable'
        });
      }
    });

    // Calculate trends
    aggregations.forEach(aggregation => {
      aggregation.trend = this.calculateTrend(aggregation);
    });

    return Array.from(aggregations.values())
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeWindow = 3600000): {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    topErrors: Array<{ fingerprint: string; count: number; message: string }>;
    errorRate: number;
  } {
    const cutoff = Date.now() - timeWindow;
    const recentErrors = this.errors.filter(e => e.context.timestamp > cutoff);

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const errorCounts = new Map<string, { count: number; message: string }>();

    recentErrors.forEach(error => {
      const category = error.error instanceof SolConnectError ? error.error.category : 'system';
      byCategory[category] = (byCategory[category] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;

      const existing = errorCounts.get(error.fingerprint);
      if (existing) {
        existing.count++;
      } else {
        errorCounts.set(error.fingerprint, {
          count: 1,
          message: error.error.message
        });
      }
    });

    const topErrors = Array.from(errorCounts.entries())
      .map(([fingerprint, { count, message }]) => ({ fingerprint, count, message }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: recentErrors.length,
      byCategory,
      bySeverity,
      topErrors,
      errorRate: recentErrors.length / (timeWindow / 60000) // errors per minute
    };
  }

  /**
   * Subscribe to error events
   */
  subscribe(observer: (report: ErrorReport) => void): () => void {
    this.errorObservers.add(observer);
    return () => this.errorObservers.delete(observer);
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
    this.breadcrumbs = [];
  }

  /**
   * Export errors for analysis
   */
  exportErrors(): string {
    return JSON.stringify({
      errors: this.errors,
      breadcrumbs: this.breadcrumbs,
      exportTime: Date.now()
    }, null, 2);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.errorObservers.clear();
    this.clear();
  }

  // Private methods

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFingerprint(error: SolConnectError | Error): string {
    if (error instanceof SolConnectError) {
      return `${error.category}_${error.code}_${error.message}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }
    
    // For regular errors, use message and first few lines of stack
    const stackLines = error.stack?.split('\n').slice(0, 3).join('|') || '';
    return `${error.name}_${error.message}_${stackLines}`.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 100);
  }

  private calculateSeverity(error: SolConnectError | Error): ErrorReport['severity'] {
    if (error instanceof SolConnectError) {
      switch (error.category) {
        case 'crypto':
        case 'auth':
          return 'critical';
        case 'network':
          return error.recoverable ? 'medium' : 'high';
        case 'validation':
          return 'low';
        default:
          return 'medium';
      }
    }

    // For regular errors, determine severity based on type
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'high';
    }
    
    return 'medium';
  }

  private calculateTrend(aggregation: ErrorAggregation): 'increasing' | 'stable' | 'decreasing' {
    if (aggregation.errors.length < 3) return 'stable';

    const recentHour = Date.now() - 3600000;
    const recentErrors = aggregation.errors.filter(e => e.context.timestamp > recentHour);
    const olderErrors = aggregation.errors.filter(e => e.context.timestamp <= recentHour);

    if (recentErrors.length > olderErrors.length * 1.5) return 'increasing';
    if (recentErrors.length < olderErrors.length * 0.5) return 'decreasing';
    return 'stable';
  }

  private getDeviceInfo(): DeviceInfo {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return {
        platform: 'server',
        browser: 'node',
        version: 'unknown',
        screen: { width: 0, height: 0 }
      };
    }

    return {
      platform: navigator.platform,
      browser: this.getBrowserName(),
      version: this.getBrowserVersion(),
      screen: {
        width: window.screen.width,
        height: window.screen.height
      },
      memory: (navigator as any).deviceMemory,
      connection: (navigator as any).connection?.effectiveType
    };
  }

  private getNetworkInfo(): NetworkInfo {
    if (typeof navigator === 'undefined') {
      return { online: true };
    }

    const connection = (navigator as any).connection;
    return {
      online: navigator.onLine,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt
    };
  }

  private getBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getBrowserVersion(): string {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/(\d+)/);
    return match ? match[1] : 'unknown';
  }

  private initializeGlobalHandlers(): void {
    if (typeof window === 'undefined') return;

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        { component: 'global', action: 'unhandled_promise_rejection' }
      );
    });

    // Capture global errors
    window.addEventListener('error', (event) => {
      this.captureError(
        event.error || new Error(event.message),
        { 
          component: 'global', 
          action: 'global_error',
          url: event.filename,
          stackTrace: `${event.filename}:${event.lineno}:${event.colno}`
        }
      );
    });
  }

  private initializeBreadcrumbTracking(): void {
    if (typeof window === 'undefined') return;

    // Track navigation
    window.addEventListener('popstate', () => {
      this.addBreadcrumb('Navigation', 'navigation', 'info', {
        url: window.location.href
      });
    });

    // Track console errors/warns
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = (...args) => {
      this.addBreadcrumb(`Console Error: ${args.join(' ')}`, 'console', 'error');
      originalConsoleError.apply(console, args);
    };

    console.warn = (...args) => {
      this.addBreadcrumb(`Console Warning: ${args.join(' ')}`, 'console', 'warning');
      originalConsoleWarn.apply(console, args);
    };
  }

  private trimErrors(): void {
    if (this.errors.length > this.maxErrors) {
      this.errors.splice(0, this.errors.length - this.maxErrors);
    }
  }

  private trimBreadcrumbs(): void {
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.splice(0, this.breadcrumbs.length - this.maxBreadcrumbs);
    }
  }

  private notifyObservers(report: ErrorReport): void {
    this.errorObservers.forEach(observer => {
      try {
        observer(report);
      } catch (error) {
        console.error('[ErrorTracker] Error in observer:', error);
      }
    });
  }
}

/**
 * Global error tracker instance
 */
let globalErrorTracker: ErrorTracker | null = null;

/**
 * Get the global error tracker instance
 */
export function getErrorTracker(): ErrorTracker {
  if (!globalErrorTracker) {
    globalErrorTracker = new ErrorTracker();
  }
  return globalErrorTracker;
}

/**
 * Convenience function for capturing errors
 */
export function captureError(
  error: SolConnectError | Error,
  context?: Partial<ErrorContext>
): string {
  return getErrorTracker().captureError(error, context);
}

/**
 * Convenience function for adding breadcrumbs
 */
export function addBreadcrumb(
  message: string,
  category: Breadcrumb['category'],
  level?: Breadcrumb['level'],
  data?: Record<string, any>
): void {
  getErrorTracker().addBreadcrumb(message, category, level, data);
}