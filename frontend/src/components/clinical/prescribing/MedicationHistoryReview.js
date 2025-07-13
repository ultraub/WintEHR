/**
 * Medication History Review Component
 * Shows patient's medication history for clinical decision support during prescribing
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Button,
  Collapse,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  useTheme,
  Grid
} from '@mui/material';
import {
  Medication as MedicationIcon,
  History as HistoryIcon,
  CheckCircle as ActiveIcon,
  Cancel as StoppedIcon,
  Pause as OnHoldIcon,
  Schedule as CompletedIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Timeline as TimelineIcon,
  CalendarMonth as DateIcon,
  Assignment as PrescriptionIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInDays, subMonths } from 'date-fns';
import { fhirClient } from '../../../services/fhirClient';
import { useMedicationResolver } from '../../../hooks/useMedicationResolver';

const MedicationHistoryReview = ({ 
  patientId, 
  onMedicationSelect,
  showActiveOnly = false,
  timeRange = 12, // months
  highlightDuplicates = true,
  compactView = false
}) => {
  const theme = useTheme();
  const { resolveMedication } = useMedicationResolver();
  
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    showActive: true,
    showCompleted: !showActiveOnly,
    showStopped: !showActiveOnly,
    showOnHold: true
  });

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    stopped: 0,
    duplicateRisk: 0
  });

  // Load medication history
  useEffect(() => {
    loadMedicationHistory();
  }, [patientId, timeRange]);

  const loadMedicationHistory = async () => {
    if (!patientId) return;

    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const dateFrom = subMonths(new Date(), timeRange).toISOString();

      // Search for medication requests
      const searchParams = {
        patient: patientId,
        _sort: '-date',
        date: `ge${dateFrom}`,
        _count: 100
      };

      const medicationRequests = await fhirClient.search('MedicationRequest', searchParams);
      const requests = medicationRequests?.entry?.map(e => e.resource) || [];

      // Process and enrich medication data
      const processedMedications = await Promise.all(
        requests.map(async (request) => {
          const medicationDisplay = await resolveMedication(request);
          
          return {
            id: request.id,
            medication: medicationDisplay,
            medicationCodeableConcept: request.medicationCodeableConcept,
            status: request.status,
            intent: request.intent,
            authoredOn: request.authoredOn,
            requester: request.requester?.display,
            dosageInstructions: request.dosageInstruction?.[0]?.text || 
                              formatDosageInstructions(request.dosageInstruction?.[0]),
            quantity: request.dispenseRequest?.quantity,
            refills: request.dispenseRequest?.numberOfRepeatsAllowed,
            reasonCode: request.reasonCode?.[0]?.text,
            note: request.note?.[0]?.text,
            // Calculate duration
            duration: calculateDuration(request),
            // Check if recently active
            isRecentlyActive: isRecentlyActive(request),
            // Determine display status
            displayStatus: getDisplayStatus(request)
          };
        })
      );

      // Analyze for duplicates/similar medications
      const analyzedMedications = analyzeDuplicates(processedMedications);

      // Sort by date, with active medications first
      analyzedMedications.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return new Date(b.authoredOn) - new Date(a.authoredOn);
      });

      setMedications(analyzedMedications);

      // Calculate statistics
      const newStats = {
        total: analyzedMedications.length,
        active: analyzedMedications.filter(m => m.status === 'active').length,
        completed: analyzedMedications.filter(m => m.status === 'completed').length,
        stopped: analyzedMedications.filter(m => m.status === 'stopped' || m.status === 'cancelled').length,
        duplicateRisk: analyzedMedications.filter(m => m.hasDuplicateRisk).length
      };
      setStats(newStats);

    } catch (err) {
      setError('Failed to load medication history');
    } finally {
      setLoading(false);
    }
  };

  const formatDosageInstructions = (dosageInstruction) => {
    if (!dosageInstruction) return '';
    
    const parts = [];
    
    if (dosageInstruction.doseAndRate?.[0]?.doseQuantity) {
      const dose = dosageInstruction.doseAndRate[0].doseQuantity;
      parts.push(`${dose.value} ${dose.unit}`);
    }
    
    if (dosageInstruction.route?.text) {
      parts.push(dosageInstruction.route.text);
    }
    
    if (dosageInstruction.timing?.code?.text) {
      parts.push(dosageInstruction.timing.code.text);
    } else if (dosageInstruction.timing?.repeat) {
      const repeat = dosageInstruction.timing.repeat;
      if (repeat.frequency && repeat.period && repeat.periodUnit) {
        parts.push(`${repeat.frequency} times per ${repeat.periodUnit}`);
      }
    }
    
    return parts.join(' ');
  };

  const calculateDuration = (request) => {
    if (!request.dispenseRequest?.expectedSupplyDuration) return null;
    
    const duration = request.dispenseRequest.expectedSupplyDuration;
    return `${duration.value} ${duration.unit}`;
  };

  const isRecentlyActive = (request) => {
    if (request.status !== 'completed' && request.status !== 'stopped') return true;
    
    // Check if completed/stopped within last 30 days
    const lastUpdated = request.meta?.lastUpdated || request.authoredOn;
    const daysSince = differenceInDays(new Date(), new Date(lastUpdated));
    
    return daysSince <= 30;
  };

  const getDisplayStatus = (request) => {
    const statusMap = {
      'active': { label: 'Active', color: 'success', icon: <ActiveIcon /> },
      'completed': { label: 'Completed', color: 'default', icon: <CompletedIcon /> },
      'stopped': { label: 'Stopped', color: 'error', icon: <StoppedIcon /> },
      'cancelled': { label: 'Cancelled', color: 'error', icon: <StoppedIcon /> },
      'on-hold': { label: 'On Hold', color: 'warning', icon: <OnHoldIcon /> },
      'draft': { label: 'Draft', color: 'default', icon: <InfoIcon /> },
      'entered-in-error': { label: 'Error', color: 'error', icon: <WarningIcon /> }
    };
    
    return statusMap[request.status] || { label: request.status, color: 'default', icon: <InfoIcon /> };
  };

  const analyzeDuplicates = (medications) => {
    return medications.map((med, index) => {
      const duplicates = [];
      
      // Look for potential duplicates
      medications.forEach((otherMed, otherIndex) => {
        if (index !== otherIndex && med.status === 'active' && otherMed.status === 'active') {
          // Simple duplicate detection - check if medication names are similar
          const medName = med.medication.toLowerCase();
          const otherName = otherMed.medication.toLowerCase();
          
          // Check for exact match or if one contains the other
          if (medName === otherName || medName.includes(otherName) || otherName.includes(medName)) {
            duplicates.push(otherMed.id);
          }
          
          // Check for same medication class (would need more sophisticated logic)
          // This is a simplified example
          const commonClasses = ['statin', 'ace inhibitor', 'beta blocker', 'ppi'];
          commonClasses.forEach(drugClass => {
            if (medName.includes(drugClass) && otherName.includes(drugClass)) {
              duplicates.push(otherMed.id);
            }
          });
        }
      });
      
      return {
        ...med,
        hasDuplicateRisk: duplicates.length > 0,
        duplicateIds: duplicates
      };
    });
  };

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredMedications = medications.filter(med => {
    // Apply status filters
    if (!filters.showActive && med.status === 'active') return false;
    if (!filters.showCompleted && med.status === 'completed') return false;
    if (!filters.showStopped && (med.status === 'stopped' || med.status === 'cancelled')) return false;
    if (!filters.showOnHold && med.status === 'on-hold') return false;
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        med.medication.toLowerCase().includes(query) ||
        med.reasonCode?.toLowerCase().includes(query) ||
        med.dosageInstructions?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const renderMedicationItem = (med) => {
    const status = med.displayStatus;
    const isExpanded = expandedItems[med.id];
    
    return (
      <Card key={med.id} sx={{ mb: 2, border: med.hasDuplicateRisk ? 2 : 0, borderColor: 'warning.main' }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Typography variant="subtitle1" fontWeight="medium">
                  {med.medication}
                </Typography>
                <Chip
                  size="small"
                  label={status.label}
                  color={status.color}
                  icon={status.icon}
                />
                {med.hasDuplicateRisk && highlightDuplicates && (
                  <Chip
                    size="small"
                    label="Duplicate Risk"
                    color="warning"
                    icon={<WarningIcon />}
                  />
                )}
                {med.isRecentlyActive && med.status !== 'active' && (
                  <Chip
                    size="small"
                    label="Recently Active"
                    variant="outlined"
                  />
                )}
              </Stack>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {med.dosageInstructions}
              </Typography>
              
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  <DateIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }} />
                  Ordered: {format(new Date(med.authoredOn), 'MMM d, yyyy')}
                </Typography>
                {med.requester && (
                  <Typography variant="caption" color="text.secondary">
                    <PrescriptionIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }} />
                    {med.requester}
                  </Typography>
                )}
                {med.duration && (
                  <Typography variant="caption" color="text.secondary">
                    <TimelineIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }} />
                    Duration: {med.duration}
                  </Typography>
                )}
              </Stack>
              
              {med.reasonCode && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Indication: {med.reasonCode}
                </Typography>
              )}
            </Box>
            
            <Stack direction="row" spacing={1}>
              {onMedicationSelect && med.status === 'active' && (
                <Tooltip title="Use as template for new prescription">
                  <IconButton
                    size="small"
                    onClick={() => onMedicationSelect(med)}
                    color="primary"
                  >
                    <MedicationIcon />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton
                size="small"
                onClick={() => toggleExpanded(med.id)}
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>
          </Stack>
          
          <Collapse in={isExpanded}>
            <Box mt={2} pt={2} borderTop={1} borderColor="divider">
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Quantity Dispensed
                  </Typography>
                  <Typography variant="body2">
                    {med.quantity ? `${med.quantity.value} ${med.quantity.unit}` : 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Refills
                  </Typography>
                  <Typography variant="body2">
                    {med.refills !== undefined ? med.refills : 'Not specified'}
                  </Typography>
                </Grid>
                {med.note && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Clinical Notes
                    </Typography>
                    <Typography variant="body2">
                      {med.note}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (compactView) {
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Recent Medications ({stats.active} active, {stats.total} total)
        </Typography>
        <List dense>
          {filteredMedications.slice(0, 5).map(med => (
            <ListItem key={med.id}>
              <ListItemIcon>
                <MedicationIcon color={med.status === 'active' ? 'primary' : 'action'} />
              </ListItemIcon>
              <ListItemText
                primary={med.medication}
                secondary={`${med.dosageInstructions} " ${med.displayStatus.label}`}
              />
            </ListItem>
          ))}
        </List>
        {filteredMedications.length > 5 && (
          <Button size="small" fullWidth>
            View All ({filteredMedications.length})
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          <HistoryIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
          Medication History
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip label={`${stats.active} Active`} color="success" size="small" />
          <Chip label={`${stats.total} Total`} size="small" />
          {stats.duplicateRisk > 0 && (
            <Chip label={`${stats.duplicateRisk} Duplicates`} color="warning" size="small" />
          )}
        </Stack>
      </Stack>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search medications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button
              size="small"
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            <Typography variant="caption" color="text.secondary">
              Showing {filteredMedications.length} of {medications.length} medications
            </Typography>
          </Stack>
          
          <Collapse in={showFilters}>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.showActive}
                    onChange={(e) => setFilters({ ...filters, showActive: e.target.checked })}
                    size="small"
                  />
                }
                label="Active"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.showCompleted}
                    onChange={(e) => setFilters({ ...filters, showCompleted: e.target.checked })}
                    size="small"
                  />
                }
                label="Completed"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.showStopped}
                    onChange={(e) => setFilters({ ...filters, showStopped: e.target.checked })}
                    size="small"
                  />
                }
                label="Stopped"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.showOnHold}
                    onChange={(e) => setFilters({ ...filters, showOnHold: e.target.checked })}
                    size="small"
                  />
                }
                label="On Hold"
              />
            </Stack>
          </Collapse>
        </Stack>
      </Paper>

      {/* Duplicate Warning */}
      {stats.duplicateRisk > 0 && highlightDuplicates && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {stats.duplicateRisk} medication{stats.duplicateRisk > 1 ? 's' : ''} may be duplicate therapy. 
            Review carefully before prescribing similar medications.
          </Typography>
        </Alert>
      )}

      {/* Medication List */}
      {filteredMedications.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No medications found matching your criteria
          </Typography>
        </Paper>
      ) : (
        <Box>
          {filteredMedications.map(renderMedicationItem)}
        </Box>
      )}
    </Box>
  );
};

export default MedicationHistoryReview;