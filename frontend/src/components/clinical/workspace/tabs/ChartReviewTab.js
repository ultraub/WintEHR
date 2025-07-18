/**
 * Chart Review Tab Component
 * Comprehensive view of patient's problems, medications, and allergies
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Collapse,
  Button,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  useTheme,
  alpha,
  Snackbar,
  Backdrop,
  Skeleton,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as ProblemIcon,
  LocalPharmacy as PharmacyIcon,
  Vaccines as ImmunizationIcon,
  SmokingRooms as SmokingIcon,
  LocalBar as AlcoholIcon,
  Add as AddIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  ErrorOutline as SeverityIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Tune as TuneIcon,
  Sort as SortIcon,
  CheckCircle as VerifiedIcon,
  HelpOutline as UnconfirmedIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';
import AddProblemDialog from '../dialogs/AddProblemDialog';
import EditProblemDialog from '../dialogs/EditProblemDialog';
import PrescribeMedicationDialog from '../dialogs/PrescribeMedicationDialog';
import EditMedicationDialog from '../dialogs/EditMedicationDialog';
import AddAllergyDialog from '../dialogs/AddAllergyDialog';
import EditAllergyDialog from '../dialogs/EditAllergyDialog';
import MedicationReconciliationDialog from '../dialogs/MedicationReconciliationDialog';
import RefillManagement from '../../medications/RefillManagement';
import MedicationDiscontinuationDialog from '../../medications/MedicationDiscontinuationDialog';
import EffectivenessMonitoringPanel from '../../medications/EffectivenessMonitoringPanel';
import ClinicalSafetyPanel from '../../medications/ClinicalSafetyPanel';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { medicationDiscontinuationService } from '../../../../services/medicationDiscontinuationService';
import { medicationEffectivenessService } from '../../../../services/medicationEffectivenessService';
import { intelligentCache } from '../../../../core/fhir/utils/intelligentCache';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../core/export/exportUtils';
import { GetApp as ExportIcon } from '@mui/icons-material';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { getMedicationName, getMedicationDosageDisplay, getMedicationSpecialInstructions } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { 
  getConditionStatus, 
  getMedicationStatus, 
  isConditionActive, 
  isMedicationActive, 
  getResourceDisplayText, 
  getCodeableConceptDisplay, 
  FHIR_STATUS_VALUES 
} from '../../../../core/fhir/utils/fhirFieldUtils';
import StatusChip from '../../common/StatusChip';
import { usePatientCDSAlerts } from '../../../../contexts/CDSContext';
import PrescriptionStatusDashboard from '../../prescribing/PrescriptionStatusDashboard';
import ClinicalCard from '../../common/ClinicalCard';
import ClinicalDataTable from '../../common/ClinicalDataTable';
import MetricCard from '../../common/MetricCard';
import { getClinicalContext } from '../../../../themes/clinicalThemeUtils';

// Problem List Component
const ProblemList = ({ conditions, patientId, onAddProblem, onEditProblem, onDeleteProblem, onExport, department }) => {
  const theme = useTheme();
  const [expandedItems, setExpandedItems] = useState({});
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  
  // Enhanced filtering state for new FHIR parameters
  const [dateFilter, setDateFilter] = useState({
    enabled: false,
    startDate: null,
    endDate: null,
    operator: 'ge' // ge, le, gt, lt, eq
  });
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortBySeverity, setSortBySeverity] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditProblem = (condition) => {
    setSelectedCondition(condition);
    setShowEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setSelectedCondition(null);
  };

  const handleSaveProblem = async (updatedCondition) => {
    try {
      await onEditProblem(updatedCondition);
      handleCloseEditDialog();
    } catch (error) {
      // Error is thrown to be handled by the calling component
      throw error;
    }
  };

  const handleDeleteProblem = async (conditionId) => {
    try {
      await onDeleteProblem(conditionId);
      handleCloseEditDialog();
    } catch (error) {
      // Error is thrown to be handled by the calling component
      throw error;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'severe': return 'error';
      case 'moderate': return 'warning';
      case 'mild': return 'info';
      default: return 'default';
    }
  };

  // Enhanced FHIR parameter utility functions
  const getVerificationStatus = (condition) => {
    return condition.verificationStatus?.coding?.[0]?.code || 'unknown';
  };

  const getSeverityLevel = (severity) => {
    if (!severity) return 'unknown';
    const code = severity.coding?.[0]?.code?.toLowerCase();
    const display = severity.coding?.[0]?.display?.toLowerCase() || severity.text?.toLowerCase();
    
    // SNOMED CT severity codes
    if (code === '24484000' || display?.includes('severe')) return 'severe';
    if (code === '6736007' || display?.includes('moderate')) return 'moderate'; 
    if (code === '255604002' || display?.includes('mild')) return 'mild';
    
    // Fallback to text analysis
    if (display) {
      if (display.includes('severe') || display.includes('critical')) return 'severe';
      if (display.includes('moderate')) return 'moderate';
      if (display.includes('mild') || display.includes('minor')) return 'mild';
    }
    
    return 'unknown';
  };

  const getSeverityWeight = (severity) => {
    switch(getSeverityLevel(severity)) {
      case 'severe': return 3;
      case 'moderate': return 2;
      case 'mild': return 1;
      default: return 0;
    }
  };

  const matchesDateFilter = (condition) => {
    if (!dateFilter.enabled || !dateFilter.startDate) return true;
    
    const onsetDate = condition.onsetDateTime || condition.onsetPeriod?.start;
    if (!onsetDate) return false;
    
    const conditionDate = new Date(onsetDate);
    const filterDate = new Date(dateFilter.startDate);
    const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
    
    switch(dateFilter.operator) {
      case 'ge': // Greater than or equal (on or after)
        return conditionDate >= filterDate;
      case 'le': // Less than or equal (on or before)
        return conditionDate <= filterDate;
      case 'gt': // Greater than (after)
        return conditionDate > filterDate;
      case 'lt': // Less than (before)
        return conditionDate < filterDate;
      case 'eq': // Equal (exactly on)
        return conditionDate.toDateString() === filterDate.toDateString();
      case 'between': // Between two dates
        return endDate ? (conditionDate >= filterDate && conditionDate <= endDate) : true;
      default:
        return true;
    }
  };

  // Enhanced filtering and sorting with new FHIR parameters
  const filteredAndSortedConditions = useMemo(() => {
    let filtered = conditions.filter(condition => {
      const conditionStatus = getConditionStatus(condition);
      const matchesFilter = filter === 'all' || 
        (filter === 'active' && conditionStatus === FHIR_STATUS_VALUES.CONDITION.ACTIVE) ||
        (filter === 'resolved' && conditionStatus === FHIR_STATUS_VALUES.CONDITION.RESOLVED);
      
      const conditionDisplay = getResourceDisplayText(condition);
      const matchesSearch = !searchTerm || 
        conditionDisplay.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Enhanced FHIR parameter filtering
      const matchesDate = matchesDateFilter(condition);
      
      // Verification status filtering
      const matchesVerification = verificationFilter === 'all' || 
        getVerificationStatus(condition) === verificationFilter;
      
      // Severity filtering
      const matchesSeverityFilter = severityFilter === 'all' || 
        getSeverityLevel(condition.severity) === severityFilter;
      
      return matchesFilter && matchesSearch && matchesDate && 
             matchesVerification && matchesSeverityFilter;
    });
    
    // Severity-based sorting
    if (sortBySeverity) {
      filtered.sort((a, b) => {
        const weightA = getSeverityWeight(a.severity);
        const weightB = getSeverityWeight(b.severity);
        return weightB - weightA; // Severe first
      });
    } else {
      // Default sorting by onset date (most recent first)
      filtered.sort((a, b) => {
        const dateA = new Date(a.onsetDateTime || a.onsetPeriod?.start || '1900-01-01');
        const dateB = new Date(b.onsetDateTime || b.onsetPeriod?.start || '1900-01-01');
        return dateB - dateA;
      });
    }
    
    return filtered;
  }, [conditions, filter, searchTerm, dateFilter, verificationFilter, severityFilter, sortBySeverity]);

  const activeCount = conditions.filter(c => isConditionActive(c)).length;
  const resolvedCount = conditions.filter(c => getConditionStatus(c) === FHIR_STATUS_VALUES.CONDITION.RESOLVED).length;

  return (
    <ClinicalCard
      title="Problem List"
      icon={<ProblemIcon />}
      department={department}
      variant="clinical"
      expandable={false}
      subtitle={
        <Stack direction="row" spacing={1} role="group" aria-label="Problem list filters">
              <Chip 
                label={`${activeCount} Active`} 
                size="small" 
                color="primary" 
                variant={filter === 'active' ? 'filled' : 'outlined'}
                onClick={() => setFilter('active')}
                component="button"
                role="button"
                aria-label={`Filter to show active problems only. ${activeCount} active problems found.`}
                aria-pressed={filter === 'active'}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setFilter('active');
                  }
                }}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.05)'
                  }
                }}
              />
              <Chip 
                label={`${resolvedCount} Resolved`} 
                size="small" 
                variant={filter === 'resolved' ? 'filled' : 'outlined'}
                onClick={() => setFilter('resolved')}
                component="button"
                role="button"
                aria-label={`Filter to show resolved problems only. ${resolvedCount} resolved problems found.`}
                aria-pressed={filter === 'resolved'}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setFilter('resolved');
                  }
                }}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.05)'
                  }
                }}
              />
              <Chip 
                label="All" 
                size="small" 
                variant={filter === 'all' ? 'filled' : 'outlined'}
                onClick={() => setFilter('all')}
                component="button"
                role="button"
                aria-label={`Show all problems. ${conditions.length} total problems found.`}
                aria-pressed={filter === 'all'}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setFilter('all');
                  }
                }}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.05)'
                  }
                }}
              />
            </Stack>
      }
      actions={
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Advanced Filters">
              <IconButton 
                size="small" 
                color={showAdvancedFilters ? "primary" : "default"}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                aria-label="Toggle advanced filtering options"
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <TuneIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sort by Severity">
              <IconButton 
                size="small"
                color={sortBySeverity ? "primary" : "default"}
                onClick={() => setSortBySeverity(!sortBySeverity)}
                aria-label="Sort problems by severity (severe first)"
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <SortIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Add Problem">
              <IconButton 
                size="small" 
                color="primary" 
                onClick={() => setShowAddDialog(true)}
                aria-label="Add new problem to patient chart"
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="View History">
              <IconButton 
                size="small"
                aria-label="View problem history for this patient"
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <HistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export">
              <IconButton 
                size="small"
                onClick={(e) => setExportAnchorEl(e.currentTarget)}
                aria-label="Export problem list data"
                aria-haspopup="menu"
                aria-expanded={Boolean(exportAnchorEl)}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <ExportIcon />
              </IconButton>
            </Tooltip>
        </Stack>
      }
    >
      <Box>
        <TextField
          fullWidth
          size="small"
          placeholder="Search problems..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />

        {/* Advanced Filters Panel */}
        <Collapse in={showAdvancedFilters}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Card variant="outlined" sx={{ 
              mb: 2, 
              p: 2,
              transition: `all ${theme.animations?.duration?.standard || 300}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 24px ${alpha(theme.palette.action.hover, 0.15)}`
              }
            }}>
              <Typography variant="subtitle2" gutterBottom>
                Advanced Filters
              </Typography>
              
              <Grid container spacing={2}>
                {/* Date Range Filter */}
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={dateFilter.enabled}
                        onChange={(e) => setDateFilter(prev => ({ 
                          ...prev, 
                          enabled: e.target.checked 
                        }))}
                      />
                    }
                    label="Filter by Onset Date"
                  />
                  
                  {dateFilter.enabled && (
                    <Box sx={{ mt: 1 }}>
                      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                        <InputLabel>Date Operator</InputLabel>
                        <Select
                          value={dateFilter.operator}
                          label="Date Operator"
                          onChange={(e) => setDateFilter(prev => ({ 
                            ...prev, 
                            operator: e.target.value 
                          }))}
                        >
                          <MenuItem value="ge">On or After</MenuItem>
                          <MenuItem value="le">On or Before</MenuItem>
                          <MenuItem value="gt">After</MenuItem>
                          <MenuItem value="lt">Before</MenuItem>
                          <MenuItem value="eq">Exactly On</MenuItem>
                          <MenuItem value="between">Between Dates</MenuItem>
                        </Select>
                      </FormControl>
                      
                      <DatePicker
                        label="Start Date"
                        value={dateFilter.startDate}
                        onChange={(date) => setDateFilter(prev => ({ 
                          ...prev, 
                          startDate: date 
                        }))}
                        renderInput={(params) => 
                          <TextField {...params} fullWidth size="small" sx={{ mb: 1 }} />
                        }
                      />
                      
                      {dateFilter.operator === 'between' && (
                        <DatePicker
                          label="End Date"
                          value={dateFilter.endDate}
                          onChange={(date) => setDateFilter(prev => ({ 
                            ...prev, 
                            endDate: date 
                          }))}
                          renderInput={(params) => 
                            <TextField {...params} fullWidth size="small" />
                          }
                        />
                      )}
                    </Box>
                  )}
                </Grid>
                
                {/* Verification Status Filter */}
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Verification Status</InputLabel>
                    <Select
                      value={verificationFilter}
                      label="Verification Status"
                      onChange={(e) => setVerificationFilter(e.target.value)}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="confirmed">Confirmed</MenuItem>
                      <MenuItem value="provisional">Provisional</MenuItem>
                      <MenuItem value="differential">Differential</MenuItem>
                      <MenuItem value="unconfirmed">Unconfirmed</MenuItem>
                      <MenuItem value="refuted">Refuted</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                {/* Severity Filter */}
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={severityFilter}
                      label="Severity"
                      onChange={(e) => setSeverityFilter(e.target.value)}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="severe">Severe</MenuItem>
                      <MenuItem value="moderate">Moderate</MenuItem>
                      <MenuItem value="mild">Mild</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              
              {/* Filter Summary */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Showing {filteredAndSortedConditions.length} of {conditions.length} problems
                  {dateFilter.enabled && ` • Date filtered`}
                  {verificationFilter !== 'all' && ` • ${verificationFilter} only`}
                  {severityFilter !== 'all' && ` • ${severityFilter} only`}
                  {sortBySeverity && ` • Sorted by severity`}
                </Typography>
              </Box>
            </Card>
          </LocalizationProvider>
        </Collapse>

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredAndSortedConditions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No problems found
            </Typography>
          ) : (
            filteredAndSortedConditions.map((condition) => (
              <ListItem
                key={condition.id}
                sx={{
                  borderRadius: theme.shape.borderRadius / 8,
                  mb: theme.spacing(1),
                  backgroundColor: expandedItems[condition.id] ? (theme.clinical?.surfaces?.primary || alpha(theme.palette.primary.main, 0.05)) : 'transparent',
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': { 
                    backgroundColor: expandedItems[condition.id] ? (theme.clinical?.interactions?.hover || alpha(theme.palette.primary.main, 0.08)) : 'action.hover',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <ListItemIcon>
                  <ProblemIcon color={isConditionActive(condition) ? 'warning' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body1">
                        {getResourceDisplayText(condition)}
                      </Typography>
                      
                      {/* Verification Status Indicator */}
                      {(() => {
                        const verificationStatus = getVerificationStatus(condition);
                        if (verificationStatus !== 'unknown') {
                          const getVerificationIcon = (status) => {
                            switch(status) {
                              case 'confirmed': return <VerifiedIcon fontSize="small" />;
                              case 'provisional': return <InfoIcon fontSize="small" />;
                              case 'differential': return <InfoIcon fontSize="small" />;
                              case 'unconfirmed': return <UnconfirmedIcon fontSize="small" />;
                              case 'refuted': return <CancelIcon fontSize="small" />;
                              default: return null;
                            }
                          };
                          
                          const getVerificationColor = (status) => {
                            switch(status) {
                              case 'confirmed': return 'success';
                              case 'provisional': return 'warning';
                              case 'differential': return 'info';
                              case 'unconfirmed': return 'warning';
                              case 'refuted': return 'error';
                              default: return 'default';
                            }
                          };
                          
                          return (
                            <Tooltip title={`Verification: ${verificationStatus}`}>
                              <Chip
                                icon={getVerificationIcon(verificationStatus)}
                                label={verificationStatus.charAt(0).toUpperCase() + verificationStatus.slice(1)}
                                size="small"
                                color={getVerificationColor(verificationStatus)}
                                variant="outlined"
                                sx={{
                                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                                  '&:hover': {
                                    transform: 'scale(1.05)'
                                  }
                                }}
                              />
                            </Tooltip>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Severity Indicator */}
                      {condition.severity && (
                        <Chip 
                          label={getSeverityLevel(condition.severity).charAt(0).toUpperCase() + getSeverityLevel(condition.severity).slice(1)}
                          size="small" 
                          color={getSeverityColor(getSeverityLevel(condition.severity))}
                          variant={getSeverityLevel(condition.severity) === 'severe' ? 'filled' : 'outlined'}
                          sx={{
                            transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                            '&:hover': {
                              transform: 'scale(1.05)'
                            }
                          }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <>
                      {condition.onsetDateTime ? 
                        `Onset: ${format(parseISO(condition.onsetDateTime), 'MMM d, yyyy')}` : 
                        'Onset date unknown'}
                      {condition.note?.[0]?.text && expandedItems[condition.id] && (
                        ` • ${condition.note[0].text}`
                      )}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit Problem">
                      <IconButton 
                        size="small"
                        onClick={() => handleEditProblem(condition)}
                        sx={{
                          transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                          '&:hover': {
                            transform: 'scale(1.1)',
                            backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                          }
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton 
                      size="small"
                      onClick={() => toggleExpanded(condition.id)}
                      sx={{
                        transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                        '&:hover': {
                          transform: 'scale(1.1)',
                          backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                        }
                      }}
                    >
                      {expandedItems[condition.id] ? <ExpandMoreIcon /> : <ExpandMoreIcon sx={{ transform: 'rotate(-90deg)' }} />}
                    </IconButton>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </Box>
      
      <AddProblemDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={onAddProblem}
        patientId={patientId}
      />
      
      <EditProblemDialog
        open={showEditDialog}
        onClose={handleCloseEditDialog}
        onSave={handleSaveProblem}
        onDelete={handleDeleteProblem}
        condition={selectedCondition}
        patientId={patientId}
      />
      
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        <MenuItem onClick={() => { onExport('csv'); setExportAnchorEl(null); }}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => { onExport('json'); setExportAnchorEl(null); }}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => { onExport('pdf'); setExportAnchorEl(null); }}>
          Export as PDF
        </MenuItem>
      </Menu>
    </ClinicalCard>
  );
};

// Medication List Component
const MedicationList = ({ medications, patientId, onPrescribeMedication, onEditMedication, onDeleteMedication, onExport, department }) => {
  const theme = useTheme();
  const [filter, setFilter] = useState('active');
  const [expandedItems, setExpandedItems] = useState({});
  const [showPrescribeDialog, setShowPrescribeDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReconciliationDialog, setShowReconciliationDialog] = useState(false);
  const [showRefillDialog, setShowRefillDialog] = useState(false);
  const [showDiscontinuationDialog, setShowDiscontinuationDialog] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  
  // Resolve medication references
  const { getMedicationDisplay, loading: resolvingMeds } = useMedicationResolver(
    medications?.filter(med => med && med.id) || []
  );
  
  // Clinical workflow context for events
  const { publish } = useClinicalWorkflow();
  
  // FHIR resource context for refreshing data
  const { refreshPatientResources } = useFHIRResource();

  const handleEditMedication = (medication) => {
    // Ensure we're setting a fresh copy of the medication
    setSelectedMedication({...medication});
    setShowEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setSelectedMedication(null);
  };

  const handleSaveMedication = async (updatedMedication) => {
    try {
      await onEditMedication(updatedMedication);
      handleCloseEditDialog();
    } catch (error) {
      // Error is thrown to be handled by the dialog component
      // Don't close the dialog on error so user can see the error message
      throw error;
    }
  };

  const handleDeleteMedication = async (medicationId) => {
    try {
      await onDeleteMedication(medicationId);
      handleCloseEditDialog();
    } catch (error) {
      // Error is thrown to be handled by the calling component
      throw error;
    }
  };

  const handleReconciliation = async (reconciliationResults) => {
    try {
      // The reconciliation service has already applied the changes
      // reconciliationResults contains the results of each change
      
      const successfulChanges = reconciliationResults.filter(result => result.result.success);
      const failedChanges = reconciliationResults.filter(result => !result.result.success);
      
      // Refresh the medication list to reflect changes
      await refreshPatientResources(patientId);
      
      // Publish workflow event for successful reconciliation
      if (successfulChanges.length > 0) {
        await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
          workflowType: 'medication-reconciliation',
          step: 'completed',
          data: {
            patientId,
            changesApplied: successfulChanges.length,
            changesFailed: failedChanges.length,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Close the dialog
      setShowReconciliationDialog(false);
      
      // Log summary for debugging
      
      // Medication reconciliation completed successfully
    } catch (error) {
      // Error during medication reconciliation
      throw error;
    }
  };

  const handleDiscontinuation = async (discontinuationData) => {
    try {
      const result = await medicationDiscontinuationService.discontinueMedication(discontinuationData);
      
      // Refresh the medication list to reflect changes
      await refreshPatientResources(patientId);
      
      // Publish workflow event for medication discontinuation
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'medication-discontinuation',
        step: 'completed',
        data: {
          medicationName: getMedicationName(result.originalRequest),
          reason: discontinuationData.reason.display,
          discontinuationType: discontinuationData.discontinuationType,
          patientId,
          timestamp: new Date().toISOString()
        }
      });
      
      // Close the dialog
      setShowDiscontinuationDialog(false);
      setSelectedMedication(null);
      
      // Log success
      
    } catch (error) {
      // Error during medication discontinuation
      throw error;
    }
  };

  const filteredMedications = medications.filter(med => {
    const medicationStatus = getMedicationStatus(med);
    return filter === 'all' || medicationStatus === filter;
  });

  const activeCount = medications.filter(m => isMedicationActive(m)).length;
  const stoppedCount = medications.filter(m => {
    const status = getMedicationStatus(m);
    return status === FHIR_STATUS_VALUES.MEDICATION.STOPPED || status === FHIR_STATUS_VALUES.MEDICATION.COMPLETED;
  }).length;

  return (
    <ClinicalCard
      title="Medications"
      icon={<MedicationIcon />}
      department={department}
      variant="clinical"
      expandable={false}
      subtitle={
        <Stack direction="row" spacing={1} role="group" aria-label="Medication list filters">
              <Chip 
                label={`${activeCount} Active`} 
                size="small" 
                color="primary" 
                variant={filter === 'active' ? 'filled' : 'outlined'}
                onClick={() => setFilter('active')}
                component="button"
                role="button"
                aria-label={`Filter to show active medications only. ${activeCount} active medications found.`}
                aria-pressed={filter === 'active'}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setFilter('active');
                  }
                }}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.05)'
                  }
                }}
              />
              <Chip 
                label={`${stoppedCount} Stopped`} 
                size="small" 
                variant={filter === 'stopped' ? 'filled' : 'outlined'}
                onClick={() => setFilter('stopped')}
                component="button"
                role="button"
                aria-label={`Filter to show stopped medications only. ${stoppedCount} stopped medications found.`}
                aria-pressed={filter === 'stopped'}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setFilter('stopped');
                  }
                }}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.05)'
                  }
                }}
              />
              <Chip 
                label="All" 
                size="small" 
                variant={filter === 'all' ? 'filled' : 'outlined'}
                onClick={() => setFilter('all')}
                component="button"
                role="button"
                aria-label={`Show all medications. ${medications.length} total medications found.`}
                aria-pressed={filter === 'all'}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setFilter('all');
                  }
                }}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.05)'
                  }
                }}
              />
            </Stack>
      }
      actions={
        <Stack direction="row" spacing={0.5}>
            <Tooltip title="Prescribe Medication">
              <IconButton 
                size="small" 
                color="primary" 
                onClick={() => setShowPrescribeDialog(true)}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Medication Reconciliation">
              <IconButton 
                size="small" 
                onClick={() => setShowReconciliationDialog(true)}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <PharmacyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refill Management">
              <IconButton 
                size="small" 
                onClick={() => setShowRefillDialog(true)}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export">
              <IconButton 
                size="small"
                onClick={(e) => setExportAnchorEl(e.currentTarget)}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <ExportIcon />
              </IconButton>
            </Tooltip>
        </Stack>
      }
    >
      <Box>
        <List sx={{ maxHeight: 400, overflow: 'auto', position: 'relative' }}>
          {resolvingMeds && (
            <Box sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: alpha(theme.palette.background.paper, 0.8),
              zIndex: 1
            }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {filteredMedications.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No medications found
            </Typography>
          ) : (
            filteredMedications.map((med) => (
              <ListItem
                key={med.id}
                sx={{
                  borderRadius: theme.shape.borderRadius / 8,
                  mb: theme.spacing(1.5),
                  py: theme.spacing(1.5),
                  backgroundColor: isMedicationActive(med) ? (theme.clinical?.surfaces?.primary || alpha(theme.palette.primary.main, 0.05)) : 'transparent',
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': { 
                    backgroundColor: isMedicationActive(med) ? (theme.clinical?.interactions?.hover || alpha(theme.palette.primary.main, 0.08)) : 'action.hover',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <ListItemIcon>
                  <MedicationIcon color={isMedicationActive(med) ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box>
                      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                        <Typography variant="body1" fontWeight="medium">
                          {getMedicationDisplay(med)}
                        </Typography>
                        {!isMedicationActive(med) && (
                          <StatusChip status={getMedicationStatus(med)} size="small" department={department} />
                        )}
                        {med.priority && med.priority !== 'routine' && (
                          <Chip 
                            label={med.priority.toUpperCase()} 
                            size="small" 
                            color={med.priority === 'stat' ? 'error' : med.priority === 'urgent' ? 'warning' : 'default'}
                            variant="outlined"
                            sx={{
                              transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                              '&:hover': {
                                transform: 'scale(1.05)'
                              }
                            }}
                          />
                        )}
                      </Stack>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      {/* Primary dosage line */}
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        <strong>Dosage:</strong> {getMedicationDosageDisplay(med)}
                        {(med.dosageInstruction?.[0]?.route?.text || med.dosageInstruction?.[0]?.route?.coding?.[0]?.display) && (
                          <span> • <strong>Route:</strong> {
                            med.dosageInstruction[0].route.text || 
                            med.dosageInstruction[0].route.coding?.[0]?.display ||
                            'Unknown'
                          }</span>
                        )}
                      </Typography>
                      
                      {/* Indication and dates */}
                      <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 0.5, gap: 1 }}>
                        {med.reasonCode?.[0]?.text && (
                          <Typography variant="caption" color="text.secondary">
                            <strong>For:</strong> {med.reasonCode[0].text}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          <strong>Prescribed:</strong> {med.authoredOn ? format(parseISO(med.authoredOn), 'MMM d, yyyy') : 'Unknown'}
                          {med.requester?.display && (
                            <span> by {med.requester.display}</span>
                          )}
                        </Typography>
                        {med.dispenseRequest?.expectedSupplyDuration?.value && (
                          <Typography variant="caption" color="text.secondary">
                            <strong>Duration:</strong> {med.dispenseRequest.expectedSupplyDuration.value} {med.dispenseRequest.expectedSupplyDuration.unit || 'days'}
                          </Typography>
                        )}
                        {med.dispenseRequest?.quantity?.value && (
                          <Typography variant="caption" color="text.secondary">
                            <strong>Qty:</strong> {med.dispenseRequest.quantity.value}{med.dispenseRequest.quantity.unit ? ` ${med.dispenseRequest.quantity.unit}` : ''}
                          </Typography>
                        )}
                        {med.dispenseRequest?.numberOfRepeatsAllowed !== undefined && (
                          <Typography variant="caption" color="text.secondary">
                            <strong>Refills:</strong> {med.dispenseRequest.numberOfRepeatsAllowed}
                          </Typography>
                        )}
                        {med.dispenseRequest?.validityPeriod?.end && (
                          <Typography variant="caption" color="text.secondary">
                            <strong>Valid until:</strong> {format(parseISO(med.dispenseRequest.validityPeriod.end), 'MMM d, yyyy')}
                          </Typography>
                        )}
                      </Stack>

                      {/* Special instructions if different from structured dosage */}
                      {(() => {
                        const specialInstructions = getMedicationSpecialInstructions(med);
                        if (specialInstructions) {
                          return (
                            <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                              <strong>Instructions:</strong> {specialInstructions}
                            </Typography>
                          );
                        }
                        return null;
                      })()}

                      {/* Notes if present */}
                      {med.note?.[0]?.text && (
                        <Typography variant="caption" sx={{ mt: 0.5, fontStyle: 'italic', display: 'block' }}>
                          <strong>Notes:</strong> {med.note[0].text}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit Medication">
                      <IconButton 
                        size="small"
                        onClick={() => handleEditMedication(med)}
                        sx={{
                          transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                          '&:hover': {
                            transform: 'scale(1.1)',
                            backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                          }
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isMedicationActive(med) && (
                      <Tooltip title="Discontinue Medication">
                        <IconButton 
                          size="small"
                          onClick={() => {
                            setSelectedMedication(med);
                            setShowDiscontinuationDialog(true);
                          }}
                          color="error"
                          sx={{
                            transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                            '&:hover': {
                              transform: 'scale(1.1)',
                              backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                            }
                          }}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </Box>
      
      <PrescribeMedicationDialog
        open={showPrescribeDialog}
        onClose={() => setShowPrescribeDialog(false)}
        onPrescribe={onPrescribeMedication}
        patientId={patientId}
      />
      
      <EditMedicationDialog
        key={selectedMedication?.id || 'new'}
        open={showEditDialog}
        onClose={handleCloseEditDialog}
        onSave={handleSaveMedication}
        onDelete={handleDeleteMedication}
        medicationRequest={selectedMedication}
        patientId={patientId}
      />
      
      <MedicationReconciliationDialog
        open={showReconciliationDialog}
        onClose={() => setShowReconciliationDialog(false)}
        patientId={patientId}
        currentMedications={medications}
        onReconcile={handleReconciliation}
      />
      
      <Dialog
        open={showRefillDialog}
        onClose={() => setShowRefillDialog(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' }
        }}
      >
        <DialogTitle>
          Medication Refill Management
        </DialogTitle>
        <DialogContent>
          <RefillManagement
            patientId={patientId}
            medications={medications}
            onRefresh={() => {
              // Refresh patient resources when refills are processed
              window.location.reload(); // Simple refresh for now
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRefillDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      <MedicationDiscontinuationDialog
        open={showDiscontinuationDialog}
        onClose={() => {
          setShowDiscontinuationDialog(false);
          setSelectedMedication(null);
        }}
        medicationRequest={selectedMedication}
        onDiscontinue={async (discontinuationData) => {
          try {
            const result = await medicationDiscontinuationService.discontinueMedication(discontinuationData);
            
            // Publish workflow event
            await publish(CLINICAL_EVENTS.MEDICATION_STATUS_CHANGED, {
              medicationId: selectedMedication.id,
              patientId,
              status: 'discontinued',
              reason: discontinuationData.reason.display,
              timestamp: new Date().toISOString()
            });
            
            // Refresh patient resources to show updated medication status
            await refreshPatientResources(patientId);
            
            return result;
          } catch (error) {
            // Error during medication discontinuation
            throw error;
          }
        }}
      />
      
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        <MenuItem onClick={() => { onExport('csv'); setExportAnchorEl(null); }}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => { onExport('json'); setExportAnchorEl(null); }}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => { onExport('pdf'); setExportAnchorEl(null); }}>
          Export as PDF
        </MenuItem>
      </Menu>
    </ClinicalCard>
  );
};


// Allergy List Component
const AllergyList = ({ allergies, patientId, onAddAllergy, onEditAllergy, onDeleteAllergy, onExport, department }) => {
  const theme = useTheme();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAllergy, setSelectedAllergy] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  
  // Enhanced allergy management state
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [criticalityFilter, setCriticalityFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const getSeverityColor = (criticality) => {
    switch (criticality?.toLowerCase()) {
      case 'high': return 'error';
      case 'low': return 'warning';
      default: return 'info';
    }
  };

  // Enhanced FHIR allergy utility functions
  const getAllergyVerificationStatus = (allergy) => {
    return allergy.verificationStatus?.coding?.[0]?.code || 'unknown';
  };

  const getVerificationStatusColor = (status) => {
    switch(status) {
      case 'confirmed': return 'error'; // High alert for confirmed allergies
      case 'unconfirmed': return 'warning';
      case 'refuted': return 'success';
      case 'entered-in-error': return 'default';
      default: return 'info';
    }
  };

  const getVerificationStatusIcon = (status) => {
    switch(status) {
      case 'confirmed': return <VerifiedIcon fontSize="small" />;
      case 'unconfirmed': return <UnconfirmedIcon fontSize="small" />;
      case 'refuted': return <CancelIcon fontSize="small" />;
      case 'entered-in-error': return <SeverityIcon fontSize="small" />;
      default: return <InfoIcon fontSize="small" />;
    }
  };

  const handleEditAllergy = (allergy) => {
    setSelectedAllergy(allergy);
    setShowEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setSelectedAllergy(null);
  };

  const handleSaveAllergy = async (updatedAllergy) => {
    try {
      await onEditAllergy(updatedAllergy);
      handleCloseEditDialog();
    } catch (error) {
      // Error is thrown to be handled by the calling component
      throw error;
    }
  };

  const handleDeleteAllergy = async (allergyId) => {
    try {
      await onDeleteAllergy(allergyId);
      handleCloseEditDialog();
    } catch (error) {
      // Error is thrown to be handled by the calling component
      throw error;
    }
  };

  // Enhanced allergy filtering and sorting
  const filteredAndSortedAllergies = useMemo(() => {
    let filtered = allergies.filter(allergy => {
      // Verification status filtering
      const matchesVerification = verificationFilter === 'all' || 
        getAllergyVerificationStatus(allergy) === verificationFilter;
      
      // Criticality filtering
      const matchesCriticality = criticalityFilter === 'all' || 
        (allergy.criticality?.toLowerCase() || 'unknown') === criticalityFilter;
      
      return matchesVerification && matchesCriticality;
    });
    
    // Sort by criticality (high first) then by verification status (confirmed first)
    filtered.sort((a, b) => {
      // First sort by criticality
      const criticalityWeightA = a.criticality?.toLowerCase() === 'high' ? 3 : 
                                a.criticality?.toLowerCase() === 'low' ? 2 : 1;
      const criticalityWeightB = b.criticality?.toLowerCase() === 'high' ? 3 : 
                                b.criticality?.toLowerCase() === 'low' ? 2 : 1;
      
      if (criticalityWeightA !== criticalityWeightB) {
        return criticalityWeightB - criticalityWeightA;
      }
      
      // Then sort by verification status (confirmed first)
      const verificationA = getAllergyVerificationStatus(a);
      const verificationB = getAllergyVerificationStatus(b);
      const verificationWeightA = verificationA === 'confirmed' ? 2 : 1;
      const verificationWeightB = verificationB === 'confirmed' ? 2 : 1;
      
      return verificationWeightB - verificationWeightA;
    });
    
    return filtered;
  }, [allergies, verificationFilter, criticalityFilter]);

  const activeAllergies = allergies.filter(a => getConditionStatus(a) === FHIR_STATUS_VALUES.CONDITION.ACTIVE);
  const criticalAllergies = allergies.filter(a => 
    a.criticality?.toLowerCase() === 'high' && 
    getAllergyVerificationStatus(a) === 'confirmed'
  );

  return (
    <ClinicalCard
      title="Allergies & Intolerances"
      icon={<WarningIcon />}
      department={department}
      variant="clinical"
      expandable={false}
      subtitle={
        <Chip 
              icon={<WarningIcon />}
              label={`${activeAllergies.length} Active`} 
              size="small" 
              color={activeAllergies.length > 0 ? 'error' : 'default'}
              sx={{
                transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                '&:hover': {
                  transform: 'scale(1.05)'
                }
              }}
            />
      }
      actions={
        <Stack direction="row" spacing={0.5}>
            <Tooltip title="Add Allergy">
              <IconButton 
                size="small" 
                color="primary" 
                onClick={() => setShowAddDialog(true)}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export">
              <IconButton 
                size="small"
                onClick={(e) => setExportAnchorEl(e.currentTarget)}
                sx={{
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                  }
                }}
              >
                <ExportIcon />
              </IconButton>
            </Tooltip>
        </Stack>
      }
    >
      <Box>
        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {allergies.length === 0 ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              No known allergies
            </Alert>
          ) : (
            allergies.map((allergy) => (
              <ListItem
                key={allergy.id}
                sx={{
                  borderRadius: theme.shape.borderRadius / 8,
                  mb: theme.spacing(1),
                  backgroundColor: theme.clinical?.surfaces?.error || alpha(theme.palette.error.main, 0.05),
                  transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                  '&:hover': { 
                    backgroundColor: theme.clinical?.interactions?.hover || alpha(theme.palette.error.main, 0.08),
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <ListItemIcon>
                  <WarningIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        {getResourceDisplayText(allergy)}
                      </Typography>
                      {allergy.criticality && (
                        <Chip 
                          label={allergy.criticality} 
                          size="small" 
                          color={getSeverityColor(allergy.criticality)}
                          sx={{
                            transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                            '&:hover': {
                              transform: 'scale(1.05)'
                            }
                          }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      {allergy.reaction?.[0]?.manifestation?.map((m, idx) => {
                        // Handle both R4 and R5 formats
                        const manifestationText = m?.concept?.text || m?.text || m?.concept?.coding?.[0]?.display || m?.coding?.[0]?.display;
                        return manifestationText ? (
                          <Chip 
                            key={idx}
                            label={manifestationText} 
                            size="small" 
                            sx={{ 
                              mr: 0.5, 
                              mb: 0.5,
                              transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                              '&:hover': {
                                transform: 'scale(1.05)'
                              }
                            }}
                          />
                        ) : null;
                      })}
                      <Typography variant="caption" color="text.secondary" display="block">
                        Recorded: {allergy.recordedDate ? format(parseISO(allergy.recordedDate), 'MMM d, yyyy') : 'Unknown'}
                      </Typography>
                    </Box>
                  }
                  primaryTypographyProps={{ component: 'div' }}
                  secondaryTypographyProps={{ component: 'div' }}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Edit Allergy">
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => handleEditAllergy(allergy)}
                      sx={{
                        transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                        '&:hover': {
                          transform: 'scale(1.1)',
                          backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                        }
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </Box>
      
      <AddAllergyDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={onAddAllergy}
        patientId={patientId}
      />
      
      <EditAllergyDialog
        open={showEditDialog}
        onClose={handleCloseEditDialog}
        onSave={handleSaveAllergy}
        onDelete={handleDeleteAllergy}
        allergyIntolerance={selectedAllergy}
        patientId={patientId}
      />
      
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        <MenuItem onClick={() => { onExport('csv'); setExportAnchorEl(null); }}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => { onExport('json'); setExportAnchorEl(null); }}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => { onExport('pdf'); setExportAnchorEl(null); }}>
          Export as PDF
        </MenuItem>
      </Menu>
    </ClinicalCard>
  );
};

// Social History Component
const SocialHistory = ({ observations, patientId, department }) => {
  const theme = useTheme();
  const socialObs = observations.filter(o => 
    o.category?.[0]?.coding?.[0]?.code === 'social-history'
  );

  const smokingStatus = socialObs.find(o => o.code?.coding?.[0]?.code === '72166-2');
  const alcoholUse = socialObs.find(o => o.code?.coding?.[0]?.code === '74013-4');

  return (
    <ClinicalCard
      title="Social History"
      icon={<InfoIcon />}
      department={department}
      variant="clinical"
      expandable={false}
    >
      <List>
        <ListItem>
          <ListItemIcon>
            <SmokingIcon color={smokingStatus ? "action" : "disabled"} />
          </ListItemIcon>
          <ListItemText 
            primary="Smoking Status"
            secondary={smokingStatus?.valueCodeableConcept?.text || 'Not documented'}
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <AlcoholIcon color={alcoholUse ? "action" : "disabled"} />
          </ListItemIcon>
          <ListItemText 
            primary="Alcohol Use"
            secondary={alcoholUse?.valueCodeableConcept?.text || 'Not documented'}
          />
        </ListItem>
      </List>
    </ClinicalCard>
  );
};

const ChartReviewTab = ({ patientId, onNotificationUpdate, department = 'general' }) => {
  const { 
    resources,
    getPatientResources, 
    searchResources, 
    searchWithInclude,
    isLoading,
    refreshPatientResources,
    currentPatient 
  } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // Get clinical context for enhanced theming
  const clinicalContext = getClinicalContext(
    window.location.pathname,
    new Date().getHours(),
    department
  );
  
  const [loading, setLoading] = useState(true);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Removed refreshKey - now using unified resource system

  // Use centralized CDS alerts
  const { alerts: cdsAlerts, loading: cdsLoading } = usePatientCDSAlerts(patientId);

  useEffect(() => {
    // Data is already loaded by FHIRResourceContext
    setLoading(false);
  }, []);

  // Handle CDS alerts notification count
  useEffect(() => {
    if (cdsAlerts.length > 0 && onNotificationUpdate) {
      // Pass critical alert count to match what ClinicalWorkspaceV3 expects
      const criticalCount = cdsAlerts.filter(alert => alert.indicator === 'critical').length;
      onNotificationUpdate(criticalCount || cdsAlerts.length);
    }
  }, [cdsAlerts, onNotificationUpdate]);

  const handleAddProblem = async (condition) => {
    try {
      const result = await fhirClient.create('Condition', condition);
      const createdCondition = result.resource || condition;
      
      // Trigger refresh of the resources
      await loadOptimizedResources();
      
      // Refresh completed successfully
    } catch (error) {
      // Error is thrown to be handled by the UI
      throw error;
    }
  };

  const handlePrescribeMedication = async (medicationRequest) => {
    try {
      // Note: CDS hooks for medication prescribing are handled in PrescribeMedicationDialog
      // This provides real-time checking during the prescription creation process

      const result = await fhirClient.create('MedicationRequest', medicationRequest);
      const createdMedication = result.resource || medicationRequest;
      
      // Create effectiveness monitoring plan for new medication
      try {
        await medicationEffectivenessService.createMonitoringPlan(createdMedication);
      } catch (error) {
        // Don't fail the prescription process if monitoring plan creation fails
      }

      // Publish workflow event
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'prescription-dispense',
        step: 'created',
        data: {
          ...createdMedication,
          medicationName: getMedicationName(createdMedication),
          patientId
        }
      });
      
      // Trigger refresh of the resources
      await loadOptimizedResources();
      
      // Refresh completed successfully
    } catch (error) {
      // Error is thrown to be handled by the UI
      throw error;
    }
  };

  const handleAddAllergy = async (allergyIntolerance) => {
    try {
      const result = await fhirClient.create('AllergyIntolerance', allergyIntolerance);
      const createdAllergy = result.resource || allergyIntolerance;
      
      // Publish workflow event for new allergy
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'allergy-notification',
        step: 'created',
        data: {
          ...createdAllergy,
          allergenName: createdAllergy.code?.text || 
                       createdAllergy.code?.coding?.[0]?.display || 
                       'Unknown allergen',
          patientId,
          timestamp: new Date().toISOString()
        }
      });
      
      // Trigger refresh of the resources
      await loadOptimizedResources();
      
      // Refresh completed successfully
    } catch (error) {
      // Error is thrown to be handled by the UI
      throw error;
    }
  };

  const handleEditProblem = async (updatedCondition) => {
    setSaveInProgress(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      // Update the condition on the server
      const result = await fhirClient.update('Condition', updatedCondition.id, updatedCondition);
      
      // Clear intelligent cache for this patient to force fresh data
      intelligentCache.clearPatient(patientId);
      
      // Clear the specific condition cache entries
      intelligentCache.clearResourceType('Condition');
      
      // Publish workflow event for condition update
      await publish(CLINICAL_EVENTS.CONDITION_UPDATED, {
        conditionId: updatedCondition.id,
        patientId,
        status: 'updated',
        conditionText: updatedCondition.code?.text || 
                      updatedCondition.code?.coding?.[0]?.display || 
                      'Unknown condition',
        timestamp: new Date().toISOString()
      });
      
      // Force refresh of patient resources to ensure UI updates
      await refreshPatientResources(patientId);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      return result;
    } catch (error) {
      setSaveError(error.message || 'Failed to update problem');
      throw error;
    } finally {
      setSaveInProgress(false);
    }
  };

  const handleDeleteProblem = async (conditionId) => {
    try {
      await fhirClient.delete('Condition', conditionId);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Publish event for condition deletion
      await publish(CLINICAL_EVENTS.CONDITION_UPDATED, {
        conditionId,
        patientId,
        status: 'deleted',
        timestamp: new Date().toISOString()
      });
      
      // Refresh patient resources to update condition list
      await refreshPatientResources(patientId);
      
      // Refresh completed successfully
    } catch (error) {
      throw error;
    }
  };

  const handleEditMedication = async (updatedMedicationRequest) => {
    setSaveInProgress(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      const result = await fhirClient.update('MedicationRequest', updatedMedicationRequest.id, updatedMedicationRequest);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Trigger refresh of the resources
      await loadOptimizedResources();
      
      return result;
    } catch (error) {
      setSaveError(error.message || 'Failed to update medication');
      throw error;
    } finally {
      setSaveInProgress(false);
    }
  };

  const handleDeleteMedication = async (medicationId) => {
    try {
      await fhirClient.delete('MedicationRequest', medicationId);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Trigger refresh of the resources
      await loadOptimizedResources();
      
      // Publish event for medication deletion
      await publish(CLINICAL_EVENTS.MEDICATION_STATUS_CHANGED, {
        medicationId,
        patientId,
        status: 'deleted',
        timestamp: new Date().toISOString()
      });
      
      // Refresh completed successfully
    } catch (error) {
      throw error;
    }
  };

  const handleEditAllergy = async (updatedAllergyIntolerance) => {
    setSaveInProgress(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      const result = await fhirClient.update('AllergyIntolerance', updatedAllergyIntolerance.id, updatedAllergyIntolerance);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Trigger refresh of the resources
      await loadOptimizedResources();
      
      return result;
    } catch (error) {
      setSaveError(error.message || 'Failed to update allergy');
      throw error;
    } finally {
      setSaveInProgress(false);
    }
  };

  const handleDeleteAllergy = async (allergyId) => {
    try {
      await fhirClient.delete('AllergyIntolerance', allergyId);
      
      // Clear intelligent cache for this patient
      intelligentCache.clearPatient(patientId);
      
      // Trigger refresh of the resources
      await loadOptimizedResources();
      
      // Publish event for allergy deletion
      await publish(CLINICAL_EVENTS.ALLERGY_UPDATED, {
        allergyId,
        patientId,
        status: 'deleted',
        timestamp: new Date().toISOString()
      });
      
      // Refresh completed successfully
    } catch (error) {
      throw error;
    }
  };

  // Export handlers
  const handleExportProblems = (format) => {
    exportClinicalData({
      patient: currentPatient,
      data: conditions,
      columns: EXPORT_COLUMNS.conditions,
      format,
      title: 'Problem_List',
      formatForPrint: (data) => {
        let html = '<h2>Problem List</h2>';
        data.forEach(condition => {
          html += `
            <div class="section">
              <h3>${getResourceDisplayText(condition)}</h3>
              <p><strong>Status:</strong> ${getConditionStatus(condition) || 'Unknown'}</p>
              ${condition.severity ? `<p><strong>Severity:</strong> ${getCodeableConceptDisplay(condition.severity)}</p>` : ''}
              <p><strong>Onset:</strong> ${condition.onsetDateTime ? format(parseISO(condition.onsetDateTime), 'MMM d, yyyy') : 'Unknown'}</p>
              ${condition.note?.[0]?.text ? `<p><strong>Notes:</strong> ${condition.note[0].text}</p>` : ''}
            </div>
          `;
        });
        return html;
      }
    });
  };

  const handleExportMedications = (format) => {
    exportClinicalData({
      patient: currentPatient,
      data: medications,
      columns: EXPORT_COLUMNS.medications,
      format,
      title: 'Medication_List',
      formatForPrint: (data) => {
        let html = '<h2>Medication List</h2>';
        data.forEach(med => {
          html += `
            <div class="section">
              <h3>${getMedicationName(med)}</h3>
              <p><strong>Status:</strong> ${getMedicationStatus(med)}</p>
              ${med.dosageInstruction?.[0]?.text ? `<p><strong>Dosage:</strong> ${med.dosageInstruction[0].text}</p>` : ''}
              <p><strong>Prescribed:</strong> ${med.authoredOn ? format(parseISO(med.authoredOn), 'MMM d, yyyy') : 'Unknown'}</p>
              ${med.requester?.display ? `<p><strong>Prescriber:</strong> ${med.requester.display}</p>` : ''}
            </div>
          `;
        });
        return html;
      }
    });
  };

  const handleExportAllergies = (format) => {
    exportClinicalData({
      patient: currentPatient,
      data: allergies,
      columns: EXPORT_COLUMNS.allergies,
      format,
      title: 'Allergy_List',
      formatForPrint: (data) => {
        let html = '<h2>Allergy List</h2>';
        data.forEach(allergy => {
          html += `
            <div class="section">
              <h3>${getResourceDisplayText(allergy)}</h3>
              <p><strong>Type:</strong> ${allergy.type || 'Unknown'}</p>
              <p><strong>Criticality:</strong> ${allergy.criticality || 'Unknown'}</p>
              ${allergy.reaction?.[0]?.manifestation?.[0]?.text ? 
                `<p><strong>Reaction:</strong> ${allergy.reaction[0].manifestation[0].text}</p>` : ''}
              <p><strong>Recorded:</strong> ${allergy.recordedDate ? format(parseISO(allergy.recordedDate), 'MMM d, yyyy') : 'Unknown'}</p>
            </div>
          `;
        });
        return html;
      }
    });
  };

  // Get resources from context instead of loading separately
  const conditions = useMemo(() => 
    Object.values(resources.Condition || {}).filter(c => 
      c.subject?.reference === `Patient/${patientId}` || 
      c.subject?.reference === `urn:uuid:${patientId}` ||
      c.patient?.reference === `Patient/${patientId}` ||
      c.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.Condition, patientId]);
    
  const medications = useMemo(() => 
    Object.values(resources.MedicationRequest || {}).filter(m => 
      m.subject?.reference === `Patient/${patientId}` || 
      m.subject?.reference === `urn:uuid:${patientId}` ||
      m.patient?.reference === `Patient/${patientId}` ||
      m.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.MedicationRequest, patientId]);
    
  const allergies = useMemo(() => 
    Object.values(resources.AllergyIntolerance || {}).filter(a => 
      a.patient?.reference === `Patient/${patientId}` ||
      a.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.AllergyIntolerance, patientId]);
    
  const observations = useMemo(() => 
    Object.values(resources.Observation || {}).filter(o => 
      o.subject?.reference === `Patient/${patientId}` || 
      o.subject?.reference === `urn:uuid:${patientId}` ||
      o.patient?.reference === `Patient/${patientId}` ||
      o.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.Observation, patientId]);
    
  const immunizations = useMemo(() => 
    Object.values(resources.Immunization || {}).filter(i => 
      i.patient?.reference === `Patient/${patientId}`
    ), [resources.Immunization, patientId]);
    
  const [loadingOptimized, setLoadingOptimized] = useState(false);

  // Optimized resource loading with batch requests and server-side filtering
  const loadOptimizedResources = useCallback(async (filters = {}) => {
    if (!patientId) return;
    
    setLoadingOptimized(true);
    
    try {
      // Build batch bundle for all resources
      const batchBundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: []
      };

      // Build condition search parameters with server-side filtering
      let conditionQuery = `Condition?patient=${patientId}&_summary=data&_sort=-recorded-date&_count=50`;
      if (filters.clinicalStatus && filters.clinicalStatus !== 'all') {
        conditionQuery += `&clinical-status=${filters.clinicalStatus}`;
      }
      if (filters.verificationStatus && filters.verificationStatus !== 'all') {
        conditionQuery += `&verification-status=${filters.verificationStatus}`;
      }
      if (filters.onsetDate) {
        if (filters.onsetDateOperator === 'ge') {
          conditionQuery += `&onset-date=ge${filters.onsetDate}`;
        } else if (filters.onsetDateOperator === 'le') {
          conditionQuery += `&onset-date=le${filters.onsetDate}`;
        }
      }
      batchBundle.entry.push({
        request: { method: "GET", url: conditionQuery }
      });

      // Build medication search parameters with server-side filtering
      let medicationQuery = `MedicationRequest?patient=${patientId}&_sort=-authored-on&_count=50&_include=MedicationRequest:medication,MedicationRequest:requester`;
      if (filters.medicationStatus && filters.medicationStatus !== 'all') {
        medicationQuery += `&status=${filters.medicationStatus}`;
      }
      batchBundle.entry.push({
        request: { method: "GET", url: medicationQuery }
      });

      // Build allergy search parameters with server-side filtering
      let allergyQuery = `AllergyIntolerance?patient=${patientId}&_sort=-recorded-date`;
      if (filters.allergyVerificationStatus && filters.allergyVerificationStatus !== 'all') {
        allergyQuery += `&verification-status=${filters.allergyVerificationStatus}`;
      }
      if (filters.allergyCriticality && filters.allergyCriticality !== 'all') {
        allergyQuery += `&criticality=${filters.allergyCriticality}`;
      }
      batchBundle.entry.push({
        request: { method: "GET", url: allergyQuery }
      });

      // Add observations query
      batchBundle.entry.push({
        request: { 
          method: "GET", 
          url: `Observation?patient=${patientId}&category=vital-signs&_sort=-date&_count=20` 
        }
      });

      // Add immunizations query
      batchBundle.entry.push({
        request: { 
          method: "GET", 
          url: `Immunization?patient=${patientId}&_sort=-date&_count=50` 
        }
      });

      // Execute batch request
      const batchResult = await fhirClient.batch(batchBundle);
      
      // Process batch response
      const entries = batchResult.entry || [];
      
      // Resources are now loaded from context, no need to set local state
      // The batch request results are ignored since we use shared resources

    } catch (error) {
      console.error('Error loading optimized resources:', error);
      // Fallback - resources are already available from context
    } finally {
      setLoadingOptimized(false);
    }
  }, [patientId, searchResources, searchWithInclude, getPatientResources]);

  // Load optimized resources on patient change - DISABLED to prevent duplicate requests
  // Resources are already loaded by the parent component through fetchPatientBundle
  // useEffect(() => {
  //   loadOptimizedResources();
  // }, [loadOptimizedResources]);
  
  // Resources are now loaded automatically via optimized loading

  // Show skeleton loading while data is loading
  if (loadingOptimized || isLoading || loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={isMobile ? 2 : 3}>
          {/* Skeleton for each section */}
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} md={6} key={item}>
              <Card sx={{
                transition: `all ${theme.animations?.duration?.standard || 300}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.action.hover, 0.15)}`
                }
              }}>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
                  <Stack spacing={1}>
                    {[1, 2, 3].map((i) => (
                      <Box key={i}>
                        <Skeleton variant="text" width="100%" height={24} />
                        <Skeleton variant="text" width="80%" height={20} />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
          <Grid item xs={12}>
            <Card sx={{
              transition: `all ${theme.animations?.duration?.standard || 300}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 24px ${alpha(theme.palette.action.hover, 0.15)}`
              }
            }}>
              <CardContent>
                <Skeleton variant="text" width="40%" height={32} />
                <Skeleton variant="text" width="70%" height={20} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, position: 'relative' }}>
      {/* Save Progress Overlay */}
      <Backdrop
        sx={{ 
          position: 'absolute',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: alpha(theme.palette.background.paper, 0.7)
        }}
        open={saveInProgress}
      >
        <CircularProgress color="primary" />
      </Backdrop>

      {/* Success/Error Notifications */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSaveSuccess(false)} severity="success" sx={{ width: '100%' }}>
          Changes saved successfully!
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!saveError}
        autoHideDuration={6000}
        onClose={() => setSaveError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSaveError(null)} severity="error" sx={{ width: '100%' }}>
          {saveError || 'Failed to save changes'}
        </Alert>
      </Snackbar>
      <Grid container spacing={isMobile ? 2 : 3}>
        {/* Problem List */}
        <Grid item xs={12} md={6}>
          <ProblemList 
            conditions={conditions} 
            patientId={patientId} 
            onAddProblem={handleAddProblem}
            onEditProblem={handleEditProblem}
            onDeleteProblem={handleDeleteProblem}
            onExport={handleExportProblems}
            department={department}
          />
        </Grid>

        {/* Medications */}
        <Grid item xs={12} md={6}>
          <MedicationList 
            medications={medications} 
            patientId={patientId} 
            onPrescribeMedication={handlePrescribeMedication}
            onEditMedication={handleEditMedication}
            onDeleteMedication={handleDeleteMedication}
            onExport={handleExportMedications}
            department={department}
          />
        </Grid>

        {/* Allergies */}
        <Grid item xs={12} md={6}>
          <AllergyList 
            allergies={allergies} 
            patientId={patientId} 
            onAddAllergy={handleAddAllergy}
            onEditAllergy={handleEditAllergy}
            onDeleteAllergy={handleDeleteAllergy}
            onExport={handleExportAllergies}
            department={department}
          />
        </Grid>

        {/* Social History */}
        <Grid item xs={12} md={6}>
          <SocialHistory observations={observations} patientId={patientId} department={department} />
        </Grid>

        {/* Immunizations Summary */}
        <Grid item xs={12}>
          <ClinicalCard
            title="Immunizations"
            icon={<ImmunizationIcon />}
            status="active"
            department={department}
            variant="clinical"
            headerAction={
              <Chip 
                icon={<ImmunizationIcon />}
                label={`${immunizations.length} recorded`} 
                size="small" 
                color="success"
              />
            }
          >
            {immunizations.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No immunization records found
              </Typography>
            ) : (
              <Typography variant="body2">
                Last immunization: {
                  immunizations[0]?.occurrenceDateTime ? 
                  format(parseISO(immunizations[0].occurrenceDateTime), 'MMM d, yyyy') : 
                  'Unknown'
                }
              </Typography>
            )}
          </ClinicalCard>
        </Grid>

        {/* Prescription Status Dashboard */}
        <Grid item xs={12}>
          <ClinicalCard
            title="Prescription Status"
            icon={<PharmacyIcon />}
            department={department}
            variant="clinical"
            expandable={false}
          >
            <PrescriptionStatusDashboard patientId={patientId} />
          </ClinicalCard>
        </Grid>

        {/* Medication Effectiveness Monitoring */}
        <Grid item xs={12}>
          <Box sx={{
            transition: `all ${theme.animations?.duration?.standard || 300}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px ${alpha(theme.palette.info.main, 0.15)}`
            }
          }}>
            <EffectivenessMonitoringPanel
              patientId={patientId}
              medications={medications}
              onRefresh={async () => {
                await loadOptimizedResources();
              }}
            />
          </Box>
        </Grid>


        {/* Clinical Safety Verification */}
        <Grid item xs={12}>
          <Box sx={{
            transition: `all ${theme.animations?.duration?.standard || 300}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px ${alpha(theme.palette.warning.main, 0.15)}`
            }
          }}>
            <ClinicalSafetyPanel
              patientId={patientId}
              medications={medications}
              onRefresh={async () => {
                await loadOptimizedResources();
              }}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default React.memo(ChartReviewTab);