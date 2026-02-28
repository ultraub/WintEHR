/**
 * SMART on FHIR Context
 *
 * Manages SMART App Launch state for:
 * - Registered app discovery and listing
 * - App launch and authorization tracking
 * - Educational flow visualization
 * - Consent management
 *
 * Educational Purpose:
 * This context demonstrates how an EHR maintains state
 * for SMART app integration, including launch contexts
 * and authorization session tracking.
 *
 * @module SMARTContext
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import smartService from '../services/smartService';
import { useFHIRResource } from './FHIRResourceContext';

// ============================================================================
// Context Creation
// ============================================================================

const SMARTContext = createContext(undefined);

/**
 * Hook to access SMART context
 * @throws {Error} If used outside SMARTProvider
 */
export const useSMART = () => {
  const context = useContext(SMARTContext);
  if (!context) {
    throw new Error('useSMART must be used within a SMARTProvider');
  }
  return context;
};

// ============================================================================
// Launch State Types (for reference)
// ============================================================================
/**
 * Launch States:
 * - idle: No launch in progress
 * - launching: Launch initiated, waiting for response
 * - authorizing: User reviewing consent screen
 * - completed: App successfully launched
 * - failed: Launch encountered an error
 */
const LAUNCH_STATES = {
  IDLE: 'idle',
  LAUNCHING: 'launching',
  AUTHORIZING: 'authorizing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// ============================================================================
// Provider Component
// ============================================================================

export const SMARTProvider = ({ children }) => {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // Registered apps
  const [apps, setApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState(null);

  // SMART configuration from discovery
  const [smartConfig, setSmartConfig] = useState(null);

  // Launch state
  const [launchState, setLaunchState] = useState(LAUNCH_STATES.IDLE);
  const [currentLaunch, setCurrentLaunch] = useState(null);
  const [launchError, setLaunchError] = useState(null);

  // Active app windows (for tracking launched apps)
  const [activeWindows, setActiveWindows] = useState([]);

  // Educational flow tracking
  const [educationalFlows, setEducationalFlows] = useState({});

  // Get patient context from FHIR resource context
  const { currentPatient, currentEncounter } = useFHIRResource();

  // -------------------------------------------------------------------------
  // Discovery and App Loading
  // -------------------------------------------------------------------------

  /**
   * Load SMART configuration from discovery endpoint
   */
  const loadSmartConfiguration = useCallback(async () => {
    try {
      const config = await smartService.getSmartConfiguration();
      setSmartConfig(config);
      return config;
    } catch (error) {
      console.debug('SMART configuration not available (expected in dev mode):', error.message);
      // Don't throw - SMART is optional functionality
      return null;
    }
  }, []);

  /**
   * Load registered SMART apps
   *
   * Educational Notes:
   * In a real EHR, apps might be filtered by:
   * - User role/permissions
   * - Patient context (e.g., pediatric apps for children)
   * - Organization policies
   */
  const loadApps = useCallback(async (forceRefresh = false) => {
    setAppsLoading(true);
    setAppsError(null);

    try {
      const appList = await smartService.getRegisteredApps(!forceRefresh);
      setApps(appList);
      return appList;
    } catch (error) {
      console.error('Failed to load SMART apps:', error);
      setAppsError('Failed to load available apps');
      return [];
    } finally {
      setAppsLoading(false);
    }
  }, []);

  /**
   * Get apps organized by category
   */
  const getAppsByCategory = useCallback(async () => {
    try {
      return await smartService.getAppsByCategory();
    } catch (error) {
      console.error('Failed to get apps by category:', error);
      return { clinical: [], analytics: [], educational: [], other: [] };
    }
  }, []);

  // -------------------------------------------------------------------------
  // App Launch Functions
  // -------------------------------------------------------------------------

  /**
   * Launch a SMART app (EHR Launch)
   *
   * Educational Notes:
   * EHR Launch Flow:
   * 1. EHR creates launch context with patient/encounter
   * 2. Server generates opaque launch token
   * 3. App opens with launch token
   * 4. App exchanges token for patient context
   *
   * @param {string} clientId - The app's client ID
   * @param {Object} options - Launch options
   * @returns {Promise<Object>} Launch result with URL and window
   */
  const launchApp = useCallback(async (clientId, options = {}) => {
    // Validate patient context
    if (!currentPatient?.id) {
      throw new Error('Cannot launch app: No patient selected');
    }

    setLaunchState(LAUNCH_STATES.LAUNCHING);
    setLaunchError(null);
    setCurrentLaunch({ clientId, startTime: Date.now() });

    try {
      // Launch app in new window
      const result = await smartService.launchAppInWindow(
        clientId,
        currentPatient.id,
        currentEncounter?.id || null,
        {
          ...options,
          userId: options.userId
        }
      );

      // Track the launched window
      if (result.window) {
        setActiveWindows(prev => [
          ...prev,
          {
            clientId,
            window: result.window,
            launchToken: result.launchToken,
            launchedAt: Date.now()
          }
        ]);
      }

      setLaunchState(LAUNCH_STATES.COMPLETED);
      setCurrentLaunch(prev => ({
        ...prev,
        result,
        completedAt: Date.now()
      }));

      return result;
    } catch (error) {
      console.error(`Failed to launch app ${clientId}:`, error);
      setLaunchState(LAUNCH_STATES.FAILED);
      setLaunchError(error.message || 'Failed to launch app');
      setCurrentLaunch(prev => ({
        ...prev,
        error: error.message,
        failedAt: Date.now()
      }));
      throw error;
    }
  }, [currentPatient, currentEncounter]);

  /**
   * Launch a SMART app in standalone mode (no EHR context)
   *
   * Educational Notes:
   * Standalone Launch:
   * - App launched outside patient context
   * - App must authenticate user and select patient
   * - Useful for patient-facing apps
   *
   * @param {string} clientId - The app's client ID
   * @returns {Promise<string>} Launch URL
   */
  const launchStandalone = useCallback(async (clientId) => {
    try {
      const launchUrl = await smartService.getStandaloneLaunchUrl(clientId);
      window.open(launchUrl, `smart-standalone-${clientId}`);
      return launchUrl;
    } catch (error) {
      console.error(`Failed to launch standalone app ${clientId}:`, error);
      throw error;
    }
  }, []);

  /**
   * Reset launch state to idle
   */
  const resetLaunchState = useCallback(() => {
    setLaunchState(LAUNCH_STATES.IDLE);
    setCurrentLaunch(null);
    setLaunchError(null);
  }, []);

  // -------------------------------------------------------------------------
  // Consent Management
  // -------------------------------------------------------------------------

  /**
   * Get consent data for an authorization session
   *
   * @param {string} sessionId - Authorization session ID
   * @returns {Promise<Object>} Consent display data
   */
  const getConsentData = useCallback(async (sessionId) => {
    setLaunchState(LAUNCH_STATES.AUTHORIZING);
    try {
      return await smartService.getConsentData(sessionId);
    } catch (error) {
      console.error('Failed to get consent data:', error);
      throw error;
    }
  }, []);

  /**
   * Approve consent for an authorization session
   *
   * @param {string} sessionId - Authorization session ID
   * @param {Object} approvalData - Approval details
   * @returns {Promise<Object>} Redirect information
   */
  const approveConsent = useCallback(async (sessionId, approvalData) => {
    try {
      const result = await smartService.approveConsent(sessionId, approvalData);
      setLaunchState(LAUNCH_STATES.COMPLETED);
      return result;
    } catch (error) {
      console.error('Failed to approve consent:', error);
      setLaunchState(LAUNCH_STATES.FAILED);
      throw error;
    }
  }, []);

  /**
   * Deny consent for an authorization session
   *
   * @param {string} sessionId - Authorization session ID
   * @param {string} reason - Denial reason
   * @returns {Promise<Object>} Redirect information
   */
  const denyConsent = useCallback(async (sessionId, reason) => {
    try {
      const result = await smartService.denyConsent(sessionId, reason);
      setLaunchState(LAUNCH_STATES.IDLE);
      return result;
    } catch (error) {
      console.error('Failed to deny consent:', error);
      throw error;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Educational Features
  // -------------------------------------------------------------------------

  /**
   * Get authorization flow details for educational display
   *
   * @param {string} sessionId - Authorization session ID
   * @returns {Promise<Object>} Flow details with steps
   */
  const getAuthorizationFlow = useCallback(async (sessionId) => {
    try {
      const flow = await smartService.getAuthorizationFlow(sessionId);

      // Store for educational display
      setEducationalFlows(prev => ({
        ...prev,
        [sessionId]: flow
      }));

      return flow;
    } catch (error) {
      console.error('Failed to get authorization flow:', error);
      throw error;
    }
  }, []);

  /**
   * Inspect an access token for educational purposes
   *
   * @param {string} token - The access token to inspect
   * @returns {Promise<Object>} Token details with explanations
   */
  const inspectToken = useCallback(async (token) => {
    try {
      return await smartService.inspectToken(token);
    } catch (error) {
      console.error('Failed to inspect token:', error);
      throw error;
    }
  }, []);

  /**
   * Parse scope descriptions for display
   *
   * @param {string[]} scopes - Array of scope strings
   * @returns {Array} Parsed scope descriptions
   */
  const parseScopes = useCallback((scopes) => {
    return smartService.parseScopeDescriptions(scopes);
  }, []);

  // -------------------------------------------------------------------------
  // App Window Management
  // -------------------------------------------------------------------------

  /**
   * Check if an app is currently running
   *
   * @param {string} clientId - The app's client ID
   * @returns {boolean} Whether the app window is open
   */
  const isAppRunning = useCallback((clientId) => {
    return activeWindows.some(
      w => w.clientId === clientId && w.window && !w.window.closed
    );
  }, [activeWindows]);

  /**
   * Close an app window
   *
   * @param {string} clientId - The app's client ID
   */
  const closeApp = useCallback((clientId) => {
    setActiveWindows(prev => {
      const windowToClose = prev.find(w => w.clientId === clientId);
      if (windowToClose?.window && !windowToClose.window.closed) {
        windowToClose.window.close();
      }
      return prev.filter(w => w.clientId !== clientId);
    });
  }, []);

  /**
   * Close all app windows
   */
  const closeAllApps = useCallback(() => {
    activeWindows.forEach(({ window }) => {
      if (window && !window.closed) {
        window.close();
      }
    });
    setActiveWindows([]);
  }, [activeWindows]);

  // -------------------------------------------------------------------------
  // Lifecycle Effects
  // -------------------------------------------------------------------------

  // Load SMART configuration and apps on mount
  useEffect(() => {
    loadSmartConfiguration();
    loadApps();
  }, [loadSmartConfiguration, loadApps]);

  // Clean up closed windows periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWindows(prev =>
        prev.filter(({ window }) => window && !window.closed)
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Close all apps when patient changes
  useEffect(() => {
    // When patient changes, close all running apps for security
    closeAllApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPatient?.id]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  /**
   * Apps filtered by patient context relevance
   * (e.g., pediatric apps for children)
   */
  const contextualApps = useMemo(() => {
    if (!currentPatient || !apps.length) return apps;

    // Could filter by patient age, conditions, etc.
    // For now, return all apps
    return apps;
  }, [apps, currentPatient]);

  /**
   * Count of currently running apps
   */
  const runningAppCount = useMemo(() => {
    return activeWindows.filter(w => w.window && !w.window.closed).length;
  }, [activeWindows]);

  // -------------------------------------------------------------------------
  // Context Value
  // -------------------------------------------------------------------------

  const isSmartEnabled = !!smartConfig;

  const value = useMemo(() => ({
    // Configuration
    smartConfig,
    isSmartEnabled,

    // Apps
    apps: contextualApps,
    appsLoading,
    appsError,
    loadApps,
    getAppsByCategory,

    // Launch state
    launchState,
    currentLaunch,
    launchError,
    LAUNCH_STATES,

    // Launch functions
    launchApp,
    launchStandalone,
    resetLaunchState,

    // Consent
    getConsentData,
    approveConsent,
    denyConsent,

    // Educational features
    getAuthorizationFlow,
    inspectToken,
    parseScopes,
    educationalFlows,

    // Window management
    isAppRunning,
    closeApp,
    closeAllApps,
    activeWindows,
    runningAppCount
  }), [
    smartConfig,
    isSmartEnabled,
    contextualApps,
    appsLoading,
    appsError,
    loadApps,
    getAppsByCategory,
    launchState,
    currentLaunch,
    launchError,
    launchApp,
    launchStandalone,
    resetLaunchState,
    getConsentData,
    approveConsent,
    denyConsent,
    getAuthorizationFlow,
    inspectToken,
    parseScopes,
    educationalFlows,
    isAppRunning,
    closeApp,
    closeAllApps,
    activeWindows,
    runningAppCount
  ]);

  return (
    <SMARTContext.Provider value={value}>
      {children}
    </SMARTContext.Provider>
  );
};

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook to get available apps with loading state
 */
export const useSMARTApps = () => {
  const { apps, appsLoading, appsError, loadApps } = useSMART();
  return { apps, loading: appsLoading, error: appsError, refresh: loadApps };
};

/**
 * Hook to manage app launching
 */
export const useSMARTLaunch = () => {
  const {
    launchApp,
    launchStandalone,
    launchState,
    launchError,
    currentLaunch,
    resetLaunchState,
    LAUNCH_STATES
  } = useSMART();

  return {
    launch: launchApp,
    launchStandalone,
    state: launchState,
    error: launchError,
    currentLaunch,
    reset: resetLaunchState,
    isLaunching: launchState === LAUNCH_STATES.LAUNCHING,
    isCompleted: launchState === LAUNCH_STATES.COMPLETED,
    isFailed: launchState === LAUNCH_STATES.FAILED
  };
};

/**
 * Hook for educational flow visualization
 */
export const useSMARTEducation = () => {
  const {
    getAuthorizationFlow,
    inspectToken,
    parseScopes,
    educationalFlows
  } = useSMART();

  return {
    getFlow: getAuthorizationFlow,
    inspectToken,
    parseScopes,
    flows: educationalFlows
  };
};

export { LAUNCH_STATES };
export default SMARTContext;
