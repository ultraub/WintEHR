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
  DeveloperMode as DevIcon,
  Webhook as WebhookIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import CDSHooksDeveloperTool from '../components/developer/CDSHooksDeveloperTool';

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
          <WebhookIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h4" fontWeight="bold">
              CDS Hooks Development Center
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Comprehensive Clinical Decision Support development, testing, and management
            </Typography>
          </Box>
        </Box>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          CDS Hooks Developer Center
        </Typography>
        <Typography variant="body2">
          Complete development environment for Clinical Decision Support hooks. Build custom hooks with advanced 
          condition builders, test with multiple scenarios, manage service configurations, and monitor execution history.
        </Typography>
      </Alert>

      {/* CDS Hooks Developer Tool */}
      <CDSHooksDeveloperTool />
    </Box>
  );
};

export default CDSHooksPage;