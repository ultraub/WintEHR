/**
 * Add Allergy Dialog Component
 * Allows adding new allergies/intolerances to patient chart
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Chip,
  Stack,
  Autocomplete,
  Box,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { searchService } from '../../../../services/searchService';

const ALLERGY_TYPES = [
  { value: 'allergy', display: 'Allergy' },
  { value: 'intolerance', display: 'Intolerance' }
];

const CRITICALITY_LEVELS = [
  { value: 'low', display: 'Low', description: 'Unlikely to cause life-threatening reactions' },
  { value: 'high', display: 'High', description: 'May cause life-threatening reactions' },
  { value: 'unable-to-assess', display: 'Unable to assess', description: 'Unable to assess criticality' }
];

const REACTION_SEVERITIES = [
  { value: 'mild', display: 'Mild' },
  { value: 'moderate', display: 'Moderate' },
  { value: 'severe', display: 'Severe' }
];

const COMMON_REACTIONS = [
  'Rash', 'Hives', 'Itching', 'Swelling', 'Difficulty breathing', 
  'Wheezing', 'Nausea', 'Vomiting', 'Diarrhea', 'Anaphylaxis',
  'Runny nose', 'Sneezing', 'Watery eyes', 'Cough'
];

const AddAllergyDialog = ({ open, onClose, onAdd, patientId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [allergenOptions, setAllergenOptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    selectedAllergen: null,
    customAllergen: '',
    allergyType: 'allergy',
    criticality: 'unable-to-assess',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    onsetDate: null,
    reactions: [],
    reactionSeverity: 'mild',
    notes: ''
  });

  // Search for allergens as user types
  const handleSearchAllergens = async (query, category = null) => {
    if (!query || query.length < 2) {
      setAllergenOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchService.searchAllergens(query, category);
      setAllergenOptions(results);
    } catch (error) {
      
      setAllergenOptions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      selectedAllergen: null,
      customAllergen: '',
      allergyType: 'allergy',
      criticality: 'unable-to-assess',
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      onsetDate: null,
      reactions: [],
      reactionSeverity: 'mild',
      notes: ''
    });
    setError('');
    setAllergenOptions([]);
    setSearchQuery('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      // Validate required fields
      if (!formData.selectedAllergen && !formData.customAllergen) {
        setError('Please specify an allergen or select from the list');
        return;
      }

      // Create FHIR AllergyIntolerance resource
      const allergyIntolerance = {
        resourceType: 'AllergyIntolerance',
        id: `allergy-${Date.now()}`,
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: formData.clinicalStatus,
            display: formData.clinicalStatus
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: formData.verificationStatus,
            display: formData.verificationStatus
          }]
        },
        type: formData.allergyType,
        criticality: formData.criticality,
        code: formData.selectedAllergen ? {
          coding: [{
            system: formData.selectedAllergen.code.startsWith('RXNORM') 
              ? 'http://www.nlm.nih.gov/research/umls/rxnorm'
              : 'http://snomed.info/sct',
            code: formData.selectedAllergen.code.replace(/^(RXNORM|SNOMED):/, ''),
            display: formData.selectedAllergen.display
          }],
          text: formData.selectedAllergen.display
        } : {
          text: formData.customAllergen
        },
        patient: {
          reference: `Patient/${patientId}`
        },
        recordedDate: new Date().toISOString(),
        ...(formData.onsetDate && {
          onsetDateTime: formData.onsetDate.toISOString()
        }),
        ...(formData.reactions.length > 0 && {
          reaction: [{
            manifestation: formData.reactions.map(reaction => ({
              coding: [{
                system: 'http://snomed.info/sct',
                display: reaction
              }],
              text: reaction
            })),
            severity: formData.reactionSeverity
          }]
        }),
        ...(formData.notes && {
          note: [{
            text: formData.notes,
            time: new Date().toISOString()
          }]
        })
      };

      // Call the onAdd callback with the new allergy
      await onAdd(allergyIntolerance);
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to add allergy');
    } finally {
      setLoading(false);
    }
  };

  const getCriticalityColor = (criticality) => {
    switch (criticality) {
      case 'high': return 'error';
      case 'low': return 'warning';
      default: return 'default';
    }
  };

  const getAllergenDisplay = () => {
    if (formData.selectedAllergen) {
      return formData.selectedAllergen.display;
    }
    return formData.customAllergen || 'No allergen selected';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '650px' }
        }}
      >
        <DialogTitle>Add New Allergy/Intolerance</DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Allergen
                </Typography>
                <Autocomplete
                  options={allergenOptions}
                  getOptionLabel={(option) => option.display}
                  groupBy={(option) => option.category}
                  value={formData.selectedAllergen}
                  loading={searchLoading}
                  onInputChange={(event, value) => {
                    setSearchQuery(value);
                    handleSearchAllergens(value);
                  }}
                  onChange={(event, newValue) => {
                    setFormData(prev => ({
                      ...prev,
                      selectedAllergen: newValue,
                      customAllergen: newValue ? newValue.display : prev.customAllergen
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search for allergens"
                      placeholder="Type to search allergens..."
                      variant="outlined"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack>
                        <Typography variant="body2">{option.display}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.category} • {option.code} • Source: {option.source}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  noOptionsText={
                    searchQuery.length < 2 ? 
                    "Type at least 2 characters to search" : 
                    searchLoading ? "Searching..." : "No allergens found"
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Or enter a custom allergen:
                </Typography>
                <TextField
                  fullWidth
                  label="Custom Allergen"
                  value={formData.customAllergen}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    customAllergen: e.target.value,
                    selectedAllergen: null
                  }))}
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={formData.allergyType}
                    label="Type"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      allergyType: e.target.value
                    }))}
                  >
                    {ALLERGY_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Criticality</InputLabel>
                  <Select
                    value={formData.criticality}
                    label="Criticality"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      criticality: e.target.value
                    }))}
                  >
                    {CRITICALITY_LEVELS.map(level => (
                      <MenuItem key={level.value} value={level.value}>
                        <Stack>
                          <Typography variant="body2">{level.display}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {level.description}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Clinical Status</InputLabel>
                  <Select
                    value={formData.clinicalStatus}
                    label="Clinical Status"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      clinicalStatus: e.target.value
                    }))}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Verification Status</InputLabel>
                  <Select
                    value={formData.verificationStatus}
                    label="Verification Status"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      verificationStatus: e.target.value
                    }))}
                  >
                    <MenuItem value="confirmed">Confirmed</MenuItem>
                    <MenuItem value="unconfirmed">Unconfirmed</MenuItem>
                    <MenuItem value="presumed">Presumed</MenuItem>
                    <MenuItem value="entered-in-error">Entered in Error</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="Onset Date"
                  value={formData.onsetDate}
                  onChange={(newValue) => setFormData(prev => ({
                    ...prev,
                    onsetDate: newValue
                  }))}
                  slotProps={{
                    textField: { fullWidth: true }
                  }}
                  maxDate={new Date()}
                />
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Reaction Severity</InputLabel>
                  <Select
                    value={formData.reactionSeverity}
                    label="Reaction Severity"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      reactionSeverity: e.target.value
                    }))}
                  >
                    {REACTION_SEVERITIES.map(severity => (
                      <MenuItem key={severity.value} value={severity.value}>
                        {severity.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Reactions/Manifestations
                </Typography>
                <Autocomplete
                  multiple
                  options={COMMON_REACTIONS}
                  value={formData.reactions}
                  onChange={(event, newValue) => {
                    setFormData(prev => ({
                      ...prev,
                      reactions: newValue
                    }));
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select reactions"
                      placeholder="Add reactions..."
                      variant="outlined"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Additional Notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  variant="outlined"
                  multiline
                  rows={3}
                  placeholder="Additional information about this allergy..."
                />
              </Grid>
            </Grid>

            {/* Preview */}
            {(formData.selectedAllergen || formData.customAllergen) && (
              <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview:
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {getAllergenDisplay()}
                  </Typography>
                  <Chip 
                    label={formData.allergyType} 
                    size="small" 
                    variant="outlined"
                  />
                  <Chip 
                    label={formData.criticality} 
                    size="small" 
                    color={getCriticalityColor(formData.criticality)}
                  />
                  <Chip 
                    label={formData.clinicalStatus} 
                    size="small" 
                    color={formData.clinicalStatus === 'active' ? 'warning' : 'default'}
                  />
                </Stack>
                {formData.reactions.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                      Reactions:
                    </Typography>
                    {formData.reactions.map((reaction, index) => (
                      <Chip key={index} label={reaction} size="small" variant="outlined" />
                    ))}
                  </Stack>
                )}
                {formData.onsetDate && (
                  <Typography variant="caption" color="text.secondary">
                    Onset: {format(formData.onsetDate, 'MMM d, yyyy')}
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading || (!formData.selectedAllergen && !formData.customAllergen)}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Adding...' : 'Add Allergy'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AddAllergyDialog;