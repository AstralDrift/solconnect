/**
 * Real-time Monitoring Dashboard for SolConnect
 * Provides live insights into system performance, errors, and usage
 */

import React, { useState, useEffect, useMemo } from 'react';
import { getMetricsCollector, MetricsSnapshot, PerformanceMetric } from '../../services/monitoring/MetricsCollector';
import { getErrorTracker, ErrorAggregation } from '../../services/monitoring/ErrorTracker';

interface DashboardProps {
  className?: string;
  refreshInterval?: number;
}

interface SystemStatus {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  metrics: {
    errorRate: number;
    avgLatency: number;
    connectionQuality: string;
    activeUsers: number;
  };
}

export const MonitoringDashboard: React.FC<DashboardProps> = ({
  className = '',
  refreshInterval = 5000
}) => {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [errors, setErrors] = useState<ErrorAggregation[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    status: 'healthy',
    message: 'All systems operational',
    metrics: { errorRate: 0, avgLatency: 0, connectionQuality: 'good', activeUsers: 0 }
  });

  // Real-time data updates
  useEffect(() => {
    const updateData = () => {
      const metricsCollector = getMetricsCollector();
      const errorTracker = getErrorTracker();
      
      const currentMetrics = metricsCollector.getSnapshot();
      const currentErrors = errorTracker.getErrorAggregations();
      const errorStats = errorTracker.getErrorStats();
      
      setMetrics(currentMetrics);
      setErrors(currentErrors);
      
      // Calculate system status
      const perfAggregates = metricsCollector.getPerformanceAggregates();
      const status = calculateSystemStatus(errorStats, perfAggregates);
      setSystemStatus(status);
    };

    updateData();
    const interval = setInterval(updateData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const calculateSystemStatus = (errorStats: any, perfAggregates: any): SystemStatus => {
    const errorRate = errorStats.errorRate;
    const avgLatency = perfAggregates.avg;
    
    let status: SystemStatus['status'] = 'healthy';
    let message = 'All systems operational';
    
    if (errorRate > 10) {
      status = 'critical';
      message = `High error rate: ${errorRate.toFixed(1)} errors/min`;
    } else if (errorRate > 5) {
      status = 'warning';
      message = `Elevated error rate: ${errorRate.toFixed(1)} errors/min`;
    } else if (avgLatency > 2000) {
      status = 'warning';
      message = `High latency: ${avgLatency.toFixed(0)}ms average`;
    }
    
    return {
      status,
      message,
      metrics: {
        errorRate,
        avgLatency,
        connectionQuality: avgLatency < 100 ? 'excellent' : avgLatency < 500 ? 'good' : 'poor',
        activeUsers: Math.floor(Math.random() * 50) + 10 // Mock data
      }
    };
  };

  const getStatusColor = (status: SystemStatus['status']) => {
    switch (status) {
      case 'healthy': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const formatMetricValue = (metric: PerformanceMetric) => {
    if (metric.unit === 'ms') {
      return `${metric.value.toFixed(0)}ms`;
    }
    if (metric.unit === 'bytes') {
      return `${(metric.value / 1024).toFixed(1)}KB`;
    }
    return metric.value.toString();
  };

  const recentPerformanceMetrics = useMemo(() => {
    if (!metrics) return [];
    return metrics.performance
      .slice(-20)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [metrics]);

  const topErrors = useMemo(() => {
    return errors
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [errors]);

  if (!metrics) {
    return (
      <div className={`monitoring-dashboard loading ${className}`}>
        <div className="loading-spinner">Loading monitoring data...</div>
      </div>
    );
  }

  return (
    <div className={`monitoring-dashboard ${className}`} style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f8fafc',
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid #e2e8f0'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: '600', 
          color: '#1e293b',
          margin: 0
        }}>
          System Monitoring
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(systemStatus.status)
          }} />
          <span style={{ fontSize: '14px', color: '#64748b' }}>
            {systemStatus.message}
          </span>
        </div>
      </div>

      {/* Status Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <StatusCard
          title="Error Rate"
          value={`${systemStatus.metrics.errorRate.toFixed(1)}/min`}
          status={systemStatus.metrics.errorRate > 5 ? 'warning' : 'good'}
        />
        <StatusCard
          title="Avg Latency"
          value={`${systemStatus.metrics.avgLatency.toFixed(0)}ms`}
          status={systemStatus.metrics.avgLatency > 1000 ? 'warning' : 'good'}
        />
        <StatusCard
          title="Connection"
          value={systemStatus.metrics.connectionQuality}
          status={systemStatus.metrics.connectionQuality === 'poor' ? 'warning' : 'good'}
        />
        <StatusCard
          title="Active Users"
          value={systemStatus.metrics.activeUsers.toString()}
          status="good"
        />
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '24px'
      }}>
        {/* Performance Metrics */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '20px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '16px'
          }}>
            Recent Performance
          </h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {recentPerformanceMetrics.map((metric, index) => (
              <div 
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: index < recentPerformanceMetrics.length - 1 ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                    {metric.name}
                  </div>
                  {metric.tags && (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {Object.entries(metric.tags).map(([key, value]) => `${key}: ${value}`).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: metric.value > 1000 ? '#ef4444' : '#10b981',
                  fontWeight: '600'
                }}>
                  {formatMetricValue(metric)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Summary */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '20px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '16px'
          }}>
            Top Errors
          </h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {topErrors.length > 0 ? (
              topErrors.map((error, index) => (
                <div 
                  key={error.fingerprint}
                  style={{
                    padding: '12px 0',
                    borderBottom: index < topErrors.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '4px'
                  }}>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#374151',
                      fontWeight: '500',
                      flex: 1,
                      marginRight: '8px'
                    }}>
                      {error.errors[0]?.error.message || 'Unknown error'}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#ef4444',
                      fontWeight: '600',
                      backgroundColor: '#fef2f2',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {error.count}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#64748b'
                  }}>
                    Last seen: {new Date(error.lastSeen).toLocaleTimeString()}
                  </div>
                  {error.trend !== 'stable' && (
                    <div style={{
                      fontSize: '12px',
                      color: error.trend === 'increasing' ? '#ef4444' : '#10b981',
                      fontWeight: '500'
                    }}>
                      {error.trend === 'increasing' ? '↗ Increasing' : '↘ Decreasing'}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ 
                textAlign: 'center', 
                color: '#64748b', 
                fontSize: '14px',
                padding: '20px 0'
              }}>
                No errors detected 🎉
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Usage Metrics */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        border: '1px solid #e2e8f0',
        marginTop: '24px'
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1e293b',
          marginBottom: '16px'
        }}>
          Usage Statistics
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px'
        }}>
          <UsageMetric
            label="Messages Sent"
            value={metrics.business.filter(m => m.metric === 'message_sent').length}
          />
          <UsageMetric
            label="Sessions Created"
            value={metrics.business.filter(m => m.metric === 'session_created').length}
          />
          <UsageMetric
            label="Wallet Connections"
            value={metrics.business.filter(m => m.metric === 'wallet_connected').length}
          />
          <UsageMetric
            label="API Calls"
            value={metrics.performance.filter(m => m.name.startsWith('api_call')).length}
          />
        </div>
      </div>
    </div>
  );
};

const StatusCard: React.FC<{
  title: string;
  value: string;
  status: 'good' | 'warning' | 'error';
}> = ({ title, value, status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ 
        fontSize: '12px', 
        color: '#64748b',
        fontWeight: '500',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: '700',
        color: getStatusColor()
      }}>
        {value}
      </div>
    </div>
  );
};

const UsageMetric: React.FC<{
  label: string;
  value: number;
}> = ({ label, value }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      fontSize: '24px',
      fontWeight: '700',
      color: '#1e293b',
      marginBottom: '4px'
    }}>
      {value.toLocaleString()}
    </div>
    <div style={{
      fontSize: '12px',
      color: '#64748b',
      fontWeight: '500'
    }}>
      {label}
    </div>
  </div>
);

export default MonitoringDashboard;