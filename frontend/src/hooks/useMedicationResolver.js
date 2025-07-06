/**
 * useMedicationResolver Hook
 * Resolves Medication references from MedicationRequest resources
 */
import { useState, useEffect, useRef } from 'react';
import { fhirClient } from '../services/fhirClient';

// Cache for resolved medications to avoid repeated fetches
const medicationCache = new Map();

export const useMedicationResolver = (medicationRequests = []) => {
  const [resolvedMedications, setResolvedMedications] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Ref to access the cache consistently
  const cacheRef = useRef(medicationCache);


  useEffect(() => {
    console.log('🔧 useMedicationResolver: Effect triggered with', medicationRequests.length, 'medications');
    
    const resolveMedications = async () => {
      if (!medicationRequests || medicationRequests.length === 0) {
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
          console.log('🔍 Processing MedicationRequest:', req.id, {
            medication: req.medication,
            medicationReference: req.medicationReference,
            medicationCodeableConcept: req.medicationCodeableConcept
          });
          
          // Handle different medication structures from Synthea
          if (req.medication?.reference?.reference) {
            // Handle nested reference structure from Synthea
            const ref = req.medication.reference.reference;
            console.log('📌 Found medication.reference.reference:', ref);
            if (ref.startsWith('urn:uuid:')) {
              const id = ref.substring(9);
              medicationRefs.add(id);
              console.log('✅ Added medication ID to fetch:', id);
            }
          } else if (req.medicationReference?.reference) {
            // Handle standard FHIR structure
            const ref = req.medicationReference.reference;
            console.log('📌 Found medicationReference.reference:', ref);
            if (ref.startsWith('Medication/')) {
              const id = ref.substring(11);
              medicationRefs.add(id);
              console.log('✅ Added medication ID to fetch:', id);
            }
          } else if (req.medication?.concept) {
            // Handle concept-based medications (inline)
            console.log('📌 Found medication.concept:', req.medication.concept);
            // These don't need fetching as they're inline
          }
        });

        // Fetch medications not in cache
        const toFetch = Array.from(medicationRefs).filter(id => !medicationCache.has(id));
        
        console.log('🚀 Fetching medications:', toFetch, 'Cache size before:', medicationCache.size);
        if (toFetch.length > 0) {
          // Sequential fetch to ensure cache operations complete properly
          for (const id of toFetch) {
            try {
              console.log('📡 Fetching Medication:', id);
              const response = await fhirClient.read('Medication', id);
              console.log('📋 Fetched Medication response for', id, ':', response);
              
              // Handle both response.data and direct response formats
              const medicationData = response.data || response;
              
              if (medicationData && medicationData.resourceType === 'Medication') {
                medicationCache.set(id, medicationData);
                console.log('💾 Cached medication:', id, medicationData.code?.text, 'Cache size now:', medicationCache.size);
                console.log('🔍 Cache verification - has key:', medicationCache.has(id), 'value:', medicationCache.get(id)?.code?.text);
              } else {
                console.warn('⚠️ No valid medication data in response for:', id, 'response:', response);
                medicationCache.set(id, null);
              }
            } catch (err) {
              console.warn(`❌ Failed to fetch Medication/${id}:`, err);
              medicationCache.set(id, null);
            }
          }
          
          console.log('📊 All fetches complete. Cache size:', medicationCache.size, 'Cache keys:', Array.from(medicationCache.keys()));
        }

        // Build resolved medications map AFTER all fetches complete
        // Verify cache before mapping
        console.log('🔗 Starting medication mapping phase');
        console.log('📊 Cache state: size =', medicationCache.size, 'keys =', Array.from(medicationCache.keys()));
        
        // Log each cache entry for debugging
        for (const [key, value] of medicationCache.entries()) {
          console.log('🗝️ Cache entry:', key, '->', value?.code?.text || 'null');
        }
        
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
            console.log('🔄 Using inline medication.concept for', req.id, ':', medName);
            resolved[req.id] = {
              name: medName,
              code: concept
            };
            return; // Skip further processing for this request
          }

          console.log('🔗 Mapping MedicationRequest', req.id, 'to Medication', medicationId);

          if (medicationId) {
            console.log('🔍 Looking for medicationId:', medicationId, 'in cache. Has key:', medicationCache.has(medicationId));
            
            if (medicationCache.has(medicationId)) {
              const medication = medicationCache.get(medicationId);
              console.log('📦 Retrieved from cache:', medication);
              
              if (medication) {
                const medName = medication.code?.text || medication.code?.coding?.[0]?.display || 'Unknown medication';
                console.log('✅ Resolved medication for MedicationRequest', req.id, '-> Medication', medicationId, ':', medName);
                resolved[req.id] = {
                  name: medName,
                  code: medication.code,
                  form: medication.form,
                  ingredient: medication.ingredient,
                  medication: medication
                };
              } else {
                console.log('❌ Medication cache has null for:', medicationId);
              }
            } else {
              console.log('❌ Medication not found in cache for:', medicationId);
              console.log('📊 Current cache contents:', Array.from(medicationCache.entries()).map(([k, v]) => ({id: k, name: v?.code?.text})));
            }
          } else if (req.medicationCodeableConcept) {
            // Fallback to medicationCodeableConcept if available
            const medName = req.medicationCodeableConcept.text || 
                          req.medicationCodeableConcept.coding?.[0]?.display || 
                          'Unknown medication';
            console.log('🔄 Using medicationCodeableConcept for', req.id, ':', medName);
            resolved[req.id] = {
              name: medName,
              code: req.medicationCodeableConcept
            };
          } else {
            console.log('❌ No medication info found for MedicationRequest:', req.id);
            console.log('   - medicationId:', medicationId);
            console.log('   - cache size:', medicationCache.size);
            console.log('   - cache keys:', Array.from(medicationCache.keys()));
            console.log('   - req.medication:', req.medication);
            console.log('   - req.medicationReference:', req.medicationReference);
            console.log('   - req.medicationCodeableConcept:', req.medicationCodeableConcept);
          }
        });

        console.log('🎯 Final resolved medications:', resolved);
        setResolvedMedications(resolved);
      } catch (err) {
        console.error('❌ Error resolving medications:', err);
        setError(err.message || 'Failed to resolve medications');
      } finally {
        setLoading(false);
      }
    };

    resolveMedications();
  }, [medicationRequests]);

  // Helper function to get medication display name
  const getMedicationDisplay = (medicationRequest) => {
    if (!medicationRequest?.id) {
      console.log('❌ getMedicationDisplay: No medication request ID');
      return 'Unknown medication';
    }
    
    const resolved = resolvedMedications[medicationRequest.id];
    if (resolved) {
      console.log('✅ getMedicationDisplay: Found resolved med for', medicationRequest.id, ':', resolved.name);
      return resolved.name;
    }
    
    // Fallback to medicationCodeableConcept if no resolution
    if (medicationRequest.medicationCodeableConcept) {
      const fallbackName = medicationRequest.medicationCodeableConcept.text || 
                          medicationRequest.medicationCodeableConcept.coding?.[0]?.display || 
                          'Unknown medication';
      console.log('🔄 getMedicationDisplay: Using fallback for', medicationRequest.id, ':', fallbackName);
      return fallbackName;
    }
    
    console.log('❌ getMedicationDisplay: No name found for', medicationRequest.id, 'resolved keys:', Object.keys(resolvedMedications));
    return 'Unknown medication';
  };

  return {
    resolvedMedications,
    getMedicationDisplay,
    loading,
    error
  };
};