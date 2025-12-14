/**
 * PatientContext
 *
 * Handles patient-specific state management including:
 * - Current patient selection
 * - Current encounter tracking
 * - Patient context changes
 * - Patient-related preferences
 */

import React, { createContext, useContext, useCallback, useReducer } from 'react';

// Action Types
const PATIENT_ACTIONS = {
  SET_CURRENT_PATIENT: 'SET_CURRENT_PATIENT',
  CLEAR_CURRENT_PATIENT: 'CLEAR_CURRENT_PATIENT',
  SET_CURRENT_ENCOUNTER: 'SET_CURRENT_ENCOUNTER',
  CLEAR_CURRENT_ENCOUNTER: 'CLEAR_CURRENT_ENCOUNTER',
  SET_PATIENT_PREFERENCES: 'SET_PATIENT_PREFERENCES',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR'
};

// Initial State
const initialState = {
  // Current patient context
  currentPatient: null,
  currentPatientId: null,

  // Current encounter context
  currentEncounter: null,
  currentEncounterId: null,

  // Patient-specific preferences (UI state per patient)
  patientPreferences: {},

  // Loading and error states
  loading: false,
  error: null
};

// Reducer
function patientReducer(state, action) {
  switch (action.type) {
    case PATIENT_ACTIONS.SET_CURRENT_PATIENT: {
      const patient = action.payload;
      return {
        ...state,
        currentPatient: patient,
        currentPatientId: patient?.id || null,
        error: null
      };
    }

    case PATIENT_ACTIONS.CLEAR_CURRENT_PATIENT: {
      return {
        ...state,
        currentPatient: null,
        currentPatientId: null,
        currentEncounter: null,
        currentEncounterId: null,
        error: null
      };
    }

    case PATIENT_ACTIONS.SET_CURRENT_ENCOUNTER: {
      const encounter = action.payload;
      return {
        ...state,
        currentEncounter: encounter,
        currentEncounterId: encounter?.id || null
      };
    }

    case PATIENT_ACTIONS.CLEAR_CURRENT_ENCOUNTER: {
      return {
        ...state,
        currentEncounter: null,
        currentEncounterId: null
      };
    }

    case PATIENT_ACTIONS.SET_PATIENT_PREFERENCES: {
      const { patientId, preferences } = action.payload;
      return {
        ...state,
        patientPreferences: {
          ...state.patientPreferences,
          [patientId]: {
            ...state.patientPreferences[patientId],
            ...preferences
          }
        }
      };
    }

    case PATIENT_ACTIONS.SET_LOADING: {
      return {
        ...state,
        loading: action.payload
      };
    }

    case PATIENT_ACTIONS.SET_ERROR: {
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    }

    default:
      return state;
  }
}

// Create Context
const PatientContext = createContext(null);

// Provider Component
export function PatientProvider({ children }) {
  const [state, dispatch] = useReducer(patientReducer, initialState);

  /**
   * Set the current patient
   * @param {Object} patient - Patient FHIR resource
   */
  const setCurrentPatient = useCallback((patient) => {
    dispatch({
      type: PATIENT_ACTIONS.SET_CURRENT_PATIENT,
      payload: patient
    });
  }, []);

  /**
   * Clear the current patient context
   */
  const clearCurrentPatient = useCallback(() => {
    dispatch({ type: PATIENT_ACTIONS.CLEAR_CURRENT_PATIENT });
  }, []);

  /**
   * Set the current encounter
   * @param {Object} encounter - Encounter FHIR resource
   */
  const setCurrentEncounter = useCallback((encounter) => {
    dispatch({
      type: PATIENT_ACTIONS.SET_CURRENT_ENCOUNTER,
      payload: encounter
    });
  }, []);

  /**
   * Clear the current encounter
   */
  const clearCurrentEncounter = useCallback(() => {
    dispatch({ type: PATIENT_ACTIONS.CLEAR_CURRENT_ENCOUNTER });
  }, []);

  /**
   * Set preferences for a specific patient
   * @param {string} patientId - Patient ID
   * @param {Object} preferences - Preferences to set
   */
  const setPatientPreferences = useCallback((patientId, preferences) => {
    dispatch({
      type: PATIENT_ACTIONS.SET_PATIENT_PREFERENCES,
      payload: { patientId, preferences }
    });
  }, []);

  /**
   * Get preferences for the current patient
   * @returns {Object} Current patient preferences
   */
  const getCurrentPatientPreferences = useCallback(() => {
    if (!state.currentPatientId) return {};
    return state.patientPreferences[state.currentPatientId] || {};
  }, [state.currentPatientId, state.patientPreferences]);

  /**
   * Set loading state
   * @param {boolean} loading - Loading state
   */
  const setLoading = useCallback((loading) => {
    dispatch({
      type: PATIENT_ACTIONS.SET_LOADING,
      payload: loading
    });
  }, []);

  /**
   * Set error state
   * @param {string|null} error - Error message or null to clear
   */
  const setError = useCallback((error) => {
    dispatch({
      type: PATIENT_ACTIONS.SET_ERROR,
      payload: error
    });
  }, []);

  /**
   * Get formatted patient name
   * @returns {string} Formatted patient name
   */
  const getPatientDisplayName = useCallback(() => {
    const patient = state.currentPatient;
    if (!patient) return '';

    const name = patient.name?.[0];
    if (!name) return patient.id || 'Unknown';

    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    return `${given} ${family}`.trim() || patient.id || 'Unknown';
  }, [state.currentPatient]);

  /**
   * Get patient MRN (Medical Record Number)
   * @returns {string|null} MRN or null
   */
  const getPatientMRN = useCallback(() => {
    const patient = state.currentPatient;
    if (!patient?.identifier) return null;

    const mrnIdentifier = patient.identifier.find(
      id => id.type?.coding?.some(c => c.code === 'MR') ||
            id.system?.includes('mrn')
    );

    return mrnIdentifier?.value || null;
  }, [state.currentPatient]);

  /**
   * Check if patient is currently selected
   * @returns {boolean} True if patient is selected
   */
  const hasPatient = useCallback(() => {
    return !!state.currentPatientId;
  }, [state.currentPatientId]);

  /**
   * Check if encounter is currently active
   * @returns {boolean} True if encounter is active
   */
  const hasEncounter = useCallback(() => {
    return !!state.currentEncounterId;
  }, [state.currentEncounterId]);

  // Context value
  const contextValue = React.useMemo(() => ({
    // State
    currentPatient: state.currentPatient,
    currentPatientId: state.currentPatientId,
    currentEncounter: state.currentEncounter,
    currentEncounterId: state.currentEncounterId,
    patientPreferences: state.patientPreferences,
    loading: state.loading,
    error: state.error,

    // Patient actions
    setCurrentPatient,
    clearCurrentPatient,

    // Encounter actions
    setCurrentEncounter,
    clearCurrentEncounter,

    // Preferences
    setPatientPreferences,
    getCurrentPatientPreferences,

    // Loading/Error
    setLoading,
    setError,

    // Utilities
    getPatientDisplayName,
    getPatientMRN,
    hasPatient,
    hasEncounter,

    // Dispatch for advanced usage
    dispatch
  }), [
    state,
    setCurrentPatient,
    clearCurrentPatient,
    setCurrentEncounter,
    clearCurrentEncounter,
    setPatientPreferences,
    getCurrentPatientPreferences,
    setLoading,
    setError,
    getPatientDisplayName,
    getPatientMRN,
    hasPatient,
    hasEncounter
  ]);

  return (
    <PatientContext.Provider value={contextValue}>
      {children}
    </PatientContext.Provider>
  );
}

/**
 * Hook to access the patient context
 * @returns {object} Patient context value
 * @throws {Error} If used outside of PatientProvider
 */
export function usePatient() {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return context;
}

// Export action types for external use
export { PATIENT_ACTIONS };

export default PatientContext;
