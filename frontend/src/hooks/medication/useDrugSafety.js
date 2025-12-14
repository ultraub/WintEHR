/**
 * Drug Safety Hook
 * Provides drug safety checking functionality for medication workflows
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../../core/api';

const DRUG_SAFETY_API = '/api/emr/clinical/drug-interactions';

export const useDrugSafety = (patientId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [safetyData, setSafetyData] = useState(null);
  const [cache, setCache] = useState({});

  // Check drug safety for a set of medications
  const checkDrugSafety = useCallback(async (medications, options = {}) => {
    if (!patientId || !medications || medications.length === 0) {
      setSafetyData(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Create cache key
      const cacheKey = JSON.stringify({ patientId, medications, options });
      
      // Check cache
      if (cache[cacheKey] && !options.skipCache) {
        setSafetyData(cache[cacheKey]);
        setLoading(false);
        return cache[cacheKey];
      }

      // Prepare medications for API
      const medicationData = medications.map(med => ({
        name: med.name || med.display || med.text || '',
        code: med.code || med.rxnormCode || '',
        rxnorm_code: med.rxnormCode || med.code || '',
        dose: med.dose || med.dosage || '',
        route: med.route || '',
        frequency: med.frequency || ''
      }));

      // Call comprehensive safety check
      const response = await apiClient.post(`${DRUG_SAFETY_API}/comprehensive-safety-check`, {
        patient_id: patientId,
        medications: medicationData,
        include_current_medications: options.includeCurrentMedications !== false,
        include_allergies: options.includeAllergies !== false,
        include_contraindications: options.includeContraindications !== false,
        include_duplicate_therapy: options.includeDuplicateTherapy !== false,
        include_dosage_check: options.includeDosageCheck !== false
      });

      const data = response.data;
      
      // Update cache
      setCache(prev => ({
        ...prev,
        [cacheKey]: data
      }));
      
      setSafetyData(data);
      return data;
    } catch (err) {
      console.error('Error checking drug safety:', err);
      setError(err.message || 'Failed to check drug safety');
      setSafetyData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [patientId, cache]);

  // Quick interaction check for two medications
  const checkInteraction = useCallback(async (med1, med2) => {
    if (!med1 || !med2) return null;

    try {
      const response = await apiClient.post(`${DRUG_SAFETY_API}/check-interactions`, [
        { name: med1.name || med1, code: med1.code || '' },
        { name: med2.name || med2, code: med2.code || '' }
      ]);

      return response.data.interactions || [];
    } catch (err) {
      console.error('Error checking interaction:', err);
      return [];
    }
  }, []);

  // Get patient medication summary
  const getMedicationSummary = useCallback(async () => {
    if (!patientId) return null;

    try {
      const response = await apiClient.get(`${DRUG_SAFETY_API}/patient/${patientId}/medication-summary`);
      return response.data;
    } catch (err) {
      console.error('Error getting medication summary:', err);
      return null;
    }
  }, [patientId]);

  // Check single medication safety
  const checkSingleMedication = useCallback(async (medication) => {
    if (!medication || !patientId) return null;

    return checkDrugSafety([medication], {
      includeCurrentMedications: true
    });
  }, [patientId, checkDrugSafety]);

  // Clear cache when patient changes
  useEffect(() => {
    setCache({});
    setSafetyData(null);
    setError(null);
  }, [patientId]);

  // Get severity level from safety data
  const getSeverityLevel = useCallback((data = safetyData) => {
    if (!data) return 'none';
    
    const score = data.overall_risk_score || 0;
    if (score >= 7) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 3) return 'moderate';
    if (score > 0) return 'low';
    return 'none';
  }, [safetyData]);

  // Check if medication is safe to proceed
  const isSafeToProceed = useCallback((data = safetyData) => {
    if (!data) return true;
    
    // Check for critical issues
    const hasCriticalAllergy = data.allergy_alerts?.some(a => a.reaction_type === 'direct');
    const hasAbsoluteContraindication = data.contraindications?.some(c => c.contraindication_type === 'absolute');
    const hasContraindicatedInteraction = data.interactions?.some(i => i.severity === 'contraindicated');
    
    return !hasCriticalAllergy && !hasAbsoluteContraindication && !hasContraindicatedInteraction;
  }, [safetyData]);

  // Get formatted recommendations
  const getFormattedRecommendations = useCallback((data = safetyData) => {
    if (!data || !data.recommendations) return [];
    
    return data.recommendations.map(rec => {
      // Parse recommendation type
      let type = 'info';
      if (rec.includes('HIGH RISK') || rec.includes('CONTRAINDICATED')) {
        type = 'critical';
      } else if (rec.includes('MODERATE RISK') || rec.includes('Review')) {
        type = 'warning';
      }
      
      return { text: rec, type };
    });
  }, [safetyData]);

  return {
    // State
    loading,
    error,
    safetyData,
    
    // Actions
    checkDrugSafety,
    checkInteraction,
    getMedicationSummary,
    checkSingleMedication,
    
    // Utilities
    getSeverityLevel,
    isSafeToProceed,
    getFormattedRecommendations,
    
    // Constants
    severityLevels: {
      NONE: 'none',
      LOW: 'low',
      MODERATE: 'moderate',
      HIGH: 'high',
      CRITICAL: 'critical'
    }
  };
};