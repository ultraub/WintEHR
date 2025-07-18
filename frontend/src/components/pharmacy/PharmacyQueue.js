/**
 * PharmacyQueue Component
 * Kanban-style pharmacy queue management (simplified without drag-and-drop for initial version)
 */
import React, { useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  Chip,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import SafeBadge from '../common/SafeBadge';
import {
  Schedule as PendingIcon,
  VerifiedUser as VerifyIcon,
  LocalShipping as DispenseIcon,
  CheckCircle as ReadyIcon,
  MoreVert as MoreIcon,
  Person as PatientIcon,
  LocalPharmacy as MedicationIcon,
  Flag as PriorityIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  ArrowForward as MoveIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';

// Pharmacy queue column configuration
const QUEUE_COLUMNS = {
  newOrders: {
    id: 'newOrders',
    title: 'New Orders',
    icon: <PendingIcon />,
    color: 'warning',
    description: 'Prescriptions awaiting initial review'
  },
  verification: {
    id: 'verification',
    title: 'Verification',
    icon: <VerifyIcon />,
    color: 'info',
    description: 'Under pharmacist review'
  },
  dispensing: {
    id: 'dispensing',
    title: 'Dispensing',
    icon: <DispenseIcon />,
    color: 'primary',
    description: 'Being physically prepared'
  },
  ready: {
    id: 'ready',
    title: 'Ready',
    icon: <ReadyIcon />,
    color: 'success',
    description: 'Ready for patient pickup'
  }
};

// Priority levels with colors and labels
const PRIORITY_LEVELS = {
  1: { label: 'STAT', color: 'error', bgColor: '#ffebee' },
  2: { label: 'Urgent', color: 'warning', bgColor: '#fff3e0' },
  3: { label: 'Normal', color: 'info', bgColor: '#f3f4f6' },
  4: { label: 'Low', color: 'default', bgColor: '#fafafa' }
};

// Prescription Card Component
const PrescriptionCard = ({ prescription, currentColumn, onStatusChange, onViewDetails }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  
  // Extract prescription details
  const medicationName = prescription.medicationCodeableConcept?.text ||
                         prescription.medicationCodeableConcept?.coding?.[0]?.display ||
                         'Unknown Medication';
  
  const patientRef = prescription.subject?.reference || '';
  const patientId = patientRef.replace('Patient/', '');
  const patientDisplay = prescription.subject?.display || `Patient ${patientId}`;
  
  const quantity = prescription.dispenseRequest?.quantity?.value || '';
  const unit = prescription.dispenseRequest?.quantity?.unit || 'units';
  
  const prescriber = prescription.requester?.display || 'Unknown Provider';
  const authoredDate = prescription.authoredOn ? new Date(prescription.authoredOn) : null;
  
  // Calculate priority (simplified logic)
  const priority = prescription.priority === 'urgent' ? 1 : 
                  prescription.priority === 'stat' ? 1 : 3;
  const priorityInfo = PRIORITY_LEVELS[priority];
  
  // Calculate time in queue
  const timeInQueue = authoredDate ? formatDistanceToNow(authoredDate, { addSuffix: true }) : '';
  
  // Check for special handling requirements
  const hasAllergies = prescription.note?.some(note => 
    note.text?.toLowerCase().includes('allergy') ||
    note.text?.toLowerCase().includes('allergic')
  );
  
  const isControlled = medicationName.toLowerCase().includes('oxycodone') ||
                      medicationName.toLowerCase().includes('morphine') ||
                      medicationName.toLowerCase().includes('fentanyl');
  
  const needsRefrigeration = medicationName.toLowerCase().includes('insulin') ||
                            medicationName.toLowerCase().includes('vaccine');

  const handleMenuClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Get next workflow action based on current column
  const getNextAction = () => {
    switch (currentColumn) {
      case 'newOrders':
        return { label: 'Verify', nextStatus: 'verification', color: 'info' };
      case 'verification':
        return { label: 'Dispense', nextStatus: 'dispensing', color: 'primary' };
      case 'dispensing':
        return { label: 'Ready', nextStatus: 'ready', color: 'success' };
      case 'ready':
        return { label: 'Complete', nextStatus: 'completed', color: 'success' };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        bgcolor: priorityInfo.bgColor,
        border: `1px solid ${theme.palette[priorityInfo.color]?.main || theme.palette.grey[300]}`,
        borderLeft: `4px solid ${theme.palette[priorityInfo.color]?.main || theme.palette.grey[500]}`,
        '&:hover': {
          boxShadow: theme.shadows[4],
        },
        position: 'relative'
      }}
    >
      {/* Priority and Special Indicators */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
        <Stack direction="row" spacing={0.5}>
          <Chip
            icon={<PriorityIcon />}
            label={priorityInfo.label}
            size="small"
            color={priorityInfo.color}
            variant="outlined"
          />
          {isControlled && (
            <Tooltip title="Controlled Substance">
              <Chip
                label="🔒"
                size="small"
                color="error"
                variant="outlined"
              />
            </Tooltip>
          )}
          {needsRefrigeration && (
            <Tooltip title="Requires Refrigeration">
              <Chip
                label="🧊"
                size="small"
                color="info"
                variant="outlined"
              />
            </Tooltip>
          )}
          {hasAllergies && (
            <Tooltip title="Patient Allergies - Review Required">
              <Chip
                icon={<WarningIcon />}
                label="⚠️"
                size="small"
                color="warning"
                variant="outlined"
              />
            </Tooltip>
          )}
        </Stack>
        
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            {timeInQueue}
          </Typography>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {/* Patient Information */}
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <PatientIcon color="action" fontSize="small" />
        <Typography variant="subtitle2" fontWeight="bold">
          {patientDisplay}
        </Typography>
      </Stack>

      {/* Medication Information */}
      <Box mb={2}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <MedicationIcon color="primary" fontSize="small" />
          <Typography variant="body1" fontWeight="semibold">
            {medicationName}
          </Typography>
        </Stack>
        
        {prescription.dosageInstruction?.[0] && (
          <Typography variant="body2" color="text.secondary" mb={0.5}>
            {prescription.dosageInstruction[0].text || 'See instructions'}
          </Typography>
        )}
        
        <Typography variant="caption" color="text.secondary">
          Qty: {quantity} {unit} | Provider: {prescriber}
        </Typography>
      </Box>

      {/* Action Buttons */}
      <Stack direction="row" spacing={1} justifyContent="space-between">
        <Button
          size="small"
          variant="outlined"
          onClick={() => onViewDetails(prescription)}
        >
          Details
        </Button>
        
        {nextAction && (
          <Button
            size="small"
            variant="contained"
            color={nextAction.color}
            startIcon={<MoveIcon />}
            onClick={() => onStatusChange(prescription.id, nextAction.nextStatus, nextAction.nextStatus)}
          >
            {nextAction.label}
          </Button>
        )}
      </Stack>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleMenuClose(); onViewDetails(prescription); }}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          View Details
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <PrintIcon sx={{ mr: 1 }} fontSize="small" />
          Print Label
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <InventoryIcon sx={{ mr: 1 }} fontSize="small" />
          Check Stock
        </MenuItem>
      </Menu>
    </Paper>
  );
};

// Queue Column Component
const QueueColumn = ({ column, prescriptions, onStatusChange, onViewDetails }) => {
  const theme = useTheme();
  const columnConfig = QUEUE_COLUMNS[column.id];
  
  return (
    <Paper 
      elevation={1} 
      sx={{ 
        height: 'calc(100vh - 400px)', 
        display: 'flex', 
        flexDirection: 'column',
        border: `1px solid ${theme.palette[columnConfig.color]?.main || theme.palette.grey[300]}`
      }}
    >
      {/* Column Header */}
      <Box 
        sx={{ 
          p: 2, 
          bgcolor: alpha(theme.palette[columnConfig.color]?.main || theme.palette.grey[500], 0.1),
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            {React.cloneElement(columnConfig.icon, { 
              color: columnConfig.color,
              fontSize: 'small'
            })}
            <Typography variant="h6" fontWeight="bold">
              {columnConfig.title}
            </Typography>
            <SafeBadge 
              badgeContent={prescriptions.length} 
              color={columnConfig.color}
              max={99}
            />
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {columnConfig.description}
        </Typography>
      </Box>

      {/* Content Area */}
      <Box
        sx={{
          flex: 1,
          p: 1,
          overflow: 'auto',
          minHeight: 100
        }}
      >
        {prescriptions.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              color: 'text.secondary'
            }}
          >
            {React.cloneElement(columnConfig.icon, { 
              sx: { fontSize: 48, opacity: 0.3 }
            })}
            <Typography variant="body2" textAlign="center" mt={1}>
              No prescriptions in {columnConfig.title.toLowerCase()}
            </Typography>
          </Box>
        ) : (
          prescriptions.map((prescription) => (
            <PrescriptionCard
              key={prescription.id}
              prescription={prescription}
              currentColumn={column.id}
              onStatusChange={onStatusChange}
              onViewDetails={onViewDetails}
            />
          ))
        )}
      </Box>
    </Paper>
  );
};

// Main PharmacyQueue Component
const PharmacyQueue = ({ queueCategories, onStatusChange, searchTerm }) => {
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Handle view details
  const handleViewDetails = useCallback((prescription) => {
    setSelectedPrescription(prescription);
    setDetailsDialogOpen(true);
  }, []);

  return (
    <Box>
      <Grid container spacing={2}>
        {Object.values(QUEUE_COLUMNS).map((columnConfig) => (
          <Grid item xs={12} md={3} key={columnConfig.id}>
            <QueueColumn
              column={columnConfig}
              prescriptions={queueCategories[columnConfig.id] || []}
              onStatusChange={onStatusChange}
              onViewDetails={handleViewDetails}
            />
          </Grid>
        ))}
      </Grid>

      {/* Prescription Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Prescription Details
        </DialogTitle>
        <DialogContent>
          {selectedPrescription && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedPrescription.medicationCodeableConcept?.text || 'Unknown Medication'}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Patient: {selectedPrescription.subject?.display || 'Unknown Patient'}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Provider: {selectedPrescription.requester?.display || 'Unknown Provider'}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Status: {selectedPrescription.status}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Prescribed: {selectedPrescription.authoredOn ? 
                  format(new Date(selectedPrescription.authoredOn), 'PPP p') : 'Unknown'}
              </Typography>
              {selectedPrescription.dosageInstruction?.[0] && (
                <Typography variant="body2" color="text.secondary" paragraph>
                  Instructions: {selectedPrescription.dosageInstruction[0].text || 'See dosage'}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PharmacyQueue;