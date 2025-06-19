/**
 * Metrics Collection Service for SolConnect
 * Collects performance, usage, and business metrics across the application
 */

import { SolConnectError, ErrorCode } from '../../types/errors';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  timestamp: number;
  tags?: Record<string, string>;
}

export interface UsageMetric {
  event: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface BusinessMetric {
  metric: string;
  value: number;
  dimension?: Record<string, string>;
  timestamp: number;
}

export interface SystemMetric {
  cpu?: number;
  memory?: number;
  network?: {
    uploadSpeed: number;
    downloadSpeed: number;
    latency: number;
  };
  timestamp: number;
}

export interface MetricsSnapshot {
  performance: PerformanceMetric[];
  usage: UsageMetric[];
  business: BusinessMetric[];
  system: SystemMetric[];
  timestamp: number;
}

/**
 * Central metrics collection and aggregation service
 */
export class MetricsCollector {
  private performanceMetrics: PerformanceMetric[] = [];
  private usageMetrics: UsageMetric[] = [];
  private businessMetrics: BusinessMetric[] = [];
  private systemMetrics: SystemMetric[] = [];
  private maxMetricsPerType = 1000;
  private flushInterval = 60000; // 1 minute
  private flushTimer: NodeJS.Timeout | null = null;
  private observers: Set<(snapshot: MetricsSnapshot) => void> = new Set();

  constructor() {
    this.startPeriodicFlush();
    this.initializePerformanceObserver();
  }

  /**
   * Record a performance metric
   */
  recordPerformance(
    name: string,
    value: number,
    unit: PerformanceMetric['unit'] = 'ms',
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    };

    this.performanceMetrics.push(metric);
    this.trimMetrics(this.performanceMetrics);

    // Log significant performance issues
    if (unit === 'ms' && value > 1000) {
      console.warn(`[MetricsCollector] Slow operation detected: ${name} took ${value}ms`, tags);
    }
  }

  /**
   * Record a usage event
   */
  recordUsage(
    event: string,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): void {
    const metric: UsageMetric = {
      event,
      userId,
      sessionId,
      metadata,
      timestamp: Date.now()
    };

    this.usageMetrics.push(metric);
    this.trimMetrics(this.usageMetrics);
  }

  /**
   * Record a business metric
   */
  recordBusiness(
    metric: string,
    value: number,
    dimension?: Record<string, string>
  ): void {
    const businessMetric: BusinessMetric = {
      metric,
      value,
      dimension,
      timestamp: Date.now()
    };

    this.businessMetrics.push(businessMetric);
    this.trimMetrics(this.businessMetrics);
  }

  /**
   * Record system metrics
   */
  recordSystem(metrics: Omit<SystemMetric, 'timestamp'>): void {
    const systemMetric: SystemMetric = {
      ...metrics,
      timestamp: Date.now()
    };

    this.systemMetrics.push(systemMetric);
    this.trimMetrics(this.systemMetrics);
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    return {
      performance: [...this.performanceMetrics],
      usage: [...this.usageMetrics],
      business: [...this.businessMetrics],
      system: [...this.systemMetrics],
      timestamp: Date.now()
    };
  }

  /**
   * Get aggregated performance metrics
   */
  getPerformanceAggregates(metricName?: string): {
    avg: number;
    min: number;
    max: number;
    count: number;
    p95: number;
    p99: number;
  } {
    const metrics = metricName 
      ? this.performanceMetrics.filter(m => m.name === metricName)
      : this.performanceMetrics;

    if (metrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0, p95: 0, p99: 0 };
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      count: values.length,
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)]
    };
  }

  /**
   * Get usage event counts
   */
  getUsageCounts(timeWindow?: number): Record<string, number> {
    const cutoff = timeWindow ? Date.now() - timeWindow : 0;
    const recentMetrics = this.usageMetrics.filter(m => m.timestamp > cutoff);
    
    return recentMetrics.reduce((counts, metric) => {
      counts[metric.event] = (counts[metric.event] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }

  /**
   * Get business metric trends
   */
  getBusinessTrends(metricName: string, bucketSize = 300000): Array<{
    timestamp: number;
    value: number;
    count: number;
  }> {
    const relevantMetrics = this.businessMetrics.filter(m => m.metric === metricName);
    const buckets = new Map<number, { sum: number; count: number }>();

    relevantMetrics.forEach(metric => {
      const bucket = Math.floor(metric.timestamp / bucketSize) * bucketSize;
      const existing = buckets.get(bucket) || { sum: 0, count: 0 };
      existing.sum += metric.value;
      existing.count += 1;
      buckets.set(bucket, existing);
    });

    return Array.from(buckets.entries())
      .map(([timestamp, { sum, count }]) => ({
        timestamp,
        value: sum / count,
        count
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Subscribe to metrics updates
   */
  subscribe(observer: (snapshot: MetricsSnapshot) => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.performanceMetrics = [];
    this.usageMetrics = [];
    this.businessMetrics = [];
    this.systemMetrics = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.observers.clear();
    this.clear();
  }

  // Private methods

  private trimMetrics<T>(metrics: T[]): void {
    if (metrics.length > this.maxMetricsPerType) {
      metrics.splice(0, metrics.length - this.maxMetricsPerType);
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      const snapshot = this.getSnapshot();
      this.notifyObservers(snapshot);
      
      // Log summary
      console.log('[MetricsCollector] Periodic flush:', {
        performance: snapshot.performance.length,
        usage: snapshot.usage.length,
        business: snapshot.business.length,
        system: snapshot.system.length
      });
    }, this.flushInterval);
  }

  private notifyObservers(snapshot: MetricsSnapshot): void {
    this.observers.forEach(observer => {
      try {
        observer(snapshot);
      } catch (error) {
        console.error('[MetricsCollector] Error in observer:', error);
      }
    });
  }

  private initializePerformanceObserver(): void {
    // Monitor navigation and resource timing
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.recordPerformance('page_load', navEntry.loadEventEnd - navEntry.navigationStart);
              this.recordPerformance('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.navigationStart);
              this.recordPerformance('first_paint', navEntry.responseStart - navEntry.navigationStart);
            } else if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              this.recordPerformance('resource_load', entry.duration, 'ms', {
                resource: resourceEntry.name,
                type: resourceEntry.initiatorType
              });
            }
          });
        });

        observer.observe({ entryTypes: ['navigation', 'resource'] });
      } catch (error) {
        console.warn('[MetricsCollector] Failed to initialize PerformanceObserver:', error);
      }
    }
  }
}

/**
 * Global metrics collector instance
 */
let globalMetricsCollector: MetricsCollector | null = null;

/**
 * Get the global metrics collector instance
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector();
  }
  return globalMetricsCollector;
}

/**
 * Convenience functions for common metrics
 */
export const Metrics = {
  /**
   * Time a function execution
   */
  time: async <T>(name: string, fn: () => Promise<T> | T, tags?: Record<string, string>): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      getMetricsCollector().recordPerformance(name, duration, 'ms', tags);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      getMetricsCollector().recordPerformance(name, duration, 'ms', { 
        ...tags, 
        error: 'true' 
      });
      throw error;
    }
  },

  /**
   * Record user action
   */
  action: (action: string, userId?: string, metadata?: Record<string, any>): void => {
    getMetricsCollector().recordUsage(`user_action.${action}`, userId, undefined, metadata);
  },

  /**
   * Record component render
   */
  render: (component: string, duration: number): void => {
    getMetricsCollector().recordPerformance(`component_render.${component}`, duration);
  },

  /**
   * Record API call
   */
  apiCall: (endpoint: string, duration: number, status: 'success' | 'error'): void => {
    getMetricsCollector().recordPerformance(`api_call.${endpoint}`, duration, 'ms', { status });
  },

  /**
   * Record business event
   */
  business: (event: string, value = 1, dimension?: Record<string, string>): void => {
    getMetricsCollector().recordBusiness(event, value, dimension);
  }
};