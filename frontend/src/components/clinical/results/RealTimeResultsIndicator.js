/**
 * Real-time results indicator component
 * Shows when new results are available for the current patient
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Alert,
  Collapse,
  IconButton,
  Typography,
  Button,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  NewReleases as NewIcon
} from '@mui/icons-material';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useClinical } from '../../../contexts/ClinicalContext';

const RealTimeResultsIndicator = ({ onRefresh }) => {
  const { currentPatient } = useClinical();
  const [showAlert, setShowAlert] = useState(false);
  const [newResults, setNewResults] = useState([]);

  // Subscribe to Observation and DiagnosticReport updates for current patient
  const { connected, lastUpdate } = useWebSocket({
    resourceTypes: ['Observation', 'DiagnosticReport'],
    patientIds: currentPatient ? [currentPatient.id] : [],
    enabled: !!currentPatient
  });

  useEffect(() => {
    if (lastUpdate && lastUpdate.action !== 'deleted') {
      const { resourceType, resource } = lastUpdate;
      
      // Check if this is a lab result
      if (
        resourceType === 'Observation' &&
        resource?.category?.[0]?.coding?.[0]?.code === 'laboratory'
      ) {
        setNewResults(prev => [...prev, {
          id: resource.id,
          type: 'Lab Result',
          name: resource.code?.text || 'Unknown test',
          value: resource.valueQuantity?.value || resource.valueString || 'N/A',
          unit: resource.valueQuantity?.unit || '',
          status: resource.status,
          timestamp: new Date()
        }]);
        setShowAlert(true);
      } else if (resourceType === 'DiagnosticReport') {
        setNewResults(prev => [...prev, {
          id: resource.id,
          type: 'Diagnostic Report',
          name: resource.code?.text || 'Unknown report',
          status: resource.status,
          timestamp: new Date()
        }]);
        setShowAlert(true);
      }
    }
  }, [lastUpdate]);

  const handleRefresh = () => {
    setShowAlert(false);
    setNewResults([]);
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleClose = () => {
    setShowAlert(false);
    setNewResults([]);
  };

  if (!connected || !currentPatient) {
    return null;
  }

  return (
    <Collapse in={showAlert}>
      <Alert
        severity="info"
        icon={<NewIcon />}
        action={
          <>
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={handleClose}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </>
        }
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            New results available
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {newResults.slice(0, 3).map((result) => (
              <Chip
                key={result.id}
                label={`${result.type}: ${result.name}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
            {newResults.length > 3 && (
              <Chip
                label={`+${newResults.length - 3} more`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      </Alert>
    </Collapse>
  );
};

export default RealTimeResultsIndicator;