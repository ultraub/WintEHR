/**
 * Method Selector Component
 * Allows users to choose between different Claude authentication methods
 */

import React from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Collapse,
  IconButton
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

const METHOD_INFO = {
  hooks: {
    name: 'Claude Code (Hooks)',
    description: 'Uses your active Claude Code session via hooks',
    requirements: 'Requires Claude Code to be running and authenticated',
    setup: 'No additional setup needed if Claude Code is running'
  },
  sdk: {
    name: 'Claude API (SDK)',
    description: 'Uses official Claude API with authentication key',
    requirements: 'Requires ANTHROPIC_API_KEY environment variable',
    setup: 'Set ANTHROPIC_API_KEY in backend .env file'
  },
  cli: {
    name: 'Claude CLI (Direct)',
    description: 'Direct CLI invocation (requires authentication)',
    requirements: 'Requires Claude CLI authentication',
    setup: 'Run "claude setup-token" in terminal'
  },
  development: {
    name: 'Development Mode',
    description: 'Template-based UI generation without Claude',
    requirements: 'No authentication required',
    setup: 'Works immediately, limited capabilities'
  }
};

const MethodSelector = ({ 
  selectedMethod, 
  onMethodChange, 
  methodStatus,
  disabled = false 
}) => {
  const [expandedInfo, setExpandedInfo] = React.useState(null);

  const handleMethodChange = (event) => {
    onMethodChange(event.target.value);
  };

  const toggleInfo = (method) => {
    setExpandedInfo(expandedInfo === method ? null : method);
  };

  const getStatusIcon = (status) => {
    if (!status) return <CircularProgress size={16} />;
    
    if (status.available) {
      return <CheckCircleIcon color="success" fontSize="small" />;
    } else {
      return <CancelIcon color="error" fontSize="small" />;
    }
  };

  const getStatusChip = (method, status) => {
    if (!status) {
      return <Chip size="small" label="Checking..." />;
    }

    if (status.available) {
      return (
        <Chip 
          size="small" 
          label="Available" 
          color="success" 
          icon={<CheckCircleIcon />}
        />
      );
    } else {
      return (
        <Chip 
          size="small" 
          label="Not Available" 
          color="error" 
          icon={<CancelIcon />}
        />
      );
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <FormControl component="fieldset" disabled={disabled} fullWidth>
        <FormLabel component="legend">
          <Typography variant="h6" gutterBottom>
            Authentication Method
          </Typography>
        </FormLabel>
        
        <RadioGroup
          value={selectedMethod}
          onChange={handleMethodChange}
          sx={{ mt: 1 }}
        >
          {Object.entries(METHOD_INFO).map(([method, info]) => {
            const status = methodStatus?.[method];
            const isAvailable = status?.available;
            
            return (
              <Box key={method} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <FormControlLabel
                    value={method}
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">{info.name}</Typography>
                        {getStatusChip(method, status)}
                      </Box>
                    }
                    disabled={!isAvailable && method !== 'development'}
                  />
                  <IconButton
                    size="small"
                    onClick={() => toggleInfo(method)}
                    sx={{ ml: 'auto' }}
                  >
                    {expandedInfo === method ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                
                <Collapse in={expandedInfo === method}>
                  <Box sx={{ ml: 4, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {info.description}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Requirements:</strong> {info.requirements}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Setup:</strong> {info.setup}
                    </Typography>
                    
                    {status?.error && (
                      <Alert severity="error" sx={{ mt: 1 }} icon={<CancelIcon />}>
                        {status.error}
                      </Alert>
                    )}
                    
                    {status?.message && (
                      <Alert severity="info" sx={{ mt: 1 }} icon={<InfoIcon />}>
                        {status.message}
                      </Alert>
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </RadioGroup>
        
        {selectedMethod && (
          <Alert 
            severity={methodStatus?.[selectedMethod]?.available ? "success" : "warning"} 
            sx={{ mt: 2 }}
          >
            {methodStatus?.[selectedMethod]?.available ? (
              <>
                <strong>{METHOD_INFO[selectedMethod].name}</strong> is ready to use.
              </>
            ) : (
              <>
                <strong>{METHOD_INFO[selectedMethod].name}</strong> requires setup.
                {' '}{METHOD_INFO[selectedMethod].setup}
              </>
            )}
          </Alert>
        )}
      </FormControl>
    </Paper>
  );
};

export default MethodSelector;