/**
 * Vector Clock implementation for distributed conflict resolution
 * Provides ordering and causality tracking for messages across devices
 */

import { VectorClock } from './SyncProtocol';

/**
 * Vector clock operations for conflict resolution
 */
export class VectorClockManager {
  /**
   * Initialize a new vector clock
   */
  static create(deviceId: string): VectorClock {
    return { [deviceId]: 0 };
  }

  /**
   * Increment the clock for a device
   */
  static increment(clock: VectorClock, deviceId: string): VectorClock {
    return {
      ...clock,
      [deviceId]: (clock[deviceId] || 0) + 1
    };
  }

  /**
   * Update clock with received vector clock (merge)
   */
  static update(localClock: VectorClock, remoteClock: VectorClock, localDeviceId: string): VectorClock {
    const merged: VectorClock = { ...localClock };

    // Take the maximum value for each device
    for (const [deviceId, remoteValue] of Object.entries(remoteClock)) {
      const localValue = merged[deviceId] || 0;
      merged[deviceId] = Math.max(localValue, remoteValue);
    }

    // Increment local device's counter
    merged[localDeviceId] = (merged[localDeviceId] || 0) + 1;

    return merged;
  }

  /**
   * Compare two vector clocks
   * Returns:
   *  -1 if a < b (a happened before b)
   *   0 if a || b (concurrent/conflicting)
   *   1 if a > b (a happened after b)
   */
  static compare(a: VectorClock, b: VectorClock): -1 | 0 | 1 {
    let aLessEqual = true;
    let bLessEqual = true;

    // Get all device IDs from both clocks
    const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const deviceId of allDevices) {
      const aValue = a[deviceId] || 0;
      const bValue = b[deviceId] || 0;

      if (aValue > bValue) {
        bLessEqual = false;
      }
      if (bValue > aValue) {
        aLessEqual = false;
      }
    }

    if (aLessEqual && bLessEqual) {
      // Equal vectors
      return 0;
    } else if (aLessEqual) {
      // a happened before b
      return -1;
    } else if (bLessEqual) {
      // b happened before a
      return 1;
    } else {
      // Concurrent (neither happened before the other)
      return 0;
    }
  }

  /**
   * Check if two vector clocks are concurrent (conflicting)
   */
  static areConcurrent(a: VectorClock, b: VectorClock): boolean {
    const comparison = this.compare(a, b);
    return comparison === 0 && !this.areEqual(a, b);
  }

  /**
   * Check if two vector clocks are equal
   */
  static areEqual(a: VectorClock, b: VectorClock): boolean {
    const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);
    
    for (const deviceId of allDevices) {
      if ((a[deviceId] || 0) !== (b[deviceId] || 0)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if clock 'a' happened before clock 'b'
   */
  static happenedBefore(a: VectorClock, b: VectorClock): boolean {
    return this.compare(a, b) === -1;
  }

  /**
   * Merge multiple vector clocks (for consensus)
   */
  static merge(clocks: VectorClock[]): VectorClock {
    if (clocks.length === 0) return {};
    if (clocks.length === 1) return { ...clocks[0] };

    const merged: VectorClock = {};
    const allDevices = new Set(clocks.flatMap(clock => Object.keys(clock)));

    for (const deviceId of allDevices) {
      merged[deviceId] = Math.max(...clocks.map(clock => clock[deviceId] || 0));
    }

    return merged;
  }

  /**
   * Get the total order value (sum of all components)
   * Useful for breaking ties in concurrent messages
   */
  static getTotalOrder(clock: VectorClock): number {
    return Object.values(clock).reduce((sum, value) => sum + value, 0);
  }

  /**
   * Convert vector clock to string for storage/display
   */
  static toString(clock: VectorClock): string {
    const entries = Object.entries(clock)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([device, value]) => `${device}:${value}`);
    return `{${entries.join(',')}}`;
  }

  /**
   * Parse vector clock from string
   */
  static fromString(str: string): VectorClock {
    const clock: VectorClock = {};
    const cleaned = str.replace(/[{}]/g, '');
    
    if (!cleaned) return clock;

    const entries = cleaned.split(',');
    for (const entry of entries) {
      const [device, value] = entry.split(':');
      if (device && value) {
        clock[device.trim()] = parseInt(value.trim(), 10) || 0;
      }
    }

    return clock;
  }

  /**
   * Get the sequence number for a specific device
   */
  static getDeviceSequence(clock: VectorClock, deviceId: string): number {
    return clock[deviceId] || 0;
  }

  /**
   * Get the highest sequence number across all devices
   */
  static getMaxSequence(clock: VectorClock): number {
    const values = Object.values(clock);
    return values.length > 0 ? Math.max(...values) : 0;
  }

  /**
   * Create a snapshot of the vector clock
   */
  static snapshot(clock: VectorClock): VectorClock {
    return { ...clock };
  }
}

/**
 * Conflict resolution strategies using vector clocks
 */
export class ConflictResolver {
  /**
   * Resolve conflicts between concurrent messages
   */
  static resolveConflict(
    messages: Array<{
      message: any;
      vectorClock: VectorClock;
      deviceId: string;
      timestamp: number;
    }>,
    strategy: 'latest' | 'vector_clock' | 'merge' = 'vector_clock'
  ): any {
    if (messages.length === 0) return null;
    if (messages.length === 1) return messages[0].message;

    switch (strategy) {
      case 'latest':
        // Simple: take the message with the latest timestamp
        return messages.reduce((latest, current) => 
          current.timestamp > latest.timestamp ? current : latest
        ).message;

      case 'vector_clock':
        // Use vector clock ordering, with timestamp as tiebreaker
        const sorted = messages.sort((a, b) => {
          const comparison = VectorClockManager.compare(a.vectorClock, b.vectorClock);
          
          if (comparison !== 0) return comparison;
          
          // For concurrent messages, use total order as first tiebreaker
          const totalOrderDiff = VectorClockManager.getTotalOrder(b.vectorClock) - 
                               VectorClockManager.getTotalOrder(a.vectorClock);
          if (totalOrderDiff !== 0) return totalOrderDiff;
          
          // Then timestamp
          if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
          
          // Finally, device ID for deterministic ordering
          return b.deviceId.localeCompare(a.deviceId);
        });
        
        return sorted[0].message;

      case 'merge':
        // Application-specific merge logic would go here
        // For now, fall back to vector_clock strategy
        return this.resolveConflict(messages, 'vector_clock');

      default:
        throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
    }
  }

  /**
   * Detect if messages are in conflict
   */
  static hasConflict(
    vectorClocks: VectorClock[]
  ): boolean {
    if (vectorClocks.length < 2) return false;

    // Check all pairs for concurrency
    for (let i = 0; i < vectorClocks.length; i++) {
      for (let j = i + 1; j < vectorClocks.length; j++) {
        if (VectorClockManager.areConcurrent(vectorClocks[i], vectorClocks[j])) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Group messages by their causal relationships
   */
  static groupByCausality(
    messages: Array<{ id: string; vectorClock: VectorClock }>
  ): Array<Array<typeof messages[0]>> {
    const groups: Array<Array<typeof messages[0]>> = [];
    const processed = new Set<string>();

    for (const message of messages) {
      if (processed.has(message.id)) continue;

      const group = [message];
      processed.add(message.id);

      // Find all concurrent messages
      for (const other of messages) {
        if (processed.has(other.id)) continue;
        
        if (VectorClockManager.areConcurrent(message.vectorClock, other.vectorClock)) {
          group.push(other);
          processed.add(other.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }
} 