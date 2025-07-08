/**
 * Custom hook for patient search functionality
 */

import { useState, useCallback } from 'react';
import api from '../services/api';

export const usePatientSearch = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchPatients = useCallback(async (searchTerm = '') => {
    setLoading(true);
    setError(null);
    
    try {
      const params = searchTerm ? `?name=${searchTerm}` : '?_count=20';
      const response = await api.get(`/fhir/R4/Patient${params}`);
      
      const patientList = response.data.entry?.map(entry => entry.resource) || [];
      setPatients(patientList);
      
      return patientList;
    } catch (err) {
      
      setError(err.message);
      setPatients([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    patients,
    loading,
    error,
    searchPatients
  };
};