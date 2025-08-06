/**
 * User Preferences Management Hook
 * 
 * Manages user settings, preferences, and application state
 * for the FHIR Explorer v4 application
 */

import { useState, useEffect, useCallback } from 'react';

// Storage key
const PREFERENCES_STORAGE_KEY = 'fhir-explorer-preferences';

// Default preferences
const DEFAULT_PREFERENCES = {
  // Theme and UI
  themeMode: 'light', // 'light' | 'dark' | 'auto'
  compactMode: false,
  showTooltips: true,
  animationsEnabled: true,
  
  // Query and search
  defaultQueryCount: 20,
  autoExecuteQueries: false,
  showQueryPerformance: true,
  defaultResourceType: 'Patient',
  cacheQueries: true,
  
  // Learning and guidance
  learningLevel: 'beginner', // 'beginner' | 'intermediate' | 'advanced'
  showGuidance: true,
  completedTutorials: [],
  
  // Data and visualization
  defaultVisualization: 'table', // 'table' | 'json' | 'chart'
  showResourceIcons: true,
  groupByResourceType: true,
  
  // Collaboration and sharing
  shareByDefault: false,
  anonymizeExports: true,
  
  // Performance and behavior
  enableAutoRefresh: false,
  refreshInterval: 300000, // 5 minutes
  maxHistorySize: 50,
  
  // Accessibility
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  
  // Developer settings
  showDebugInfo: false,
  enableExperimentalFeatures: false,
  apiTimeout: 30000,
  
  // Notification preferences
  showNotifications: true,
  notificationTypes: {
    queryCompletion: true,
    dataUpdates: true,
    tips: true,
    errors: true
  }
};

/**
 * Custom hook for user preferences management
 */
export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const storedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (storedPreferences) {
        const parsed = JSON.parse(storedPreferences);
        // Merge with defaults to ensure all properties exist
        const merged = { ...DEFAULT_PREFERENCES, ...parsed };
        setPreferences(merged);
      }
    } catch (err) {
      console.error('Failed to load user preferences:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPreferences) => {
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(newPreferences));
    } catch (err) {
      console.error('Failed to save user preferences:', err);
    }
  }, []);

  // Update a single preference
  const updatePreference = useCallback((key, value) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      savePreferences(updated);
      return updated;
    });
  }, [savePreferences]);

  // Update nested preference (e.g., 'notificationTypes.tips')
  const updateNestedPreference = useCallback((path, value) => {
    const keys = path.split('.');
    setPreferences(prev => {
      const updated = { ...prev };
      let current = updated;
      
      // Navigate to the parent object
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      // Set the final value
      current[keys[keys.length - 1]] = value;
      
      savePreferences(updated);
      return updated;
    });
  }, [savePreferences]);

  // Update multiple preferences at once
  const updatePreferences = useCallback((updates) => {
    setPreferences(prev => {
      const updated = { ...prev, ...updates };
      savePreferences(updated);
      return updated;
    });
  }, [savePreferences]);

  // Reset preferences to defaults
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  // Reset a specific preference to default
  const resetPreference = useCallback((key) => {
    const defaultValue = DEFAULT_PREFERENCES[key];
    updatePreference(key, defaultValue);
  }, [updatePreference]);

  // Get preference value with fallback
  const getPreference = useCallback((key, fallback = null) => {
    return preferences[key] !== undefined ? preferences[key] : fallback;
  }, [preferences]);

  // Check if preference differs from default
  const isModified = useCallback((key) => {
    return preferences[key] !== DEFAULT_PREFERENCES[key];
  }, [preferences]);

  // Get all modified preferences
  const getModifiedPreferences = useCallback(() => {
    const modified = {};
    Object.keys(preferences).forEach(key => {
      if (isModified(key)) {
        modified[key] = preferences[key];
      }
    });
    return modified;
  }, [preferences, isModified]);

  // Learning progress management
  const markTutorialComplete = useCallback((tutorialId) => {
    setPreferences(prev => {
      const completedTutorials = [...(prev.completedTutorials || [])];
      if (!completedTutorials.includes(tutorialId)) {
        completedTutorials.push(tutorialId);
      }
      const updated = { ...prev, completedTutorials };
      savePreferences(updated);
      return updated;
    });
  }, [savePreferences]);

  // Check if tutorial is completed
  const isTutorialComplete = useCallback((tutorialId) => {
    return (preferences.completedTutorials || []).includes(tutorialId);
  }, [preferences.completedTutorials]);

  // Reset learning progress
  const resetLearningProgress = useCallback(() => {
    updatePreference('completedTutorials', []);
    updatePreference('learningLevel', 'beginner');
  }, [updatePreference]);

  // Update learning level based on completed tutorials
  const updateLearningLevel = useCallback(() => {
    const completed = preferences.completedTutorials || [];
    let level = 'beginner';
    
    if (completed.length >= 3) {
      level = 'intermediate';
    }
    if (completed.length >= 6) {
      level = 'advanced';
    }
    
    if (level !== preferences.learningLevel) {
      updatePreference('learningLevel', level);
    }
  }, [preferences.completedTutorials, preferences.learningLevel, updatePreference]);

  // Export preferences
  const exportPreferences = useCallback(() => {
    return {
      preferences,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }, [preferences]);

  // Import preferences
  const importPreferences = useCallback((data) => {
    try {
      if (data.preferences && typeof data.preferences === 'object') {
        const merged = { ...DEFAULT_PREFERENCES, ...data.preferences };
        setPreferences(merged);
        savePreferences(merged);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to import preferences:', err);
      return false;
    }
  }, [savePreferences]);

  // Theme-specific helpers
  const isDarkMode = getPreference('themeMode') === 'dark';
  const isLightMode = getPreference('themeMode') === 'light';
  const isAutoTheme = getPreference('themeMode') === 'auto';

  // Accessibility helpers
  const hasAccessibilityNeeds = useCallback(() => {
    return preferences.highContrast || 
           preferences.largeText || 
           preferences.reducedMotion;
  }, [preferences.highContrast, preferences.largeText, preferences.reducedMotion]);

  // Performance helpers
  const shouldAnimate = useCallback(() => {
    return preferences.animationsEnabled && !preferences.reducedMotion;
  }, [preferences.animationsEnabled, preferences.reducedMotion]);

  // Learning helpers
  const getLearningProgress = useCallback(() => {
    const totalTutorials = 10; // Adjust based on actual tutorial count
    const completed = preferences.completedTutorials?.length || 0;
    return {
      completed,
      total: totalTutorials,
      percentage: Math.round((completed / totalTutorials) * 100),
      level: preferences.learningLevel
    };
  }, [preferences.completedTutorials, preferences.learningLevel]);

  return {
    // State
    preferences,
    loading,

    // Single preference management
    updatePreference,
    updateNestedPreference,
    getPreference,
    resetPreference,
    isModified,

    // Bulk preference management
    updatePreferences,
    resetPreferences,
    getModifiedPreferences,

    // Learning progress
    markTutorialComplete,
    isTutorialComplete,
    resetLearningProgress,
    updateLearningLevel,
    getLearningProgress,

    // Data management
    exportPreferences,
    importPreferences,

    // Theme helpers
    isDarkMode,
    isLightMode,
    isAutoTheme,

    // Accessibility helpers
    hasAccessibilityNeeds,
    shouldAnimate,

    // Quick access to common preferences
    learningLevel: preferences.learningLevel,
    showGuidance: preferences.showGuidance,
    enableNotifications: preferences.showNotifications,
    defaultQueryCount: preferences.defaultQueryCount,
    compactMode: preferences.compactMode
  };
};