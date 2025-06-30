import { RelayConfig } from '../services/relay/RelayManager';

/**
 * Default relay configuration for different environments
 */

export const DEVELOPMENT_RELAY_CONFIG: RelayConfig = {
  relays: [
    {
      id: 'local-relay-1',
      url: 'ws://localhost:8080',
      region: 'local',
      priority: 1,
      maxConnections: 100,
      currentConnections: 0,
      isHealthy: true,
      lastHealthCheck: new Date(),
      qualityScore: 1.0,
      latency: 0,
      metadata: {
        environment: 'development',
        version: '1.0.0'
      }
    }
  ],
  selectionStrategy: 'round-robin',
  failoverThreshold: 500,
  healthCheckInterval: 30000, // 30 seconds
  maxRetries: 3,
  connectionTimeout: 5000,
  enableAutoDiscovery: false,
  preferredRegions: ['local']
};

export const PRODUCTION_RELAY_CONFIG: RelayConfig = {
  relays: [
    {
      id: 'prod-relay-us-east-1',
      url: 'wss://relay-us-east-1.solconnect.io',
      region: 'us-east',
      priority: 1,
      maxConnections: 1000,
      currentConnections: 0,
      isHealthy: true,
      lastHealthCheck: new Date(),
      qualityScore: 1.0,
      latency: 0,
      metadata: {
        environment: 'production',
        datacenter: 'us-east-1',
        version: '1.0.0'
      }
    },
    {
      id: 'prod-relay-us-west-1',
      url: 'wss://relay-us-west-1.solconnect.io',
      region: 'us-west',
      priority: 2,
      maxConnections: 1000,
      currentConnections: 0,
      isHealthy: true,
      lastHealthCheck: new Date(),
      qualityScore: 1.0,
      latency: 0,
      metadata: {
        environment: 'production',
        datacenter: 'us-west-1',
        version: '1.0.0'
      }
    },
    {
      id: 'prod-relay-eu-west-1',
      url: 'wss://relay-eu-west-1.solconnect.io',
      region: 'eu-west',
      priority: 3,
      maxConnections: 1000,
      currentConnections: 0,
      isHealthy: true,
      lastHealthCheck: new Date(),
      qualityScore: 1.0,
      latency: 0,
      metadata: {
        environment: 'production',
        datacenter: 'eu-west-1',
        version: '1.0.0'
      }
    },
    {
      id: 'prod-relay-ap-south-1',
      url: 'wss://relay-ap-south-1.solconnect.io',
      region: 'ap-south',
      priority: 4,
      maxConnections: 1000,
      currentConnections: 0,
      isHealthy: true,
      lastHealthCheck: new Date(),
      qualityScore: 1.0,
      latency: 0,
      metadata: {
        environment: 'production',
        datacenter: 'ap-south-1',
        version: '1.0.0'
      }
    }
  ],
  selectionStrategy: 'weighted',
  failoverThreshold: 500,
  healthCheckInterval: 10000, // 10 seconds
  maxRetries: 5,
  connectionTimeout: 5000,
  enableAutoDiscovery: true,
  preferredRegions: [] // Will be set based on user location
};

/**
 * Get relay configuration based on environment
 */
export function getRelayConfig(): RelayConfig {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    // In production, determine preferred regions based on user location
    const config = { ...PRODUCTION_RELAY_CONFIG };
    config.preferredRegions = determinePreferredRegions();
    return config;
  }
  
  return DEVELOPMENT_RELAY_CONFIG;
}

/**
 * Determine preferred regions based on user's timezone or geolocation
 */
function determinePreferredRegions(): string[] {
  // This is a simplified version. In production, you might use:
  // - Timezone detection
  // - IP geolocation
  // - User preferences
  
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  if (timezone.includes('America')) {
    return ['us-east', 'us-west'];
  } else if (timezone.includes('Europe') || timezone.includes('Africa')) {
    return ['eu-west', 'us-east'];
  } else if (timezone.includes('Asia') || timezone.includes('Australia')) {
    return ['ap-south', 'us-west'];
  }
  
  // Default fallback
  return ['us-east', 'us-west', 'eu-west', 'ap-south'];
}

/**
 * Custom relay configuration for specific use cases
 */
export const CUSTOM_RELAY_CONFIGS = {
  // High-frequency trading configuration
  trading: {
    selectionStrategy: 'least-latency' as const,
    failoverThreshold: 100, // Very fast failover
    healthCheckInterval: 1000, // Frequent health checks
  },
  
  // Mobile configuration with battery optimization
  mobile: {
    healthCheckInterval: 60000, // Less frequent checks
    enableAutoDiscovery: false, // Save battery
    connectionTimeout: 10000, // More tolerant of slow connections
  },
  
  // Enterprise configuration with custom relays
  enterprise: {
    enableAutoDiscovery: false,
    relays: [] // Will be populated with enterprise-specific relays
  }
};

/**
 * Merge custom configuration with base configuration
 */
export function mergeRelayConfig(
  baseConfig: RelayConfig,
  customConfig: Partial<RelayConfig>
): RelayConfig {
  return {
    ...baseConfig,
    ...customConfig,
    relays: customConfig.relays || baseConfig.relays
  };
} 