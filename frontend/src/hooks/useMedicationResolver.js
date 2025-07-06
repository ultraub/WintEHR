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
  const medicationRequestIds = useMemo(() => 
    medicationRequests.map(req => req.id).join(','), 
    [medicationRequests]
  );

  useEffect(() => {
    const resolveMedications = async () => {
      if (!medicationRequests || medicationRequests.length === 0) {
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
              console.warn(`Failed to fetch Medication/${id}:`, err);
              medicationCache.set(id, null);
            }
          }
        }

        // Build resolved medications map AFTER all fetches complete
        medicationRequests.forEach(req => {
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
        console.error('Error resolving medications:', err);
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
    
    // Fallback to medicationCodeableConcept if no resolution
    if (medicationRequest.medicationCodeableConcept) {
      const fallbackName = medicationRequest.medicationCodeableConcept.text || 
                          medicationRequest.medicationCodeableConcept.coding?.[0]?.display || 
                          'Unknown medication';
      return fallbackName;
    }
    
    return 'Unknown medication';
  }, [resolvedMedications]);

  return {
    resolvedMedications,
    getMedicationDisplay,
    loading,
    error
  };
};