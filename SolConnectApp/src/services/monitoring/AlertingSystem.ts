/**
 * Alerting and Notification System for SolConnect
 * Monitors metrics and errors to trigger alerts and notifications
 */

import { getMetricsCollector } from './MetricsCollector';
import { getErrorTracker } from './ErrorTracker';
import { getLogger } from './Logger';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'threshold' | 'anomaly' | 'error_rate' | 'performance' | 'custom';

export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownPeriod: number; // milliseconds
  lastTriggered?: number;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
  threshold: number | string;
  timeWindow?: number; // milliseconds
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

export interface AlertAction {
  type: 'notification' | 'email' | 'webhook' | 'log';
  config: Record<string, any>;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  timestamp: number;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  score: number; // 0-100
  issues: string[];
  lastChecked: number;
}

/**
 * Alerting system that monitors metrics and triggers notifications
 */
export class AlertingSystem {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Alert[] = [];
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();
  private monitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private logger = getLogger('alerting');
  private alertObservers: Set<(alert: Alert) => void> = new Set();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Start monitoring
   */
  start(interval = 30000): void {
    if (this.monitoring) return;

    this.monitoring = true;
    this.logger.info('Alerting system started', { interval });

    this.monitoringInterval = setInterval(() => {
      this.checkAlerts();
    }, interval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.monitoring) return;

    this.monitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.logger.info('Alerting system stopped');
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.logger.info('Alert rule removed', { ruleId });
  }

  /**
   * Enable/disable a rule
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.logger.info('Alert rule toggled', { ruleId, enabled });
    }
  }

  /**
   * Add a health check
   */
  addHealthCheck(name: string, check: () => Promise<boolean>): void {
    this.healthChecks.set(name, check);
    this.logger.info('Health check added', { name });
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const issues: string[] = [];
    const checks: Array<{ name: string; passed: boolean }> = [];

    // Run health checks
    for (const [name, check] of this.healthChecks.entries()) {
      try {
        const passed = await check();
        checks.push({ name, passed });
        if (!passed) {
          issues.push(`Health check failed: ${name}`);
        }
      } catch (error) {
        checks.push({ name, passed: false });
        issues.push(`Health check error: ${name} - ${error}`);
      }
    }

    // Check for recent critical alerts
    const recentCriticalAlerts = this.alerts.filter(
      alert => 
        alert.severity === 'critical' && 
        !alert.resolved &&
        Date.now() - alert.timestamp < 300000 // 5 minutes
    );

    if (recentCriticalAlerts.length > 0) {
      issues.push(`${recentCriticalAlerts.length} unresolved critical alert(s)`);
    }

    // Calculate health score
    const passedChecks = checks.filter(c => c.passed).length;
    const totalChecks = checks.length;
    const baseScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;
    
    // Reduce score for critical alerts
    const criticalPenalty = recentCriticalAlerts.length * 20;
    const score = Math.max(0, baseScore - criticalPenalty);

    let status: SystemHealth['status'] = 'healthy';
    if (score < 50) {
      status = 'down';
    } else if (score < 80 || issues.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      score,
      issues,
      lastChecked: Date.now()
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        // Sort by severity, then by timestamp
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        return severityDiff !== 0 ? severityDiff : b.timestamp - a.timestamp;
      });
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100): Alert[] {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.logger.info('Alert resolved', { alertId, title: alert.title });
    }
  }

  /**
   * Subscribe to alert events
   */
  subscribe(observer: (alert: Alert) => void): () => void {
    this.alertObservers.add(observer);
    return () => this.alertObservers.delete(observer);
  }

  /**
   * Trigger a custom alert
   */
  triggerAlert(
    title: string,
    message: string,
    severity: AlertSeverity = 'warning',
    metadata: Record<string, any> = {}
  ): string {
    const alert: Alert = {
      id: this.generateAlertId(),
      ruleId: 'custom',
      timestamp: Date.now(),
      severity,
      title,
      message,
      metadata,
      resolved: false
    };

    this.alerts.push(alert);
    this.executeAlertActions(alert);
    this.notifyObservers(alert);

    this.logger.warn('Custom alert triggered', {
      alertId: alert.id,
      title,
      severity
    });

    return alert.id;
  }

  /**
   * Clear all alerts
   */
  clear(): void {
    this.alerts = [];
  }

  /**
   * Export alert data
   */
  exportAlerts(): string {
    return JSON.stringify({
      alerts: this.alerts,
      rules: Array.from(this.rules.values()),
      exportTime: Date.now()
    }, null, 2);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.alertObservers.clear();
    this.clear();
  }

  // Private methods

  private async checkAlerts(): Promise<void> {
    const metricsCollector = getMetricsCollector();
    const errorTracker = getErrorTracker();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownPeriod) {
        continue;
      }

      try {
        const shouldTrigger = await this.evaluateRule(rule, metricsCollector, errorTracker);
        if (shouldTrigger) {
          await this.triggerRuleAlert(rule);
        }
      } catch (error) {
        this.logger.error('Error evaluating alert rule', error as Error, {
          ruleId: rule.id,
          ruleName: rule.name
        });
      }
    }
  }

  private async evaluateRule(
    rule: AlertRule,
    metricsCollector: any,
    errorTracker: any
  ): Promise<boolean> {
    for (const condition of rule.conditions) {
      const conditionMet = await this.evaluateCondition(condition, metricsCollector, errorTracker);
      if (!conditionMet) {
        return false; // All conditions must be met
      }
    }
    return true;
  }

  private async evaluateCondition(
    condition: AlertCondition,
    metricsCollector: any,
    errorTracker: any
  ): Promise<boolean> {
    let value: number | string;

    // Get metric value based on condition
    switch (condition.metric) {
      case 'error_rate':
        const errorStats = errorTracker.getErrorStats(condition.timeWindow || 3600000);
        value = errorStats.errorRate;
        break;
      
      case 'avg_latency':
        const perfAggregates = metricsCollector.getPerformanceAggregates();
        value = perfAggregates.avg;
        break;
      
      case 'active_connections':
        // Mock value - in real implementation, get from connection manager
        value = Math.floor(Math.random() * 100);
        break;
      
      default:
        // Try to get from metrics snapshot
        const snapshot = metricsCollector.getSnapshot();
        const businessMetric = snapshot.business.find((m: any) => m.metric === condition.metric);
        value = businessMetric ? businessMetric.value : 0;
        break;
    }

    // Evaluate condition
    switch (condition.operator) {
      case 'gt':
        return Number(value) > Number(condition.threshold);
      case 'gte':
        return Number(value) >= Number(condition.threshold);
      case 'lt':
        return Number(value) < Number(condition.threshold);
      case 'lte':
        return Number(value) <= Number(condition.threshold);
      case 'eq':
        return value === condition.threshold;
      case 'contains':
        return String(value).includes(String(condition.threshold));
      default:
        return false;
    }
  }

  private async triggerRuleAlert(rule: AlertRule): Promise<void> {
    const alert: Alert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      timestamp: Date.now(),
      severity: rule.severity,
      title: rule.name,
      message: `Alert rule "${rule.name}" has been triggered`,
      metadata: { rule },
      resolved: false
    };

    this.alerts.push(alert);
    rule.lastTriggered = Date.now();

    this.executeAlertActions(alert);
    this.notifyObservers(alert);

    this.logger.warn('Alert rule triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity
    });
  }

  private executeAlertActions(alert: Alert): void {
    const rule = this.rules.get(alert.ruleId);
    if (!rule) return;

    rule.actions.forEach(action => {
      if (!action.enabled) return;

      try {
        switch (action.type) {
          case 'notification':
            this.showNotification(alert);
            break;
          case 'log':
            this.logAlert(alert);
            break;
          case 'webhook':
            this.sendWebhook(alert, action.config);
            break;
          // Additional action types can be added here
        }
      } catch (error) {
        this.logger.error('Error executing alert action', error as Error, {
          alertId: alert.id,
          actionType: action.type
        });
      }
    });
  }

  private showNotification(alert: Alert): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`SolConnect Alert: ${alert.title}`, {
          body: alert.message,
          icon: '/icon.png',
          tag: alert.id
        });
      }
    }
  }

  private logAlert(alert: Alert): void {
    this.logger.warn(`ALERT: ${alert.title}`, {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      metadata: alert.metadata
    });
  }

  private async sendWebhook(alert: Alert, config: Record<string, any>): Promise<void> {
    if (!config.url) return;

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify({
          alert,
          timestamp: Date.now(),
          source: 'solconnect'
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('Webhook delivery failed', error as Error, {
        alertId: alert.id,
        webhookUrl: config.url
      });
    }
  }

  private notifyObservers(alert: Alert): void {
    this.alertObservers.forEach(observer => {
      try {
        observer(alert);
      } catch (error) {
        this.logger.error('Error in alert observer', error as Error);
      }
    });
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeDefaultRules(): void {
    // High error rate rule
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      type: 'error_rate',
      severity: 'critical',
      enabled: true,
      conditions: [{
        metric: 'error_rate',
        operator: 'gt',
        threshold: 10,
        timeWindow: 300000 // 5 minutes
      }],
      actions: [{
        type: 'notification',
        config: {},
        enabled: true
      }, {
        type: 'log',
        config: {},
        enabled: true
      }],
      cooldownPeriod: 300000 // 5 minutes
    });

    // High latency rule
    this.addRule({
      id: 'high_latency',
      name: 'High Average Latency',
      type: 'performance',
      severity: 'warning',
      enabled: true,
      conditions: [{
        metric: 'avg_latency',
        operator: 'gt',
        threshold: 2000,
        timeWindow: 600000 // 10 minutes
      }],
      actions: [{
        type: 'log',
        config: {},
        enabled: true
      }],
      cooldownPeriod: 600000 // 10 minutes
    });
  }
}

/**
 * Global alerting system instance
 */
let globalAlertingSystem: AlertingSystem | null = null;

/**
 * Get the global alerting system instance
 */
export function getAlertingSystem(): AlertingSystem {
  if (!globalAlertingSystem) {
    globalAlertingSystem = new AlertingSystem();
  }
  return globalAlertingSystem;
}