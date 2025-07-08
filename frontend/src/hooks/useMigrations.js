/**
 * useMigrations Hook
 * React hook for managing FHIR data migrations
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import MigrationManager from '../utils/migrations';

export const useMigrations = () => {
  const [migrationManager] = useState(() => new MigrationManager());
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);

  // Run migration on a single resource
  const migrateResource = useCallback(async (resource, options = {}) => {
    setIsRunning(true);
    try {
      const result = await migrationManager.migrateResource(resource, options);
      setLastResult(result);
      return result;
    } catch (error) {
      
      throw error;
    } finally {
      setIsRunning(false);
    }
  }, [migrationManager]);

  // Run migrations on multiple resources
  const migrateResources = useCallback(async (resources, options = {}) => {
    setIsRunning(true);
    setProgress({ processed: 0, total: resources.length, migrated: 0, errors: 0 });

    try {
      const result = await migrationManager.migrateResources(resources, {
        ...options,
        onProgress: (progressInfo) => {
          setProgress(progressInfo);
          options.onProgress?.(progressInfo);
        }
      });
      
      setLastResult(result);
      return result;
    } catch (error) {
      
      throw error;
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }, [migrationManager]);

  // Get migration status for resource types
  const getMigrationStatus = useCallback(async (resourceType = null) => {
    try {
      const status = await migrationManager.getMigrationStatus(resourceType);
      setMigrationStatus(status);
      return status;
    } catch (error) {
      
      throw error;
    }
  }, [migrationManager]);

  // Check if a resource needs migration
  const needsMigration = useCallback((resource) => {
    return migrationManager.migrations.some(migration => migration.shouldRun(resource));
  }, [migrationManager]);

  // Add custom migration
  const addMigration = useCallback((migration) => {
    migrationManager.addMigration(migration);
  }, [migrationManager]);

  // Clear results
  const clearResults = useCallback(() => {
    setLastResult(null);
    setProgress(null);
    setMigrationStatus(null);
  }, []);

  return {
    // Actions
    migrateResource,
    migrateResources,
    getMigrationStatus,
    needsMigration,
    addMigration,
    clearResults,

    // State
    isRunning,
    progress,
    lastResult,
    migrationStatus,

    // Computed
    availableMigrations: migrationManager.migrations,
    hasResults: !!lastResult
  };
};

/**
 * Hook for monitoring migration progress
 */
export const useMigrationProgress = (onProgress) => {
  const [progress, setProgress] = useState(null);
  const [isActive, setIsActive] = useState(false);

  const startProgress = useCallback((total) => {
    setIsActive(true);
    setProgress({ processed: 0, total, migrated: 0, errors: 0 });
  }, []);

  const updateProgress = useCallback((update) => {
    setProgress(prev => ({ ...prev, ...update }));
    onProgress?.(update);
  }, [onProgress]);

  const finishProgress = useCallback(() => {
    setIsActive(false);
  }, []);

  const progressPercentage = useMemo(() => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  }, [progress]);

  return {
    progress,
    progressPercentage,
    isActive,
    startProgress,
    updateProgress,
    finishProgress
  };
};

/**
 * Hook for resource-specific migrations
 */
export const useResourceMigration = (resource) => {
  const { migrateResource, needsMigration: checkNeedsMigration } = useMigrations();
  const [migrationResult, setMigrationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const needsMigration = useMemo(() => {
    if (!resource) return false;
    return checkNeedsMigration(resource);
  }, [resource, checkNeedsMigration]);

  const runMigration = useCallback(async (options = {}) => {
    if (!resource) return null;

    setIsLoading(true);
    try {
      const result = await migrateResource(resource, options);
      setMigrationResult(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [resource, migrateResource]);

  const clearResult = useCallback(() => {
    setMigrationResult(null);
  }, []);

  return {
    needsMigration,
    migrationResult,
    isLoading,
    runMigration,
    clearResult,
    hasResult: !!migrationResult
  };
};

export default useMigrations;