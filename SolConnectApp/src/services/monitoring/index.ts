/**
 * Monitoring and Observability Index
 * Central exports for all monitoring services
 */

export { MetricsCollector, getMetricsCollector, Metrics } from './MetricsCollector';
export { ErrorTracker, getErrorTracker } from './ErrorTracker';
export { AlertingSystem, getAlertingSystem } from './AlertingSystem';
export { Logger, getLogger, getComponentLogger, appLogger, sdkLogger, networkLogger, uiLogger, perfLogger, Log } from './Logger';
export { MonitoringDashboard } from '../../components/monitoring/MonitoringDashboard';

// Type exports
export type { 
  MetricsSnapshot, 
  PerformanceMetric, 
  ActionMetric, 
  BusinessMetric 
} from './MetricsCollector';

export type { 
  ErrorEntry, 
  ErrorAggregation, 
  ErrorFilter 
} from './ErrorTracker';

export type { 
  AlertSeverity, 
  AlertType, 
  AlertRule, 
  Alert, 
  SystemHealth 
} from './AlertingSystem';

export type { 
  LogLevel, 
  LogEntry, 
  LoggerConfig 
} from './Logger';

/**
 * Initialize all monitoring services
 */
export async function initializeMonitoring(): Promise<void> {
  // Start metrics collection
  const metricsCollector = getMetricsCollector();
  metricsCollector.start();

  // Start error tracking
  const errorTracker = getErrorTracker();
  errorTracker.start();

  // Start alerting system
  const alertingSystem = getAlertingSystem();
  alertingSystem.start();

  // Set up default health checks
  alertingSystem.addHealthCheck('metrics_collector', async () => {
    return metricsCollector.isRunning;
  });

  alertingSystem.addHealthCheck('error_tracker', async () => {
    return errorTracker.isRunning;
  });

  console.log('[Monitoring] All monitoring services initialized');
}

/**
 * Cleanup all monitoring services
 */
export async function cleanupMonitoring(): Promise<void> {
  const metricsCollector = getMetricsCollector();
  const errorTracker = getErrorTracker();
  const alertingSystem = getAlertingSystem();

  metricsCollector.stop();
  errorTracker.stop();
  alertingSystem.stop();

  console.log('[Monitoring] All monitoring services stopped');
}

/**
 * Get system health overview
 */
export async function getSystemHealthOverview() {
  const alertingSystem = getAlertingSystem();
  const metricsCollector = getMetricsCollector();
  const errorTracker = getErrorTracker();

  const systemHealth = await alertingSystem.getSystemHealth();
  const errorStats = errorTracker.getErrorStats();
  const perfAggregates = metricsCollector.getPerformanceAggregates();

  return {
    ...systemHealth,
    metrics: {
      errorRate: errorStats.errorRate,
      avgLatency: perfAggregates.avg,
      totalMetrics: metricsCollector.getSnapshot().performance.length,
      totalErrors: errorStats.totalErrors
    }
  };
}