/**
 * Test FHIR Integration Component
 * Shows if generated components use real FHIR data
 */

import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Paper, 
  Typography, 
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Stack
} from '@mui/material';
import { uiComposerService } from '../../../services/uiComposerService';
import { useUIComposer } from '../contexts/UIComposerContext';

const TestFHIRIntegration = ({ selectedMethod, selectedModel }) => {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  
  const runTest = async () => {
    setLoading(true);
    setTestResult(null);
    setGeneratedCode('');
    
    try {
      // Test request
      const testRequest = "Create a component showing patient vital signs with trends for blood pressure and heart rate";
      
      // Step 1: Analyze - Use current settings
      const analyzeResult = await uiComposerService.analyzeRequest(
        testRequest,
        {
          patientId: '0288c42c-43a1-9878-4a9d-6b96caa12c40', // Real patient from DB
          userRole: 'clinician',
          model: selectedModel || 'claude-sonnet-4-20250514'
        },
        selectedMethod || 'cli' // Use selected method
      );
      
      if (!analyzeResult.success) {
        setTestResult({
          success: false,
          error: analyzeResult.error || 'Analysis failed'
        });
        return;
      }
      
      const checks = {
        hasRequiredData: analyzeResult.analysis?.requiredData?.length > 0,
        includesObservation: analyzeResult.analysis?.requiredData?.includes('Observation'),
        hasDataBinding: analyzeResult.analysis?.components?.some(c => c.dataBinding),
        hasFHIRContext: !!analyzeResult.raw_response?.includes('fhirContext')
      };
      
      // Step 2: Generate
      if (analyzeResult.specification) {
        const generateResult = await uiComposerService.generateUI(
          analyzeResult.specification,
          true,
          selectedMethod || 'cli'
        );
        
        if (generateResult.success && generateResult.components) {
          const code = Object.values(generateResult.components)[0] || '';
          setGeneratedCode(code);
          
          // Check code quality
          const codeChecks = {
            usesPatientResources: code.includes('usePatientResources'),
            usesFHIRClient: code.includes('useFHIRClient'),
            queriesObservations: code.includes("'Observation'"),
            hasRealCodes: code.includes('85354-9') || code.includes('8867-4'), // BP, HR codes
            noMockData: !code.includes('mockData') && !code.includes('John Doe') && !code.includes('john doe')
          };
          
          setTestResult({
            success: true,
            analysisChecks: checks,
            codeChecks: codeChecks,
            sessionId: analyzeResult.session_id
          });
        }
      }
      
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Paper elevation={2} sx={{ p: 3, m: 2 }}>
      <Typography variant="h6" gutterBottom>
        FHIR Integration Test
      </Typography>
      
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip label={`Method: ${selectedMethod || 'cli'}`} size="small" color="primary" />
        <Chip label={`Model: ${selectedModel?.split('-').slice(-1)[0] || 'Sonnet 4'}`} size="small" color="secondary" />
      </Stack>
      
      <Button 
        variant="contained" 
        onClick={runTest}
        disabled={loading || selectedMethod === 'sdk'}
        sx={{ mb: 2 }}
      >
        {loading ? <CircularProgress size={20} /> : 
         selectedMethod === 'sdk' ? 'Disabled (SDK costs money)' : 'Run FHIR Test'}
      </Button>
      
      {testResult && (
        <Box>
          <Alert severity={testResult.success ? "success" : "error"} sx={{ mb: 2 }}>
            {testResult.success ? "FHIR Integration Test Passed" : testResult.error}
          </Alert>
          
          {testResult.success && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Analysis Checks:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                {Object.entries(testResult.analysisChecks).map(([check, passed]) => (
                  <Chip 
                    key={check}
                    label={check}
                    color={passed ? "success" : "error"}
                    size="small"
                  />
                ))}
              </Stack>
              
              <Typography variant="subtitle2" gutterBottom>
                Code Quality Checks:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                {Object.entries(testResult.codeChecks).map(([check, passed]) => (
                  <Chip 
                    key={check}
                    label={check}
                    color={passed ? "success" : "error"}
                    size="small"
                  />
                ))}
              </Stack>
            </>
          )}
          
          {generatedCode && (
            <TextField
              fullWidth
              multiline
              rows={10}
              value={generatedCode}
              label="Generated Code"
              variant="outlined"
              InputProps={{ readOnly: true }}
              sx={{ fontFamily: 'monospace' }}
            />
          )}
        </Box>
      )}
    </Paper>
  );
};

export default TestFHIRIntegration;