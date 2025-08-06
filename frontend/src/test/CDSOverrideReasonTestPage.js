/**
 * CDS Override Reason Test Page
 * Interactive test page to verify override reason configuration is saved correctly
 */
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  Divider,
  Chip,
  Grid,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import { cdsHooksService } from '../services/cdsHooksService';

const CDSOverrideReasonTestPage = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const TEST_HOOK_ID = 'test-override-config';

  const testHookConfig = {
    id: TEST_HOOK_ID,
    title: 'Override Configuration Test Hook',
    description: 'Tests saving and retrieving override reason configuration',
    hook: 'patient-view',
    enabled: true,
    
    // Display behavior with acknowledgment configuration
    displayBehavior: {
      defaultMode: 'modal',
      indicatorOverrides: {
        critical: 'modal',
        warning: 'popup',
        info: 'inline'
      },
      acknowledgment: {
        required: true,
        reasonRequired: true
      },
      snooze: {
        enabled: false
      }
    },
    
    conditions: [{
      id: 'test-condition',
      type: 'age',
      operator: 'greater_than',
      value: '18',
      enabled: true
    }],
    
    cards: [{
      id: 'test-card',
      summary: 'Test Alert - Override Required',
      detail: 'This alert requires both acknowledgment and reason',
      indicator: 'critical',
      source: {
        label: 'Test System'
      }
    }]
  };

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const testResults = {
        createResult: null,
        retrieveResult: null,
        verificationPassed: false
      };

      // Step 1: Create/Update the hook
      console.log('Step 1: Creating/updating test hook...');
      try {
        testResults.createResult = await cdsHooksService.createHook(testHookConfig);
      } catch (createError) {
        if (createError.message?.includes('already exists')) {
          console.log('Hook exists, updating instead...');
          testResults.createResult = await cdsHooksService.updateHook(TEST_HOOK_ID, testHookConfig);
        } else {
          throw createError;
        }
      }

      // Step 2: Retrieve the hook
      console.log('Step 2: Retrieving saved hook...');
      testResults.retrieveResult = await cdsHooksService.getHook(TEST_HOOK_ID);

      // Step 3: Verify the configuration
      console.log('Step 3: Verifying configuration...');
      const savedBehavior = testResults.retrieveResult.displayBehavior;
      
      testResults.verificationPassed = 
        savedBehavior?.acknowledgment?.required === true &&
        savedBehavior?.acknowledgment?.reasonRequired === true;

      setResults(testResults);
      
      if (testResults.verificationPassed) {
        console.log('✅ SUCCESS: Override configuration saved correctly!');
      } else {
        console.error('❌ FAILED: Override configuration not saved correctly');
      }

    } catch (err) {
      console.error('Test error:', err);
      setError(err.message || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  const cleanup = async () => {
    setLoading(true);
    try {
      await cdsHooksService.deleteHook(TEST_HOOK_ID);
      setResults(null);
      setError(null);
      console.log('Test hook cleaned up');
    } catch (err) {
      setError(`Cleanup failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          CDS Override Reason Configuration Test
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          This test verifies that override reason requirements are properly saved at the hook level
          via the displayBehavior.acknowledgment configuration.
        </Alert>

        <Stack spacing={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>Test Configuration</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Presentation Mode</Typography>
                  <Typography>Modal (hard-stop)</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Override Requirements</Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip label="Acknowledgment Required" size="small" color="primary" />
                    <Chip label="Reason Required" size="small" color="primary" />
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={runTest}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Running Test...' : 'Run Test'}
            </Button>
            
            {results && (
              <Button
                variant="outlined"
                color="error"
                onClick={cleanup}
                disabled={loading}
              >
                Clean Up
              </Button>
            )}
          </Stack>

          {error && (
            <Alert severity="error">
              <Typography variant="subtitle2">Error</Typography>
              <Typography variant="body2">{error}</Typography>
            </Alert>
          )}

          {results && (
            <>
              <Divider />
              
              <Card variant={results.verificationPassed ? 'outlined' : 'elevation'}>
                <CardContent>
                  <Stack spacing={2}>
                    <Alert severity={results.verificationPassed ? 'success' : 'error'}>
                      {results.verificationPassed 
                        ? '✅ Override configuration saved correctly!' 
                        : '❌ Override configuration not saved correctly'}
                    </Alert>

                    <Typography variant="h6">Saved Configuration</Typography>
                    
                    {results.retrieveResult?.displayBehavior ? (
                      <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
                        <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                          {JSON.stringify(results.retrieveResult.displayBehavior, null, 2)}
                        </pre>
                      </Box>
                    ) : (
                      <Alert severity="warning">
                        No displayBehavior configuration found in saved hook
                      </Alert>
                    )}

                    <Typography variant="subtitle2" color="text.secondary">
                      Hook ID: {TEST_HOOK_ID}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default CDSOverrideReasonTestPage;