/**
 * Clinical Context Provider
 * Manages clinical workflow state including current patient, encounter, and workspace
 * Now uses FHIR APIs directly for all clinical data
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { fhirClient } from '../services/fhirClient';

const ClinicalContext = createContext();

export const useClinical = () => {
  const context = useContext(ClinicalContext);
  if (!context) {
    throw new Error('useClinical must be used within a ClinicalProvider');
  }
  return context;
};

export const ClinicalProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentPatient, setCurrentPatient] = useState(null);
  const [currentEncounter, setCurrentEncounter] = useState(null);
  const [currentNote, setCurrentNote] = useState(null);
  const [workspaceMode, setWorkspaceMode] = useState('results');
  const [isLoading, setIsLoading] = useState(false);

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
        substance: allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown',
        severity: allergy.criticality || 'unknown',
        reaction: allergy.reaction?.[0]?.manifestation?.[0]?.text || '',
        status: allergy.clinicalStatus?.coding?.[0]?.code || 'active'
      }));
      
      // Transform conditions/problems
      patient.problems = conditionsResult.resources.map(condition => ({
        id: condition.id,
        code: condition.code?.coding?.[0]?.code,
        display: condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown',
        status: condition.clinicalStatus?.coding?.[0]?.code || 'active',
        onsetDate: condition.onsetDateTime || condition.onsetPeriod?.start
      }));
      
      // Transform medications
      patient.medications = medicationsResult.resources.map(med => ({
        id: med.id,
        medication: med.medicationCodeableConcept?.text || 
                   med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown',
        dosage: med.dosageInstruction?.[0]?.text || '',
        status: med.status,
        authoredOn: med.authoredOn
      }));
      
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
      console.error('Error loading patient:', error);
      // Add more detailed error handling
      if (error.response?.status === 404) {
        const errorMessage = 'Patient not found';
        console.error(errorMessage);
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
      console.error('Error loading encounter:', error);
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
      console.error('Error creating encounter:', error);
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
        console.error('Failed to load patient from localStorage:', error);
        localStorage.removeItem('selectedPatientId');
      });
    }
  }, [user]); // Only depend on user to avoid infinite loops

  const value = {
    currentPatient,
    currentEncounter,
    currentNote,
    workspaceMode,
    isLoading,
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