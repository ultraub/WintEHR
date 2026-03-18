/**
 * Summary Tab Component
 * Patient overview dashboard with key clinical information
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
  Button,
  IconButton,
  Skeleton,
  Alert,
  LinearProgress,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as ProblemIcon,
  Science as LabIcon,
  LocalHospital as EncounterIcon,
  Assessment as VitalsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowForward as ArrowIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
  CalendarMonth as CalendarIcon,
  Print as PrintIcon,
  Event as EventIcon,
  FamilyRestroom as FamilyHistoryIcon,
  Add as AddIcon,
  Close as CloseIcon,
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  GppGood as ConsentIcon
} from '@mui/icons-material';
import { formatDistanceToNow, parseISO, isWithinInterval, subDays } from 'date-fns';
import { formatClinicalDate } from '../../../../core/fhir/utils/dateFormatUtils';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useStableCallback } from '../../../../hooks/ui/useStableReferences';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { TAB_IDS } from '../../utils/navigationHelper';
import { useMedicationResolver } from '../../../../hooks/medication/useMedicationResolver';
import { printDocument, formatConditionsForPrint, formatMedicationsForPrint, formatLabResultsForPrint } from '../../../../core/export/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { getMedicationDosageDisplay } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { 
  getConditionStatus, 
  getMedicationStatus, 
  getObservationCategory, 
  getObservationInterpretation,
  getEncounterStatus,
  isObservationLaboratory,
  isConditionActive,
  isMedicationActive,
  getResourceDisplayText,
  getCodeableConceptDisplay
} from '../../../../core/fhir/utils/fhirFieldUtils';
import CareTeamSummary from '../components/CareTeamSummary';
import EnhancedProviderDisplay from '../components/EnhancedProviderDisplay';
import QuestionnairesSection from '../components/QuestionnairesSection';
import { StatusChip } from '../../shared/display';
import { ViewControls, useDensity } from '../../shared/layout';
import { 
  ClinicalResourceCard,
  ClinicalSummaryCard,
  ClinicalLoadingState,
  ClinicalEmptyState
} from '../../shared';

// Family relationship codes (v3-RoleCode)
const RELATIONSHIP_OPTIONS = [
  { code: 'FTH', display: 'Father' },
  { code: 'MTH', display: 'Mother' },
  { code: 'BRO', display: 'Brother' },
  { code: 'SIS', display: 'Sister' },
  { code: 'SON', display: 'Son' },
  { code: 'DAU', display: 'Daughter' },
  { code: 'MGRMTH', display: 'Maternal Grandmother' },
  { code: 'PGRMTH', display: 'Paternal Grandmother' },
  { code: 'MGRFTH', display: 'Maternal Grandfather' },
  { code: 'PGRFTH', display: 'Paternal Grandfather' }
];

const INITIAL_FAMILY_HISTORY_FORM = {
  relationship: '',
  condition: '',
  onsetAge: '',
  deceased: false,
  deceasedAge: '',
  notes: ''
};

// Add Family History Dialog
const AddFamilyHistoryDialog = ({ open, onClose, patientId, onSaved }) => {
  const [formData, setFormData] = useState(INITIAL_FAMILY_HISTORY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    setFormData(INITIAL_FAMILY_HISTORY_FORM);
    setError(null);
    onClose();
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.relationship) {
      setError('Relationship is required');
      return;
    }
    if (!formData.condition.trim()) {
      setError('Condition is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const rel = RELATIONSHIP_OPTIONS.find(r => r.code === formData.relationship);

      const resource = {
        resourceType: 'FamilyMemberHistory',
        status: 'completed',
        patient: { reference: `Patient/${patientId}` },
        relationship: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
            code: rel.code,
            display: rel.display
          }],
          text: rel.display
        },
        condition: [{
          code: { text: formData.condition.trim() },
          ...(formData.onsetAge ? {
            onsetAge: {
              value: parseInt(formData.onsetAge, 10),
              unit: 'years',
              system: 'http://unitsofmeasure.org',
              code: 'a'
            }
          } : {})
        }],
        ...(formData.deceased ? { deceasedBoolean: true } : {}),
        ...(formData.deceased && formData.deceasedAge ? {
          deceasedAge: {
            value: parseInt(formData.deceasedAge, 10),
            unit: 'years',
            system: 'http://unitsofmeasure.org',
            code: 'a'
          },
          deceasedBoolean: undefined
        } : {}),
        ...(formData.notes.trim() ? {
          note: [{ text: formData.notes.trim() }]
        } : {})
      };

      // If deceasedAge is provided, remove deceasedBoolean (FHIR allows one or the other)
      if (resource.deceasedAge) {
        delete resource.deceasedBoolean;
      }

      await fhirClient.create('FamilyMemberHistory', resource);
      handleClose();
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Failed to save family history:', err);
      setError('Failed to save family history. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 0 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FamilyHistoryIcon color="primary" />
          <Typography variant="h6">Add Family History</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel id="relationship-label">Relationship</InputLabel>
              <Select
                labelId="relationship-label"
                value={formData.relationship}
                label="Relationship"
                onChange={(e) => handleChange('relationship', e.target.value)}
                sx={{ borderRadius: 0 }}
              >
                {RELATIONSHIP_OPTIONS.map((rel) => (
                  <MenuItem key={rel.code} value={rel.code}>
                    {rel.display}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              label="Condition"
              value={formData.condition}
              onChange={(e) => handleChange('condition', e.target.value)}
              placeholder="e.g., Diabetes mellitus type 2"
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Onset Age (years)"
              type="number"
              value={formData.onsetAge}
              onChange={(e) => handleChange('onsetAge', e.target.value)}
              inputProps={{ min: 0, max: 150 }}
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.deceased}
                  onChange={(e) => handleChange('deceased', e.target.checked)}
                />
              }
              label="Deceased"
            />
          </Grid>
          {formData.deceased && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Age at Death (years)"
                type="number"
                value={formData.deceasedAge}
                onChange={(e) => handleChange('deceasedAge', e.target.value)}
                inputProps={{ min: 0, max: 150 }}
                InputProps={{ sx: { borderRadius: 0 } }}
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes about this family history entry"
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={saving} sx={{ borderRadius: 0 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
          sx={{ borderRadius: 0 }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Related Person relationship options (v3-RoleCode)
const RELATED_PERSON_RELATIONSHIPS = [
  { code: 'ECON', display: 'Emergency Contact' },
  { code: 'SPS', display: 'Spouse' },
  { code: 'PRN', display: 'Parent' },
  { code: 'CHILD', display: 'Child' },
  { code: 'SIB', display: 'Sibling' },
  { code: 'GUARD', display: 'Guardian' },
  { code: 'O', display: 'Other' }
];

const INITIAL_RELATED_PERSON_FORM = {
  firstName: '',
  lastName: '',
  relationship: '',
  phone: '',
  email: '',
  address: ''
};

// Add Related Person Dialog
const AddRelatedPersonDialog = ({ open, onClose, patientId, onSaved }) => {
  const [formData, setFormData] = useState(INITIAL_RELATED_PERSON_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    setFormData(INITIAL_RELATED_PERSON_FORM);
    setError(null);
    onClose();
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }
    if (!formData.relationship) {
      setError('Relationship is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const rel = RELATED_PERSON_RELATIONSHIPS.find(r => r.code === formData.relationship);

      const telecom = [];
      if (formData.phone.trim()) {
        telecom.push({ system: 'phone', value: formData.phone.trim() });
      }
      if (formData.email.trim()) {
        telecom.push({ system: 'email', value: formData.email.trim() });
      }

      const resource = {
        resourceType: 'RelatedPerson',
        patient: { reference: `Patient/${patientId}` },
        relationship: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
            code: rel.code,
            display: rel.display
          }],
          text: rel.display
        }],
        name: [{ given: [formData.firstName.trim()], family: formData.lastName.trim() }],
        ...(telecom.length > 0 ? { telecom } : {}),
        ...(formData.address.trim() ? {
          address: [{ text: formData.address.trim() }]
        } : {})
      };

      await fhirClient.create('RelatedPerson', resource);
      handleClose();
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Failed to save related person:', err);
      setError('Failed to save contact. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 0 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon color="primary" />
          <Typography variant="h6">Add Contact</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="First Name"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel id="related-person-relationship-label">Relationship</InputLabel>
              <Select
                labelId="related-person-relationship-label"
                value={formData.relationship}
                label="Relationship"
                onChange={(e) => handleChange('relationship', e.target.value)}
                sx={{ borderRadius: 0 }}
              >
                {RELATED_PERSON_RELATIONSHIPS.map((rel) => (
                  <MenuItem key={rel.code} value={rel.code}>
                    {rel.display}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="e.g., (555) 123-4567"
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="e.g., contact@example.com"
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address (optional)"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Street address, city, state, ZIP"
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={saving} sx={{ borderRadius: 0 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <PersonAddIcon />}
          sx={{ borderRadius: 0 }}
        >
          {saving ? 'Saving...' : 'Add Contact'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Consent category options
const CONSENT_CATEGORIES = [
  { code: '59284-0', display: 'Treatment', scope: 'treatment', scopeDisplay: 'Treatment' },
  { code: '57016-8', display: 'Research Participation', scope: 'research', scopeDisplay: 'Research' },
  { code: '64292-6', display: 'Data Sharing', scope: 'patient-privacy', scopeDisplay: 'Privacy' },
  { code: '75781-5', display: 'Advance Directive', scope: 'adr', scopeDisplay: 'Advance Directive' },
  { code: '64293-4', display: 'HIPAA Authorization', scope: 'patient-privacy', scopeDisplay: 'Privacy' }
];

const CONSENT_STATUSES = [
  { value: 'active', display: 'Active' },
  { value: 'rejected', display: 'Rejected' },
  { value: 'inactive', display: 'Inactive' }
];

const INITIAL_CONSENT_FORM = {
  category: '',
  status: 'active',
  consentDate: new Date().toISOString().split('T')[0],
  periodEnd: '',
  notes: ''
};

// Record Consent Dialog
const RecordConsentDialog = ({ open, onClose, patientId, onSaved }) => {
  const [formData, setFormData] = useState(INITIAL_CONSENT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    setFormData(INITIAL_CONSENT_FORM);
    setError(null);
    onClose();
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.category) {
      setError('Consent category is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const cat = CONSENT_CATEGORIES.find(c => c.code === formData.category);

      const resource = {
        resourceType: 'Consent',
        status: formData.status,
        scope: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: cat.scope,
            display: cat.scopeDisplay
          }]
        },
        category: [{
          coding: [{
            system: 'http://loinc.org',
            code: cat.code,
            display: cat.display
          }]
        }],
        patient: { reference: `Patient/${patientId}` },
        dateTime: formData.consentDate,
        ...(formData.periodEnd ? {
          provision: { period: { end: formData.periodEnd } }
        } : {}),
        ...(formData.notes.trim() ? {
          note: [{ text: formData.notes.trim() }]
        } : {})
      };

      await fhirClient.create('Consent', resource);
      handleClose();
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Failed to save consent:', err);
      setError('Failed to record consent. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 0 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ConsentIcon color="primary" />
          <Typography variant="h6">Record Consent</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel id="consent-category-label">Consent Category</InputLabel>
              <Select
                labelId="consent-category-label"
                value={formData.category}
                label="Consent Category"
                onChange={(e) => handleChange('category', e.target.value)}
                sx={{ borderRadius: 0 }}
              >
                {CONSENT_CATEGORIES.map((cat) => (
                  <MenuItem key={cat.code} value={cat.code}>
                    {cat.display}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel id="consent-status-label">Status</InputLabel>
              <Select
                labelId="consent-status-label"
                value={formData.status}
                label="Status"
                onChange={(e) => handleChange('status', e.target.value)}
                sx={{ borderRadius: 0 }}
              >
                {CONSENT_STATUSES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.display}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Consent Date"
              type="date"
              value={formData.consentDate}
              onChange={(e) => handleChange('consentDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Expiration Date (optional)"
              type="date"
              value={formData.periodEnd}
              onChange={(e) => handleChange('periodEnd', e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes about this consent"
              InputProps={{ sx: { borderRadius: 0 } }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={saving} sx={{ borderRadius: 0 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <ConsentIcon />}
          sx={{ borderRadius: 0 }}
        >
          {saving ? 'Saving...' : 'Record Consent'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Recent Item Component
const RecentItem = ({ primary, secondary, icon, status, onClick }) => {
  const theme = useTheme();

  return (
    <ListItem
      component="button"
      onClick={onClick}
      sx={{
        mb: theme.spacing(1),
        transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
        '&:hover': {
          backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
        },
        cursor: 'pointer',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px'
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${primary}. ${secondary}${status ? `. Status: ${status}` : ''}`}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText 
        primary={primary}
        secondary={secondary}
      />
      {status && (
        <StatusChip 
          status={status}
          size="small"
        />
      )}
    </ListItem>
  );
};

const SummaryTab = ({ patientId, onNotificationUpdate, onNavigateToTab }) => {
  const theme = useTheme();
  const { 
    resources,
    fetchPatientBundle,
    isResourceLoading,
    currentPatient,
    relationships,
    isCacheWarm 
  } = useFHIRResource();
  
  const { subscribe, publish } = useClinicalWorkflow();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [density, setDensity] = useDensity('comfortable');
  const [viewMode, setViewMode] = useState('dashboard');
  const [familyHistory, setFamilyHistory] = useState([]);
  const [familyHistoryLoading, setFamilyHistoryLoading] = useState(false);
  const [familyHistoryError, setFamilyHistoryError] = useState(null);
  const [familyHistoryDialogOpen, setFamilyHistoryDialogOpen] = useState(false);
  const [relatedPersons, setRelatedPersons] = useState([]);
  const [relatedPersonsLoading, setRelatedPersonsLoading] = useState(false);
  const [relatedPersonsError, setRelatedPersonsError] = useState(null);
  const [relatedPersonDialogOpen, setRelatedPersonDialogOpen] = useState(false);
  const [consents, setConsents] = useState([]);
  const [consentsLoading, setConsentsLoading] = useState(false);
  const [consentsError, setConsentsError] = useState(null);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    activeProblems: 0,
    activeMedications: 0,
    recentLabs: 0,
    upcomingAppointments: 0,
    overdueItems: 0
  });

  // Optimized loading for summary counts
  const loadSummaryStats = useCallback(async () => {
    if (!patientId) return;
    
    try {
      // Use batch request to get counts efficiently
      const batchRequests = [
        {
          method: "GET",
          url: `Condition?patient=${patientId}&clinical-status=active&_summary=count`
        },
        {
          method: "GET",
          url: `MedicationRequest?patient=${patientId}&status=active&_summary=count`
        },
        {
          method: "GET",
          url: `Observation?patient=${patientId}&category=laboratory&date=ge${subDays(new Date(), 7).toISOString().split('T')[0]}&_summary=count`
        },
        {
          method: "GET",
          url: `AllergyIntolerance?patient=${patientId}&_summary=count`
        }
      ];

      const batchResult = await fhirClient.batch(batchRequests);
      
      // Extract counts from batch response
      const entries = batchResult.entry || [];
      const activeProblems = entries[0]?.resource?.total || 0;
      const activeMedications = entries[1]?.resource?.total || 0;
      const recentLabs = entries[2]?.resource?.total || 0;
      const totalAllergies = entries[3]?.resource?.total || 0;

      setStats({
        activeProblems,
        activeMedications,
        recentLabs,
        totalAllergies,
        upcomingAppointments: 0, // Will be calculated separately
        overdueItems: 0 // Will be calculated separately
      });
    } catch (error) {
      // Error loading summary stats - stats will not be displayed
      // Log error but don't call fetchPatientBundle to avoid infinite loop
    }
  }, [patientId, fhirClient]);

  // Load optimized summary stats on patient change
  // DISABLED: Using loadDashboardData instead which filters resources client-side
  // The API search filtering isn't working properly, so we rely on client-side filtering
  // useEffect(() => {
  //   if (patientId) {
  //     loadSummaryStats();
  //   }
  // }, [patientId]); // Only depend on patientId to avoid infinite loop

  // Get resources from context - these are already cached and shared
  const conditions = useMemo(() => {
    // Processing raw Condition resources
    const filtered = Object.values(resources.Condition || {}).filter(c => 
      c.subject?.reference === `Patient/${patientId}` || 
      c.subject?.reference === `urn:uuid:${patientId}` ||
      c.patient?.reference === `Patient/${patientId}` ||
      c.patient?.reference === `urn:uuid:${patientId}`
    );
    // Conditions filtered by status
    return filtered;
  }, [resources.Condition, patientId]);
  
  const medications = useMemo(() => {
    // Processing raw MedicationRequest resources
    const filtered = Object.values(resources.MedicationRequest || {}).filter(m => 
      m.subject?.reference === `Patient/${patientId}` || 
      m.subject?.reference === `urn:uuid:${patientId}` ||
      m.patient?.reference === `Patient/${patientId}` ||
      m.patient?.reference === `urn:uuid:${patientId}`
    );
    // Medications filtered by status
    return filtered;
  }, [resources.MedicationRequest, patientId]);
  
  const observations = useMemo(() => 
    Object.values(resources.Observation || {}).filter(o => 
      o.subject?.reference === `Patient/${patientId}` || 
      o.subject?.reference === `urn:uuid:${patientId}` ||
      o.patient?.reference === `Patient/${patientId}` ||
      o.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.Observation, patientId]);
  
  const encounters = useMemo(() => 
    Object.values(resources.Encounter || {}).filter(e => 
      e.subject?.reference === `Patient/${patientId}` || 
      e.subject?.reference === `urn:uuid:${patientId}` ||
      e.patient?.reference === `Patient/${patientId}` ||
      e.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.Encounter, patientId]);
  
  const allergies = useMemo(() => 
    Object.values(resources.AllergyIntolerance || {}).filter(a => 
      a.patient?.reference === `Patient/${patientId}` ||
      a.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.AllergyIntolerance, patientId]);

  const serviceRequests = useMemo(() => 
    Object.values(resources.ServiceRequest || {}).filter(s => 
      s.subject?.reference === `Patient/${patientId}` || 
      s.subject?.reference === `urn:uuid:${patientId}` ||
      s.patient?.reference === `Patient/${patientId}` ||
      s.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.ServiceRequest, patientId]);

  // Load family history from HAPI FHIR (not in FHIRResourceContext cache)
  const loadFamilyHistory = useCallback(async () => {
    if (!patientId) return;
    setFamilyHistoryLoading(true);
    setFamilyHistoryError(null);
    try {
      const response = await fhirClient.search('FamilyMemberHistory', {
        patient: `Patient/${patientId}`
      });
      const entries = response.entry?.map(e => e.resource) || [];
      setFamilyHistory(entries);
    } catch (err) {
      console.error('Failed to load family history:', err);
      setFamilyHistoryError('Failed to load family history');
    } finally {
      setFamilyHistoryLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadFamilyHistory();
  }, [loadFamilyHistory]);

  // Load related persons from HAPI FHIR
  const loadRelatedPersons = useCallback(async () => {
    if (!patientId) return;
    setRelatedPersonsLoading(true);
    setRelatedPersonsError(null);
    try {
      const response = await fhirClient.search('RelatedPerson', {
        patient: `Patient/${patientId}`
      });
      const entries = response.entry?.map(e => e.resource) || [];
      setRelatedPersons(entries);
    } catch (err) {
      console.error('Failed to load related persons:', err);
      setRelatedPersonsError('Failed to load contacts');
    } finally {
      setRelatedPersonsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadRelatedPersons();
  }, [loadRelatedPersons]);

  // Load consents from HAPI FHIR
  const loadConsents = useCallback(async () => {
    if (!patientId) return;
    setConsentsLoading(true);
    setConsentsError(null);
    try {
      const response = await fhirClient.search('Consent', {
        patient: `Patient/${patientId}`
      });
      const entries = response.entry?.map(e => e.resource) || [];
      setConsents(entries);
    } catch (err) {
      console.error('Failed to load consents:', err);
      setConsentsError('Failed to load consent records');
    } finally {
      setConsentsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadConsents();
  }, [loadConsents]);

  // Define loadDashboardData function with stable callback to prevent infinite loops
  const loadDashboardData = useStableCallback(async () => {
    try {
      // Don't set loading if we're just refreshing data we already have
      if (conditions.length === 0 && medications.length === 0 && observations.length === 0) {
        setLoading(true);
      }
      
      // Use current resource arrays directly - no need to reassign
      // Calculate stats using resilient field access utilities
      const activeConditions = conditions.filter(isConditionActive);
      const activeMeds = medications.filter(isMedicationActive);
      
      // Recent labs (last 7 days)
      const recentLabs = observations.filter(o => {
        if (isObservationLaboratory(o)) {
          const date = o.effectiveDateTime || o.issued;
          if (date) {
            return isWithinInterval(parseISO(date), {
              start: subDays(new Date(), 7),
              end: new Date()
            });
          }
        }
        return false;
      });

      // Count upcoming appointments (encounters with future dates)
      const upcomingAppointments = encounters.filter(enc => {
        const startDate = enc.period?.start;
        return startDate && new Date(startDate) > new Date() && enc.status === 'planned';
      }).length;

      // Calculate overdue items (medications needing refill, overdue lab orders, etc.)
      let overdueCount = 0;
      
      // Check for medications that might need refills
      medications.forEach(med => {
        if (isMedicationActive(med) && med.dispenseRequest?.validityPeriod?.end) {
          const endDate = new Date(med.dispenseRequest.validityPeriod.end);
          if (endDate < new Date()) {
            overdueCount++;
          }
        }
      });

      // Check for overdue lab orders (use already loaded service requests)
      serviceRequests.forEach(order => {
        if (order.status === 'active' && order.occurrenceDateTime) {
          const dueDate = new Date(order.occurrenceDateTime);
          if (dueDate < new Date()) {
            overdueCount++;
          }
        }
      });

      // Update stats
      setStats({
        activeProblems: activeConditions.length,
        activeMedications: activeMeds.length,
        recentLabs: recentLabs.length,
        upcomingAppointments: upcomingAppointments,
        overdueItems: overdueCount,
        totalAllergies: allergies.length
      });

      // Update notifications
      if (onNotificationUpdate && recentLabs.length > 0) {
        onNotificationUpdate(recentLabs.length);
      }

      setLastRefresh(new Date());
    } catch (error) {
      // Error loading summary data - in production this would show an error notification to the user
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  });

  // Update dashboard when resources change - removed loadDashboardData from deps to prevent infinite loops
  useEffect(() => {
    if (!patientId) return;
    
    // Resource check: tracking patient resources and cache status
    
    // Check if we have any resources loaded for this patient
    const hasAnyResources = conditions.length > 0 || medications.length > 0 || observations.length > 0 || encounters.length > 0;
    
    if (hasAnyResources) {
      // We have resources, process them
      // Processing resources from context
      loadDashboardData();
      setLoading(false);
    } else {
      // No resources yet, check if we're already loading from context
      if (isResourceLoading(patientId)) {
        // Resources are loading from context
        setLoading(true);
      } else if (!isCacheWarm(patientId)) {
        // Cache isn't warm and we're not loading, trigger a fetch
        // Cache not warm, fetching patient bundle
        setLoading(true);
        fetchPatientBundle(patientId, false, 'critical');
      } else {
        // Cache is warm but no resources - patient might have no data
        // Cache is warm but no resources found
        setLoading(false);
      }
    }
  }, [patientId, conditions.length, medications.length, observations.length, encounters.length, allergies.length, serviceRequests.length, isResourceLoading, isCacheWarm, fetchPatientBundle, loadDashboardData]);

  // Note: Removed problematic useEffect that was causing infinite loops
  // Data refreshing is now handled only by the event system below

  // Subscribe to clinical events to refresh summary when data changes
  useEffect(() => {
    const unsubscribers = [];
    let timeoutId = null;

    // Subscribe to events that should trigger a refresh
    const eventsToWatch = [
      CLINICAL_EVENTS.CONDITION_ADDED,
      CLINICAL_EVENTS.CONDITION_UPDATED,
      CLINICAL_EVENTS.MEDICATION_PRESCRIBED,
      CLINICAL_EVENTS.MEDICATION_STATUS_CHANGED,
      CLINICAL_EVENTS.RESULT_RECEIVED,
      CLINICAL_EVENTS.ENCOUNTER_CREATED,
      CLINICAL_EVENTS.ALLERGY_ADDED,
      CLINICAL_EVENTS.ALLERGY_UPDATED
    ];

    eventsToWatch.forEach(eventType => {
      const unsubscribe = subscribe(eventType, (data) => {
        // Only refresh if the event is for the current patient
        if (data.patientId === patientId || data.resourceType) {
          setRefreshing(true);
          // Use a timeout to prevent rapid successive calls
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => loadDashboardData(), 100);
        }
      });
      unsubscribers.push(unsubscribe);
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [subscribe, patientId, loadDashboardData]); // Include all dependencies


  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // Resolve medication references
  const { getMedicationDisplay } = useMedicationResolver(
    medications?.filter(med => med && med.id) || []
  );

  const handlePrintSummary = () => {
    // Skip printing if no relationships are available
    if (!relationships[patientId]) {
      return;
    }
    
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    // Create comprehensive summary content
    let content = '<h2>Clinical Summary</h2>';
    
    // Active Problems
    content += '<h3>Active Problems</h3>';
    const activeConditions = conditions.filter(isConditionActive);
    content += formatConditionsForPrint(activeConditions);
    
    // Active Medications
    content += '<h3>Active Medications</h3>';
    const activeMeds = medications.filter(isMedicationActive);
    content += formatMedicationsForPrint(activeMeds);
    
    // Recent Lab Results
    content += '<h3>Recent Lab Results (Last 7 Days)</h3>';
    const recentLabs = observations
      .filter(isObservationLaboratory)
      .sort((a, b) => new Date(b.effectiveDateTime || b.issued || 0) - new Date(a.effectiveDateTime || a.issued || 0))
      .slice(0, 5);
    content += formatLabResultsForPrint(recentLabs);
    
    // Allergies
    if (allergies.length > 0) {
      content += '<h3>Allergies</h3>';
      content += '<ul>';
      allergies.forEach(allergy => {
        const allergyText = getResourceDisplayText(allergy);
        const criticality = allergy.criticality ? ` (${allergy.criticality})` : '';
        content += `<li>${allergyText}${criticality}</li>`;
      });
      content += '</ul>';
    }
    
    printDocument({
      title: 'Clinical Summary',
      patient: patientInfo,
      content
    });
  };

  // Memoized data processing to prevent recalculation on every render
  const processedData = useMemo(() => {
    // Get critical conditions
    const criticalConditions = conditions.filter(c => 
      isConditionActive(c) && 
      (c.severity?.coding?.[0]?.code === 'severe' || 
       c.code?.text?.toLowerCase().includes('critical'))
    );
    
    // Generate vitals trend data (mock for now, should come from real observations)
    const vitalsTrend = observations
      .filter(o => o.code?.coding?.[0]?.system === 'http://loinc.org' && 
                   ['8867-4', '8462-4', '8310-5'].includes(o.code?.coding?.[0]?.code))
      .slice(-10)
      .map(o => ({
        value: o.valueQuantity?.value || 0,
        date: o.effectiveDateTime || o.issued
      }));
    
    return {
      recentConditions: conditions
        .sort((a, b) => new Date(b.recordedDate || 0) - new Date(a.recordedDate || 0))
        .slice(0, 5),
      
      recentMedications: medications
        .filter(isMedicationActive)
        .sort((a, b) => new Date(b.authoredOn || 0) - new Date(a.authoredOn || 0))
        .slice(0, 5),
      
      recentLabs: observations
        .filter(isObservationLaboratory)
        .sort((a, b) => new Date(b.effectiveDateTime || b.issued || 0) - new Date(a.effectiveDateTime || a.issued || 0))
        .slice(0, 5),
      
      recentEncounters: encounters
        .sort((a, b) => new Date(b.period?.start || 0) - new Date(a.period?.start || 0))
        .slice(0, 5),
        
      criticalConditions,
      vitalsTrend
    };
  }, [conditions, medications, observations, encounters]);
  
  const { recentConditions, recentMedications, recentLabs, recentEncounters, criticalConditions, vitalsTrend } = processedData;
  
  // Calculate patient acuity for header
  const patientAcuity = useMemo(() => {
    if (criticalConditions.length > 0) return 'critical';
    if (stats.overdueItems > 3) return 'high';
    if (stats.activeProblems > 5) return 'moderate';
    return 'low';
  }, [criticalConditions.length, stats]);

  if (loading && !refreshing) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Loading patient data...</Typography>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={140} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {refreshing && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 }} />}
      
      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Action Bar */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 2
        }}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ViewControls
              density={density}
              onDensityChange={setDensity}
              showViewMode={false}
              size="small"
            />
            <IconButton 
              onClick={handlePrintSummary} 
              title="Print Summary"
              size="small"
            >
              <PrintIcon />
            </IconButton>
            <IconButton 
              onClick={handleRefresh} 
              disabled={refreshing}
              size="small"
            >
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <ClinicalSummaryCard
              title="Active Problems"
              value={stats.activeProblems}
              icon={<ProblemIcon />}
              accentColor="#EF4444"
              severity={stats.activeProblems > 5 ? 'high' : stats.activeProblems > 3 ? 'moderate' : 'normal'}
              trend={stats.activeProblems > 3 ? { direction: 'up' } : null}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <ClinicalSummaryCard
              title="Medications"
              value={stats.activeMedications}
              icon={<MedicationIcon />}
              accentColor="#3B82F6"
              severity="normal"
              chips={stats.overdueItems > 0 ? [{ label: `${stats.overdueItems} need refill`, color: 'error' }] : []}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <ClinicalSummaryCard
              title="Recent Labs"
              value={stats.recentLabs}
              icon={<LabIcon />}
              accentColor="#F59E0B"
              severity="info"
              chips={[{ label: 'Last 7 days', color: 'default' }]}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <ClinicalSummaryCard
              title="Allergies"
              value={stats.totalAllergies}
              icon={<WarningIcon />}
              accentColor="#F97316"
              severity={stats.totalAllergies > 3 ? 'high' : stats.totalAllergies > 0 ? 'moderate' : 'normal'}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <ClinicalSummaryCard
              title="Overdue"
              value={stats.overdueItems}
              icon={<CalendarIcon />}
              accentColor="#8B5CF6"
              severity={stats.overdueItems > 0 ? 'high' : 'normal'}
              progress={stats.overdueItems > 0 ? (stats.overdueItems / 10) * 100 : 0}
            />
          </Grid>
        </Grid>


        {/* Clinical Alerts */}
        {(allergies.length > 0 || criticalConditions.length > 0) && (
            <Box sx={{ mt: 2, mb: 2 }}>
              {criticalConditions.length > 0 && (
                <Alert 
                  severity="error" 
                  sx={{ mb: 1 }}
                  action={
                    <Button size="small" onClick={() => onNavigateToTab && onNavigateToTab(TAB_IDS.CHART_REVIEW)}>
                      Manage
                    </Button>
                  }
                >
                  <Typography variant="subtitle2" fontWeight="bold">
                    Critical Conditions
                  </Typography>
                  {criticalConditions.slice(0, 2).map((condition, index) => (
                    <Typography key={index} variant="body2">
                      • {getResourceDisplayText(condition)}
                    </Typography>
                  ))}
                </Alert>
              )}
              {allergies.length > 0 && (
                <Alert 
                  severity="warning" 
                  sx={{ mb: 1 }}
                  action={
                    <Button size="small" onClick={() => onNavigateToTab && onNavigateToTab(TAB_IDS.CHART_REVIEW)}>
                      View All
                    </Button>
                  }
                >
                  <Typography variant="subtitle2" fontWeight="bold">
                    Allergies ({allergies.length})
                  </Typography>
                  {allergies.slice(0, 3).map((allergy, index) => (
                    <Typography key={index} variant="body2">
                      • {getResourceDisplayText(allergy)} 
                      {allergy.criticality && ` (${allergy.criticality})`}
                    </Typography>
                  ))}
                </Alert>
              )}
            </Box>
        )}

        {/* Clinical Snapshot Grid - 2x2 Layout */}
        <Grid container spacing={3}>
          {/* Active Problems Card */}
          <Grid item xs={12} md={6}>
              <ClinicalResourceCard
                title="Active Problems"
                subtitle={`${stats.activeProblems} conditions`}
                icon={<ProblemIcon />}
                severity={criticalConditions.length > 0 ? 'critical' : stats.activeProblems > 5 ? 'high' : stats.activeProblems > 3 ? 'moderate' : 'normal'}
                actions={
                  <IconButton
                    size="small"
                    onClick={() => onNavigateToTab && onNavigateToTab(TAB_IDS.CHART_REVIEW)}
                    title="View All"
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ height: '100%' }}
              >
                <List disablePadding>
                  {recentConditions.length > 0 ? (
                    recentConditions.slice(0, density === 'compact' ? 3 : 5).map((condition) => (
                      <ListItem
                        key={condition.id}
                        sx={{ 
                          px: density === 'compact' ? 1 : 2,
                          py: density === 'compact' ? 0.5 : 1
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <ProblemIcon 
                            color="warning" 
                            fontSize={density === 'compact' ? 'small' : 'medium'}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={getResourceDisplayText(condition)}
                          secondary={condition.recordedDate ?
                            formatClinicalDate(condition.recordedDate) :
                            null
                          }
                          primaryTypographyProps={{
                            variant: density === 'compact' ? 'body2' : 'body1',
                            noWrap: density === 'compact'
                          }}
                          secondaryTypographyProps={{
                            variant: 'caption'
                          }}
                        />
                        <StatusChip 
                          status={getConditionStatus(condition)}
                          size="small"
                        />
                      </ListItem>
                    ))
                  ) : (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      No active problems
                    </Typography>
                  )}
                </List>
              </ClinicalResourceCard>
          </Grid>

          {/* Current Medications Card */}
          <Grid item xs={12} md={6}>
              <ClinicalResourceCard
                title="Current Medications"
                subtitle={`${stats.activeMedications} active medications`}
                icon={<MedicationIcon />}
                severity={stats.overdueItems > 0 ? 'high' : stats.activeMedications > 10 ? 'moderate' : 'normal'}
                status={stats.overdueItems > 0 ? `${stats.overdueItems} need refill` : null}
                statusColor={stats.overdueItems > 0 ? 'error' : 'default'}
                actions={
                  <IconButton
                    size="small"
                    onClick={() => onNavigateToTab && onNavigateToTab(TAB_IDS.PHARMACY)}
                    title="View All"
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ height: '100%' }}
              >
                <List disablePadding>
                  {recentMedications.length > 0 ? (
                    recentMedications.slice(0, density === 'compact' ? 3 : 5).map((med) => (
                      <ListItem
                        key={med.id}
                        sx={{ 
                          px: density === 'compact' ? 1 : 2,
                          py: density === 'compact' ? 0.5 : 1
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <MedicationIcon 
                            color="primary" 
                            fontSize={density === 'compact' ? 'small' : 'medium'}
                          />
                        </ListItemIcon>
                        <ListItemText 
                          primary={getMedicationDisplay(med)}
                          secondary={getMedicationDosageDisplay(med)}
                          primaryTypographyProps={{
                            variant: density === 'compact' ? 'body2' : 'body1',
                            noWrap: density === 'compact'
                          }}
                          secondaryTypographyProps={{
                            variant: 'caption',
                            noWrap: true
                          }}
                        />
                        {med.dispenseRequest?.validityPeriod?.end && 
                         new Date(med.dispenseRequest.validityPeriod.end) < new Date() && (
                          <Chip 
                            label="Refill" 
                            size="small" 
                            color="error"
                            variant="outlined"
                          />
                        )}
                      </ListItem>
                    ))
                  ) : (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      No active medications
                    </Typography>
                  )}
                </List>
              </ClinicalResourceCard>
          </Grid>

          {/* Recent Lab Results Card */}
          <Grid item xs={12} md={6}>
              <ClinicalResourceCard
                title="Recent Lab Results"
                subtitle={`${recentLabs.length} results in last 7 days`}
                icon={<LabIcon />}
                severity={recentLabs.some(lab => {
                  const interp = getObservationInterpretation(lab);
                  const code = interp?.coding?.[0]?.code || interp;
                  return code === 'H' || code === 'L' || code === 'HH' || code === 'LL';
                }) ? 'high' : 'normal'}
                status={recentLabs.filter(lab => {
                  const interp = getObservationInterpretation(lab);
                  const code = interp?.coding?.[0]?.code || interp;
                  return code === 'H' || code === 'L' || code === 'HH' || code === 'LL';
                }).length > 0 ? `${recentLabs.filter(lab => {
                  const interp = getObservationInterpretation(lab);
                  const code = interp?.coding?.[0]?.code || interp;
                  return code === 'H' || code === 'L' || code === 'HH' || code === 'LL';
                }).length} abnormal` : null}
                statusColor={recentLabs.some(lab => {
                  const interp = getObservationInterpretation(lab);
                  const code = interp?.coding?.[0]?.code || interp;
                  return code === 'H' || code === 'L' || code === 'HH' || code === 'LL';
                }) ? 'warning' : 'default'}
                actions={
                  <IconButton
                    size="small"
                    onClick={() => onNavigateToTab && onNavigateToTab(TAB_IDS.RESULTS)}
                    title="View All"
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ height: '100%' }}
              >
                <List disablePadding>
                  {recentLabs.length > 0 ? (
                    recentLabs.slice(0, density === 'compact' ? 3 : 5).map((lab) => {
                      const interpretation = getObservationInterpretation(lab);
                      const interpCode = interpretation?.coding?.[0]?.code || interpretation;
                      const isAbnormal = interpCode === 'H' || interpCode === 'L' || interpCode === 'HH' || interpCode === 'LL';
                      
                      return (
                        <ListItem
                          key={lab.id}
                          sx={{ 
                            px: density === 'compact' ? 1 : 2,
                            py: density === 'compact' ? 0.5 : 1,
                            backgroundColor: isAbnormal ? 
                              alpha(theme.palette.error.main, 0.04) : 'transparent'
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <LabIcon 
                              color={isAbnormal ? 'error' : 'info'}
                              fontSize={density === 'compact' ? 'small' : 'medium'}
                            />
                          </ListItemIcon>
                          <ListItemText 
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography 
                                  variant={density === 'compact' ? 'body2' : 'body1'}
                                  noWrap
                                >
                                  {getResourceDisplayText(lab)}
                                </Typography>
                                {isAbnormal && (
                                  <Chip 
                                    label={interpretation} 
                                    size="small" 
                                    color="error"
                                    sx={{ height: 16, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <>
                                {lab.valueQuantity ?
                                  `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` :
                                  lab.valueString || 'Pending'
                                }
                                {' • '}
                                {formatClinicalDate(lab.effectiveDateTime || lab.issued, 'monthDay')}
                              </>
                            }
                            secondaryTypographyProps={{
                              variant: 'caption'
                            }}
                          />
                        </ListItem>
                      );
                    })
                  ) : (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      No recent lab results
                    </Typography>
                  )}
                </List>
              </ClinicalResourceCard>
          </Grid>

          {/* Upcoming Care Card */}
          <Grid item xs={12} md={6}>
              <ClinicalResourceCard
                title="Upcoming Care"
                subtitle="Next scheduled activities"
                icon={<EventIcon />}
                severity={stats.overdueItems > 0 ? 'high' : 'normal'}
                status={stats.overdueItems > 0 ? `${stats.overdueItems} overdue` : null}
                statusColor={stats.overdueItems > 0 ? 'error' : 'default'}
                actions={
                  <IconButton
                    size="small"
                    onClick={() => onNavigateToTab && onNavigateToTab(TAB_IDS.ENCOUNTERS)}
                    title="View Calendar"
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ height: '100%' }}
              >
                <List disablePadding>
                  {encounters.filter(enc => {
                    const startDate = enc.period?.start;
                    return startDate && new Date(startDate) > new Date() && enc.status === 'planned';
                  }).slice(0, density === 'compact' ? 3 : 5).map((encounter) => (
                    <ListItem
                      key={encounter.id}
                      sx={{ 
                        px: density === 'compact' ? 1 : 2,
                        py: density === 'compact' ? 0.5 : 1
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CalendarIcon 
                          color="secondary" 
                          fontSize={density === 'compact' ? 'small' : 'medium'}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={encounter.type?.[0]?.text || 'Appointment'}
                        secondary={encounter.period?.start ?
                          formatClinicalDate(encounter.period.start, 'withTime') :
                          'Date TBD'
                        }
                        primaryTypographyProps={{
                          variant: density === 'compact' ? 'body2' : 'body1',
                          noWrap: density === 'compact'
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption'
                        }}
                      />
                    </ListItem>
                  ))}
                  {stats.overdueItems > 0 && (
                    <ListItem
                      sx={{ 
                        px: density === 'compact' ? 1 : 2,
                        py: density === 'compact' ? 0.5 : 1,
                        backgroundColor: alpha(theme.palette.error.main, 0.04)
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <WarningIcon 
                          color="error" 
                          fontSize={density === 'compact' ? 'small' : 'medium'}
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={`${stats.overdueItems} overdue items`}
                        secondary="Action required"
                        primaryTypographyProps={{
                          variant: density === 'compact' ? 'body2' : 'body1',
                          color: 'error'
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption'
                        }}
                      />
                    </ListItem>
                  )}
                  {encounters.filter(enc => enc.status === 'planned').length === 0 && 
                   stats.overdueItems === 0 && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      No upcoming appointments
                    </Typography>
                  )}
                </List>
              </ClinicalResourceCard>
          </Grid>
        </Grid>

        {/* Family History Section */}
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <ClinicalResourceCard
              title="Family History"
              subtitle={familyHistoryLoading ? 'Loading...' : `${familyHistory.length} record${familyHistory.length !== 1 ? 's' : ''}`}
              icon={<FamilyHistoryIcon />}
              severity="normal"
              actions={
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setFamilyHistoryDialogOpen(true)}
                  sx={{ borderRadius: 0 }}
                >
                  Add
                </Button>
              }
            >
              {familyHistoryLoading ? (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : familyHistoryError ? (
                <Alert severity="error" sx={{ m: 1 }}>
                  {familyHistoryError}
                  <Button size="small" onClick={loadFamilyHistory} sx={{ ml: 1 }}>
                    Retry
                  </Button>
                </Alert>
              ) : familyHistory.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2, textAlign: 'center' }}
                >
                  No family history recorded
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small" aria-label="Family history">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Relationship</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Condition</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Onset Age</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Deceased</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {familyHistory.map((fmh) => {
                        const relationship = fmh.relationship?.coding?.[0]?.display
                          || fmh.relationship?.text
                          || 'Unknown';
                        const condition = fmh.condition?.[0]?.code?.coding?.[0]?.display
                          || fmh.condition?.[0]?.code?.text
                          || '--';
                        const onsetAge = fmh.condition?.[0]?.onsetAge
                          ? `${fmh.condition[0].onsetAge.value} ${fmh.condition[0].onsetAge.unit || 'years'}`
                          : '--';
                        const deceased = fmh.deceasedAge
                          ? `Yes (age ${fmh.deceasedAge.value} ${fmh.deceasedAge.unit || 'years'})`
                          : fmh.deceasedBoolean === true
                            ? 'Yes'
                            : fmh.deceasedBoolean === false
                              ? 'No'
                              : '--';
                        const notes = fmh.note?.[0]?.text || '--';

                        return (
                          <TableRow key={fmh.id} hover>
                            <TableCell>
                              <Chip
                                label={relationship}
                                size="small"
                                variant="outlined"
                                sx={{ borderRadius: 0 }}
                              />
                            </TableCell>
                            <TableCell>{condition}</TableCell>
                            <TableCell>{onsetAge}</TableCell>
                            <TableCell>{deceased}</TableCell>
                            <TableCell
                              sx={{
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={notes !== '--' ? notes : undefined}
                            >
                              {notes}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </ClinicalResourceCard>
          </Grid>
        </Grid>

        <AddFamilyHistoryDialog
          open={familyHistoryDialogOpen}
          onClose={() => setFamilyHistoryDialogOpen(false)}
          patientId={patientId}
          onSaved={loadFamilyHistory}
        />

        {/* Contacts & Relationships Section */}
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <ClinicalResourceCard
              title="Contacts & Relationships"
              subtitle={relatedPersonsLoading ? 'Loading...' : `${relatedPersons.length} contact${relatedPersons.length !== 1 ? 's' : ''}`}
              icon={<PeopleIcon />}
              severity="normal"
              actions={
                <Button
                  size="small"
                  startIcon={<PersonAddIcon />}
                  onClick={() => setRelatedPersonDialogOpen(true)}
                  sx={{ borderRadius: 0 }}
                >
                  Add Contact
                </Button>
              }
            >
              {relatedPersonsLoading ? (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : relatedPersonsError ? (
                <Alert severity="error" sx={{ m: 1 }}>
                  {relatedPersonsError}
                  <Button size="small" onClick={loadRelatedPersons} sx={{ ml: 1 }}>
                    Retry
                  </Button>
                </Alert>
              ) : relatedPersons.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2, textAlign: 'center' }}
                >
                  No emergency contacts or related persons recorded
                </Typography>
              ) : (
                <List disablePadding>
                  {relatedPersons.map((rp) => {
                    const name = rp.name?.[0]
                      ? `${(rp.name[0].given || []).join(' ')} ${rp.name[0].family || ''}`.trim()
                      : 'Unknown';
                    const relationship = rp.relationship?.[0]?.coding?.[0]?.display
                      || rp.relationship?.[0]?.text
                      || 'Related Person';
                    const phone = rp.telecom?.find(t => t.system === 'phone')?.value;
                    const email = rp.telecom?.find(t => t.system === 'email')?.value;

                    return (
                      <ListItem
                        key={rp.id}
                        sx={{
                          px: density === 'compact' ? 1 : 2,
                          py: density === 'compact' ? 0.5 : 1
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <PeopleIcon
                            color="action"
                            fontSize={density === 'compact' ? 'small' : 'medium'}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant={density === 'compact' ? 'body2' : 'body1'}>
                                {name}
                              </Typography>
                              <Chip
                                label={relationship}
                                size="small"
                                variant="outlined"
                                sx={{ borderRadius: 0 }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                              {phone && (
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary">{phone}</Typography>
                                </Box>
                              )}
                              {email && (
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary">{email}</Typography>
                                </Box>
                              )}
                              {!phone && !email && (
                                <Typography variant="caption" color="text.secondary">No contact info</Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </ClinicalResourceCard>
          </Grid>

          {/* Consent Status Section */}
          <Grid item xs={12} md={6}>
            <ClinicalResourceCard
              title="Consent Status"
              subtitle={consentsLoading ? 'Loading...' : `${consents.length} record${consents.length !== 1 ? 's' : ''}`}
              icon={<ConsentIcon />}
              severity="normal"
              actions={
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setConsentDialogOpen(true)}
                  sx={{ borderRadius: 0 }}
                >
                  Record Consent
                </Button>
              }
            >
              {consentsLoading ? (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : consentsError ? (
                <Alert severity="error" sx={{ m: 1 }}>
                  {consentsError}
                  <Button size="small" onClick={loadConsents} sx={{ ml: 1 }}>
                    Retry
                  </Button>
                </Alert>
              ) : consents.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2, textAlign: 'center' }}
                >
                  No consent records found
                </Typography>
              ) : (
                <List disablePadding>
                  {consents.map((consent) => {
                    const category = consent.category?.[0]?.coding?.[0]?.display
                      || consent.category?.[0]?.text
                      || 'Consent';
                    const status = consent.status || 'unknown';
                    const dateTime = consent.dateTime
                      ? formatClinicalDate(consent.dateTime)
                      : 'Date unknown';
                    const periodEnd = consent.provision?.period?.end
                      ? formatClinicalDate(consent.provision.period.end)
                      : null;

                    const statusColor = status === 'active'
                      ? 'success'
                      : status === 'rejected'
                        ? 'error'
                        : 'default';

                    return (
                      <ListItem
                        key={consent.id}
                        sx={{
                          px: density === 'compact' ? 1 : 2,
                          py: density === 'compact' ? 0.5 : 1
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <ConsentIcon
                            color={status === 'active' ? 'success' : status === 'rejected' ? 'error' : 'action'}
                            fontSize={density === 'compact' ? 'small' : 'medium'}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant={density === 'compact' ? 'body2' : 'body1'}>
                                {category}
                              </Typography>
                              <Chip
                                label={status}
                                size="small"
                                color={statusColor}
                                sx={{ borderRadius: 0, textTransform: 'capitalize' }}
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {dateTime}
                              {periodEnd ? ` - Expires: ${periodEnd}` : ''}
                            </Typography>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </ClinicalResourceCard>
          </Grid>
        </Grid>

        <AddRelatedPersonDialog
          open={relatedPersonDialogOpen}
          onClose={() => setRelatedPersonDialogOpen(false)}
          patientId={patientId}
          onSaved={loadRelatedPersons}
        />

        <RecordConsentDialog
          open={consentDialogOpen}
          onClose={() => setConsentDialogOpen(false)}
          patientId={patientId}
          onSaved={loadConsents}
        />

        {/* Additional Information Row */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Recent Activity
        </Typography>
        <Grid container spacing={3}>
          {/* Recent Encounters */}
          <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardHeader
                  title="Recent Visits"
                  titleTypographyProps={{ variant: 'h6' }}
                  action={
                    <IconButton 
                      size="small"
                      onClick={() => onNavigateToTab && onNavigateToTab(TAB_IDS.ENCOUNTERS)}
                    >
                      <ArrowIcon />
                    </IconButton>
                  }
                />
                <CardContent sx={{ pt: 0 }}>
                  <List disablePadding>
                    {recentEncounters.slice(0, density === 'compact' ? 3 : 4).map((encounter) => (
                      <ListItem 
                        key={encounter.id}
                        sx={{ px: 0 }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <EncounterIcon color="action" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={encounter.type?.[0]?.text || 'Encounter'}
                          secondary={
                            encounter.period?.start ?
                              formatClinicalDate(encounter.period.start) :
                              'Date unknown'
                          }
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <StatusChip 
                          status={getEncounterStatus(encounter)}
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
          </Grid>

          {/* Care Team Summary */}
          <Grid item xs={12} md={6}>
            <CareTeamSummary
              patientId={patientId}
              onViewFullTeam={() => onNavigateToTab && onNavigateToTab(TAB_IDS.CARE_PLAN)}
            />
          </Grid>
        </Grid>

        {/* Forms & Questionnaires */}
        <QuestionnairesSection patientId={patientId} />
      </Box>
    </Box>
  );
};

export default React.memo(SummaryTab);