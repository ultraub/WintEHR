/**
 * Intelligent Caching System
 * Provides smart caching strategies for different types of EMR data
 */

class IntelligentCache {
  constructor() {
    this.cache = new Map();
    this.priorityLevels = {
      CRITICAL: 'critical',     // 30 minutes
      IMPORTANT: 'important',   // 15 minutes  
      NORMAL: 'normal',         // 10 minutes
      LOW: 'low'               // 5 minutes
    };
    
    this.ttlMap = {
      [this.priorityLevels.CRITICAL]: 30 * 60 * 1000,  // 30 minutes
      [this.priorityLevels.IMPORTANT]: 15 * 60 * 1000, // 15 minutes
      [this.priorityLevels.NORMAL]: 10 * 60 * 1000,    // 10 minutes
      [this.priorityLevels.LOW]: 5 * 60 * 1000         // 5 minutes
    };
    
    // Define priority levels for different resource types
    this.resourcePriorities = {
      // Critical - rarely change, cache longer
      'Patient': this.priorityLevels.CRITICAL,
      'AllergyIntolerance': this.priorityLevels.CRITICAL,
      'Condition': this.priorityLevels.IMPORTANT,
      'MedicationRequest': this.priorityLevels.IMPORTANT,
      
      // Important - moderate change frequency
      'Encounter': this.priorityLevels.IMPORTANT,
      'Procedure': this.priorityLevels.IMPORTANT,
      'DiagnosticReport': this.priorityLevels.IMPORTANT,
      
      // Normal - regular updates expected
      'Observation': this.priorityLevels.NORMAL,
      'DocumentReference': this.priorityLevels.NORMAL,
      'ImagingStudy': this.priorityLevels.NORMAL,
      
      // Low - frequently updated or less critical
      'CareTeam': this.priorityLevels.LOW,
      'CarePlan': this.priorityLevels.LOW,
      'Coverage': this.priorityLevels.LOW
    };
    
    // Automatically clean expired entries
    this.startCleanupTimer();
  }
  
  /**
   * Set cache entry with intelligent TTL based on data type
   */
  set(key, data, options = {}) {
    const {
      resourceType,
      priority,
      customTTL,
      tags = []
    } = options;
    
    let ttl;
    if (customTTL) {
      ttl = customTTL;
    } else if (priority) {
      ttl = this.ttlMap[priority];
    } else if (resourceType && this.resourcePriorities[resourceType]) {
      ttl = this.ttlMap[this.resourcePriorities[resourceType]];
    } else {
      ttl = this.ttlMap[this.priorityLevels.NORMAL];
    }
    
    const entry = {
      data,
      timestamp: Date.now(),
      ttl,
      expiresAt: Date.now() + ttl,
      priority: priority || this.resourcePriorities[resourceType] || this.priorityLevels.NORMAL,
      resourceType,
      tags,
      accessCount: 0,
      lastAccessed: Date.now()
    };
    
    this.cache.set(key, entry);
    
    // If cache is getting large, proactively clean low-priority items
    if (this.cache.size > 1000) {
      this.cleanupLowPriority();
    }
    
    return entry;
  }
  
  /**
   * Get cache entry with automatic cleanup of expired items
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.data;
  }
  
  /**
   * Check if key exists and is not expired
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete specific cache entry
   */
  delete(key) {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries for a specific patient
   */
  clearPatient(patientId) {
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (key.includes(patientId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
  
  /**
   * Clear entries by resource type
   */
  clearResourceType(resourceType) {
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.resourceType === resourceType) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
  
  /**
   * Clear entries by tags
   */
  clearByTag(tag) {
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags && entry.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    let totalEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;
    const priorityStats = {};
    const resourceTypeStats = {};
    
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      totalEntries++;
      
      if (now > entry.expiresAt) {
        expiredEntries++;
      }
      
      // Estimate size (rough approximation)
      totalSize += JSON.stringify(entry.data).length;
      
      // Priority stats
      if (!priorityStats[entry.priority]) {
        priorityStats[entry.priority] = 0;
      }
      priorityStats[entry.priority]++;
      
      // Resource type stats
      if (entry.resourceType) {
        if (!resourceTypeStats[entry.resourceType]) {
          resourceTypeStats[entry.resourceType] = 0;
        }
        resourceTypeStats[entry.resourceType]++;
      }
    }
    
    return {
      totalEntries,
      expiredEntries,
      activeEntries: totalEntries - expiredEntries,
      estimatedSizeBytes: totalSize,
      estimatedSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      priorityBreakdown: priorityStats,
      resourceTypeBreakdown: resourceTypeStats,
      hitRate: this.calculateHitRate()
    };
  }
  
  /**
   * Calculate cache hit rate
   */
  calculateHitRate() {
    let totalAccess = 0;
    let totalHits = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      totalAccess += entry.accessCount;
      if (entry.accessCount > 0) {
        totalHits++;
      }
    }
    
    return totalAccess > 0 ? ((totalHits / totalAccess) * 100).toFixed(2) : 0;
  }
  
  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
  
  /**
   * Cleanup low priority items when cache is full
   */
  cleanupLowPriority() {
    const lowPriorityKeys = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.priority === this.priorityLevels.LOW) {
        lowPriorityKeys.push({ key, lastAccessed: entry.lastAccessed });
      }
    }
    
    // Sort by least recently accessed and remove oldest
    lowPriorityKeys
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .slice(0, 100) // Remove up to 100 entries
      .forEach(item => this.cache.delete(item.key));
  }
  
  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    // Clean expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
      }
    }, 5 * 60 * 1000);
  }
  
  /**
   * Stop automatic cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }
  
  /**
   * Prefetch data for common access patterns
   */
  prefetch(patientId, priority = 'important') {
    // Implementation would depend on specific prefetch strategy
    // This is a placeholder for prefetch logic
    // Prefetching logic placeholder
  }
}

// Create singleton instance
export const intelligentCache = new IntelligentCache();

// Cache utility functions
export const cacheUtils = {
  // Generate cache key for patient resources
  patientResourceKey: (patientId, resourceType, params = {}) => {
    const paramString = Object.keys(params).length > 0 ? 
      JSON.stringify(params) : '';
    return `patient:${patientId}:${resourceType}:${paramString}`;
  },
  
  // Generate cache key for search results
  searchKey: (query, resourceType, params = {}) => {
    return `search:${resourceType}:${query}:${JSON.stringify(params)}`;
  },
  
  // Generate cache key for bundles
  bundleKey: (patientId, priority = 'all') => {
    return `bundle:${patientId}:${priority}`;
  }
};

export default intelligentCache;