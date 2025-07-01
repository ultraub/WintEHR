/**
 * Clinical Context Provider
 * Manages clinical workflow state including current patient, encounter, and workspace
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

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

  // Load patient data
  const loadPatient = async (patientId) => {
    setIsLoading(true);
    // Clear previous patient state
    setCurrentPatient(null);
    setCurrentEncounter(null);
    
    try {
      const response = await api.get(`/api/patients/${patientId}`);
      const patientData = response.data;
      
      // Transform to our Patient interface
      const patient = {
        id: patientData.id,
        mrn: patientData.mrn,
        firstName: patientData.first_name,
        lastName: patientData.last_name,
        dateOfBirth: patientData.date_of_birth,
        gender: patientData.gender,
        race: patientData.race,
        ethnicity: patientData.ethnicity,
        address: patientData.address,
        city: patientData.city,
        state: patientData.state,
        zipCode: patientData.zip_code,
        phone: patientData.phone,
        email: patientData.email,
        insuranceName: patientData.insurance_name,
        insuranceId: patientData.insurance_id,
        allergies: patientData.allergies || [],
        problems: patientData.conditions || [],
        medications: patientData.medications || []
      };
      
      setCurrentPatient(patient);
      
      // Load most recent encounter
      const encountersResponse = await api.get(`/api/encounters`, {
        params: {
          patient_id: patientId,
          sort: 'start_date',
          order: 'desc',
          limit: 1
        }
      });
      
      if (encountersResponse.data.length > 0) {
        const encounterData = encountersResponse.data[0];
        const encounter = {
          id: encounterData.id,
          patientId: encounterData.patient_id,
          encounter_type: encounterData.encounter_type,
          encounter_date: encounterData.encounter_date || encounterData.start_date,
          encounter_class: encounterData.encounter_class,
          status: encounterData.status,
          startDate: encounterData.start_date,
          endDate: encounterData.end_date,
          location: encounterData.location,
          provider: encounterData.provider
        };
        setCurrentEncounter(encounter);
      }
    } catch (error) {
      console.error('Error loading patient:', error);
      // Add more detailed error handling
      if (error.response?.status === 404) {
        const errorMessage = 'Failed to load patient: 404';
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Load encounter data
  const loadEncounter = async (encounterId) => {
    setIsLoading(true);
    try {
      const response = await api.get(`/api/encounters/${encounterId}`);
      const encounterData = response.data;
      
      setCurrentEncounter({
        id: encounterData.id,
        patientId: encounterData.patient_id,
        encounterType: encounterData.encounter_type,
        status: encounterData.status,
        startDate: encounterData.start_date,
        endDate: encounterData.end_date,
        location: encounterData.location,
        provider: encounterData.provider
      });
      
      // Also load the patient if not already loaded
      if (!currentPatient || currentPatient.id !== encounterData.patient_id) {
        await loadPatient(encounterData.patient_id);
      }
    } catch (error) {
      console.error('Error loading encounter:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Create new encounter
  const createEncounter = async (patientId, encounterData) => {
    try {
      const response = await api.post('/api/encounters', {
        patient_id: patientId,
        ...encounterData
      });
      
      const newEncounter = {
        id: response.data.id,
        patientId: response.data.patient_id,
        encounterType: response.data.encounter_type,
        status: response.data.status,
        startDate: response.data.start_date,
        endDate: response.data.end_date,
        location: response.data.location,
        provider: response.data.provider
      };
      
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
    if (selectedPatientId && !currentPatient) {
      loadPatient(selectedPatientId).catch(console.error);
    }
  }, []);

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