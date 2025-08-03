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

  /**
   * Show auth error notification
   */
  authError() {
    return this.error('Authentication required. Please log in again.');
  }

  /**
   * Show permission error notification
   */
  permissionError() {
    return this.error('You do not have permission to perform this action.');
  }

  /**
   * Show network error notification
   */
  networkError() {
    return this.error('Network error. Please check your connection.');
  }

  /**
   * Show validation error notification
   */
  validationError(message) {
    return this.error(message || 'Validation error');
  }

  /**
   * Show FHIR-specific error notification
   */
  fhirError(error, context = {}) {
    let message = 'FHIR operation failed';
    if (error?.response?.data?.resourceType === 'OperationOutcome') {
      const issue = error.response.data.issue?.[0];
      if (issue) {
        message = issue.diagnostics || issue.details?.text || message;
      }
    } else if (error?.message) {
      message = error.message;
    }
    
    if (context.operation && context.resourceType) {
      message = `${context.operation} ${context.resourceType}: ${message}`;
    }
    
    return this.error(message);
  }

  /**
   * Show FHIR success notification
   */
  fhirSuccess(operation, resourceType, resourceId) {
    const message = resourceId 
      ? `${operation} ${resourceType} ${resourceId}`
      : `${operation} ${resourceType}`;
    return this.success(message);
  }

  /**
   * Show loading notification
   */
  loading(message) {
    return this.info(message, 0); // 0 duration means persistent
  }

  /**
   * Update a notification to success
   */
  updateSuccess(id, message) {
    // For now, just show a new success notification
    return this.success(message);
  }

  /**
   * Update a notification to error
   */
  updateError(id, error) {
    // For now, just show a new error notification
    return this.error(error?.message || 'Operation failed');
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Export both named and default
export { notificationService };
export default notificationService;