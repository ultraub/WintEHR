/**
 * Login Page Component
 * Provider selection and authentication
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Container,
  Divider,
  useTheme
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

const Login = () => {
  const theme = useTheme();
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
      // Extract available users from auth config
      const availableUsers = response.data.available_users || [];
      
      // Map users to provider format with display names
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
      // Find the selected provider's username
      const provider = providers.find(p => p.id === selectedProvider);
      if (!provider) {
        setError('Invalid provider selection');
        return;
      }
      
      // Login with username (password defaults to 'password' in training mode)
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

  return (
    <Container maxWidth="sm" sx={{ 
      mt: 8,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <Paper
        elevation={0}
        sx={{
          p: 5,
          backgroundColor: 'background.paper',
          borderRadius: theme.shape.borderRadius * 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            component="img"
            src="/wintehr-logo.png"
            alt="WintEHR"
            sx={{
              width: 120,
              height: 120,
              objectFit: 'contain',
              mb: 3,
              mx: 'auto',
              display: 'block',
            }}
          />
          <Typography variant="h4" component="h1" gutterBottom sx={{ 
            fontWeight: 700,
            color: 'text.primary',
          }}>
            Welcome to WintEHR
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Select your provider profile to continue
          </Typography>
        </Box>

        <Divider sx={{ my: 4 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

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
                      {provider.npi && ` • NPI: ${provider.npi}`}
                    </Typography>
                  </Box>
                </MenuItem>
              )) : null}
            </Select>
          </FormControl>

          {selectedProvider && roleDescriptions[selectedProvider] && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                mb: 3,
                p: 1.5,
                borderRadius: theme.shape.borderRadius,
                backgroundColor: 'action.hover',
              }}
            >
              <InfoIcon fontSize="small" color="action" sx={{ mt: 0.25 }} />
              <Typography variant="body2" color="text.secondary">
                {roleDescriptions[selectedProvider]}
              </Typography>
            </Box>
          )}

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleLogin}
            disabled={!selectedProvider || loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              borderRadius: theme.shape.borderRadius * 1.5,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              },
            }}
          >
            {loading ? 'Logging in...' : 'Sign In to WintEHR'}
          </Button>
        </Box>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Educational EMR System • For Teaching Purposes Only
          </Typography>
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
            Educational platform using synthetic Synthea data
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login;