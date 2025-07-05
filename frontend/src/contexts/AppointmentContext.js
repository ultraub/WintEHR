/**
 * AppointmentContext - React context for managing appointment state
 * Provides FHIR R4 compliant appointment management functionality
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { fhirClient } from '../services/fhirClient';

// Action types
const APPOINTMENT_ACTIONS = {
  FETCH_APPOINTMENTS_START: 'FETCH_APPOINTMENTS_START',
  FETCH_APPOINTMENTS_SUCCESS: 'FETCH_APPOINTMENTS_SUCCESS',
  FETCH_APPOINTMENTS_ERROR: 'FETCH_APPOINTMENTS_ERROR',
  CREATE_APPOINTMENT_START: 'CREATE_APPOINTMENT_START',
  CREATE_APPOINTMENT_SUCCESS: 'CREATE_APPOINTMENT_SUCCESS',
  CREATE_APPOINTMENT_ERROR: 'CREATE_APPOINTMENT_ERROR',
  UPDATE_APPOINTMENT_START: 'UPDATE_APPOINTMENT_START',
  UPDATE_APPOINTMENT_SUCCESS: 'UPDATE_APPOINTMENT_SUCCESS',
  UPDATE_APPOINTMENT_ERROR: 'UPDATE_APPOINTMENT_ERROR',
  DELETE_APPOINTMENT_START: 'DELETE_APPOINTMENT_START',
  DELETE_APPOINTMENT_SUCCESS: 'DELETE_APPOINTMENT_SUCCESS',
  DELETE_APPOINTMENT_ERROR: 'DELETE_APPOINTMENT_ERROR',
  SET_SELECTED_APPOINTMENT: 'SET_SELECTED_APPOINTMENT',
  SET_FILTERS: 'SET_FILTERS',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// FHIR R4 Appointment status values
export const APPOINTMENT_STATUS = {
  PROPOSED: 'proposed',
  PENDING: 'pending',
  BOOKED: 'booked',
  ARRIVED: 'arrived',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
  NOSHOW: 'noshow',
  ENTERED_IN_ERROR: 'entered-in-error',
  CHECKED_IN: 'checked-in',
  WAITLIST: 'waitlist'
};

// FHIR R4 Participant status values
export const PARTICIPANT_STATUS = {
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  TENTATIVE: 'tentative',
  NEEDS_ACTION: 'needs-action'
};

// Initial state
const initialState = {
  appointments: [],
  selectedAppointment: null,
  loading: false,
  error: null,
  filters: {
    status: '',
    patient: '',
    practitioner: '',
    location: '',
    dateRange: {
      start: null,
      end: null
    }
  },
  pagination: {
    page: 0,
    size: 20,
    total: 0
  }
};

// Reducer function
function appointmentReducer(state, action) {
  switch (action.type) {
    case APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_START:
    case APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_START:
    case APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_START:
    case APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_SUCCESS:
      return {
        ...state,
        loading: false,
        appointments: action.payload.appointments,
        pagination: {
          ...state.pagination,
          total: action.payload.total
        },
        error: null
      };

    case APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_SUCCESS:
      return {
        ...state,
        loading: false,
        appointments: [action.payload, ...state.appointments],
        error: null
      };

    case APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_SUCCESS:
      return {
        ...state,
        loading: false,
        appointments: state.appointments.map(appointment =>
          appointment.id === action.payload.id ? action.payload : appointment
        ),
        selectedAppointment: action.payload,
        error: null
      };

    case APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_SUCCESS:
      return {
        ...state,
        loading: false,
        appointments: state.appointments.filter(appointment => appointment.id !== action.payload),
        selectedAppointment: null,
        error: null
      };

    case APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_ERROR:
    case APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_ERROR:
    case APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_ERROR:
    case APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload
      };

    case APPOINTMENT_ACTIONS.SET_SELECTED_APPOINTMENT:
      return {
        ...state,
        selectedAppointment: action.payload
      };

    case APPOINTMENT_ACTIONS.SET_FILTERS:
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload
        }
      };

    case APPOINTMENT_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
}

// Create context
const AppointmentContext = createContext(null);

// Provider component
export function AppointmentProvider({ children }) {
  const [state, dispatch] = useReducer(appointmentReducer, initialState);

  // Helper function to build FHIR search parameters
  const buildSearchParams = useCallback((filters, pagination) => {
    const params = {};
    
    // Add pagination
    params._count = pagination.size.toString();
    params._offset = (pagination.page * pagination.size).toString();
    
    // Add filters
    if (filters.status) {
      params.status = filters.status;
    }
    
    if (filters.patient) {
      params.patient = filters.patient;
    }
    
    if (filters.practitioner) {
      params.practitioner = filters.practitioner;
    }
    
    if (filters.location) {
      params.location = filters.location;
    }
    
    if (filters.dateRange.start) {
      params.date = `ge${filters.dateRange.start}`;
    }
    
    if (filters.dateRange.end) {
      // If we already have a start date, combine them
      if (params.date) {
        params.date = [params.date, `le${filters.dateRange.end}`];
      } else {
        params.date = `le${filters.dateRange.end}`;
      }
    }
    
    return params;
  }, []);

  // Fetch appointments
  const fetchAppointments = useCallback(async (customFilters = null, customPagination = null) => {
    dispatch({ type: APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_START });
    
    try {
      const filters = customFilters || state.filters;
      const pagination = customPagination || state.pagination;
      const searchParams = buildSearchParams(filters, pagination);
      
      const response = await fhirClient.search('Appointment', searchParams);
      
      const appointments = response.resources || [];
      const total = response.total || 0;
      
      dispatch({
        type: APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_SUCCESS,
        payload: { appointments, total }
      });
      
      return { appointments, total };
    } catch (error) {
      console.error('Error fetching appointments:', error);
      dispatch({
        type: APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_ERROR,
        payload: error.response?.data?.message || 'Failed to fetch appointments'
      });
      throw error;
    }
  }, [state.filters, state.pagination, buildSearchParams]);

  // Create appointment
  const createAppointment = useCallback(async (appointmentData) => {
    dispatch({ type: APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_START });
    
    try {
      // Ensure required FHIR fields
      const fhirAppointment = {
        resourceType: 'Appointment',
        status: appointmentData.status || APPOINTMENT_STATUS.BOOKED,
        start: appointmentData.start,
        end: appointmentData.end,
        participant: appointmentData.participant || [],
        ...appointmentData
      };
      
      const response = await fhirClient.create('Appointment', fhirAppointment);
      
      dispatch({
        type: APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_SUCCESS,
        payload: response.resource || fhirAppointment
      });
      
      return response.resource || fhirAppointment;
    } catch (error) {
      console.error('Error creating appointment:', error);
      dispatch({
        type: APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_ERROR,
        payload: error.response?.data?.message || 'Failed to create appointment'
      });
      throw error;
    }
  }, []);

  // Update appointment
  const updateAppointment = useCallback(async (appointmentId, updateData) => {
    dispatch({ type: APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_START });
    
    try {
      const response = await fhirClient.update('Appointment', appointmentId, updateData);
      
      dispatch({
        type: APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_SUCCESS,
        payload: updateData
      });
      
      return updateData;
    } catch (error) {
      console.error('Error updating appointment:', error);
      dispatch({
        type: APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_ERROR,
        payload: error.response?.data?.message || 'Failed to update appointment'
      });
      throw error;
    }
  }, []);

  // Cancel appointment
  const cancelAppointment = useCallback(async (appointmentId, reason) => {
    try {
      const updateData = {
        status: APPOINTMENT_STATUS.CANCELLED,
        cancelationReason: reason ? {
          text: reason
        } : undefined
      };
      
      return await updateAppointment(appointmentId, updateData);
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw error;
    }
  }, [updateAppointment]);

  // Reschedule appointment
  const rescheduleAppointment = useCallback(async (appointmentId, newStart, newEnd) => {
    try {
      const updateData = {
        start: newStart,
        end: newEnd,
        status: APPOINTMENT_STATUS.BOOKED // Reset to booked when rescheduled
      };
      
      return await updateAppointment(appointmentId, updateData);
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      throw error;
    }
  }, [updateAppointment]);

  // Delete appointment
  const deleteAppointment = useCallback(async (appointmentId) => {
    dispatch({ type: APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_START });
    
    try {
      await fhirClient.delete('Appointment', appointmentId);
      
      dispatch({
        type: APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_SUCCESS,
        payload: appointmentId
      });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      dispatch({
        type: APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_ERROR,
        payload: error.response?.data?.message || 'Failed to delete appointment'
      });
      throw error;
    }
  }, []);

  // Get appointment by ID
  const getAppointment = useCallback(async (appointmentId) => {
    try {
      const appointment = await fhirClient.read('Appointment', appointmentId);
      return appointment;
    } catch (error) {
      console.error('Error fetching appointment:', error);
      throw error;
    }
  }, []);

  // Set selected appointment
  const setSelectedAppointment = useCallback((appointment) => {
    dispatch({
      type: APPOINTMENT_ACTIONS.SET_SELECTED_APPOINTMENT,
      payload: appointment
    });
  }, []);

  // Set filters
  const setFilters = useCallback((newFilters) => {
    dispatch({
      type: APPOINTMENT_ACTIONS.SET_FILTERS,
      payload: newFilters
    });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: APPOINTMENT_ACTIONS.CLEAR_ERROR });
  }, []);

  // Helper functions for appointment management
  const getAppointmentsByPatient = useCallback(async (patientId) => {
    return fetchAppointments({ patient: `Patient/${patientId}` });
  }, [fetchAppointments]);

  const getAppointmentsByPractitioner = useCallback(async (practitionerId) => {
    return fetchAppointments({ practitioner: `Practitioner/${practitionerId}` });
  }, [fetchAppointments]);

  const getAppointmentsByDateRange = useCallback(async (startDate, endDate) => {
    return fetchAppointments({
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  }, [fetchAppointments]);

  // Context value
  const value = {
    // State
    ...state,
    
    // Actions
    fetchAppointments,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    rescheduleAppointment,
    deleteAppointment,
    getAppointment,
    setSelectedAppointment,
    setFilters,
    clearError,
    
    // Helper functions
    getAppointmentsByPatient,
    getAppointmentsByPractitioner,
    getAppointmentsByDateRange,
    
    // Constants
    APPOINTMENT_STATUS,
    PARTICIPANT_STATUS
  };

  return (
    <AppointmentContext.Provider value={value}>
      {children}
    </AppointmentContext.Provider>
  );
}

// Custom hook for using appointment context
export function useAppointments() {
  const context = useContext(AppointmentContext);
  if (!context) {
    throw new Error('useAppointments must be used within an AppointmentProvider');
  }
  return context;
}

export default AppointmentContext;