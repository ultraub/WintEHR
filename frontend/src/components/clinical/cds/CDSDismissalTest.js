/**
 * Test component to verify CDS dismissal functionality
 * This is a temporary component for testing purposes
 */
import React from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';

const CDSDismissalTest = () => {
  const testPatientId = 'test-patient-123';
  
  const checkSessionStorage = () => {
    const sessionKey = `cds-dismissed-alerts-${testPatientId}`;
    const stored = sessionStorage.getItem(sessionKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        alert(`Dismissed alerts for patient ${testPatientId}:\n${parsed.join('\n')}`);
      } catch (e) {
      }
    } else {
      alert('No dismissed alerts found in session storage');
    }
  };
  
  const clearSessionStorage = () => {
    const sessionKey = `cds-dismissed-alerts-${testPatientId}`;
    sessionStorage.removeItem(sessionKey);
    alert('Session storage cleared for CDS dismissed alerts');
  };
  
  return (
    <Paper sx={{ p: 3, m: 2 }}>
      <Typography variant="h6" gutterBottom>
        CDS Dismissal Test
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Use this to verify that CDS alerts are being properly stored in sessionStorage when dismissed.
      </Typography>
      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <Button variant="contained" onClick={checkSessionStorage}>
          Check Session Storage
        </Button>
        <Button variant="outlined" onClick={clearSessionStorage}>
          Clear Session Storage
        </Button>
      </Box>
      <Typography variant="caption" display="block" sx={{ mt: 2 }}>
        Note: Dismiss some CDS alerts in the Clinical Workspace, then click "Check Session Storage" to verify they're being saved.
      </Typography>
    </Paper>
  );
};

export default CDSDismissalTest;