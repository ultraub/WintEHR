/**
 * Enhanced Confirmation Dialog Component
 * Provides detailed confirmation dialogs for delete operations
 */
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Stack,
  Chip,
  Divider
} from '@mui/material';
import {
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const ConfirmDeleteDialog = ({ 
  open, 
  onClose, 
  onConfirm, 
  resourceType, 
  resourceData, 
  loading = false 
}) => {
  const getResourceDisplay = () => {
    switch (resourceType) {
      case 'condition':
        return resourceData?.code?.text || resourceData?.code?.coding?.[0]?.display || 'Unknown condition';
      case 'medication':
        return resourceData?.medicationCodeableConcept?.text || 
               resourceData?.medicationCodeableConcept?.coding?.[0]?.display || 
               'Unknown medication';
      case 'allergy':
        return resourceData?.code?.text || resourceData?.code?.coding?.[0]?.display || 'Unknown allergen';
      default:
        return 'Unknown resource';
    }
  };

  const getResourceDetails = () => {
    switch (resourceType) {
      case 'condition':
        return {
          status: resourceData?.clinicalStatus?.coding?.[0]?.code || 'unknown',
          date: resourceData?.onsetDateTime || resourceData?.recordedDate,
          severity: resourceData?.severity?.text || resourceData?.severity?.coding?.[0]?.display
        };
      case 'medication':
        return {
          status: resourceData?.status || 'unknown',
          date: resourceData?.authoredOn,
          dosage: resourceData?.dosageInstruction?.[0]?.text
        };
      case 'allergy':
        return {
          status: resourceData?.clinicalStatus?.coding?.[0]?.code || 'unknown',
          criticality: resourceData?.criticality,
          date: resourceData?.recordedDate || resourceData?.onsetDateTime
        };
      default:
        return {};
    }
  };

  const getWarningMessage = () => {
    switch (resourceType) {
      case 'condition':
        return 'This will remove the condition from the patient\'s active problem list. The condition will be marked as inactive but preserved for medical history.';
      case 'medication':
        return 'This will cancel the medication prescription. The medication will be marked as cancelled but preserved for medication history.';
      case 'allergy':
        return 'This will remove the allergy from the patient\'s active allergy list. The allergy will be marked as inactive but preserved for safety history.';
      default:
        return 'This action will modify the resource status but preserve it for historical records.';
    }
  };

  const resourceDisplay = getResourceDisplay();
  const resourceDetails = getResourceDetails();

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 0,
          border: '1px solid',
          borderColor: 'divider'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          <Typography variant="h6">
            Confirm Delete {resourceType?.charAt(0).toUpperCase() + resourceType?.slice(1)}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3}>
          <Alert severity="warning" icon={<InfoIcon />}>
            {getWarningMessage()}
          </Alert>

          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Resource to be deleted:
            </Typography>
            <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 0, border: '1px solid', borderColor: 'grey.300' }}>
              <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {resourceDisplay}
              </Typography>
              
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {resourceDetails.status && (
                  <Chip 
                    label={`Status: ${resourceDetails.status}`} 
                    size="small" 
                    color={resourceDetails.status === 'active' ? 'success' : 'default'}
                  />
                )}
                {resourceDetails.criticality && (
                  <Chip 
                    label={`Criticality: ${resourceDetails.criticality}`} 
                    size="small" 
                    color={resourceDetails.criticality === 'high' ? 'error' : 'default'}
                  />
                )}
                {resourceDetails.severity && (
                  <Chip 
                    label={`Severity: ${resourceDetails.severity}`} 
                    size="small" 
                  />
                )}
              </Stack>

              {resourceDetails.dosage && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Dosage: {resourceDetails.dosage}
                </Typography>
              )}

              {resourceDetails.date && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Date: {new Date(resourceDetails.date).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="body2" color="text.secondary">
              <strong>Note:</strong> This action uses "soft delete" - the resource will be marked as inactive 
              but preserved in the medical record for auditing and historical purposes. This follows 
              clinical best practices for maintaining complete patient history.
            </Typography>
          </Box>

          <Typography variant="h6" color="error" sx={{ textAlign: 'center' }}>
            Are you sure you want to proceed?
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          color="error" 
          variant="contained"
          disabled={loading}
          startIcon={loading ? null : <DeleteIcon />}
        >
          {loading ? 'Deleting...' : `Delete ${resourceType?.charAt(0).toUpperCase() + resourceType?.slice(1)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteDialog;