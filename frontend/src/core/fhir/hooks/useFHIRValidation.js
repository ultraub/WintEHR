/**
 * useFHIRValidation Hook
 * React hook for FHIR resource validation with caching and real-time feedback
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import { validateResource, validateReference, validateBundle, FHIRValidator } from '../validators/fhirValidation';

export const useFHIRValidation = (options = {}) => {
  const [validationCache, setValidationCache] = useState(new Map());
  const [isValidating, setIsValidating] = useState(false);
  const validatorRef = useRef(new FHIRValidator(options));

  // Update validator options
  const updateOptions = useCallback((newOptions) => {
    validatorRef.current = new FHIRValidator({ ...options, ...newOptions });
    setValidationCache(new Map()); // Clear cache when options change
  }, [options]);

  // Generate cache key for a resource
  const getCacheKey = useCallback((resource) => {
    if (!resource || typeof resource !== 'object') return null;
    try {
      return JSON.stringify({
        resourceType: resource.resourceType,
        id: resource.id,
        meta: resource.meta,
        // Add other fields that affect validation
        checksum: JSON.stringify(resource).length // Simple checksum
      });
    } catch {
      return null;
    }
  }, []);

  // Validate a single resource
  const validateSingleResource = useCallback(async (resource, useCache = true) => {
    const cacheKey = getCacheKey(resource);
    
    if (useCache && cacheKey && validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey);
    }

    setIsValidating(true);
    
    try {
      // Use setTimeout to make validation async and avoid blocking UI
      const result = await new Promise((resolve) => {
        setTimeout(() => {
          resolve(validateResource(resource, options));
        }, 0);
      });

      if (useCache && cacheKey) {
        setValidationCache(prev => new Map(prev).set(cacheKey, result));
      }

      return result;
    } finally {
      setIsValidating(false);
    }
  }, [getCacheKey, validationCache, options]);

  // Validate multiple resources
  const validateMultipleResources = useCallback(async (resources, useCache = true) => {
    if (!Array.isArray(resources)) {
      throw new Error('Resources must be an array');
    }

    setIsValidating(true);
    
    try {
      const results = await Promise.all(
        resources.map(resource => validateSingleResource(resource, useCache))
      );

      return {
        results,
        summary: {
          total: results.length,
          valid: results.filter(r => r.isValid).length,
          invalid: results.filter(r => !r.isValid).length,
          warnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
          errors: results.reduce((sum, r) => sum + r.errors.length, 0)
        }
      };
    } finally {
      setIsValidating(false);
    }
  }, [validateSingleResource]);

  // Validate a bundle
  const validateBundleResource = useCallback(async (bundle, useCache = true) => {
    const cacheKey = getCacheKey(bundle);
    
    if (useCache && cacheKey && validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey);
    }

    setIsValidating(true);
    
    try {
      const result = await new Promise((resolve) => {
        setTimeout(() => {
          resolve(validateBundle(bundle, options));
        }, 0);
      });

      if (useCache && cacheKey) {
        setValidationCache(prev => new Map(prev).set(cacheKey, result));
      }

      return result;
    } finally {
      setIsValidating(false);
    }
  }, [getCacheKey, validationCache, options]);

  // Validate a reference
  const validateReferenceResource = useCallback(async (reference, useCache = true) => {
    const cacheKey = reference ? JSON.stringify(reference) : null;
    
    if (useCache && cacheKey && validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey);
    }

    setIsValidating(true);
    
    try {
      const result = await new Promise((resolve) => {
        setTimeout(() => {
          resolve(validateReference(reference, options));
        }, 0);
      });

      if (useCache && cacheKey) {
        setValidationCache(prev => new Map(prev).set(cacheKey, result));
      }

      return result;
    } finally {
      setIsValidating(false);
    }
  }, [validationCache, options]);

  // Clear validation cache
  const clearCache = useCallback(() => {
    setValidationCache(new Map());
  }, []);

  // Get validation statistics
  const getValidationStats = useCallback(() => {
    const cached = Array.from(validationCache.values());
    return {
      cacheSize: validationCache.size,
      totalResources: cached.length,
      validResources: cached.filter(r => r.isValid).length,
      invalidResources: cached.filter(r => !r.isValid).length,
      totalErrors: cached.reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: cached.reduce((sum, r) => sum + r.warnings.length, 0)
    };
  }, [validationCache]);

  // Validate field in real-time
  const validateField = useCallback((value, fieldType, path = '') => {
    const validator = validatorRef.current;
    const result = { isValid: true, errors: [], warnings: [] };

    try {
      switch (fieldType) {
        case 'id':
          if (value && !validator.constructor.prototype.validateId) {
            // Use patterns directly if validator method not available
            const idPattern = /^[A-Za-z0-9\-\.]{1,64}$/;
            if (!idPattern.test(value)) {
              result.isValid = false;
              result.errors.push(`Invalid ID format: ${value}`);
            }
          }
          break;
        case 'uri':
          if (value && typeof value === 'string') {
            const uriPattern = /^[a-z][a-z0-9+.-]*:\/\/[^\s]*$/i;
            if (!uriPattern.test(value)) {
              result.isValid = false;
              result.errors.push(`Invalid URI format: ${value}`);
            }
          }
          break;
        case 'dateTime':
          if (value && typeof value === 'string') {
            const dateTimePattern = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/;
            if (!dateTimePattern.test(value)) {
              result.isValid = false;
              result.errors.push(`Invalid dateTime format: ${value}`);
            }
          }
          break;
        case 'code':
          if (value && typeof value === 'string') {
            const codePattern = /^[^\s]+(\s[^\s]+)*$/;
            if (!codePattern.test(value)) {
              result.isValid = false;
              result.errors.push(`Invalid code format: ${value}`);
            }
          }
          break;
        default:
          // Generic validation
          if (value === null || value === undefined) {
            result.warnings.push(`Field ${path} is empty`);
          }
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }, []);

  return {
    // Main validation functions
    validateResource: validateSingleResource,
    validateResources: validateMultipleResources,
    validateBundle: validateBundleResource,
    validateReference: validateReferenceResource,
    validateField,
    
    // Cache management
    clearCache,
    cacheSize: validationCache.size,
    
    // State
    isValidating,
    
    // Configuration
    updateOptions,
    
    // Statistics
    getValidationStats
  };
};

/**
 * Hook for validating a single resource with real-time updates
 */
export const useResourceValidation = (resource, options = {}) => {
  const { validateResource, isValidating } = useFHIRValidation(options);
  const [validationResult, setValidationResult] = useState(null);
  const [lastValidatedResource, setLastValidatedResource] = useState(null);

  // Validate when resource changes
  const validate = useCallback(async () => {
    if (!resource) {
      setValidationResult(null);
      return;
    }

    // Only validate if resource actually changed
    const resourceStr = JSON.stringify(resource);
    if (resourceStr === lastValidatedResource) {
      return;
    }

    const result = await validateResource(resource);
    setValidationResult(result);
    setLastValidatedResource(resourceStr);
  }, [resource, validateResource, lastValidatedResource]);

  // Auto-validate on resource change
  useMemo(() => {
    validate();
  }, [validate]);

  const isValid = validationResult?.isValid ?? null;
  const hasWarnings = validationResult?.hasWarnings ?? false;
  const errors = validationResult?.errors ?? [];
  const warnings = validationResult?.warnings ?? [];

  return {
    validationResult,
    isValid,
    hasWarnings,
    errors,
    warnings,
    isValidating,
    revalidate: validate
  };
};

/**
 * Hook for batch validation of multiple resources
 */
export const useBatchValidation = (resources = [], options = {}) => {
  const { validateResources, isValidating } = useFHIRValidation(options);
  const [validationResults, setValidationResults] = useState(null);

  const validate = useCallback(async () => {
    if (!resources.length) {
      setValidationResults(null);
      return;
    }

    const results = await validateResources(resources);
    setValidationResults(results);
  }, [resources, validateResources]);

  const isValid = validationResults?.summary.invalid === 0;
  const summary = validationResults?.summary;

  return {
    validationResults,
    summary,
    isValid,
    isValidating,
    validate
  };
};

export default useFHIRValidation;