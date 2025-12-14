import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  VpnKey as CredentialsIcon,
  Visibility as ShowIcon,
  VisibilityOff as HideIcon
} from '@mui/icons-material';
import cdsStudioApi from '../services/cdsStudioApi';

const AUTH_TYPES = [
  { value: 'basic', label: 'Basic Authentication' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' }
];

const CredentialDialog = ({ open, credential, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    credential_id: '',
    name: '',
    description: '',
    auth_type: 'basic',
    // Basic auth
    username: '',
    password: '',
    // Bearer token
    token: '',
    // API Key
    api_key: '',
    api_key_header: 'X-API-Key',
    // OAuth2
    client_id: '',
    client_secret: '',
    token_url: '',
    scope: ''
  });

  useEffect(() => {
    if (credential) {
      // Editing existing credential
      setFormData({
        credential_id: credential.credential_id,
        name: credential.name,
        description: credential.description || '',
        auth_type: credential.auth_type,
        username: credential.username || '',
        password: credential.password || '',
        token: credential.token || '',
        api_key: credential.api_key || '',
        api_key_header: credential.api_key_header || 'X-API-Key',
        client_id: credential.client_id || '',
        client_secret: credential.client_secret || '',
        token_url: credential.token_url || '',
        scope: credential.scope || ''
      });
    } else {
      // Creating new credential - reset form
      setFormData({
        credential_id: '',
        name: '',
        description: '',
        auth_type: 'basic',
        username: '',
        password: '',
        token: '',
        api_key: '',
        api_key_header: 'X-API-Key',
        client_id: '',
        client_secret: '',
        token_url: '',
        scope: ''
      });
    }
    setError(null);
  }, [credential, open]);

  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value
    });
  };

  const validateForm = () => {
    if (!formData.credential_id || !formData.name) {
      setError('Credential ID and Name are required');
      return false;
    }

    switch (formData.auth_type) {
      case 'basic':
        if (!formData.username || !formData.password) {
          setError('Username and Password are required for Basic Authentication');
          return false;
        }
        break;
      case 'bearer':
        if (!formData.token) {
          setError('Token is required for Bearer Authentication');
          return false;
        }
        break;
      case 'api_key':
        if (!formData.api_key || !formData.api_key_header) {
          setError('API Key and Header name are required for API Key Authentication');
          return false;
        }
        break;
      case 'oauth2':
        if (!formData.client_id || !formData.client_secret || !formData.token_url) {
          setError('Client ID, Client Secret, and Token URL are required for OAuth 2.0');
          return false;
        }
        break;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build credential data based on auth type
      const credentialData = {
        credential_id: formData.credential_id,
        name: formData.name,
        description: formData.description,
        auth_type: formData.auth_type
      };

      // Add auth-type-specific fields
      switch (formData.auth_type) {
        case 'basic':
          credentialData.username = formData.username;
          credentialData.password = formData.password;
          break;
        case 'bearer':
          credentialData.token = formData.token;
          break;
        case 'api_key':
          credentialData.api_key = formData.api_key;
          credentialData.api_key_header = formData.api_key_header;
          break;
        case 'oauth2':
          credentialData.client_id = formData.client_id;
          credentialData.client_secret = formData.client_secret;
          credentialData.token_url = formData.token_url;
          credentialData.scope = formData.scope;
          break;
      }

      if (credential) {
        // Update existing credential
        await cdsStudioApi.updateCredential(credential.credential_id, credentialData);
      } else {
        // Create new credential
        await cdsStudioApi.createCredential(credentialData);
      }

      onSuccess?.();
    } catch (err) {
      console.error('Failed to save credential:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const renderAuthFields = () => {
    switch (formData.auth_type) {
      case 'basic':
        return (
          <>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Username"
                value={formData.username}
                onChange={handleChange('username')}
                placeholder="username"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange('password')}
                placeholder="••••••••"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <HideIcon /> : <ShowIcon />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </>
        );

      case 'bearer':
        return (
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              label="Bearer Token"
              type={showToken ? 'text' : 'password'}
              value={formData.token}
              onChange={handleChange('token')}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowToken(!showToken)}
                      edge="end"
                    >
                      {showToken ? <HideIcon /> : <ShowIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
        );

      case 'api_key':
        return (
          <>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="API Key"
                type={showToken ? 'text' : 'password'}
                value={formData.api_key}
                onChange={handleChange('api_key')}
                placeholder="sk_live_..."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowToken(!showToken)}
                        edge="end"
                      >
                        {showToken ? <HideIcon /> : <ShowIcon />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Header Name"
                value={formData.api_key_header}
                onChange={handleChange('api_key_header')}
                placeholder="X-API-Key"
                helperText="The HTTP header name where the API key will be sent"
              />
            </Grid>
          </>
        );

      case 'oauth2':
        return (
          <>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Client ID"
                value={formData.client_id}
                onChange={handleChange('client_id')}
                placeholder="client-id-123"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Client Secret"
                type={showClientSecret ? 'text' : 'password'}
                value={formData.client_secret}
                onChange={handleChange('client_secret')}
                placeholder="••••••••"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        edge="end"
                      >
                        {showClientSecret ? <HideIcon /> : <ShowIcon />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Token URL"
                value={formData.token_url}
                onChange={handleChange('token_url')}
                placeholder="https://auth.example.com/oauth/token"
                helperText="The OAuth 2.0 token endpoint URL"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Scope (Optional)"
                value={formData.scope}
                onChange={handleChange('scope')}
                placeholder="read write"
                helperText="Space-separated OAuth scopes"
              />
            </Grid>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CredentialsIcon />
          {credential ? 'Edit Credential' : 'Create Credential'}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Credential ID"
                value={formData.credential_id}
                onChange={handleChange('credential_id')}
                placeholder="my-api-credential"
                helperText="Unique identifier (lowercase, hyphens allowed)"
                disabled={Boolean(credential)} // Can't change ID when editing
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Name"
                value={formData.name}
                onChange={handleChange('name')}
                placeholder="My API Credential"
                helperText="Human-readable name"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description"
                value={formData.description}
                onChange={handleChange('description')}
                placeholder="Describe this credential..."
              />
            </Grid>

            {/* Authentication Type */}
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Authentication Type</InputLabel>
                <Select
                  value={formData.auth_type}
                  onChange={handleChange('auth_type')}
                  label="Authentication Type"
                >
                  {AUTH_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Auth Type Specific Fields */}
            {renderAuthFields()}
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Saving...' : credential ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CredentialDialog;
