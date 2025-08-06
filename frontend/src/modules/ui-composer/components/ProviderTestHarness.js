import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  CompareArrows as CompareIcon,
  Assessment as AssessmentIcon,
  Code as CodeIcon,
  Preview as PreviewIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import DynamicComponent from './DynamicComponent';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Test scenarios for quick testing
const TEST_SCENARIOS = [
  {
    id: 'vital_signs',
    name: 'Vital Signs Display',
    request: 'Show current vital signs for this patient',
    context: { user_role: 'physician' }
  },
  {
    id: 'bp_trends',
    name: 'Blood Pressure Trends',
    request: 'Display blood pressure trends with medication timeline',
    context: { user_role: 'physician' }
  },
  {
    id: 'lab_results',
    name: 'Lab Results Dashboard',
    request: 'Show recent lab results with abnormal values highlighted',
    context: { user_role: 'physician' }
  },
  {
    id: 'medication_timeline',
    name: 'Medication Timeline',
    request: 'Create a timeline view of all medications with dosage changes',
    context: { user_role: 'pharmacist' }
  },
  {
    id: 'diabetes_dashboard',
    name: 'Diabetes Management',
    request: 'Dashboard for diabetes management with HbA1c trends and glucose readings',
    context: { user_role: 'physician' }
  }
];

const ProviderTestHarness = ({ patientId }) => {
  const [availableProviders, setAvailableProviders] = useState({});
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [selectedScenario, setSelectedScenario] = useState(TEST_SCENARIOS[0].id);
  const [customRequest, setCustomRequest] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkProviderAvailability();
  }, []);

  const checkProviderAvailability = async () => {
    try {
      const response = await fetch('/api/ui-composer/providers/status');
      const data = await response.json();
      setAvailableProviders(data);
      
      // Select first available provider
      const firstAvailable = Object.keys(data).find(p => data[p]?.available);
      if (firstAvailable) {
        setSelectedProvider(firstAvailable);
      }
    } catch (err) {
      setError('Failed to check provider availability');
    }
  };

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const scenario = TEST_SCENARIOS.find(s => s.id === selectedScenario);
      const request = customRequest || scenario.request;
      const context = scenario.context;
      
      // Step 1: Analyze request
      const analyzeResponse = await fetch('/api/ui-composer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request,
          context: { ...context, provider: selectedProvider },
          method: 'development' // Use development mode for testing
        })
      });
      
      const analyzeData = await analyzeResponse.json();
      
      if (!analyzeData.success) {
        throw new Error(analyzeData.error || 'Analysis failed');
      }
      
      // Step 2: Generate component with specific provider
      const generateResponse = await fetch('/api/ui-composer/generate-with-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specification: analyzeData.specification,
          fhir_data: {}, // Empty for testing
          provider: selectedProvider
        })
      });
      
      const generateData = await generateResponse.json();
      
      if (!generateData.success) {
        throw new Error(generateData.error || 'Generation failed');
      }
      
      setResults({
        request,
        provider: selectedProvider,
        analysis: analyzeData.analysis,
        specification: analyzeData.specification,
        component: generateData.component,
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runComparison = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const scenario = TEST_SCENARIOS.find(s => s.id === selectedScenario);
      const request = customRequest || scenario.request;
      
      // Get all available providers
      const providers = Object.keys(availableProviders)
        .filter(p => availableProviders[p]?.available);
      
      if (providers.length < 2) {
        throw new Error('Need at least 2 providers for comparison');
      }
      
      const response = await fetch('/api/ui-composer/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request,
          context: scenario.context,
          providers: providers.slice(0, 3) // Limit to 3 for UI
        })
      });
      
      const data = await response.json();
      
      setResults({
        type: 'comparison',
        request,
        comparison: data,
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (results?.component) {
      navigator.clipboard.writeText(results.component);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderAnalysisTab = () => {
    if (!results?.analysis) return null;
    
    return (
      <Box p={3}>
        <Typography variant="h6" gutterBottom>Analysis Results</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Intent</Typography>
                <Typography>{results.analysis.intent}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">UI Type</Typography>
                <Typography>{results.analysis.ui_type || 'display'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Required FHIR Resources</Typography>
                <Box mt={1}>
                  {(results.analysis.data_needs || []).map((resource, idx) => (
                    <Chip key={idx} label={resource} size="small" sx={{ mr: 1, mb: 1 }} />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Full Analysis</Typography>
                <Box mt={1} sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                  <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                    {JSON.stringify(results.analysis, null, 2)}
                  </pre>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const renderCodeTab = () => {
    if (!results?.component) return null;
    
    return (
      <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Generated Component</Typography>
          <Tooltip title={copied ? "Copied!" : "Copy code"}>
            <IconButton onClick={copyCode} size="small">
              {copied ? <CheckIcon color="success" /> : <CopyIcon />}
            </IconButton>
          </Tooltip>
        </Box>
        <Paper elevation={0} sx={{ backgroundColor: '#1e1e1e', overflow: 'auto' }}>
          <SyntaxHighlighter
            language="jsx"
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '16px' }}
          >
            {results.component}
          </SyntaxHighlighter>
        </Paper>
      </Box>
    );
  };

  const renderPreviewTab = () => {
    if (!results?.component) return null;
    
    return (
      <Box p={3}>
        <Typography variant="h6" gutterBottom>Component Preview</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Preview shows component with mock data. In production, this would use real FHIR data.
        </Alert>
        <Paper sx={{ p: 3 }}>
          <DynamicComponent
            code={results.component}
            fhirData={{}} // Empty data for preview
            patient={{ id: patientId }}
          />
        </Paper>
      </Box>
    );
  };

  const renderComparisonResults = () => {
    if (!results?.comparison) return null;
    
    const { provider_results, comparison_metrics } = results.comparison;
    
    return (
      <Box p={3}>
        <Typography variant="h6" gutterBottom>Provider Comparison</Typography>
        
        {comparison_metrics?.comparison_possible && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>Comparison Metrics</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Intent Agreement</Typography>
                  <Typography variant="h6">
                    {comparison_metrics.intent_agreement ? '✅' : '❌'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Data Overlap</Typography>
                  <Typography variant="h6">
                    {(comparison_metrics.data_needs_overlap * 100).toFixed(0)}%
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">UI Agreement</Typography>
                  <Typography variant="h6">
                    {comparison_metrics.ui_type_agreement ? '✅' : '❌'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Avg Response Time</Typography>
                  <Typography variant="h6">
                    {comparison_metrics.average_response_time.toFixed(2)}s
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}
        
        <Grid container spacing={2}>
          {Object.entries(provider_results).map(([provider, result]) => (
            <Grid item xs={12} md={4} key={provider}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">{provider}</Typography>
                    {result.success ? (
                      <CheckIcon color="success" />
                    ) : (
                      <Chip label="Failed" color="error" size="small" />
                    )}
                  </Box>
                  
                  {result.success && result.analysis && (
                    <>
                      <Typography variant="body2" color="text.secondary">Intent</Typography>
                      <Typography variant="body2" gutterBottom>
                        {result.analysis.intent}
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" mt={1}>UI Type</Typography>
                      <Typography variant="body2" gutterBottom>
                        {result.analysis.ui_type}
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" mt={1}>Response Time</Typography>
                      <Typography variant="body2">
                        {result.elapsed_seconds?.toFixed(2)}s
                      </Typography>
                    </>
                  )}
                  
                  {!result.success && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {result.error}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Provider Test Harness
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Test Scenario</InputLabel>
              <Select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                label="Test Scenario"
              >
                {TEST_SCENARIOS.map(scenario => (
                  <MenuItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                label="Provider"
              >
                {Object.entries(availableProviders).map(([key, info]) => (
                  <MenuItem key={key} value={key} disabled={!info?.available}>
                    {key} {info?.available ? '✅' : '❌'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                startIcon={<PlayIcon />}
                onClick={runTest}
                disabled={loading || !selectedProvider}
                fullWidth
              >
                Run Test
              </Button>
              <Button
                variant="outlined"
                startIcon={<CompareIcon />}
                onClick={runComparison}
                disabled={loading}
              >
                Compare
              </Button>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Custom Request (optional)"
              placeholder="Override scenario with custom clinical request..."
              value={customRequest}
              onChange={(e) => setCustomRequest(e.target.value)}
              multiline
              rows={2}
            />
          </Grid>
        </Grid>
      </Paper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {loading && (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      )}
      
      {results && !loading && (
        <Paper>
          {results.type === 'comparison' ? (
            renderComparisonResults()
          ) : (
            <>
              <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
                <Tab icon={<AssessmentIcon />} label="Analysis" />
                <Tab icon={<CodeIcon />} label="Code" />
                <Tab icon={<PreviewIcon />} label="Preview" />
              </Tabs>
              <Divider />
              {activeTab === 0 && renderAnalysisTab()}
              {activeTab === 1 && renderCodeTab()}
              {activeTab === 2 && renderPreviewTab()}
            </>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default ProviderTestHarness;