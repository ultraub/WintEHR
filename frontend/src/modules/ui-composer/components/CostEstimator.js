/**
 * Cost Estimator Component
 * Shows estimated cost before generation for different methods and models
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Divider
} from '@mui/material';
import {
  AttachMoney as AttachMoneyIcon,
  Speed as SpeedIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';

const CostEstimator = ({ 
  request, 
  selectedMethod, 
  selectedModel, 
  generationMode, 
  onProceed, 
  onCancel 
}) => {
  const [estimates, setEstimates] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pricing data (per 1M tokens)
  const pricing = {
    'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
    'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 }
  };

  // Estimation factors based on generation mode and request complexity
  const getEstimationFactors = (method, model, mode, requestLength) => {
    const baseInputTokens = Math.max(500, Math.floor(requestLength * 1.5)); // Rough estimation
    const baseOutputTokens = mode === 'full' ? 2000 : mode === 'mixed' ? 1200 : 800;
    
    const factors = {
      cli: {
        inputTokens: baseInputTokens + 300, // Additional prompt context
        outputTokens: baseOutputTokens,
        operations: 2, // analyze + generate
        description: 'Claude CLI (via Claude Max subscription)',
        actualCost: 0, // No direct cost with subscription
        estimatedValue: 0 // But show estimated value
      },
      sdk: {
        inputTokens: baseInputTokens + 200,
        outputTokens: baseOutputTokens,
        operations: 2,
        description: 'Anthropic SDK (direct API)',
        actualCost: 0, // Will calculate
        estimatedValue: 0
      },
      development: {
        inputTokens: 0,
        outputTokens: 0,
        operations: 1,
        description: 'Development mode (mock data)',
        actualCost: 0,
        estimatedValue: 0
      }
    };

    const factor = factors[method] || factors.cli;
    
    // Calculate actual cost for SDK
    if (method === 'sdk' && pricing[model]) {
      const totalInputTokens = factor.inputTokens * factor.operations;
      const totalOutputTokens = factor.outputTokens * factor.operations;
      const inputCost = (totalInputTokens / 1_000_000) * pricing[model].input;
      const outputCost = (totalOutputTokens / 1_000_000) * pricing[model].output;
      factor.actualCost = inputCost + outputCost;
      factor.estimatedValue = factor.actualCost;
    }
    
    // For CLI, show what it would cost without subscription
    if (method === 'cli' && pricing[model]) {
      const totalInputTokens = factor.inputTokens * factor.operations;
      const totalOutputTokens = factor.outputTokens * factor.operations;
      const inputCost = (totalInputTokens / 1_000_000) * pricing[model].input;
      const outputCost = (totalOutputTokens / 1_000_000) * pricing[model].output;
      factor.estimatedValue = inputCost + outputCost;
    }

    return factor;
  };

  useEffect(() => {
    if (request) {
      setLoading(true);
      
      // Simulate calculation delay
      setTimeout(() => {
        const requestLength = request.length;
        const currentEstimate = getEstimationFactors(selectedMethod, selectedModel, generationMode, requestLength);
        
        // Generate estimates for all methods for comparison
        const allEstimates = {
          current: currentEstimate,
          alternatives: {}
        };

        // Add alternative methods
        ['cli', 'sdk', 'development'].forEach(method => {
          if (method !== selectedMethod) {
            allEstimates.alternatives[method] = getEstimationFactors(method, selectedModel, generationMode, requestLength);
          }
        });

        // Add alternative models (only for SDK)
        if (selectedMethod === 'sdk') {
          allEstimates.models = {};
          Object.keys(pricing).forEach(model => {
            if (model !== selectedModel) {
              allEstimates.models[model] = getEstimationFactors(selectedMethod, model, generationMode, requestLength);
            }
          });
        }

        setEstimates(allEstimates);
        setLoading(false);
      }, 500);
    }
  }, [request, selectedMethod, selectedModel, generationMode]);

  const formatCost = (cost) => {
    if (cost === 0) return 'Free';
    if (cost < 0.001) return '<$0.001';
    if (cost < 0.01) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens) => {
    if (tokens > 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return tokens.toString();
  };

  if (loading || !estimates) {
    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6">Calculating cost estimate...</Typography>
      </Paper>
    );
  }

  const { current, alternatives, models } = estimates;

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <AttachMoneyIcon color="primary" />
        <Typography variant="h6">Cost Estimation</Typography>
      </Stack>

      {/* Current Selection */}
      <Alert 
        severity={current.actualCost === 0 ? "success" : "info"} 
        sx={{ mb: 2 }}
        icon={current.actualCost === 0 ? <SpeedIcon /> : <AttachMoneyIcon />}
      >
        <Typography variant="subtitle2">
          <strong>Selected:</strong> {current.description}
        </Typography>
        <Typography variant="body2">
          {current.actualCost === 0 ? (
            selectedMethod === 'cli' ? 
              `No cost with Claude Max subscription (estimated value: ${formatCost(current.estimatedValue)})` :
              'Free development mode'
          ) : (
            `Estimated cost: ${formatCost(current.actualCost)} for ${formatTokens(current.inputTokens * current.operations)} input + ${formatTokens(current.outputTokens * current.operations)} output tokens`
          )}
        </Typography>
      </Alert>

      {/* Model Comparison (for SDK) */}
      {models && Object.keys(models).length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Model Comparison (SDK method):
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Model</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="right">Speed</TableCell>
                  <TableCell align="right">Quality</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow sx={{ bgcolor: 'action.selected' }}>
                  <TableCell>
                    <strong>{selectedModel.split('-').slice(-1)[0]} (current)</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{formatCost(current.actualCost)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={selectedModel.includes('sonnet') ? 'Fast' : 'Slower'} size="small" color="primary" />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={selectedModel.includes('opus') ? 'Highest' : 'High'} size="small" color="success" />
                  </TableCell>
                </TableRow>
                {Object.entries(models).map(([model, estimate]) => (
                  <TableRow key={model}>
                    <TableCell>{model.split('-').slice(-1)[0]}</TableCell>
                    <TableCell align="right">{formatCost(estimate.actualCost)}</TableCell>
                    <TableCell align="right">
                      <Chip label={model.includes('sonnet') ? 'Fast' : 'Slower'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={model.includes('opus') ? 'Highest' : 'High'} size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Method Alternatives */}
      {alternatives && Object.keys(alternatives).length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Alternative Methods:
          </Typography>
          <Stack spacing={1}>
            {Object.entries(alternatives).map(([method, estimate]) => (
              <Box key={method} sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">
                    <strong>{estimate.description}</strong>
                  </Typography>
                  <Chip 
                    label={estimate.actualCost === 0 ? 'Free' : formatCost(estimate.actualCost)}
                    size="small"
                    color={estimate.actualCost === 0 ? 'success' : 'default'}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Generation Mode Impact */}
      <Alert severity="info" icon={<TrendingUpIcon />} sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Generation Mode:</strong> {generationMode} - {
            generationMode === 'full' ? 'Higher cost, maximum creativity' :
            generationMode === 'mixed' ? 'Balanced cost and quality' :
            'Lower cost, template-based'
          }
        </Typography>
      </Alert>

      {/* Action Buttons */}
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={onProceed}
          startIcon={<AttachMoneyIcon />}
        >
          Proceed {current.actualCost > 0 && `(${formatCost(current.actualCost)})`}
        </Button>
      </Stack>
    </Paper>
  );
};

export default CostEstimator;