/**
 * Notification Service
 * Provides centralized notification management for the application
 */

class NotificationService {
  constructor() {
    this.subscribers = new Set();
  }

  /**
   * Subscribe to notifications
   * @param {Function} callback - Function to call when notifications are updated
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Show a notification
   * @param {string} message - Notification message
   * @param {string} severity - Notification severity (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds (0 for persistent)
   */
  show(message, severity = 'info', duration = 6000) {
    const notification = {
      id: Date.now(),
      message,
      severity,
      duration,
      timestamp: new Date().toISOString()
    };

    // Notify all subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Error in notification subscriber:', error);
      }
    });

    return notification.id;
  }

  /**
   * Show success notification
   */
  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  /**
   * Show error notification
   */
  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  /**
   * Show warning notification
   */
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  /**
   * Show info notification
   */
  info(message, duration) {
    return this.show(message, 'info', duration);
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Export both named and default
export { notificationService };
export default notificationService;