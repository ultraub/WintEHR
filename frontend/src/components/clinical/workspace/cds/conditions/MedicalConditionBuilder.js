/**
 * Medical Condition Builder Component
 * Placeholder - to be implemented
 */
import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

const MedicalConditionBuilder = ({ condition, onChange, onRemove }) => {
  return (
    <Box>
      <Alert severity="info">
        <Typography variant="body2">
          Medical Condition builder with SNOMED/ICD codes coming soon...
        </Typography>
      </Alert>
    </Box>
  );
};

export default MedicalConditionBuilder;