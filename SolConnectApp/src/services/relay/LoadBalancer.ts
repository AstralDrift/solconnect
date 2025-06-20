import { Logger } from '../monitoring/Logger';
import { RelayEndpoint, RelayConfig } from './RelayManager';

export interface LoadBalancingStrategy {
  algorithm: 'round-robin' | 'least-connections' | 'weighted-random' | 'geographic' | 'adaptive';
  weights: Record<string, number>;
  stickySession: boolean;
  healthWeight: number; // 0-1, how much health affects selection
  latencyWeight: number; // 0-1, how much latency affects selection
  loadWeight: number; // 0-1, how much current load affects selection
}

export interface LoadMetrics {
  totalSelections: number;
  selectionsByRelay: Record<string, number>;
  averageSelectionTime: number;
  strategyEffectiveness: Record<string, number>;
}

export interface RelayScore {
  relayId: string;
  baseScore: number;
  healthScore: number;
  latencyScore: number;
  loadScore: number;
  geoScore: number;
  finalScore: number;
  selectedCount: number;
}

/**
 * Performance-first load balancer with adaptive relay selection
 */
export class LoadBalancer {
  private logger = new Logger('LoadBalancer');
  private config: RelayConfig;
  private strategy: LoadBalancingStrategy;
  
  private selectionHistory: string[] = [];
  private roundRobinIndex = 0;
  private metrics: LoadMetrics;
  private relayScores = new Map<string, RelayScore>();
  
  // Geographic preferences
  private userRegion: string | null = null;
  private regionLatencies = new Map<string, number>();

  constructor(config: RelayConfig) {
    this.config = config;
    this.strategy = this.getDefaultStrategy();
    this.metrics = this.initializeMetrics();
    
    // Detect user's geographic region
    this.detectUserRegion();
  }

  /**
   * Select optimal relay based on configured strategy
   */
  async selectRelay(availableRelays: RelayEndpoint[]): Promise<RelayEndpoint> {
    const startTime = performance.now();
    
    try {
      if (availableRelays.length === 0) {
        throw new Error('No available relays for selection');
      }

      if (availableRelays.length === 1) {
        this.updateMetrics(availableRelays[0].id, performance.now() - startTime);
        return availableRelays[0];
      }

      let selectedRelay: RelayEndpoint;

      switch (this.strategy.algorithm) {
        case 'round-robin':
          selectedRelay = this.selectRoundRobin(availableRelays);
          break;
        case 'least-connections':
          selectedRelay = this.selectLeastConnections(availableRelays);
          break;
        case 'weighted-random':
          selectedRelay = this.selectWeightedRandom(availableRelays);
          break;
        case 'geographic':
          selectedRelay = this.selectGeographic(availableRelays);
          break;
        case 'adaptive':
          selectedRelay = await this.selectAdaptive(availableRelays);
          break;
        default:
          selectedRelay = this.selectWeightedRandom(availableRelays);
      }

      const selectionTime = performance.now() - startTime;
      this.updateMetrics(selectedRelay.id, selectionTime);
      
      this.logger.debug('Relay selected', {
        algorithm: this.strategy.algorithm,
        selectedRelay: selectedRelay.id,
        selectionTime: `${selectionTime.toFixed(2)}ms`,
        availableCount: availableRelays.length
      });

      return selectedRelay;
    } catch (error) {
      this.logger.error('Relay selection failed', error);
      // Fallback to first available relay
      return availableRelays[0];
    }
  }

  /**
   * Round-robin selection algorithm
   */
  private selectRoundRobin(relays: RelayEndpoint[]): RelayEndpoint {
    const selectedRelay = relays[this.roundRobinIndex % relays.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % relays.length;
    return selectedRelay;
  }

  /**
   * Least connections selection algorithm
   */
  private selectLeastConnections(relays: RelayEndpoint[]): RelayEndpoint {
    return relays.reduce((minRelay, currentRelay) => {
      // Calculate effective load considering max capacity
      const minLoad = minRelay.currentConnections / minRelay.maxConnections;
      const currentLoad = currentRelay.currentConnections / currentRelay.maxConnections;
      
      // Apply health weighting
      const minEffectiveLoad = minLoad / (minRelay.isHealthy ? 1 : 2);
      const currentEffectiveLoad = currentLoad / (currentRelay.isHealthy ? 1 : 2);
      
      return currentEffectiveLoad < minEffectiveLoad ? currentRelay : minRelay;
    });
  }

  /**
   * Weighted random selection algorithm
   */
  private selectWeightedRandom(relays: RelayEndpoint[]): RelayEndpoint {
    // Calculate weights for each relay
    const weights = relays.map(relay => this.calculateRelayWeight(relay));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    if (totalWeight === 0) {
      // Fallback to random selection if all weights are 0
      return relays[Math.floor(Math.random() * relays.length)];
    }
    
    // Select based on weighted probability
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < relays.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return relays[i];
      }
    }
    
    // Fallback (shouldn't reach here)
    return relays[relays.length - 1];
  }

  /**
   * Geographic selection algorithm
   */
  private selectGeographic(relays: RelayEndpoint[]): RelayEndpoint {
    if (!this.userRegion) {
      // Fallback to latency-based selection
      return this.selectByLatency(relays);
    }

    // Prefer relays in the same region
    const sameRegionRelays = relays.filter(relay => relay.region === this.userRegion);
    
    if (sameRegionRelays.length > 0) {
      // Select best relay in same region
      return this.selectByLatency(sameRegionRelays);
    }

    // If no relays in same region, select closest by latency
    return this.selectByLatency(relays);
  }

  /**
   * Adaptive selection algorithm that learns from performance
   */
  private async selectAdaptive(relays: RelayEndpoint[]): Promise<RelayEndpoint> {
    // Update relay scores based on recent performance
    this.updateRelayScores(relays);
    
    // Calculate composite scores
    const scoredRelays = relays.map(relay => {
      const score = this.relayScores.get(relay.id) || this.createRelayScore(relay);
      return { relay, score: score.finalScore };
    });

    // Sort by score (highest first)
    scoredRelays.sort((a, b) => b.score - a.score);
    
    // Use weighted selection among top performers
    const topPerformers = scoredRelays.slice(0, Math.max(2, Math.ceil(relays.length * 0.5)));
    
    return this.selectWeightedFromScores(topPerformers.map(item => item.relay));
  }

  /**
   * Select relay based on latency only
   */
  private selectByLatency(relays: RelayEndpoint[]): RelayEndpoint {
    return relays.reduce((minRelay, currentRelay) => {
      const minLatency = minRelay.latency * (minRelay.isHealthy ? 1 : 2);
      const currentLatency = currentRelay.latency * (currentRelay.isHealthy ? 1 : 2);
      return currentLatency < minLatency ? currentRelay : minRelay;
    });
  }

  /**
   * Calculate weight for weighted random selection
   */
  private calculateRelayWeight(relay: RelayEndpoint): number {
    let weight = 1.0;
    
    // Health factor
    if (!relay.isHealthy) {
      weight *= 0.1; // Heavily penalize unhealthy relays
    }
    
    // Quality score factor
    weight *= (relay.qualityScore / 100);
    
    // Latency factor (lower latency = higher weight)
    const normalizedLatency = Math.max(1, relay.latency) / 1000; // Convert to seconds
    weight *= (1 / normalizedLatency);
    
    // Load factor (lower load = higher weight)
    const loadFactor = relay.currentConnections / relay.maxConnections;
    weight *= (1 - loadFactor);
    
    // Priority factor
    weight *= (relay.priority / 10);
    
    // Apply strategy weights
    weight *= this.strategy.weights[relay.id] || 1.0;
    
    return Math.max(0, weight);
  }

  /**
   * Update relay performance scores for adaptive selection
   */
  private updateRelayScores(relays: RelayEndpoint[]): void {
    for (const relay of relays) {
      let score = this.relayScores.get(relay.id);
      
      if (!score) {
        score = this.createRelayScore(relay);
        this.relayScores.set(relay.id, score);
      }
      
      // Update individual score components
      score.healthScore = relay.isHealthy ? 100 : 0;
      score.latencyScore = this.calculateLatencyScore(relay.latency);
      score.loadScore = this.calculateLoadScore(relay);
      score.geoScore = this.calculateGeoScore(relay);
      
      // Calculate final composite score
      score.finalScore = (
        score.baseScore * 0.2 +
        score.healthScore * this.strategy.healthWeight +
        score.latencyScore * this.strategy.latencyWeight +
        score.loadScore * this.strategy.loadWeight +
        score.geoScore * 0.1
      ) / (0.2 + this.strategy.healthWeight + this.strategy.latencyWeight + this.strategy.loadWeight + 0.1);
    }
  }

  /**
   * Create new relay score entry
   */
  private createRelayScore(relay: RelayEndpoint): RelayScore {
    return {
      relayId: relay.id,
      baseScore: relay.qualityScore,
      healthScore: relay.isHealthy ? 100 : 0,
      latencyScore: this.calculateLatencyScore(relay.latency),
      loadScore: this.calculateLoadScore(relay),
      geoScore: this.calculateGeoScore(relay),
      finalScore: 0,
      selectedCount: 0
    };
  }

  /**
   * Calculate latency score (0-100, higher is better)
   */
  private calculateLatencyScore(latency: number): number {
    if (latency <= 50) return 100;
    if (latency <= 100) return 90;
    if (latency <= 200) return 70;
    if (latency <= 500) return 50;
    if (latency <= 1000) return 30;
    return 10;
  }

  /**
   * Calculate load score (0-100, higher is better)
   */
  private calculateLoadScore(relay: RelayEndpoint): number {
    const loadRatio = relay.currentConnections / relay.maxConnections;
    return Math.max(0, (1 - loadRatio) * 100);
  }

  /**
   * Calculate geographic score (0-100, higher is better)
   */
  private calculateGeoScore(relay: RelayEndpoint): number {
    if (!this.userRegion) return 50; // Neutral score if region unknown
    
    if (relay.region === this.userRegion) return 100;
    
    // Score based on regional proximity
    const proximityMap: Record<string, Record<string, number>> = {
      'us-east': { 'us-west': 80, 'us-central': 90, 'eu-west': 60, 'asia': 40 },
      'us-west': { 'us-east': 80, 'us-central': 90, 'eu-west': 50, 'asia': 70 },
      'eu-west': { 'us-east': 60, 'us-west': 50, 'asia': 60 },
      'asia': { 'us-west': 70, 'eu-west': 60, 'us-east': 40 }
    };
    
    return proximityMap[this.userRegion]?.[relay.region] || 30;
  }

  /**
   * Select from relays using their calculated scores
   */
  private selectWeightedFromScores(relays: RelayEndpoint[]): RelayEndpoint {
    const weights = relays.map(relay => {
      const score = this.relayScores.get(relay.id);
      return score ? score.finalScore : 50; // Default score
    });
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < relays.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return relays[i];
      }
    }
    
    return relays[relays.length - 1];
  }

  /**
   * Detect user's geographic region
   */
  private async detectUserRegion(): Promise<void> {
    try {
      // In a real implementation, this would use IP geolocation
      // For now, we'll use a simple heuristic based on timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      if (timezone.includes('America')) {
        if (timezone.includes('New_York') || timezone.includes('Toronto')) {
          this.userRegion = 'us-east';
        } else if (timezone.includes('Los_Angeles') || timezone.includes('Vancouver')) {
          this.userRegion = 'us-west';
        } else {
          this.userRegion = 'us-central';
        }
      } else if (timezone.includes('Europe')) {
        this.userRegion = 'eu-west';
      } else if (timezone.includes('Asia')) {
        this.userRegion = 'asia';
      }
      
      this.logger.debug('Detected user region', { userRegion: this.userRegion, timezone });
    } catch (error) {
      this.logger.warn('Failed to detect user region', error);
    }
  }

  /**
   * Update load balancing strategy
   */
  updateStrategy(newStrategy: Partial<LoadBalancingStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
    this.logger.info('Load balancing strategy updated', { strategy: this.strategy });
  }

  /**
   * Get current load balancing metrics
   */
  getMetrics(): LoadMetrics {
    return { ...this.metrics };
  }

  /**
   * Get relay scores for monitoring
   */
  getRelayScores(): RelayScore[] {
    return Array.from(this.relayScores.values());
  }

  /**
   * Reset selection history and metrics
   */
  reset(): void {
    this.selectionHistory = [];
    this.roundRobinIndex = 0;
    this.metrics = this.initializeMetrics();
    this.relayScores.clear();
    
    this.logger.info('Load balancer reset');
  }

  // Private helper methods
  private updateMetrics(relayId: string, selectionTime: number): void {
    this.metrics.totalSelections++;
    this.metrics.selectionsByRelay[relayId] = (this.metrics.selectionsByRelay[relayId] || 0) + 1;
    
    // Update average selection time
    const totalTime = (this.metrics.averageSelectionTime * (this.metrics.totalSelections - 1)) + selectionTime;
    this.metrics.averageSelectionTime = totalTime / this.metrics.totalSelections;
    
    // Update relay score selection count
    const score = this.relayScores.get(relayId);
    if (score) {
      score.selectedCount++;
    }
    
    // Keep selection history for analysis
    this.selectionHistory.push(relayId);
    if (this.selectionHistory.length > 1000) {
      this.selectionHistory = this.selectionHistory.slice(-500);
    }
  }

  private getDefaultStrategy(): LoadBalancingStrategy {
    return {
      algorithm: 'adaptive',
      weights: {},
      stickySession: false,
      healthWeight: 0.4,
      latencyWeight: 0.3,
      loadWeight: 0.3
    };
  }

  private initializeMetrics(): LoadMetrics {
    return {
      totalSelections: 0,
      selectionsByRelay: {},
      averageSelectionTime: 0,
      strategyEffectiveness: {}
    };
  }
}