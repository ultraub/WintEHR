/**
 * CDS Hooks Developer Tools Page
 * Standalone page for CDS Hooks management and testing
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  Stack,
  Breadcrumbs,
  Link,
  Divider
} from '@mui/material';
import {
  Psychology as CDSIcon,
  ArrowBack as BackIcon,
  DeveloperMode as DevIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import CDSHooksTab from '../components/clinical/workspace/tabs/CDSHooksTab';

const CDSHooksPage = () => {
  const navigate = useNavigate();
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link 
            underline="hover" 
            color="inherit" 
            href="/training"
            onClick={(e) => {
              e.preventDefault();
              navigate('/training');
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <DevIcon fontSize="small" />
              <Typography variant="body2">Developer Tools</Typography>
            </Stack>
          </Link>
          <Typography color="text.primary">CDS Hooks</Typography>
        </Breadcrumbs>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/training')}
            variant="outlined"
            size="small"
          >
            Back to Developer Tools
          </Button>
          <Box sx={{ flexGrow: 1 }} />
        </Stack>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CDSIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h4" fontWeight="bold">
              CDS Hooks Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Clinical Decision Support Hooks testing and configuration
            </Typography>
          </Box>
        </Box>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          CDS Hooks Developer Tools
        </Typography>
        <Typography variant="body2">
          This tool allows you to test and configure Clinical Decision Support (CDS) hooks. 
          Use it to evaluate CDS services, test hook responses, and debug CDS integrations.
        </Typography>
      </Alert>

      {/* CDS Hooks Component */}
      <Paper sx={{ p: 0 }}>
        <CDSHooksTab patientId="test-patient" />
      </Paper>
    </Box>
  );
};

export default CDSHooksPage;