import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControlLabel,
  Checkbox,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';

const PROVIDERS = {
  anthropic: { name: 'Claude', color: '#8B5CF6' },
  openai: { name: 'GPT-4', color: '#10B981' },
  azure_openai: { name: 'Azure GPT-4', color: '#3B82F6' },
  gemini: { name: 'Gemini', color: '#F59E0B' }
};

const ProviderComparison = ({ request, context, onProviderSelect }) => {
  const [selectedProviders, setSelectedProviders] = useState(['anthropic', 'openai']);
  const [availableProviders, setAvailableProviders] = useState({});
  const [comparisonResults, setComparisonResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkProviderAvailability();
  }, []);

  const checkProviderAvailability = async () => {
    try {
      const response = await fetch('/api/ui-composer/providers/status');
      const data = await response.json();
      setAvailableProviders(data);
    } catch (err) {
      setError('Failed to check provider availability');
    }
  };

  const handleProviderToggle = (provider) => {
    setSelectedProviders(prev => 
      prev.includes(provider) 
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const runComparison = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ui-composer/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request,
          context,
          providers: selectedProviders
        })
      });
      
      const data = await response.json();
      setComparisonResults(data);
    } catch (err) {
      setError('Comparison failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderProviderResult = (provider, result) => {
    const providerInfo = PROVIDERS[provider];
    const isSuccess = result.success;
    
    return (
      <Accordion key={provider}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={2} width="100%">
            <Chip 
              label={providerInfo.name}
              style={{ backgroundColor: providerInfo.color, color: 'white' }}
              size="small"
            />
            {isSuccess ? (
              <CheckCircleIcon color="success" />
            ) : (
              <ErrorIcon color="error" />
            )}
            {result.elapsed_seconds && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <SpeedIcon fontSize="small" />
                <Typography variant="caption">
                  {result.elapsed_seconds.toFixed(2)}s
                </Typography>
              </Box>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {isSuccess ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Analysis Results:
              </Typography>
              <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '10px', 
                borderRadius: '4px',
                overflow: 'auto'
              }}>
                {JSON.stringify(result.analysis, null, 2)}
              </pre>
              
              {result.model_info && (
                <Box mt={2}>
                  <Typography variant="subtitle2">Model Info:</Typography>
                  <Typography variant="body2">
                    Model: {result.model_info.model}
                  </Typography>
                  <Typography variant="body2">
                    Max Tokens: {result.model_info.max_tokens}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Alert severity="error">
              {result.error}
            </Alert>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderComparisonMetrics = () => {
    if (!comparisonResults?.comparison_metrics?.comparison_possible) {
      return null;
    }
    
    const metrics = comparisonResults.comparison_metrics;
    
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Comparison Metrics
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Intent Agreement</TableCell>
                  <TableCell align="right">
                    {metrics.intent_agreement ? '✅ Yes' : '❌ No'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Data Needs Overlap</TableCell>
                  <TableCell align="right">
                    {(metrics.data_needs_overlap * 100).toFixed(0)}%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>UI Type Agreement</TableCell>
                  <TableCell align="right">
                    {metrics.ui_type_agreement ? '✅ Yes' : '❌ No'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Average Response Time</TableCell>
                  <TableCell align="right">
                    {metrics.average_response_time.toFixed(2)}s
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Fastest Provider</TableCell>
                  <TableCell align="right">
                    <Chip 
                      label={PROVIDERS[metrics.fastest_provider]?.name || metrics.fastest_provider}
                      size="small"
                      style={{ 
                        backgroundColor: PROVIDERS[metrics.fastest_provider]?.color,
                        color: 'white'
                      }}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            LLM Provider Comparison
          </Typography>
          
          <Grid container spacing={2}>
            {Object.entries(PROVIDERS).map(([key, provider]) => (
              <Grid item xs={6} sm={3} key={key}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedProviders.includes(key)}
                      onChange={() => handleProviderToggle(key)}
                      disabled={!availableProviders[key]?.available}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip 
                        label={provider.name}
                        size="small"
                        style={{ 
                          backgroundColor: provider.color,
                          color: 'white',
                          opacity: availableProviders[key]?.available ? 1 : 0.5
                        }}
                      />
                    </Box>
                  }
                />
              </Grid>
            ))}
          </Grid>
          
          <Box mt={2}>
            <Button
              variant="contained"
              onClick={runComparison}
              disabled={loading || selectedProviders.length < 2}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : 'Run Comparison'}
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      
      {comparisonResults && (
        <Box mt={3}>
          <Typography variant="h6" gutterBottom>
            Results
          </Typography>
          
          {renderComparisonMetrics()}
          
          <Box mt={2}>
            {Object.entries(comparisonResults.provider_results).map(([provider, result]) =>
              renderProviderResult(provider, result)
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ProviderComparison;