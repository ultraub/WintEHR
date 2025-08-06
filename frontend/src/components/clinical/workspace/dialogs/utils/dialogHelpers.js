/**
 * Dialog Helper Utilities
 * Provides consistent error handling, loading states, and validation for clinical dialogs
 * 
 * @since 2025-01-25
 */

import { useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';

/**
 * Custom hook for consistent dialog save handling with error management
 * @param {Function} onSave - Parent callback function
 * @param {Function} onClose - Dialog close function
 * @returns {Object} - { saving, error, handleSave }
 */
export const useDialogSave = (onSave, onClose) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  const handleSave = useCallback(async (resource, successMessage = 'Resource saved successfully') => {
    if (!resource) {
      setError('No resource data to save');
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      // Call the parent's save handler and get the saved resource
      const savedResource = await onSave(resource);
      
      // Show success message
      enqueueSnackbar(successMessage, { variant: 'success' });
      
      // Close dialog on success
      if (onClose) {
        onClose();
      }
      
      // Return the saved resource (with ID if it was created)
      return savedResource || resource;
    } catch (error) {
      console.error('Error saving resource:', error);
      
      // Set error for display in dialog
      const errorMessage = error.message || 'Failed to save resource. Please try again.';
      setError(errorMessage);
      
      // Show error snackbar
      enqueueSnackbar(errorMessage, { variant: 'error' });
      
      return false;
    } finally {
      setSaving(false);
    }
  }, [onSave, onClose, enqueueSnackbar]);

  return {
    saving,
    error,
    handleSave,
    setError
  };
};

/**
 * Custom hook for form validation
 * @param {Object} initialErrors - Initial error state
 * @returns {Object} - { errors, validateField, validateForm, clearErrors }
 */
export const useDialogValidation = (initialErrors = {}) => {
  const [errors, setErrors] = useState(initialErrors);

  const validateField = useCallback((fieldName, value, rules) => {
    const fieldErrors = [];

    // Required field validation
    if (rules.required && !value) {
      fieldErrors.push(`${fieldName} is required`);
    }

    // Min length validation
    if (rules.minLength && value && value.length < rules.minLength) {
      fieldErrors.push(`${fieldName} must be at least ${rules.minLength} characters`);
    }

    // Max length validation
    if (rules.maxLength && value && value.length > rules.maxLength) {
      fieldErrors.push(`${fieldName} must be no more than ${rules.maxLength} characters`);
    }

    // Pattern validation
    if (rules.pattern && value && !rules.pattern.test(value)) {
      fieldErrors.push(rules.patternMessage || `${fieldName} format is invalid`);
    }

    // Custom validation
    if (rules.custom && value) {
      const customError = rules.custom(value);
      if (customError) {
        fieldErrors.push(customError);
      }
    }

    // Update errors state
    setErrors(prev => ({
      ...prev,
      [fieldName]: fieldErrors.length > 0 ? fieldErrors[0] : null
    }));

    return fieldErrors.length === 0;
  }, []);

  const validateForm = useCallback((formData, validationRules) => {
    let isValid = true;
    const newErrors = {};

    Object.keys(validationRules).forEach(fieldName => {
      const value = formData[fieldName];
      const rules = validationRules[fieldName];
      const fieldErrors = [];

      // Apply validation rules
      if (rules.required && !value) {
        fieldErrors.push(`${fieldName} is required`);
        isValid = false;
      }

      if (rules.minLength && value && value.length < rules.minLength) {
        fieldErrors.push(`${fieldName} must be at least ${rules.minLength} characters`);
        isValid = false;
      }

      if (rules.maxLength && value && value.length > rules.maxLength) {
        fieldErrors.push(`${fieldName} must be no more than ${rules.maxLength} characters`);
        isValid = false;
      }

      if (rules.pattern && value && !rules.pattern.test(value)) {
        fieldErrors.push(rules.patternMessage || `${fieldName} format is invalid`);
        isValid = false;
      }

      if (rules.custom && value) {
        const customError = rules.custom(value);
        if (customError) {
          fieldErrors.push(customError);
          isValid = false;
        }
      }

      newErrors[fieldName] = fieldErrors.length > 0 ? fieldErrors[0] : null;
    });

    setErrors(newErrors);
    return isValid;
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateField,
    validateForm,
    clearErrors
  };
};

/**
 * Common validation rules for clinical resources
 */
export const VALIDATION_RULES = {
  condition: {
    code: {
      required: true,
      minLength: 1,
      patternMessage: 'Please select a valid condition code'
    },
    clinicalStatus: {
      required: true
    },
    verificationStatus: {
      required: true
    }
  },
  medication: {
    medicationCode: {
      required: true,
      minLength: 1,
      patternMessage: 'Please select a valid medication'
    },
    dosageQuantity: {
      required: true,
      pattern: /^\d+(\.\d+)?$/,
      patternMessage: 'Please enter a valid number'
    },
    status: {
      required: true
    },
    intent: {
      required: true
    }
  },
  allergy: {
    code: {
      required: true,
      minLength: 1,
      patternMessage: 'Please select a valid allergen'
    },
    clinicalStatus: {
      required: true
    },
    verificationStatus: {
      required: true
    },
    type: {
      required: true
    }
  },
  procedure: {
    code: {
      required: true,
      minLength: 1,
      patternMessage: 'Please select a valid procedure'
    },
    status: {
      required: true
    },
    performedDateTime: {
      required: true,
      custom: (value) => {
        const date = new Date(value);
        if (date > new Date()) {
          return 'Procedure date cannot be in the future';
        }
        return null;
      }
    }
  }
};

/**
 * Format error messages for display
 * @param {Error|string} error - Error object or message
 * @returns {string} - Formatted error message
 */
export const formatErrorMessage = (error) => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
};

/**
 * Get resource display name for messages
 * @param {string} resourceType - FHIR resource type
 * @returns {string} - Human-readable resource name
 */
export const getResourceDisplayName = (resourceType) => {
  const displayNames = {
    Condition: 'condition',
    MedicationRequest: 'medication',
    AllergyIntolerance: 'allergy',
    Procedure: 'procedure',
    Immunization: 'immunization',
    CarePlan: 'care plan',
    DocumentReference: 'document',
    ServiceRequest: 'service request',
    Observation: 'observation',
    DiagnosticReport: 'diagnostic report'
  };
  
  return displayNames[resourceType] || 'resource';
};