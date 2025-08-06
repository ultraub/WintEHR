/**
 * Cost Display Component
 * Shows the cost of API usage for SDK method
 */

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Tooltip, 
  CircularProgress,
  Stack,
  Chip
} from '@mui/material';
import { 
  AttachMoney as AttachMoneyIcon,
  Info as InfoIcon 
} from '@mui/icons-material';
import { uiComposerService } from '../../../services/uiComposerService';

const CostDisplay = ({ sessionId, loading, onCostUpdate }) => {
  const [costData, setCostData] = useState(null);
  const [fetchingCost, setFetchingCost] = useState(false);
  
  useEffect(() => {
    if (sessionId) {
      fetchCostData();
    }
  }, [sessionId]);
  
  const fetchCostData = async () => {
    if (!sessionId) return;
    
    setFetchingCost(true);
    try {
      const response = await fetch(`/api/ui-composer/sessions/${sessionId}/cost`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCostData(data);
        if (onCostUpdate) {
          onCostUpdate(data);
        }
      }
    } catch (error) {
      // Failed to fetch cost data - error handled silently
    } finally {
      setFetchingCost(false);
    }
  };
  
  // If no session or CLI method, show "No cost" message
  if (!sessionId) {
    return (
      <Tooltip title="Using Claude Max subscription via CLI - No additional API costs">
        <Stack direction="row" spacing={1} alignItems="center">
          <AttachMoneyIcon fontSize="small" color="success" />
          <Typography variant="body2" color="success.main">
            Included with Claude Max
          </Typography>
        </Stack>
      </Tooltip>
    );
  }
  
  if (fetchingCost || loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2">Loading cost...</Typography>
      </Box>
    );
  }
  
  if (!costData) {
    return null;
  }
  
  const formatCost = (cost) => {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return `<$0.01`;
    return `$${cost.toFixed(2)}`;
  };
  
  const formatTokens = (tokens) => {
    if (tokens > 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };
  
  return (
    <Tooltip 
      title={
        <Box>
          <Typography variant="caption" display="block" sx={{ mb: 1 }}>
            API Usage Details
          </Typography>
          <Typography variant="caption" display="block">
            Input tokens: {costData.total_input_tokens?.toLocaleString() || 0}
          </Typography>
          <Typography variant="caption" display="block">
            Output tokens: {costData.total_output_tokens?.toLocaleString() || 0}
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Total cost: {formatCost(costData.total_cost || 0)}
          </Typography>
        </Box>
      }
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <AttachMoneyIcon fontSize="small" />
        <Typography variant="body2">
          {formatCost(costData.total_cost || 0)}
        </Typography>
        <Chip 
          label={`${formatTokens((costData.total_input_tokens || 0) + (costData.total_output_tokens || 0))} tokens`}
          size="small"
          variant="outlined"
        />
      </Stack>
    </Tooltip>
  );
};

export default CostDisplay;