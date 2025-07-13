/**
 * OrderSigningDialog Component
 * Simple dialog for signing multiple orders with digital signature
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Draw as SignatureIcon,
  Medication as MedicationIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  Assignment as OrderIcon,
  Security as SecurityIcon
} from '@mui/icons-material';

const getOrderIcon = (order) => {
  if (order.resourceType === 'MedicationRequest') {
    return <MedicationIcon color="primary" />;
  } else if (order.resourceType === 'ServiceRequest') {
    const category = order.category?.[0]?.coding?.[0]?.code;
    if (category === 'laboratory') return <LabIcon color="info" />;
    if (category === 'imaging') return <ImagingIcon color="secondary" />;
  }
  return <OrderIcon color="action" />;
};

const getOrderTitle = (order) => {
  if (order.resourceType === 'MedicationRequest') {
    return order.medicationCodeableConcept?.text || 
           order.medicationCodeableConcept?.coding?.[0]?.display ||
           'Medication Order';
  } else if (order.resourceType === 'ServiceRequest') {
    return order.code?.text || 
           order.code?.coding?.[0]?.display ||
           'Service Order';
  }
  return 'Order';
};

const OrderSigningDialog = ({ 
  open, 
  onClose, 
  orders = [], 
  onOrdersSigned,
  loading = false 
}) => {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('Provider authorization for order execution');
  const [validationError, setValidationError] = useState('');

  const handleSign = () => {
    if (!pin.trim()) {
      setValidationError('PIN is required');
      return;
    }
    
    if (!reason.trim()) {
      setValidationError('Signature reason is required');
      return;
    }

    setValidationError('');
    onOrdersSigned(orders, pin, reason);
  };

  const handleClose = () => {
    if (!loading) {
      setPin('');
      setReason('Provider authorization for order execution');
      setValidationError('');
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <SignatureIcon />
          <Typography variant="h6">
            Sign Orders ({orders.length})
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          You are about to digitally sign the following orders. This action will make them active and ready for execution.
        </Typography>

        <Box sx={{ mt: 2, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Orders to Sign:
          </Typography>
          <List dense>
            {orders.map((order, index) => (
              <ListItem key={order.id} divider={index < orders.length - 1}>
                <ListItemIcon>
                  {getOrderIcon(order)}
                </ListItemIcon>
                <ListItemText
                  primary={getOrderTitle(order)}
                  secondary={`Status: ${order.status} • Priority: ${order.priority || 'routine'}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={3}>
          <TextField
            fullWidth
            label="Provider PIN"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter your PIN"
            disabled={loading}
            InputProps={{
              startAdornment: <SecurityIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
          
          <TextField
            fullWidth
            label="Signature Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for signing these orders"
            disabled={loading}
            multiline
            rows={2}
          />

          {validationError && (
            <Alert severity="error">
              {validationError}
            </Alert>
          )}

          <Alert severity="info" icon={<SignatureIcon />}>
            By providing your PIN and signing these orders, you are authorizing their execution 
            and taking responsibility for their clinical appropriateness.
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSign}
          disabled={loading || !pin.trim() || !reason.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <SignatureIcon />}
        >
          {loading ? 'Signing...' : 'Sign Orders'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderSigningDialog;