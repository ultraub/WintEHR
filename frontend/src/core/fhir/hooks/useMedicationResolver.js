/**
 * useMedicationResolver Hook
 * Resolves Medication references from MedicationRequest resources
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fhirClient } from '../services/fhirClient';

// Cache for resolved medications to avoid repeated fetches
const medicationCache = new Map();

export const useMedicationResolver = (medicationRequests = []) => {
  const [resolvedMedications, setResolvedMedications] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Memoize the medication requests array based on IDs to prevent unnecessary re-renders
  const medicationRequestIds = useMemo(() => {
    if (!medicationRequests || !Array.isArray(medicationRequests)) {
      return '';
    }
    return medicationRequests
      .filter(req => req && typeof req === 'object' && req.id) // More robust null check
      .map(req => req?.id) // Additional safety check with optional chaining
      .filter(id => id) // Remove any undefined/null IDs
      .join(',');
  }, [medicationRequests]);

  useEffect(() => {
    const resolveMedications = async () => {
      if (!medicationRequests || !Array.isArray(medicationRequests) || medicationRequests.length === 0) {
        setResolvedMedications({});
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const resolved = {};

        // Extract unique medication references
        const medicationRefs = new Set();
        medicationRequests.forEach(req => {
          // Skip null/undefined requests or requests without IDs
          if (!req || typeof req !== 'object' || !req.id) return;
          
          // Handle different medication structures from Synthea
          if (req.medication?.reference?.reference) {
            // Handle nested reference structure from Synthea
            const ref = req.medication.reference.reference;
            if (ref.startsWith('urn:uuid:')) {
              const id = ref.substring(9);
              medicationRefs.add(id);
            }
          } else if (req.medicationReference?.reference) {
            // Handle standard FHIR structure
            const ref = req.medicationReference.reference;
            if (ref.startsWith('Medication/')) {
              const id = ref.substring(11);
              medicationRefs.add(id);
            }
          }
        });

        // Fetch medications not in cache
        const toFetch = Array.from(medicationRefs).filter(id => !medicationCache.has(id));
        
        if (toFetch.length > 0) {
          // Sequential fetch to ensure cache operations complete properly
          for (const id of toFetch) {
            try {
              const response = await fhirClient.read('Medication', id);
              
              // Handle both response.data and direct response formats
              const medicationData = response.data || response;
              
              if (medicationData && medicationData.resourceType === 'Medication') {
                medicationCache.set(id, medicationData);
              } else {
                medicationCache.set(id, null);
              }
            } catch (err) {
              
              medicationCache.set(id, null);
            }
          }
        }

        // Build resolved medications map AFTER all fetches complete
        medicationRequests.forEach(req => {
          // Skip null/undefined requests or requests without IDs
          if (!req || typeof req !== 'object' || !req.id) return;
          
          let medicationId = null;
          
          // Handle reference-based medications
          if (req.medication?.reference?.reference) {
            const ref = req.medication.reference.reference;
            if (ref.startsWith('urn:uuid:')) {
              medicationId = ref.substring(9);
            }
          } else if (req.medicationReference?.reference) {
            const ref = req.medicationReference.reference;
            if (ref.startsWith('Medication/')) {
              medicationId = ref.substring(11);
            }
          }

          // Handle concept-based medications (inline)
          if (req.medication?.concept) {
            const concept = req.medication.concept;
            const medName = concept.text || concept.coding?.[0]?.display || 'Unknown medication';
            resolved[req.id] = {
              name: medName,
              code: concept
            };
            return; // Skip further processing for this request
          }

          if (medicationId) {
            if (medicationCache.has(medicationId)) {
              const medication = medicationCache.get(medicationId);
              
              if (medication) {
                const medName = medication.code?.text || medication.code?.coding?.[0]?.display || 'Unknown medication';
                resolved[req.id] = {
                  name: medName,
                  code: medication.code,
                  form: medication.form,
                  ingredient: medication.ingredient,
                  medication: medication
                };
              }
            }
          } else if (req.medicationCodeableConcept) {
            // Fallback to medicationCodeableConcept if available
            const medName = req.medicationCodeableConcept.text || 
                          req.medicationCodeableConcept.coding?.[0]?.display || 
                          'Unknown medication';
            resolved[req.id] = {
              name: medName,
              code: req.medicationCodeableConcept
            };
          }
        });

        setResolvedMedications(resolved);
      } catch (err) {
        
        setError(err.message || 'Failed to resolve medications');
      } finally {
        setLoading(false);
      }
    };

    resolveMedications();
  }, [medicationRequestIds]);

  // Helper function to get medication display name
  const getMedicationDisplay = useCallback((medicationRequest) => {
    if (!medicationRequest?.id) {
      return 'Unknown medication';
    }
    
    const resolved = resolvedMedications[medicationRequest.id];
    if (resolved) {
      return resolved.name;
    }
    
    // Fallback to medication field (R5 format) or medicationCodeableConcept (R4 format)
    if (medicationRequest.medication?.concept) {
      // FHIR R5 format
      const concept = medicationRequest.medication.concept;
      const fallbackName = concept.text || 
                          concept.coding?.[0]?.display || 
                          'Unknown medication';
      return fallbackName;
    } else if (medicationRequest.medicationCodeableConcept) {
      // FHIR R4 format
      const fallbackName = medicationRequest.medicationCodeableConcept.text || 
                          medicationRequest.medicationCodeableConcept.coding?.[0]?.display || 
                          'Unknown medication';
      return fallbackName;
    }
    
    return 'Unknown medication';
  }, [resolvedMedications]);

  // Helper function to detect FHIR format and extract medication info
  const getMedicationInfo = useCallback((medicationRequest) => {
    if (!medicationRequest) {
      return { format: 'unknown', concept: null };
    }

    // Detect R5 format
    if (medicationRequest.medication?.concept) {
      return {
        format: 'R5',
        concept: medicationRequest.medication.concept
      };
    }
    
    // Detect R4 format
    if (medicationRequest.medicationCodeableConcept) {
      return {
        format: 'R4',
        concept: medicationRequest.medicationCodeableConcept
      };
    }
    
    // Reference format
    if (medicationRequest.medicationReference) {
      return {
        format: 'reference',
        reference: medicationRequest.medicationReference
      };
    }
    
    return { format: 'unknown', concept: null };
  }, []);

  // Helper function to convert any format to R5 format
  const convertToR5Format = useCallback((medicationRequest) => {
    const info = getMedicationInfo(medicationRequest);
    
    if (info.format === 'R5') {
      // Already R5, return as-is
      return medicationRequest.medication;
    }
    
    if (info.format === 'R4' && info.concept) {
      // Convert R4 to R5
      return {
        concept: info.concept
      };
    }
    
    // For reference format or unknown, return a generic structure
    return {
      concept: {
        text: 'Unknown medication'
      }
    };
  }, [getMedicationInfo]);

  return {
    resolvedMedications,
    getMedicationDisplay,
    loading,
    error
  };
};