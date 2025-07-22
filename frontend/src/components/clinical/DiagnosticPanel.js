/**
 * Diagnostic Panel for debugging clinical workspace loading issues
 */
import React from 'react';
import { Box, Paper, Typography, Chip, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';

const DiagnosticPanel = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { currentPatient, isLoading: fhirLoading, resources, globalLoading } = useFHIRResource();

  const diagnostics = [
    {
      label: 'Auth Status',
      status: authLoading ? 'loading' : (isAuthenticated ? 'success' : 'error'),
      value: authLoading ? 'Loading...' : (isAuthenticated ? `Logged in as ${user?.username}` : 'Not authenticated')
    },
    {
      label: 'Auth Token',
      status: localStorage.getItem('auth_token') ? 'success' : 'error',
      value: localStorage.getItem('auth_token') ? 'Token present' : 'No token'
    },
    {
      label: 'Patient Data',
      status: fhirLoading ? 'loading' : (currentPatient ? 'success' : 'warning'),
      value: fhirLoading ? 'Loading...' : (currentPatient ? `${currentPatient.name?.[0]?.text || 'Patient loaded'}` : 'No patient')
    },
    {
      label: 'FHIR Loading',
      status: fhirLoading ? 'loading' : 'success',
      value: fhirLoading ? 'Loading resources...' : 'Ready'
    },
    {
      label: 'Global Loading',
      status: globalLoading ? 'loading' : 'success',
      value: globalLoading ? 'Loading...' : 'Ready'
    },
    {
      label: 'Resources',
      status: resources ? 'success' : 'error',
      value: resources ? `${Object.keys(resources).length} types loaded` : 'No resources'
    }
  ];

  const getIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon fontSize="small" />;
      case 'error':
        return <ErrorIcon fontSize="small" />;
      case 'loading':
        return <CircularProgress size={16} />;
      case 'warning':
        return <PendingIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const getColor = (status) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'loading':
        return 'default';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Paper sx={{ p: 2, position: 'fixed', bottom: 16, right: 16, zIndex: 9999, maxWidth: 400 }}>
      <Typography variant="h6" gutterBottom>
        Clinical Workspace Diagnostics
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {diagnostics.map((item, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 120 }}>
              {item.label}:
            </Typography>
            <Chip
              icon={getIcon(item.status)}
              label={item.value}
              color={getColor(item.status)}
              size="small"
              variant="outlined"
            />
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default DiagnosticPanel;