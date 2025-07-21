/**
 * Centralized Notification Service
 * 
 * Provides a unified interface for displaying notifications throughout the application.
 * Supports success, error, warning, and info notifications with customizable options.
 * 
 * @since 2025-01-21
 */

import React from 'react';
import { SnackbarKey, OptionsObject, VariantType } from 'notistack';
import { enqueueSnackbar, closeSnackbar } from 'notistack';
import { AxiosError } from 'axios';
import type { OperationOutcome } from '../core/fhir/types';

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Notification options
export interface NotificationOptions extends Partial<OptionsObject> {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
}

// FHIR-specific error details
interface FHIRErrorDetails {
  resourceType?: string;
  operation?: string;
  id?: string;
  details?: string;
}

class NotificationService {
  private defaultOptions: Partial<OptionsObject> = {
    anchorOrigin: {
      vertical: 'top',
      horizontal: 'right'
    },
    autoHideDuration: 5000,
    preventDuplicate: true
  };

  /**
   * Show a notification
   */
  private show(
    type: NotificationType,
    message: string,
    options?: NotificationOptions
  ): SnackbarKey {
    const snackbarOptions: OptionsObject = {
      ...this.defaultOptions,
      ...options,
      variant: type,
      autoHideDuration: options?.persistent ? null : (options?.duration || this.defaultOptions.autoHideDuration),
    };

    if (options?.action) {
      snackbarOptions.action = (key) => (
        <button onClick={() => {
          options.action?.onClick();
          closeSnackbar(key);
        }} style={{ 
          background: 'transparent', 
          border: '1px solid currentColor',
          color: 'inherit',
          padding: '4px 8px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          {options.action.label}
        </button>
      );
    }

    return enqueueSnackbar(message, snackbarOptions);
  }

  /**
   * Show success notification
   */
  success(message: string, options?: NotificationOptions): SnackbarKey {
    return this.show('success', message, options);
  }

  /**
   * Show error notification
   */
  error(message: string | Error | AxiosError, options?: NotificationOptions): SnackbarKey {
    const errorMessage = this.formatErrorMessage(message);
    return this.show('error', errorMessage, {
      ...options,
      duration: options?.duration || 8000, // Errors show longer
    });
  }

  /**
   * Show warning notification
   */
  warning(message: string, options?: NotificationOptions): SnackbarKey {
    return this.show('warning', message, options);
  }

  /**
   * Show info notification
   */
  info(message: string, options?: NotificationOptions): SnackbarKey {
    return this.show('info', message, options);
  }

  /**
   * Show FHIR-specific error notification
   */
  fhirError(error: any, details?: FHIRErrorDetails): SnackbarKey {
    const message = this.formatFHIRError(error, details);
    return this.error(message, {
      persistent: false,
      duration: 10000,
    });
  }

  /**
   * Show FHIR operation success
   */
  fhirSuccess(operation: string, resourceType?: string, id?: string): SnackbarKey {
    let message = `${operation} successful`;
    if (resourceType) {
      message = `${resourceType} ${operation.toLowerCase()} successful`;
      if (id) {
        message += ` (ID: ${id})`;
      }
    }
    return this.success(message);
  }

  /**
   * Dismiss a notification
   */
  dismiss(id?: SnackbarKey): void {
    if (id) {
      closeSnackbar(id);
    } else {
      closeSnackbar();
    }
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    closeSnackbar();
  }

  /**
   * Format error message
   */
  private formatErrorMessage(error: string | Error | AxiosError): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      // Check if it's an Axios error
      if ('response' in error) {
        const axiosError = error as AxiosError;
        const data = axiosError.response?.data as any;
        
        // Check for FHIR OperationOutcome
        if (data?.resourceType === 'OperationOutcome') {
          return this.formatOperationOutcome(data as OperationOutcome);
        }
        
        // Check for other error formats
        if (data?.message) return data.message;
        if (data?.error) return data.error;
        if (data?.detail) return data.detail;
        
        // Use status text if available
        if (axiosError.response?.statusText) {
          return `${axiosError.response.status}: ${axiosError.response.statusText}`;
        }
      }
      
      return error.message;
    }

    return 'An unknown error occurred';
  }

  /**
   * Format FHIR OperationOutcome
   */
  private formatOperationOutcome(outcome: OperationOutcome): string {
    if (!outcome.issue || outcome.issue.length === 0) {
      return 'FHIR operation failed';
    }

    // Get the most severe issue
    const severityOrder = ['fatal', 'error', 'warning', 'information'];
    const sortedIssues = outcome.issue.sort((a, b) => 
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );

    const mainIssue = sortedIssues[0];
    let message = mainIssue.diagnostics || mainIssue.details?.text || mainIssue.code;

    // Add location if available
    if (mainIssue.location && mainIssue.location.length > 0) {
      message += ` (at ${mainIssue.location.join(', ')})`;
    }

    // Add count if multiple issues
    if (outcome.issue.length > 1) {
      message += ` (+${outcome.issue.length - 1} more issues)`;
    }

    return message;
  }

  /**
   * Format FHIR-specific error
   */
  private formatFHIRError(error: any, details?: FHIRErrorDetails): string {
    let message = this.formatErrorMessage(error);

    // Add FHIR-specific context
    if (details) {
      const parts: string[] = [];
      
      if (details.operation) {
        parts.push(`Operation: ${details.operation}`);
      }
      
      if (details.resourceType) {
        parts.push(`Resource: ${details.resourceType}`);
        if (details.id) {
          parts.push(`ID: ${details.id}`);
        }
      }
      
      if (details.details) {
        parts.push(details.details);
      }
      
      if (parts.length > 0) {
        message += ` (${parts.join(', ')})`;
      }
    }

    return message;
  }

  /**
   * Show a loading notification that can be updated
   */
  loading(message: string): SnackbarKey {
    return enqueueSnackbar(message, {
      ...this.defaultOptions,
      variant: 'info',
      autoHideDuration: null, // persist is not a valid option
    });
  }

  /**
   * Update a loading notification to success
   */
  updateSuccess(id: SnackbarKey, message: string): void {
    closeSnackbar(id);
    this.success(message);
  }

  /**
   * Update a loading notification to error
   */
  updateError(id: SnackbarKey, message: string | Error): void {
    closeSnackbar(id);
    this.error(message);
  }

  /**
   * Show notification with custom component
   */
  custom(component: React.ReactNode, options?: NotificationOptions): SnackbarKey {
    return enqueueSnackbar(component, {
      ...this.defaultOptions,
      ...options,
    });
  }

  /**
   * Check if any notifications are active
   */
  isActive(id?: SnackbarKey): boolean {
    // Notistack doesn't have a direct isActive method
    // This is a placeholder that always returns false
    return false;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export types
export type { NotificationService };

// Helper functions for common FHIR operations
export const fhirNotifications = {
  // Resource operations
  created: (resourceType: string, id?: string) => 
    notificationService.fhirSuccess('Created', resourceType, id),
  
  updated: (resourceType: string, id?: string) => 
    notificationService.fhirSuccess('Updated', resourceType, id),
  
  deleted: (resourceType: string, id?: string) => 
    notificationService.fhirSuccess('Deleted', resourceType, id),
  
  // Search operations
  searchComplete: (resourceType: string, count: number) => 
    notificationService.success(`Found ${count} ${resourceType} resources`),
  
  searchEmpty: (resourceType: string) => 
    notificationService.info(`No ${resourceType} resources found`),
  
  // Batch operations
  batchSuccess: (successCount: number, totalCount: number) => 
    notificationService.success(`${successCount} of ${totalCount} operations completed successfully`),
  
  batchPartial: (successCount: number, totalCount: number) => 
    notificationService.warning(`${successCount} of ${totalCount} operations completed. ${totalCount - successCount} failed.`),
  
  batchFailed: () => 
    notificationService.error('Batch operation failed'),
  
  // Validation
  validationError: (message: string) => 
    notificationService.error(`Validation error: ${message}`),
  
  // Network
  networkError: () => 
    notificationService.error('Network error. Please check your connection.'),
  
  // Authentication
  authError: () => 
    notificationService.error('Authentication failed. Please log in again.'),
  
  // Permissions
  permissionError: () => 
    notificationService.error('You do not have permission to perform this action.'),
};

// Export default
export default notificationService;