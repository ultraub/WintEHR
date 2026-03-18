/**
 * Login Page Component
 * Split-panel layout: warm charcoal branding + white form panel
 * Part of the "Warm Slate Modern" design refresh
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Login as LoginIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const roleDescriptions = {
  demo: 'Full access to clinical workspace, orders, prescriptions, and all features',
  nurse: 'Access to patient vitals, documentation, and medication administration',
  pharmacist: 'Access to pharmacy dispensing, medication verification, and inventory',
  admin: 'Access to system settings, audit trail, and user management'
};

/* --- Warm Slate palette tokens --- */
const palette = {
  stone900: '#1F1D2B',
  stone800: '#252244',
  stone700: '#44403C',
  stone600: '#57534E',
  stone500: '#78716C',
  stone400: '#A8A29E',
  stone300: '#D6D3D1',
  stone200: '#E7E5E4',
  stone100: '#F5F5F4',
  stone50:  '#FAFAF9',
  indigo:   '#6366F1',
  indigoHover: '#4F46E5',
  white:    '#FAFAF9',
};

const Login = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/patients');
    }
  }, [user, navigate]);

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await api.get('/api/auth/config');
      const availableUsers = response.data.available_users || [];

      const userDisplayNames = {
        'demo': 'Dr. Demo User',
        'nurse': 'Nurse Jane Smith',
        'pharmacist': 'Pharmacist John Doe',
        'admin': 'Administrator'
      };

      const formattedProviders = availableUsers.map(username => ({
        id: username,
        username: username,
        display_name: userDisplayNames[username] || username
      }));

      setProviders(formattedProviders);
    } catch (error) {
      console.error('Failed to load auth config:', error);
      setError('Failed to load provider list. Please refresh and try again.');
    }
  };

  const handleLogin = async () => {
    if (!selectedProvider) {
      setError('Please select a provider');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const provider = providers.find(p => p.id === selectedProvider);
      if (!provider) {
        setError('Invalid provider selection');
        return;
      }

      await login(provider.username);
      navigate('/patients');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && selectedProvider && !loading) {
      handleLogin();
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Left branding panel                                                */
  /* ------------------------------------------------------------------ */
  const brandingPanel = (
    <Box
      sx={{
        background: `linear-gradient(180deg, #1A1735 0%, ${palette.stone800} 50%, ${palette.stone900} 100%)`,
        color: palette.white,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        minHeight: isMobile ? 'auto' : '100vh',
        py: isMobile ? 5 : 0,
        px: 4,
      }}
    >
      {/* Centred branding block */}
      <Box sx={{ maxWidth: 340, textAlign: 'center' }}>
        <Box
          component="img"
          src="/wintehr-logo.png"
          alt="WintEHR logo"
          sx={{
            width: 80,
            height: 80,
            objectFit: 'contain',
            mb: 2.5,
            mx: 'auto',
            display: 'block',
            filter: 'brightness(0) invert(1)',
          }}
        />

        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            fontSize: '2.5rem',
            color: palette.white,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          WintEHR
        </Typography>

        <Typography
          sx={{
            color: palette.stone400,
            fontSize: '1rem',
            mt: 0.75,
            mb: 3,
            letterSpacing: '0.02em',
          }}
        >
          FHIR-Native Clinical Platform
        </Typography>

        <Divider
          sx={{
            borderColor: palette.stone700,
            width: 48,
            mx: 'auto',
            mb: 3,
          }}
        />

        <Typography
          sx={{
            color: palette.stone500,
            fontSize: '0.875rem',
            lineHeight: 1.7,
          }}
        >
          An educational platform for learning healthcare IT concepts, FHIR R4
          workflows, and clinical decision support.
        </Typography>
      </Box>

      {/* Version footer pinned to bottom (desktop) / inline (mobile) */}
      <Box
        sx={{
          position: isMobile ? 'static' : 'absolute',
          bottom: isMobile ? undefined : 28,
          left: 0,
          right: 0,
          textAlign: 'center',
          mt: isMobile ? 4 : 0,
        }}
      >
        <Typography sx={{ color: palette.stone600, fontSize: '0.75rem' }}>
          v6.1 &bull; React 18 &bull; FastAPI &bull; HAPI FHIR
        </Typography>
      </Box>
    </Box>
  );

  /* ------------------------------------------------------------------ */
  /*  Right form panel                                                   */
  /* ------------------------------------------------------------------ */
  const formPanel = (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: isMobile ? 'auto' : '100vh',
        py: isMobile ? 6 : 0,
        px: 3,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        {/* Heading */}
        <Typography
          variant="h5"
          component="h2"
          sx={{
            fontWeight: 600,
            color: palette.stone900,
            mb: 0.5,
          }}
        >
          Welcome back
        </Typography>

        <Typography
          sx={{
            color: palette.stone500,
            fontSize: '0.9375rem',
            mb: 4,
          }}
        >
          Select your provider profile to continue
        </Typography>

        {/* Error alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Provider select */}
        <Box component="form" onSubmit={(e) => e.preventDefault()}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="provider-select-label">Select Provider</InputLabel>
            <Select
              labelId="provider-select-label"
              id="provider-select"
              value={selectedProvider}
              label="Select Provider"
              onChange={(e) => setSelectedProvider(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            >
              {providers && providers.length > 0 ? providers.map((provider) => (
                <MenuItem key={provider.id} value={provider.id}>
                  <Box>
                    <Typography variant="body1">
                      {provider.display_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {provider.specialty}
                      {provider.npi && ` \u2022 NPI: ${provider.npi}`}
                    </Typography>
                  </Box>
                </MenuItem>
              )) : null}
            </Select>
          </FormControl>

          {/* Role description info box */}
          {selectedProvider && roleDescriptions[selectedProvider] && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                mb: 3,
                p: 1.5,
                borderRadius: 1,
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <InfoIcon
                fontSize="small"
                sx={{ mt: 0.25, color: theme.palette.text.secondary }}
              />
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                {roleDescriptions[selectedProvider]}
              </Typography>
            </Box>
          )}

          {/* Sign in button */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleLogin}
            disabled={!selectedProvider || loading}
            startIcon={
              loading
                ? <CircularProgress size={20} color="inherit" />
                : <LoginIcon />
            }
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: '6px',
              textTransform: 'none',
              backgroundColor: palette.indigo,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: palette.indigoHover,
                boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
              },
              '&.Mui-disabled': {
                backgroundColor: palette.stone300,
                color: palette.stone500,
              },
            }}
          >
            {loading ? 'Signing in\u2026' : 'Sign In to WintEHR'}
          </Button>
        </Box>

        {/* Footer */}
        <Box sx={{ mt: 5, textAlign: 'center' }}>
          <Typography sx={{ color: palette.stone400, fontSize: '0.75rem' }}>
            Educational Platform &bull; Synthetic Synthea Data &bull; For
            Teaching Only
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  /* ------------------------------------------------------------------ */
  /*  Page shell: two-panel grid                                         */
  /* ------------------------------------------------------------------ */
  return (
    <Grid
      container
      sx={{
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Left branding panel - 5/12 on desktop, full width compact on mobile */}
      <Grid
        item
        xs={12}
        md={5}
      >
        {brandingPanel}
      </Grid>

      {/* Right form panel - 7/12 on desktop, full width on mobile */}
      <Grid
        item
        xs={12}
        md={7}
      >
        {formPanel}
      </Grid>
    </Grid>
  );
};

export default Login;
