import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  VpnKey as CredentialsIcon,
  Visibility as ShowIcon,
  VisibilityOff as HideIcon
} from '@mui/icons-material';
import cdsStudioApi from '../services/cdsStudioApi';
import CredentialDialog from '../components/CredentialDialog';

const CredentialsManager = () => {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [revealedSecrets, setRevealedSecrets] = useState(new Set());

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cdsStudioApi.listCredentials();
      setCredentials(data.credentials || []);
    } catch (err) {
      console.error('Failed to load credentials:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCredential(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (credential) => {
    setEditingCredential(credential);
    setCreateDialogOpen(true);
  };

  const handleDeleteClick = (credential) => {
    setDeleteConfirmation(credential);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) return;

    try {
      await cdsStudioApi.deleteCredential(deleteConfirmation.credential_id);
      await loadCredentials();
      setDeleteConfirmation(null);
    } catch (err) {
      console.error('Failed to delete credential:', err);
      setError(err.message);
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditingCredential(null);
  };

  const handleDialogSuccess = async () => {
    await loadCredentials();
    handleDialogClose();
  };

  const toggleSecretVisibility = (credentialId) => {
    setRevealedSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(credentialId)) {
        newSet.delete(credentialId);
      } else {
        newSet.add(credentialId);
      }
      return newSet;
    });
  };

  const maskSecret = (secret, credentialId) => {
    if (revealedSecrets.has(credentialId)) {
      return secret;
    }
    return '••••••••••••••••';
  };

  const getAuthTypeColor = (authType) => {
    switch (authType) {
      case 'basic':
        return 'primary';
      case 'bearer':
        return 'secondary';
      case 'api_key':
        return 'success';
      case 'oauth2':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading && credentials.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={3}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <CredentialsIcon fontSize="large" />
            <Box>
              <Typography variant="h4" gutterBottom>
                Credentials Manager
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage authentication credentials for external CDS services
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            New Credential
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Box>

      <Paper>
        {credentials.length === 0 ? (
          <Box p={4} textAlign="center">
            <CredentialsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Credentials Configured
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Add credentials to authenticate with external CDS services
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              Create First Credential
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Credential ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Auth Type</TableCell>
                  <TableCell>Username/Key</TableCell>
                  <TableCell>Secret</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {credentials.map((credential) => (
                  <TableRow key={credential.credential_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {credential.credential_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {credential.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={credential.auth_type}
                        size="small"
                        color={getAuthTypeColor(credential.auth_type)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {credential.username || credential.api_key || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontFamily="monospace">
                          {maskSecret(credential.password || credential.token || credential.client_secret, credential.credential_id)}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => toggleSecretVisibility(credential.credential_id)}
                        >
                          {revealedSecrets.has(credential.credential_id) ? (
                            <HideIcon fontSize="small" />
                          ) : (
                            <ShowIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {credential.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(credential)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(credential)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmation)}
        onClose={() => setDeleteConfirmation(null)}
      >
        <DialogTitle>Delete Credential</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the credential "{deleteConfirmation?.name}"?
            This action cannot be undone. Services using this credential will fail to authenticate.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmation(null)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Dialog */}
      {createDialogOpen && (
        <CredentialDialog
          open={createDialogOpen}
          credential={editingCredential}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
        />
      )}
    </Container>
  );
};

export default CredentialsManager;
