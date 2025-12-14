/**
 * useMedicationResolver Hook
 * Resolves Medication references from MedicationRequest resources
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { fhirClient } from '../../core/fhir/services/fhirClient';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';

// Cache for resolved medications to avoid repeated fetches
const medicationCache = new Map();

export const useMedicationResolver = (medicationRequests = []) => {
  const [resolvedMedications, setResolvedMedications] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getResource } = useFHIRResource();
  
  // Memoize the medication requests array based on IDs to prevent unnecessary re-renders
  const medicationRequestIds = useMemo(() => {
    if (!medicationRequests || !Array.isArray(medicationRequests) || medicationRequests.length === 0) {
      return '';
    }
    return medicationRequests
      .filter(req => req && typeof req === 'object' && req.id) // More robust null check
      .map(req => req.id) // Remove optional chaining since filter already ensures req.id exists
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

        // Helper function to resolve contained resource
        const resolveContainedMedication = (req, containedRef) => {
          if (!req.contained || !Array.isArray(req.contained)) {
            return null;
          }
          // Remove the leading '#' from the reference
          const containedId = containedRef.substring(1);
          return req.contained.find(
            resource => resource.resourceType === 'Medication' && resource.id === containedId
          );
        };

        // Extract unique medication references
        const medicationRefs = new Set();
        medicationRequests.forEach(req => {
          // Skip null/undefined requests or requests without IDs
          if (!req || typeof req !== 'object' || !req.id) return;

          // Handle different medication structures from Synthea
          if (req.medication?.reference?.reference) {
            // Handle nested reference structure from Synthea
            const ref = req.medication.reference.reference;
            if (ref.startsWith('#')) {
              // Contained resource - resolve from contained[] array
              const containedMed = resolveContainedMedication(req, ref);
              if (containedMed) {
                medicationCache.set(`contained:${req.id}:${ref}`, containedMed);
              }
            } else if (ref.startsWith('urn:uuid:')) {
              const id = ref.substring(9);
              medicationRefs.add(id);
            }
          } else if (req.medicationReference?.reference) {
            // Handle standard FHIR structure
            const ref = req.medicationReference.reference;
            if (ref.startsWith('#')) {
              // Contained resource - resolve from contained[] array
              const containedMed = resolveContainedMedication(req, ref);
              if (containedMed) {
                medicationCache.set(`contained:${req.id}:${ref}`, containedMed);
              }
            } else if (ref.startsWith('Medication/')) {
              const id = ref.substring(11);
              medicationRefs.add(id);
            }
          }
        });

        // Check context first, then cache, then fetch if needed
        const toFetch = [];
        
        for (const id of Array.from(medicationRefs)) {
          // Check if already in cache
          if (medicationCache.has(id)) {
            continue;
          }
          
          // Check if available in context store (from _include)
          const contextMedication = getResource('Medication', id);
          if (contextMedication) {
            medicationCache.set(id, contextMedication);
          } else {
            toFetch.push(id);
          }
        }
        
        // Only fetch medications not in cache or context
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
          let containedCacheKey = null;

          // Handle reference-based medications
          if (req.medication?.reference?.reference) {
            const ref = req.medication.reference.reference;
            if (ref.startsWith('#')) {
              // Contained resource reference
              containedCacheKey = `contained:${req.id}:${ref}`;
            } else if (ref.startsWith('urn:uuid:')) {
              medicationId = ref.substring(9);
            }
          } else if (req.medicationReference?.reference) {
            const ref = req.medicationReference.reference;
            if (ref.startsWith('#')) {
              // Contained resource reference
              containedCacheKey = `contained:${req.id}:${ref}`;
            } else if (ref.startsWith('Medication/')) {
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

          // Handle contained resource references
          if (containedCacheKey && medicationCache.has(containedCacheKey)) {
            const medication = medicationCache.get(containedCacheKey);
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

    // Check for enriched medication data (from _include resolution)
    if (medicationRequest._resolvedMedicationCodeableConcept) {
      const enrichedName = medicationRequest._resolvedMedicationCodeableConcept.text ||
                          medicationRequest._resolvedMedicationCodeableConcept.coding?.[0]?.display;
      if (enrichedName) {
        return enrichedName;
      }
    }

    // Check medicationReference.display (may be enriched from _include)
    if (medicationRequest.medicationReference?.display) {
      return medicationRequest.medicationReference.display;
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

    // Reference format - check for contained first
    if (medicationRequest.medicationReference?.reference) {
      const ref = medicationRequest.medicationReference.reference;
      if (ref.startsWith('#')) {
        // Contained resource reference
        const containedMed = medicationRequest.contained?.find(
          resource => resource.resourceType === 'Medication' && resource.id === ref.substring(1)
        );
        if (containedMed) {
          return {
            format: 'contained',
            reference: medicationRequest.medicationReference,
            medication: containedMed,
            concept: containedMed.code
          };
        }
      }
      return {
        format: 'reference',
        reference: medicationRequest.medicationReference
      };
    }

    // Also check medication.reference for R5-like structures
    if (medicationRequest.medication?.reference?.reference) {
      const ref = medicationRequest.medication.reference.reference;
      if (ref.startsWith('#')) {
        const containedMed = medicationRequest.contained?.find(
          resource => resource.resourceType === 'Medication' && resource.id === ref.substring(1)
        );
        if (containedMed) {
          return {
            format: 'contained',
            reference: medicationRequest.medication.reference,
            medication: containedMed,
            concept: containedMed.code
          };
        }
      }
    }

    return { format: 'unknown', concept: null };
  }, []);

  return {
    resolvedMedications,
    getMedicationDisplay,
    loading,
    error
  };
};