/**
 * UI Serializer Service
 * Handles save/load dashboard specifications
 */

import { validateUISpec } from '../utils/uiSpecSchema';

class UISerializer {
  constructor() {
    this.storageKey = 'ui-composer-dashboards';
  }

  /**
   * Save dashboard specification
   */
  async saveDashboard(specification, metadata = {}) {
    try {
      // Validate specification
      const validation = validateUISpec(specification);
      if (!validation.valid) {
        throw new Error(`Invalid specification: ${validation.errors.join(', ')}`);
      }
      
      // Create dashboard entry
      const dashboard = {
        id: metadata.id || Date.now().toString(),
        name: metadata.name || 'Untitled Dashboard',
        description: metadata.description || '',
        specification,
        metadata: {
          ...metadata,
          version: '1.0',
          createdAt: metadata.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
      
      // Get existing dashboards
      const dashboards = await this.loadDashboards();
      
      // Add or update dashboard
      const existingIndex = dashboards.findIndex(d => d.id === dashboard.id);
      if (existingIndex >= 0) {
        dashboards[existingIndex] = dashboard;
      } else {
        dashboards.push(dashboard);
      }
      
      // Save to storage
      await this.saveDashboards(dashboards);
      
      return dashboard;
      
    } catch (error) {
      throw new Error(`Failed to save dashboard: ${error.message}`);
    }
  }

  /**
   * Load dashboard by ID
   */
  async loadDashboard(id) {
    try {
      const dashboards = await this.loadDashboards();
      const dashboard = dashboards.find(d => d.id === id);
      
      if (!dashboard) {
        throw new Error(`Dashboard with ID ${id} not found`);
      }
      
      // Validate specification
      const validation = validateUISpec(dashboard.specification);
      if (!validation.valid) {
        throw new Error(`Invalid specification: ${validation.errors.join(', ')}`);
      }
      
      return dashboard;
      
    } catch (error) {
      throw new Error(`Failed to load dashboard: ${error.message}`);
    }
  }

  /**
   * Load all dashboards
   */
  async loadDashboards() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return [];
      }
      
      const dashboards = JSON.parse(stored);
      
      // Validate each dashboard
      const validDashboards = dashboards.filter(dashboard => {
        const validation = validateUISpec(dashboard.specification);
        return validation.valid;
      });
      
      return validDashboards;
      
    } catch (error) {
      // Error loading dashboards
      return [];
    }
  }

  /**
   * Save dashboards to storage
   */
  async saveDashboards(dashboards) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(dashboards));
    } catch (error) {
      throw new Error(`Failed to save dashboards: ${error.message}`);
    }
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(id) {
    try {
      const dashboards = await this.loadDashboards();
      const filteredDashboards = dashboards.filter(d => d.id !== id);
      
      if (filteredDashboards.length === dashboards.length) {
        throw new Error(`Dashboard with ID ${id} not found`);
      }
      
      await this.saveDashboards(filteredDashboards);
      
      return true;
      
    } catch (error) {
      throw new Error(`Failed to delete dashboard: ${error.message}`);
    }
  }

  /**
   * Export dashboard as JSON
   */
  async exportDashboard(id) {
    try {
      const dashboard = await this.loadDashboard(id);
      
      const exportData = {
        ...dashboard,
        exportedAt: new Date().toISOString(),
        exportVersion: '1.0'
      };
      
      return JSON.stringify(exportData, null, 2);
      
    } catch (error) {
      throw new Error(`Failed to export dashboard: ${error.message}`);
    }
  }

  /**
   * Import dashboard from JSON
   */
  async importDashboard(jsonData) {
    try {
      const importData = JSON.parse(jsonData);
      
      // Validate required fields
      if (!importData.specification || !importData.name) {
        throw new Error('Invalid dashboard data');
      }
      
      // Create new dashboard
      const dashboard = {
        id: Date.now().toString(),
        name: importData.name,
        description: importData.description || '',
        specification: importData.specification,
        metadata: {
          ...importData.metadata,
          importedAt: new Date().toISOString(),
          originalId: importData.id
        }
      };
      
      // Save dashboard
      return await this.saveDashboard(dashboard.specification, dashboard.metadata);
      
    } catch (error) {
      throw new Error(`Failed to import dashboard: ${error.message}`);
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    try {
      const dashboards = await this.loadDashboards();
      
      const stats = {
        total: dashboards.length,
        byType: {},
        byAuthor: {},
        totalComponents: 0,
        totalDataSources: 0
      };
      
      dashboards.forEach(dashboard => {
        const spec = dashboard.specification;
        const layoutType = spec.layout?.type || 'unknown';
        
        stats.byType[layoutType] = (stats.byType[layoutType] || 0) + 1;
        
        const author = dashboard.metadata?.author || 'unknown';
        stats.byAuthor[author] = (stats.byAuthor[author] || 0) + 1;
        
        stats.totalComponents += this.countComponents(spec.layout?.structure);
        stats.totalDataSources += spec.dataSources?.length || 0;
      });
      
      return stats;
      
    } catch (error) {
      return {
        total: 0,
        byType: {},
        byAuthor: {},
        totalComponents: 0,
        totalDataSources: 0,
        error: error.message
      };
    }
  }

  /**
   * Count components in specification
   */
  countComponents(structure) {
    if (!structure) return 0;
    
    let count = 1; // Count current component
    
    if (structure.children && Array.isArray(structure.children)) {
      structure.children.forEach(child => {
        count += this.countComponents(child);
      });
    }
    
    return count;
  }

  /**
   * Clear all dashboards
   */
  async clearAllDashboards() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      throw new Error(`Failed to clear dashboards: ${error.message}`);
    }
  }

  /**
   * Backup dashboards
   */
  async backupDashboards() {
    try {
      const dashboards = await this.loadDashboards();
      
      const backup = {
        dashboards,
        backupDate: new Date().toISOString(),
        version: '1.0'
      };
      
      return JSON.stringify(backup, null, 2);
      
    } catch (error) {
      throw new Error(`Failed to backup dashboards: ${error.message}`);
    }
  }

  /**
   * Restore dashboards from backup
   */
  async restoreDashboards(backupData) {
    try {
      const backup = JSON.parse(backupData);
      
      if (!backup.dashboards || !Array.isArray(backup.dashboards)) {
        throw new Error('Invalid backup data');
      }
      
      // Validate each dashboard
      const validDashboards = backup.dashboards.filter(dashboard => {
        const validation = validateUISpec(dashboard.specification);
        return validation.valid;
      });
      
      await this.saveDashboards(validDashboards);
      
      return validDashboards.length;
      
    } catch (error) {
      throw new Error(`Failed to restore dashboards: ${error.message}`);
    }
  }
}

// Create singleton instance
const uiSerializer = new UISerializer();

export default uiSerializer;