/**
 * FHIR Client Configuration
 * 
 * Example configuration showing how to set up the enhanced FHIR client
 * with interceptors, caching, and error handling.
 * 
 * @since 2025-01-21
 */

import FHIRClient from '../services/fhirClient';
import { notificationService } from '../../../services/notificationService';
import type { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * Create a configured FHIR client instance
 */
export function createConfiguredFHIRClient() {
  // Get auth token from localStorage or context
  const getAuthToken = () => {
    return localStorage.getItem('authToken') || '';
  };

  // Create client with configuration
  const client = new FHIRClient({
    baseUrl: process.env.REACT_APP_FHIR_ENDPOINT || '/fhir/R4',
    auth: {
      token: getAuthToken(),
      type: 'Bearer'
    },
    cache: {
      enabled: true,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 200 // Increased for better performance
    },
    queue: {
      maxConcurrent: 5,
      requestsPerSecond: 20, // Increased for better performance
      retryAttempts: 3,
      retryDelay: 1000,
      retryMultiplier: 2,
      maxRetryDelay: 10000
    }
  });

  // Add request interceptor for logging and metrics
  client.addRequestInterceptor((config: AxiosRequestConfig) => {
    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`FHIR Request: ${config.method?.toUpperCase()} ${config.url}`, config.params);
    }

    // Add request timestamp for performance tracking
    (config as any)._requestStartTime = Date.now();

    // Ensure auth token is current
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  // Add response interceptor for logging and metrics
  client.addResponseInterceptor((response: AxiosResponse) => {
    // Calculate request duration
    const config = response.config as any;
    const duration = config._requestStartTime ? Date.now() - config._requestStartTime : 0;

    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `FHIR Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`,
        response.data
      );
    }

    // Track performance metrics
    if (window.performance && window.performance.mark) {
      window.performance.measure(
        `fhir-request-${response.config.method}-${response.config.url}`,
        { duration }
      );
    }

    return response;
  });

  // Add error interceptor for user notifications
  client.addErrorInterceptor(async (error: AxiosError) => {
    // Don't show notification for cancelled requests
    if (error.code === 'ECONNABORTED' || error.message === 'canceled') {
      return Promise.reject(error);
    }

    // Handle specific error types
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 401:
          // Unauthorized - redirect to login
          notificationService.authError();
          // Dispatch logout action or redirect
          window.location.href = '/login';
          break;

        case 403:
          // Forbidden
          notificationService.permissionError();
          break;

        case 404:
          // Not found - might be expected, don't always notify
          if (!error.config?.url?.includes('_search')) {
            notificationService.error('Resource not found');
          }
          break;

        case 422:
          // Validation error
          if (data?.resourceType === 'OperationOutcome') {
            notificationService.fhirError(error, {
              operation: error.config?.method?.toUpperCase(),
              resourceType: error.config?.url?.split('/')[1]
            });
          } else {
            notificationService.validationError(data?.message || 'Invalid data');
          }
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          // Server errors
          notificationService.error('Server error. Please try again later.');
          break;

        default:
          // Other errors
          if (data?.resourceType === 'OperationOutcome') {
            notificationService.fhirError(error);
          } else {
            notificationService.error(error);
          }
      }
    } else if (error.request) {
      // Network error
      notificationService.networkError();
    }

    return Promise.reject(error);
  });

  return client;
}

/**
 * Default configured client instance
 */
export const configuredFHIRClient = createConfiguredFHIRClient();

/**
 * Hook to get a configured FHIR client
 * Can be extended to get client from React context
 */
export function useFHIRClient() {
  // In a real app, this might get the client from context
  // with user-specific configuration
  return configuredFHIRClient;
}

/**
 * Utility to clear all FHIR caches
 */
export function clearFHIRCaches() {
  configuredFHIRClient.clearCache();
  console.log('FHIR caches cleared');
}

/**
 * Utility to prefetch common resources
 */
export async function prefetchCommonResources(patientId: string) {
  try {
    // Prefetch in parallel
    await Promise.all([
      configuredFHIRClient.getPatient(patientId),
      configuredFHIRClient.getConditions(patientId, 'active'),
      configuredFHIRClient.getMedications(patientId, 'active'),
      configuredFHIRClient.getAllergies(patientId),
      configuredFHIRClient.getVitalSigns(patientId, 10)
    ]);
    
    console.log(`Prefetched resources for patient ${patientId}`);
  } catch (error) {
    console.error('Error prefetching resources:', error);
  }
}

/**
 * Performance monitoring utilities
 */
export const performanceMonitor = {
  /**
   * Get average request duration for a resource type
   */
  getAverageRequestDuration(resourceType: string): number {
    if (!window.performance || !window.performance.getEntriesByType) {
      return 0;
    }

    const entries = window.performance.getEntriesByType('measure')
      .filter(entry => entry.name.includes(`fhir-request-`) && entry.name.includes(resourceType));
    
    if (entries.length === 0) return 0;
    
    const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
    return Math.round(totalDuration / entries.length);
  },

  /**
   * Get cache hit rate
   */
  getCacheStats() {
    // This would need to be implemented in the FHIRClient class
    // For now, return mock data
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize: 200
    };
  },

  /**
   * Clear performance entries
   */
  clearMetrics() {
    if (window.performance && window.performance.clearMeasures) {
      window.performance.clearMeasures();
    }
  }
};