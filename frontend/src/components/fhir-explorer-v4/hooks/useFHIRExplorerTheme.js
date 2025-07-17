/**
 * FHIR Explorer Theme Hook
 * 
 * Manages theme state and preferences for the FHIR Explorer v4
 * Provides light/dark mode switching with persistence
 */

import { useState, useEffect, useCallback } from 'react';

const THEME_STORAGE_KEY = 'fhir-explorer-theme-mode';

/**
 * Custom hook for managing FHIR Explorer theme
 */
export const useFHIRExplorerTheme = () => {
  // Initialize theme mode from localStorage or system preference
  const [themeMode, setThemeMode] = useState(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      return savedTheme;
    }
    
    // Fall back to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    return 'light';
  });

  // Toggle between light and dark mode
  const toggleTheme = useCallback(() => {
    setThemeMode(prevMode => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
      return newMode;
    });
  }, []);

  // Set specific theme mode
  const setTheme = useCallback((mode) => {
    if (mode === 'light' || mode === 'dark') {
      setThemeMode(mode);
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e) => {
        // Only update if user hasn't manually set a preference
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (!savedTheme) {
          setThemeMode(e.matches ? 'dark' : 'light');
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  return {
    themeMode,
    toggleTheme,
    setTheme,
    isDark: themeMode === 'dark',
    isLight: themeMode === 'light'
  };
};