/**
 * Clinical Context Provider
 * Manages clinical workflow state including current patient, encounter, and workspace
 * Now uses FHIR APIs directly for all clinical data
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { fhirClient } from '../services/fhirClient';
import { usePatientUpdates } from '../hooks/useWebSocket';
import websocketClient from '../services/websocket';

const ClinicalContext = createContext();

export const useClinical = () => {
  const context = useContext(ClinicalContext);
  if (!context) {
    throw new Error('useClinical must be used within a ClinicalProvider');
  }
  return context;
};

export const ClinicalProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [currentPatient, setCurrentPatient] = useState(null);
  const [currentEncounter, setCurrentEncounter] = useState(null);
  const [currentNote, setCurrentNote] = useState(null);
  const [workspaceMode, setWorkspaceMode] = useState('results');
  const [isLoading, setIsLoading] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState([]);

  // Use WebSocket hook for patient updates
  const { connected: wsConnected, lastUpdate } = usePatientUpdates(
    currentPatient?.id,
    { enabled: !!currentPatient }
  );

  // Initialize WebSocket connection
  useEffect(() => {
    if (token) {
      websocketClient.connect(token).catch(() => {
        // WebSocket connection error handled silently
      });
    }
    return () => {
      if (!token) {
        websocketClient.disconnect();
      }
    };
  }, [token]);

  // Helper function to transform FHIR Patient to our interface
  const transformFHIRPatient = (fhirPatient) => {
    const name = fhirPatient.name?.[0] || {};
    const address = fhirPatient.address?.[0] || {};
    const telecom = fhirPatient.telecom || [];
    
    // Extract phone and email
    const phone = telecom.find(t => t.system === 'phone')?.value;
    const email = telecom.find(t => t.system === 'email')?.value;
    
    // Extract MRN from identifiers
    const mrn = fhirPatient.identifier?.find(id => 
      id.type?.coding?.[0]?.code === 'MR' || 
      id.system?.includes('mrn')
    )?.value || fhirPatient.identifier?.[0]?.value;

    return {
      id: fhirPatient.id,
      mrn: mrn,
      firstName: name.given?.join(' ') || '',
      lastName: name.family || '',
      dateOfBirth: fhirPatient.birthDate,
      gender: fhirPatient.gender,
      race: fhirPatient.extension?.find(ext => 
        ext.url?.includes('race')
      )?.valueCodeableConcept?.text,
      ethnicity: fhirPatient.extension?.find(ext => 
        ext.url?.includes('ethnicity')
      )?.valueCodeableConcept?.text,
      address: address.line?.join(', ') || '',
      city: address.city,
      state: address.state,
      zipCode: address.postalCode,
      phone: phone,
      email: email,
      // These will be loaded separately
      allergies: [],
      problems: [],
      medications: []
    };
  };

  // Helper function to transform FHIR Encounter to our interface
  const transformFHIREncounter = (fhirEncounter) => {
    const type = fhirEncounter.type?.[0];
    const period = fhirEncounter.period || {};
    const location = fhirEncounter.location?.[0]?.location;
    const participant = fhirEncounter.participant?.find(p => 
      p.type?.[0]?.coding?.[0]?.code === 'ATND' ||
      p.type?.[0]?.coding?.[0]?.code === 'PPRF'
    );

    return {
      id: fhirEncounter.id,
      patientId: fhirClient.extractId(fhirEncounter.subject),
      encounter_type: type?.text || type?.coding?.[0]?.display || 'Unknown',
      encounter_date: period.start || fhirEncounter.date,
      encounter_class: fhirEncounter.class?.code,
      status: fhirEncounter.status,
      startDate: period.start,
      endDate: period.end,
      location: location ? { display: location.display } : null,
      provider: participant?.individual ? {
        display: participant.individual.display
      } : null
    };
  };

  // Load patient data using FHIR APIs
  const loadPatient = async (patientId) => {
    setIsLoading(true);
    // Clear previous patient state
    setCurrentPatient(null);
    setCurrentEncounter(null);
    
    try {
      // Load patient resource
      const fhirPatient = await fhirClient.read('Patient', patientId);
      const patient = transformFHIRPatient(fhirPatient);
      
      // Load related clinical data in parallel
      const [allergiesResult, conditionsResult, medicationsResult] = await Promise.all([
        fhirClient.getAllergies(patientId),
        fhirClient.getConditions(patientId),
        fhirClient.getMedications(patientId)
      ]);
      
      // Transform allergies
      patient.allergies = allergiesResult.resources.map(allergy => ({
        id: allergy.id,
        allergen: allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown',
        severity: allergy.criticality || 'unknown',
        reaction: allergy.reaction?.[0]?.manifestation?.[0]?.text || '',
        status: allergy.clinicalStatus?.coding?.[0]?.code || 'active'
      }));
      
      // Transform conditions/problems
      patient.problems = conditionsResult.resources.map(condition => ({
        id: condition.id,
        code: condition.code?.coding?.[0]?.code,
        description: condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown',
        display: condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown',
        clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code || 'active',
        clinical_status: condition.clinicalStatus?.coding?.[0]?.code || 'active',
        onsetDate: condition.onsetDateTime || condition.onsetPeriod?.start,
        snomed_code: condition.code?.coding?.find(c => c.system?.includes('snomed'))?.code,
        icd10_code: condition.code?.coding?.find(c => c.system?.includes('icd') || c.system?.includes('ICD'))?.code
      }));
      
      // Transform medications
      patient.medications = medicationsResult.resources.map(med => {
        // Extract medication name - check multiple possible locations
        let medicationName = 'Unknown';
        // Check for 'medication' field (used in some FHIR versions)
        if (med.medication?.text) {
          medicationName = med.medication.text;
        } else if (med.medication?.coding?.[0]?.display) {
          medicationName = med.medication.coding[0].display;
        } else if (med.medicationCodeableConcept?.text) {
          medicationName = med.medicationCodeableConcept.text;
        } else if (med.medicationCodeableConcept?.coding?.[0]?.display) {
          medicationName = med.medicationCodeableConcept.coding[0].display;
        } else if (med.medicationReference?.display) {
          // Handle medicationReference if used
          medicationName = med.medicationReference.display;
        } else if (med.contained?.[0]?.code?.text) {
          // Sometimes medication details are in contained resources
          medicationName = med.contained[0].code.text;
        } else if (med.contained?.[0]?.code?.coding?.[0]?.display) {
          medicationName = med.contained[0].code.coding[0].display;
        }
        
        // Extract dosage information
        let dosage = '';
        if (med.dosageInstruction?.[0]?.text) {
          // Use the text if available (more human-readable)
          dosage = med.dosageInstruction[0].text;
        } else if (med.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity) {
          const dose = med.dosageInstruction[0].doseAndRate[0].doseQuantity;
          dosage = `${dose.value} ${dose.unit || ''}`.trim();
        } else if (med.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseRange) {
          // Handle dose ranges
          const range = med.dosageInstruction[0].doseAndRate[0].doseRange;
          dosage = `${range.low?.value || ''}-${range.high?.value || ''} ${range.low?.unit || ''}`.trim();
        }
        
        // Extract frequency information
        let frequency = '';
        if (med.dosageInstruction?.[0]?.timing?.code?.text) {
          // Use timing code text if available
          frequency = med.dosageInstruction[0].timing.code.text;
        } else if (med.dosageInstruction?.[0]?.timing?.repeat) {
          const repeat = med.dosageInstruction[0].timing.repeat;
          if (repeat.frequency && repeat.period && repeat.periodUnit) {
            const periodUnit = repeat.periodUnit === 'd' ? 'day' : repeat.periodUnit;
            frequency = `${repeat.frequency} times per ${periodUnit}`;
          } else if (repeat.period && repeat.periodUnit) {
            // Sometimes frequency is implied as once per period
            const periodUnit = repeat.periodUnit === 'd' ? 'day' : repeat.periodUnit;
            frequency = `Once per ${periodUnit}`;
          }
        }
        
        // If we still have default values, combine dosage instruction text
        if ((medicationName === 'Unknown' || !dosage) && med.dosageInstruction?.[0]?.text) {
          const instructionText = med.dosageInstruction[0].text;
          // Try to parse medication name from instruction text if needed
          if (medicationName === 'Unknown' && instructionText) {
            // Common pattern: "Drug name X mg ..."
            const match = instructionText.match(/^([^\d]+)/);
            if (match) {
              medicationName = match[1].trim();
            }
          }
        }
        
        return {
          id: med.id,
          medication_name: medicationName,
          medication: medicationName,
          dosage: dosage || 'See instructions',
          frequency: frequency || 'As directed',
          status: med.status,
          source: 'prescribed',
          authoredOn: med.authoredOn
        };
      });
      
      setCurrentPatient(patient);
      
      // Load most recent encounter
      const encountersResult = await fhirClient.getEncounters(patientId);
      if (encountersResult.resources.length > 0) {
        // Sort by date descending
        const sortedEncounters = encountersResult.resources.sort((a, b) => {
          const dateA = new Date(a.period?.start || a.date || 0);
          const dateB = new Date(b.period?.start || b.date || 0);
          return dateB - dateA;
        });
        
        const mostRecentEncounter = transformFHIREncounter(sortedEncounters[0]);
        setCurrentEncounter(mostRecentEncounter);
      }
      
      // Store patient ID in localStorage
      localStorage.setItem('selectedPatientId', patientId);
      
    } catch (error) {
      // Add more detailed error handling
      if (error.response?.status === 404) {
        const errorMessage = 'Patient not found';
        localStorage.removeItem('selectedPatientId');
        throw new Error(errorMessage);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Load encounter data using FHIR API
  const loadEncounter = async (encounterId) => {
    setIsLoading(true);
    try {
      const fhirEncounter = await fhirClient.read('Encounter', encounterId);
      const encounter = transformFHIREncounter(fhirEncounter);
      
      setCurrentEncounter(encounter);
      
      // Also load the patient if not already loaded
      const patientId = fhirClient.extractId(fhirEncounter.subject);
      if (!currentPatient || currentPatient.id !== patientId) {
        await loadPatient(patientId);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Create new encounter using FHIR API
  const createEncounter = async (patientId, encounterData) => {
    try {
      // Build FHIR Encounter resource
      const fhirEncounter = {
        resourceType: 'Encounter',
        status: encounterData.status || 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: encounterData.encounter_class || 'AMB',
          display: encounterData.encounter_class === 'IMP' ? 'Inpatient' : 'Ambulatory'
        },
        type: [{
          text: encounterData.encounter_type || 'Office Visit'
        }],
        subject: fhirClient.reference('Patient', patientId),
        period: {
          start: encounterData.startDate || new Date().toISOString()
        }
      };
      
      // Add provider if specified
      if (encounterData.provider) {
        fhirEncounter.participant = [{
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'ATND',
              display: 'Attender'
            }]
          }],
          individual: {
            display: encounterData.provider.display || encounterData.provider
          }
        }];
      }
      
      // Add location if specified
      if (encounterData.location) {
        fhirEncounter.location = [{
          location: {
            display: encounterData.location.display || encounterData.location
          }
        }];
      }
      
      const result = await fhirClient.create('Encounter', fhirEncounter);
      const newEncounter = transformFHIREncounter(result.resource || fhirEncounter);
      newEncounter.id = result.id;
      
      setCurrentEncounter(newEncounter);
      return newEncounter;
    } catch (error) {
      throw error;
    }
  };

  // Refresh patient data
  const refreshPatientData = async () => {
    if (currentPatient) {
      await loadPatient(currentPatient.id);
    }
  };

  // Clear context
  const clearClinicalContext = () => {
    setCurrentPatient(null);
    setCurrentEncounter(null);
    setCurrentNote(null);
    setWorkspaceMode('overview');
    localStorage.removeItem('selectedPatientId');
  };

  // Clear context on logout
  useEffect(() => {
    if (!user) {
      clearClinicalContext();
    }
  }, [user]);

  // Load patient from localStorage if available
  useEffect(() => {
    const selectedPatientId = localStorage.getItem('selectedPatientId');
    if (selectedPatientId && !currentPatient && user) {
      loadPatient(selectedPatientId).catch(error => {
        localStorage.removeItem('selectedPatientId');
      });
    }
  }, [user]); // Only depend on user to avoid infinite loops

  // Handle real-time updates
  useEffect(() => {
    if (lastUpdate) {
      setRealTimeUpdates(prev => [...prev, lastUpdate].slice(-50)); // Keep last 50 updates
      
      // Refresh specific data based on update type
      if (lastUpdate.resourceType === 'Observation' && currentPatient) {
        // Could trigger a refresh of observations here
      } else if (lastUpdate.resourceType === 'DiagnosticReport' && currentPatient) {
        // Could trigger a refresh of lab results here
      }
    }
  }, [lastUpdate, currentPatient]);

  const value = {
    currentPatient,
    currentEncounter,
    currentNote,
    workspaceMode,
    isLoading,
    wsConnected,
    realTimeUpdates,
    setCurrentPatient,
    setCurrentEncounter,
    setCurrentNote,
    setWorkspaceMode,
    loadPatient,
    loadEncounter,
    createEncounter,
    refreshPatientData,
    clearClinicalContext
  };

  return (
    <ClinicalContext.Provider value={value}>
      {children}
    </ClinicalContext.Provider>
  );
};