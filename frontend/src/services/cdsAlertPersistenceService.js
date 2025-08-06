/**
 * CDS Alert Persistence Service
 * Handles persistent storage of CDS alert dismissals and snoozes
 */

class CDSAlertPersistenceService {
  constructor() {
    this.storagePrefix = 'cds-alerts';
  }

  /**
   * Get storage key for patient-specific alerts
   */
  getStorageKey(patientId, type = 'dismissed') {
    return `${this.storagePrefix}-${type}-${patientId}`;
  }

  /**
   * Get dismissed alerts for a patient
   */
  getDismissedAlerts(patientId) {
    try {
      const key = this.getStorageKey(patientId, 'dismissed');
      const stored = localStorage.getItem(key);
      if (!stored) return new Set();
      
      const parsed = JSON.parse(stored);
      // Convert array to Set and filter out expired dismissals
      const now = Date.now();
      const validDismissals = parsed.filter(item => {
        if (item.expiresAt && item.expiresAt < now) {
          return false;
        }
        return true;
      });
      
      return new Set(validDismissals.map(item => item.alertId));
    } catch (e) {
      console.error('Failed to load dismissed alerts:', e);
      return new Set();
    }
  }

  /**
   * Save dismissed alert
   */
  dismissAlert(patientId, alertId, reason = '', permanent = false) {
    try {
      const key = this.getStorageKey(patientId, 'dismissed');
      const stored = localStorage.getItem(key);
      const dismissals = stored ? JSON.parse(stored) : [];
      
      // Check if already dismissed
      if (dismissals.some(d => d.alertId === alertId)) {
        return;
      }
      
      const dismissal = {
        alertId,
        reason,
        dismissedAt: Date.now(),
        permanent
      };
      
      // If not permanent, set expiration (24 hours by default)
      if (!permanent) {
        dismissal.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
      }
      
      dismissals.push(dismissal);
      localStorage.setItem(key, JSON.stringify(dismissals));
    } catch (e) {
      console.error('Failed to save dismissed alert:', e);
    }
  }

  /**
   * Get snoozed alerts for a patient
   */
  getSnoozedAlerts(patientId) {
    try {
      const key = this.getStorageKey(patientId, 'snoozed');
      const stored = localStorage.getItem(key);
      if (!stored) return new Map();
      
      const parsed = JSON.parse(stored);
      const now = Date.now();
      const snoozedMap = new Map();
      
      // Filter out expired snoozes
      parsed.forEach(item => {
        if (item.snoozeUntil > now) {
          snoozedMap.set(item.alertId, item.snoozeUntil);
        }
      });
      
      return snoozedMap;
    } catch (e) {
      console.error('Failed to load snoozed alerts:', e);
      return new Map();
    }
  }

  /**
   * Snooze an alert
   */
  snoozeAlert(patientId, alertId, durationMinutes) {
    try {
      const key = this.getStorageKey(patientId, 'snoozed');
      const stored = localStorage.getItem(key);
      const snoozes = stored ? JSON.parse(stored) : [];
      
      // Remove existing snooze for this alert
      const filtered = snoozes.filter(s => s.alertId !== alertId);
      
      // Add new snooze
      filtered.push({
        alertId,
        snoozedAt: Date.now(),
        snoozeUntil: Date.now() + (durationMinutes * 60 * 1000)
      });
      
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to snooze alert:', e);
    }
  }

  /**
   * Clear dismissed alert
   */
  undismissAlert(patientId, alertId) {
    try {
      const key = this.getStorageKey(patientId, 'dismissed');
      const stored = localStorage.getItem(key);
      if (!stored) return;
      
      const dismissals = JSON.parse(stored);
      const filtered = dismissals.filter(d => d.alertId !== alertId);
      
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to undismiss alert:', e);
    }
  }

  /**
   * Clear all dismissals for a patient
   */
  clearAllDismissals(patientId) {
    try {
      const dismissedKey = this.getStorageKey(patientId, 'dismissed');
      const snoozedKey = this.getStorageKey(patientId, 'snoozed');
      
      localStorage.removeItem(dismissedKey);
      localStorage.removeItem(snoozedKey);
    } catch (e) {
      console.error('Failed to clear dismissals:', e);
    }
  }

  /**
   * Get dismissal history for a patient
   */
  getDismissalHistory(patientId) {
    try {
      const key = this.getStorageKey(patientId, 'dismissed');
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load dismissal history:', e);
      return [];
    }
  }
}

// Export singleton instance
export const cdsAlertPersistence = new CDSAlertPersistenceService();