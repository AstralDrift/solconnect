import React, { useEffect, useState } from 'react';
import { RelayEndpoint, RelayMetrics } from '../../services/relay/RelayManager';

interface RelayStatusProps {
  transport?: any; // RelayWebSocketTransport instance
  className?: string;
}

interface RelayStatusInfo {
  primaryRelay: RelayEndpoint | null;
  availableRelays: RelayEndpoint[];
  metrics: RelayMetrics | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export const RelayStatus: React.FC<RelayStatusProps> = ({ transport, className = '' }) => {
  const [relayInfo, setRelayInfo] = useState<RelayStatusInfo>({
    primaryRelay: null,
    availableRelays: [],
    metrics: null,
    connectionStatus: 'disconnected'
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!transport || !transport.getRelayMetrics) return;

    const updateRelayInfo = () => {
      try {
        const metrics = transport.getRelayMetrics();
        const availableRelays = transport.getAvailableRelays();
        const activeConnections = transport.getActiveConnections();
        const primaryConnection = activeConnections.find((conn: any) => conn.state === 'connected');

        setRelayInfo({
          primaryRelay: primaryConnection?.relay || null,
          availableRelays,
          metrics,
          connectionStatus: transport.connectionStatus || 'disconnected'
        });
      } catch (error) {
        console.error('Error updating relay info:', error);
      }
    };

    // Initial update
    updateRelayInfo();

    // Update every 2 seconds
    const interval = setInterval(updateRelayInfo, 2000);

    return () => clearInterval(interval);
  }, [transport]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'disconnected':
        return 'text-red-500';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatLatency = (latency: number) => {
    if (latency < 1000) return `${latency}ms`;
    return `${(latency / 1000).toFixed(1)}s`;
  };

  if (!transport || !relayInfo.metrics) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Relay Status</h3>
          <span className="text-sm text-gray-500">No relay connection</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Relay Network</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Primary Connection Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Status</span>
          <span className={`text-sm font-medium ${getStatusColor(relayInfo.connectionStatus)}`}>
            {relayInfo.connectionStatus.charAt(0).toUpperCase() + relayInfo.connectionStatus.slice(1)}
          </span>
        </div>

        {relayInfo.primaryRelay && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Primary Relay</span>
              <span className="text-sm text-white">{relayInfo.primaryRelay.region}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Latency</span>
              <span className="text-sm text-white">{formatLatency(relayInfo.primaryRelay.latency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Health</span>
              <span className={`text-sm font-medium ${getHealthColor(relayInfo.primaryRelay.qualityScore)}`}>
                {(relayInfo.primaryRelay.qualityScore * 100).toFixed(0)}%
              </span>
            </div>
          </>
        )}

        {/* Metrics Summary */}
        <div className="pt-3 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-gray-500">Active Relays</span>
              <p className="text-sm font-medium text-white">
                {relayInfo.metrics.healthyRelays} / {relayInfo.metrics.totalRelays}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Avg Latency</span>
              <p className="text-sm font-medium text-white">
                {formatLatency(relayInfo.metrics.averageLatency)}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Messages</span>
              <p className="text-sm font-medium text-white">
                ↑{relayInfo.metrics.totalMessagesSent} ↓{relayInfo.metrics.totalMessagesReceived}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Failovers</span>
              <p className="text-sm font-medium text-white">
                {relayInfo.metrics.failoverCount}
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Relay List */}
        {showDetails && relayInfo.availableRelays.length > 0 && (
          <div className="pt-3 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Available Relays</h4>
            <div className="space-y-2">
              {relayInfo.availableRelays.map((relay) => (
                <div
                  key={relay.id}
                  className={`p-2 rounded ${
                    relay.id === relayInfo.primaryRelay?.id ? 'bg-gray-700' : 'bg-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          relay.isHealthy ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-xs text-white">{relay.region}</span>
                      {relay.id === relayInfo.primaryRelay?.id && (
                        <span className="text-xs text-blue-400">(Primary)</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-400">
                        {formatLatency(relay.latency)}
                      </span>
                      <span className={`text-xs ${getHealthColor(relay.qualityScore)}`}>
                        {(relay.qualityScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {relay.id === relayInfo.primaryRelay?.id && (
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>Connections: {relay.currentConnections}/{relay.maxConnections}</span>
                      <span>Priority: {relay.priority}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 