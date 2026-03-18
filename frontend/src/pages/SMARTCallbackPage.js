/**
 * SMART Callback Page
 *
 * Handles OAuth2 authorization callbacks from SMART apps.
 * This page is the redirect_uri target for authorization flows.
 *
 * Educational Purpose:
 * Demonstrates how an EHR handles the OAuth2 callback:
 * - Parses authorization code from URL
 * - Displays consent screen for user approval
 * - Completes the authorization flow
 *
 * @module SMARTCallbackPage
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  AlertTitle,
  Button,
  Divider
} from '@mui/material';
import {
  Security as SecurityIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';

import ConsentScreen from '../components/smart/ConsentScreen';

const SMARTCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConsent, setShowConsent] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState(null);

  // Parse URL parameters
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    const processCallback = async () => {
      setLoading(true);

      // Handle OAuth errors
      if (errorParam) {
        setError({
          type: errorParam,
          message: errorDescription || `Authorization failed: ${errorParam}`
        });
        setLoading(false);
        return;
      }

      // Check for authorization code
      if (code) {
        // Exchange authorization code for tokens via the SMART token endpoint
        try {
          const tokenResponse = await fetch('/api/smart/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: window.location.origin + '/smart-callback',
              client_id: 'demo-patient-viewer',
            })
          });

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            setError({
              type: errorData.error || 'token_exchange_failed',
              message: errorData.error_description || 'Failed to exchange authorization code for tokens'
            });
            setLoading(false);
            return;
          }

          // Token exchange successful
          setAuthCompleted(true);
        } catch (err) {
          console.error('Token exchange failed:', err);
          setError({
            type: 'token_exchange_error',
            message: 'Failed to complete token exchange: ' + err.message
          });
        }
        setLoading(false);
        return;
      }

      // Check for session ID (consent flow)
      const sessionParam = searchParams.get('session');
      if (sessionParam) {
        setSessionId(sessionParam);
        setShowConsent(true);
        setLoading(false);
        return;
      }

      // No recognized parameters
      setError({
        type: 'invalid_request',
        message: 'Missing required authorization parameters'
      });
      setLoading(false);
    };

    processCallback();
  }, [code, state, errorParam, errorDescription, searchParams]);

  // Handle consent approval
  const handleConsentApprove = (result) => {
    setShowConsent(false);
    if (result?.redirect_uri) {
      setRedirectUrl(result.redirect_uri);
      // Redirect to app after brief delay
      setTimeout(() => {
        window.location.href = result.redirect_uri;
      }, 2000);
    } else {
      setAuthCompleted(true);
    }
  };

  // Handle consent denial
  const handleConsentDeny = (result) => {
    setShowConsent(false);
    if (result?.redirect_uri) {
      window.location.href = result.redirect_uri;
    } else {
      navigate('/patients');
    }
  };

  // Handle going back to patients
  const handleBack = () => {
    navigate('/patients');
  };

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Processing authorization...
        </Typography>
      </Box>
    );
  }

  // Consent screen
  if (showConsent && sessionId) {
    return (
      <ConsentScreen
        open={true}
        sessionId={sessionId}
        onApprove={handleConsentApprove}
        onDeny={handleConsentDeny}
        onClose={handleConsentDeny}
      />
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, borderRadius: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <ErrorIcon color="error" sx={{ fontSize: 48 }} />
            <Box>
              <Typography variant="h5" fontWeight={600}>
                Authorization Failed
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {error.type}
              </Typography>
            </Box>
          </Box>

          <Alert severity="error" sx={{ mb: 3, borderRadius: 0 }}>
            <AlertTitle>Error</AlertTitle>
            {error.message}
          </Alert>

          <Divider sx={{ my: 3 }} />

          {/* Educational Info */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Educational Notes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              OAuth2 authorization can fail for various reasons:
            </Typography>
            <Box component="ul" sx={{ mt: 1, pl: 3 }}>
              <li>
                <Typography variant="body2" color="text.secondary">
                  <strong>access_denied</strong>: User denied the authorization request
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  <strong>invalid_request</strong>: Missing or invalid parameters
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  <strong>unauthorized_client</strong>: App is not registered or disabled
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  <strong>invalid_scope</strong>: Requested scopes are not allowed
                </Typography>
              </li>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<BackIcon />}
            onClick={handleBack}
            sx={{ borderRadius: 0 }}
          >
            Return to Patients
          </Button>
        </Paper>
      </Container>
    );
  }

  // Success state (auth completed or redirecting)
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          {redirectUrl ? (
            <CircularProgress size={40} />
          ) : (
            <SuccessIcon color="success" sx={{ fontSize: 48 }} />
          )}
          <Box>
            <Typography variant="h5" fontWeight={600}>
              {redirectUrl ? 'Redirecting...' : 'Authorization Complete'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {redirectUrl
                ? 'Returning to the application'
                : 'The app has been authorized'
              }
            </Typography>
          </Box>
        </Box>

        {authCompleted && !redirectUrl && (
          <>
            <Alert severity="success" sx={{ mb: 3, borderRadius: 0 }}>
              <AlertTitle>Success</AlertTitle>
              The SMART app has been authorized and can now access patient data
              according to the granted permissions.
            </Alert>

            <Divider sx={{ my: 3 }} />

            {/* Educational Info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Educational Notes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                After authorization, the following happens:
              </Typography>
              <Box component="ol" sx={{ mt: 1, pl: 3 }}>
                <li>
                  <Typography variant="body2" color="text.secondary">
                    The app receives an authorization code
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary">
                    The app exchanges the code for access/refresh tokens
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary">
                    The app can now make FHIR API calls with the token
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary">
                    The token includes the patient context from the launch
                  </Typography>
                </li>
              </Box>
            </Box>

            <Button
              variant="contained"
              startIcon={<BackIcon />}
              onClick={handleBack}
              sx={{ borderRadius: 0 }}
            >
              Return to Patients
            </Button>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default SMARTCallbackPage;
