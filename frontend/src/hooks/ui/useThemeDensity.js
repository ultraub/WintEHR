/**
 * useThemeDensity Hook
 * Manages theme density preferences across the application
 * Part of the Clinical UI Improvements Initiative
 */
import { useState, useEffect } from 'react';

const DENSITY_KEY = 'emr_theme_density';

export const useThemeDensity = () => {
  // Load initial density from localStorage or default to 'comfortable'
  const [density, setDensityState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DENSITY_KEY);
      if (saved && ['compact', 'comfortable', 'spacious'].includes(saved)) {
        return saved;
      }
    }
    return 'comfortable';
  });

  // Persist density changes to localStorage
  const setDensity = (newDensity) => {
    if (['compact', 'comfortable', 'spacious'].includes(newDensity)) {
      setDensityState(newDensity);
      if (typeof window !== 'undefined') {
        localStorage.setItem(DENSITY_KEY, newDensity);
      }
    }
  };

  // Sync across tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === DENSITY_KEY && e.newValue) {
        if (['compact', 'comfortable', 'spacious'].includes(e.newValue)) {
          setDensityState(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return [density, setDensity];
};

// Export density configurations for consistent use
export const densityConfigs = {
  compact: {
    spacing: 1,
    padding: 1,
    fontSize: '0.75rem',
    buttonSize: 'small',
    iconSize: 'small',
    rowHeight: 32
  },
  comfortable: {
    spacing: 2,
    padding: 2,
    fontSize: '0.875rem',
    buttonSize: 'medium',
    iconSize: 'medium',
    rowHeight: 48
  },
  spacious: {
    spacing: 3,
    padding: 3,
    fontSize: '1rem',
    buttonSize: 'large',
    iconSize: 'large',
    rowHeight: 64
  }
};

export default useThemeDensity;