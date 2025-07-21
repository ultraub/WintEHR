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
  Divider
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  Login as LoginIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Login = () => {
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
      const response = await api.get('/auth/config');
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
          backgroundColor: 'white',
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ 
            width: 72, 
            height: 72, 
            borderRadius: 2,
            backgroundColor: theme => theme.palette.primary.light + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}>
            <HospitalIcon sx={{ fontSize: 36, color: 'primary.main' }} />
          </Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ 
            fontWeight: 700,
            color: 'text.primary',
          }}>
            Welcome to MedFlow
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
            }}
          >
            {loading ? 'Logging in...' : 'Sign In to MedFlow'}
          </Button>
        </Box>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Educational EMR System • For Teaching Purposes Only
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login;