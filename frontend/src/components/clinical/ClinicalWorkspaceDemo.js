/**
 * ClinicalWorkspaceDemo Component
 * Temporary component for testing the enhanced clinical workspace without authentication
 */
import React, { useState, useEffect } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import EnhancedClinicalLayout from './layouts/EnhancedClinicalLayout';
import ClinicalWorkspaceEnhanced from './ClinicalWorkspaceEnhanced';
import { FHIRResourceProvider } from '../../contexts/FHIRResourceContext';
import { ClinicalWorkflowProvider } from '../../contexts/ClinicalWorkflowContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import { MockAuthProvider } from './MockAuthProvider';

const ClinicalWorkspaceDemo = () => {
  const { id: urlPatientId } = useParams();
  const navigate = useNavigate();
  const [mockPatient, setMockPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load a real patient from the database
  useEffect(() => {
    const loadPatient = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First try to use the URL patient ID
        let response = await fetch(`/api/fhir/R4/Patient/${urlPatientId}`);
        
        // If not found, get the first patient from the database
        if (!response.ok) {
          response = await fetch('/api/fhir/R4/Patient?_count=1');
          const bundle = await response.json();
          
          if (bundle.entry && bundle.entry.length > 0) {
            const firstPatient = bundle.entry[0].resource;
            setMockPatient(firstPatient);
            
            // Redirect to the correct patient ID
            if (firstPatient.id !== urlPatientId) {
              navigate(`/clinical-demo/${firstPatient.id}`, { replace: true });
            }
          } else {
            throw new Error('No patients found in database');
          }
        } else {
          const patient = await response.json();
          setMockPatient(patient);
        }
      } catch (err) {
        console.error('Failed to load patient:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPatient();
  }, [urlPatientId, navigate]);

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography>Failed to load demo patient: {error}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Make sure you have loaded patient data using ./load-patients.sh
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <MockAuthProvider>
      <WebSocketProvider>
        <FHIRResourceProvider>
          <ClinicalWorkflowProvider>
            <Box sx={{ height: '100vh', overflow: 'hidden' }}>
              <Alert severity="warning" sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                <Typography variant="body2">
                  Demo Mode: This is a temporary view for testing the enhanced clinical workspace UI. 
                  Authentication is bypassed. {mockPatient && `Testing with patient: ${mockPatient.name?.[0]?.given?.[0]} ${mockPatient.name?.[0]?.family}`}
                </Typography>
              </Alert>
              
              <Box sx={{ mt: 6, height: 'calc(100vh - 48px)' }}>
                <EnhancedClinicalLayout>
                  <ClinicalWorkspaceEnhanced 
                    patient={mockPatient}
                    loading={loading}
                    patientData={mockPatient}
                  />
                </EnhancedClinicalLayout>
              </Box>
            </Box>
          </ClinicalWorkflowProvider>
        </FHIRResourceProvider>
      </WebSocketProvider>
    </MockAuthProvider>
  );
};

export default ClinicalWorkspaceDemo;