/**
 * Edit Allergy Dialog Component
 * Allows editing existing allergies/intolerances in patient chart
 */
import React, { useState, useEffect } from 'react';
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
import { format, parseISO } from 'date-fns';
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

const CLINICAL_STATUS = [
  { value: 'active', display: 'Active' },
  { value: 'inactive', display: 'Inactive' },
  { value: 'resolved', display: 'Resolved' }
];

const VERIFICATION_STATUS = [
  { value: 'unconfirmed', display: 'Unconfirmed' },
  { value: 'confirmed', display: 'Confirmed' },
  { value: 'refuted', display: 'Refuted' },
  { value: 'entered-in-error', display: 'Entered in Error' }
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

const EditAllergyDialog = ({ open, onClose, onSave, onDelete, allergyIntolerance, patientId }) => {
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

  // Initialize form with existing allergy data
  useEffect(() => {
    if (allergyIntolerance && open) {
      const clinicalStatus = allergyIntolerance.clinicalStatus?.coding?.[0]?.code || 'active';
      const verificationStatus = allergyIntolerance.verificationStatus?.coding?.[0]?.code || 'confirmed';
      const criticality = allergyIntolerance.criticality || 'unable-to-assess';
      const type = allergyIntolerance.type || 'allergy';
      const onsetDate = allergyIntolerance.onsetDateTime ? parseISO(allergyIntolerance.onsetDateTime) : null;
      
      // Extract allergen information
      let selectedAllergen = null;
      let customAllergen = '';
      
      if (allergyIntolerance.code) {
        const allergen = allergyIntolerance.code;
        if (allergen.coding && allergen.coding.length > 0) {
          const coding = allergen.coding[0];
          selectedAllergen = {
            code: coding.code,
            display: coding.display || allergen.text,
            system: coding.system || 'http://snomed.info/sct',
            source: 'existing'
          };
        } else if (allergen.text) {
          customAllergen = allergen.text;
        }
      }

      // Extract reactions
      const reactions = allergyIntolerance.reaction?.map(r => r.manifestation?.[0]?.text || r.manifestation?.[0]?.coding?.[0]?.display).filter(Boolean) || [];
      const reactionSeverity = allergyIntolerance.reaction?.[0]?.severity || 'mild';
      
      // Extract notes
      const notes = allergyIntolerance.note?.[0]?.text || '';

      setFormData({
        selectedAllergen,
        customAllergen,
        allergyType: type,
        criticality,
        clinicalStatus,
        verificationStatus,
        onsetDate,
        reactions,
        reactionSeverity,
        notes
      });
    }
  }, [allergyIntolerance, open]);

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
      console.error('Error searching allergens:', error);
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

  const handleAddReaction = (reactionText) => {
    if (reactionText && !formData.reactions.includes(reactionText)) {
      setFormData(prev => ({
        ...prev,
        reactions: [...prev.reactions, reactionText]
      }));
    }
  };

  const handleRemoveReaction = (reactionToRemove) => {
    setFormData(prev => ({
      ...prev,
      reactions: prev.reactions.filter(r => r !== reactionToRemove)
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      // Validate required fields
      if (!formData.selectedAllergen && !formData.customAllergen) {
        setError('Please select an allergen or enter a custom allergen');
        return;
      }

      // Ensure we have the resource ID
      if (!allergyIntolerance.id) {
        setError('Cannot update allergy: missing resource ID');
        return;
      }

      // Create updated FHIR AllergyIntolerance resource
      const updatedAllergyIntolerance = {
        ...allergyIntolerance, // Preserve existing fields like id, meta, etc.
        resourceType: 'AllergyIntolerance',
        id: allergyIntolerance.id, // Explicitly set ID
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: formData.clinicalStatus,
            display: CLINICAL_STATUS.find(s => s.value === formData.clinicalStatus)?.display
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: formData.verificationStatus,
            display: VERIFICATION_STATUS.find(s => s.value === formData.verificationStatus)?.display
          }]
        },
        type: formData.allergyType,
        criticality: formData.criticality,
        code: formData.selectedAllergen ? {
          coding: [{
            system: formData.selectedAllergen.system || 'http://snomed.info/sct',
            code: formData.selectedAllergen.code,
            display: formData.selectedAllergen.display
          }],
          text: formData.selectedAllergen.display
        } : {
          text: formData.customAllergen
        },
        patient: {
          reference: `Patient/${patientId}`
        },
        ...(formData.onsetDate && {
          onsetDateTime: formData.onsetDate.toISOString()
        }),
        ...(formData.reactions.length > 0 && {
          reaction: formData.reactions.map(reaction => ({
            manifestation: [{
              text: reaction
            }],
            severity: formData.reactionSeverity
          }))
        }),
        ...(formData.notes && {
          note: [{
            text: formData.notes,
            time: new Date().toISOString()
          }]
        })
      };

      // Call the onSave callback with the updated allergy
      await onSave(updatedAllergyIntolerance);
      handleClose();
    } catch (err) {
      console.error('Error saving allergy:', err);
      // Ensure we always set a string error message
      const errorMessage = typeof err === 'string' ? err : 
                          err?.message || 
                          err?.response?.data?.message || 
                          err?.response?.data?.detail || 
                          'Failed to update allergy';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this allergy? This action cannot be undone.')) {
      try {
        setLoading(true);
        await onDelete(allergyIntolerance.id);
        handleClose();
      } catch (err) {
        console.error('Error deleting allergy:', err);
        // Ensure we always set a string error message
        const errorMessage = typeof err === 'string' ? err : 
                            err?.message || 
                            err?.response?.data?.message || 
                            err?.response?.data?.detail || 
                            'Failed to delete allergy';
        setError(errorMessage);
        setLoading(false);
      }
    }
  };

  const getAllergenDisplay = () => {
    if (formData.selectedAllergen) {
      return formData.selectedAllergen.display;
    }
    return formData.customAllergen || 'No allergen selected';
  };

  if (!allergyIntolerance) {
    return null;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '600px' }
        }}
      >
        <DialogTitle>
          Edit Allergy/Intolerance
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Allergy ID: {allergyIntolerance.id}
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Grid container spacing={3}>
              {/* Allergen Selection */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Allergen
                </Typography>
                <Autocomplete
                  options={allergenOptions}
                  getOptionLabel={(option) => option.display}
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
                      customAllergen: ''
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search for allergen"
                      placeholder="Type to search allergens..."
                      variant="outlined"
                      fullWidth
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
                          {option.category} • {option.code}
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

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Allergy Details */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Allergy Details
                </Typography>
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
                        <Box>
                          <Typography variant="body2">{level.display}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {level.description}
                          </Typography>
                        </Box>
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
                    {CLINICAL_STATUS.map(status => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.display}
                      </MenuItem>
                    ))}
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
                    {VERIFICATION_STATUS.map(status => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="Onset Date (Optional)"
                  value={formData.onsetDate}
                  onChange={(newValue) => setFormData(prev => ({
                    ...prev,
                    onsetDate: newValue
                  }))}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth />
                  )}
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
                <Divider />
              </Grid>

              {/* Reactions */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Reactions
                </Typography>
                
                <Autocomplete
                  multiple
                  freeSolo
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
                        key={index}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Reactions"
                      placeholder="Select or type reactions..."
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
                  placeholder="Additional notes about the allergy or reactions..."
                />
              </Grid>
            </Grid>

            {/* Preview */}
            {(formData.selectedAllergen || formData.customAllergen) && (
              <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Updated Allergy Preview:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {getAllergenDisplay()}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip 
                    label={formData.allergyType} 
                    size="small" 
                    color="primary"
                  />
                  <Chip 
                    label={formData.criticality} 
                    size="small" 
                    color={formData.criticality === 'high' ? 'error' : 'default'}
                  />
                  <Chip 
                    label={formData.clinicalStatus} 
                    size="small" 
                    color={formData.clinicalStatus === 'active' ? 'success' : 'default'}
                  />
                  {formData.reactions.length > 0 && (
                    <Chip 
                      label={`${formData.reactions.length} reaction${formData.reactions.length > 1 ? 's' : ''}`} 
                      size="small" 
                    />
                  )}
                </Stack>
                {formData.reactions.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Reactions: {formData.reactions.join(', ')}
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button 
            onClick={handleDelete} 
            color="error" 
            disabled={loading}
            variant="outlined"
          >
            Delete Allergy
          </Button>
          
          <Stack direction="row" spacing={1}>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              variant="contained" 
              disabled={loading || ((!formData.selectedAllergen && !formData.customAllergen))}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default EditAllergyDialog;