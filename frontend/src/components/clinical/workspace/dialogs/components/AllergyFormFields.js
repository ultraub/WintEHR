/**
 * AllergyFormFields Component
 * Specialized form fields for AllergyIntolerance resource management
 */
import React, { useState } from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Chip,
  Stack,
  Autocomplete,
  Box,
  CircularProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { searchService } from '../../../../../services/searchService';
import {
  ALLERGY_TYPES,
  CRITICALITY_LEVELS,
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_STATUS_OPTIONS,
  REACTION_SEVERITIES,
  COMMON_REACTIONS,
  getCriticalityColor,
  getAllergenDisplay
} from '../config/allergyDialogConfig';

const AllergyFormFields = ({ formData, errors, onChange, disabled }) => {
  const [searchLoading, setSearchLoading] = useState(false);
  const [allergenOptions, setAllergenOptions] = useState([]);

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

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* Allergen Search */}
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
            disabled={disabled}
            onInputChange={(event, value) => {
              handleSearchAllergens(value);
            }}
            onChange={(event, newValue) => {
              onChange('selectedAllergen', newValue);
              onChange('customAllergen', newValue ? newValue.display : formData.customAllergen);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search for allergens"
                placeholder="Type to search allergens..."
                variant="outlined"
                error={!!errors.allergen}
                helperText={errors.allergen}
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
              searchLoading ? "Searching..." : "No allergens found"
            }
          />
        </Grid>

        {/* Custom Allergen */}
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Or enter a custom allergen:
          </Typography>
          <TextField
            fullWidth
            label="Custom Allergen"
            value={formData.customAllergen}
            onChange={(e) => {
              onChange('customAllergen', e.target.value);
              onChange('selectedAllergen', null);
            }}
            variant="outlined"
            disabled={disabled}
            error={!!errors.allergen}
            helperText={errors.allergen || "Enter an allergen not found in the search results"}
          />
        </Grid>

        {/* Type and Criticality */}
        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.allergyType}>
            <InputLabel>Type</InputLabel>
            <Select
              value={formData.allergyType}
              label="Type"
              disabled={disabled}
              onChange={(e) => onChange('allergyType', e.target.value)}
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
          <FormControl fullWidth error={!!errors.criticality}>
            <InputLabel>Criticality</InputLabel>
            <Select
              value={formData.criticality}
              label="Criticality"
              disabled={disabled}
              onChange={(e) => onChange('criticality', e.target.value)}
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

        {/* Clinical Status and Verification Status */}
        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.clinicalStatus}>
            <InputLabel>Clinical Status</InputLabel>
            <Select
              value={formData.clinicalStatus}
              label="Clinical Status"
              disabled={disabled}
              onChange={(e) => onChange('clinicalStatus', e.target.value)}
            >
              {CLINICAL_STATUS_OPTIONS.map(status => (
                <MenuItem key={status.value} value={status.value}>
                  {status.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.verificationStatus}>
            <InputLabel>Verification Status</InputLabel>
            <Select
              value={formData.verificationStatus}
              label="Verification Status"
              disabled={disabled}
              onChange={(e) => onChange('verificationStatus', e.target.value)}
            >
              {VERIFICATION_STATUS_OPTIONS.map(status => (
                <MenuItem key={status.value} value={status.value}>
                  {status.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Onset Date and Reaction Severity */}
        <Grid item xs={6}>
          <DatePicker
            label="Onset Date"
            value={formData.onsetDate}
            disabled={disabled}
            onChange={(newValue) => onChange('onsetDate', newValue)}
            slotProps={{
              textField: { 
                fullWidth: true,
                error: !!errors.onsetDate,
                helperText: errors.onsetDate
              }
            }}
            maxDate={new Date()}
          />
        </Grid>

        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.reactionSeverity}>
            <InputLabel>Reaction Severity</InputLabel>
            <Select
              value={formData.reactionSeverity}
              label="Reaction Severity"
              disabled={disabled}
              onChange={(e) => onChange('reactionSeverity', e.target.value)}
            >
              {REACTION_SEVERITIES.map(severity => (
                <MenuItem key={severity.value} value={severity.value}>
                  {severity.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Reactions/Manifestations */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Reactions/Manifestations
          </Typography>
          <Autocomplete
            multiple
            freeSolo
            options={COMMON_REACTIONS}
            disabled={disabled}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.text || option.display || 'Unknown';
            }}
            value={formData.reactions}
            onChange={(event, newValue) => onChange('reactions', newValue)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={typeof option === 'string' ? option : option?.text || option?.display || 'Unknown'}
                  {...getTagProps({ index })}
                  key={index}
                />
              ))
            }
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Stack>
                  <Typography variant="body2">
                    {typeof option === 'string' ? option : option.text || option.display}
                  </Typography>
                  {typeof option === 'object' && option.code && (
                    <Typography variant="caption" color="text.secondary">
                      SNOMED: {option.code} - {option.display}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select reactions"
                placeholder="Add reactions..."
                variant="outlined"
                error={!!errors.reactions}
                helperText={errors.reactions}
              />
            )}
          />
        </Grid>

        {/* Additional Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Additional Notes"
            value={formData.notes}
            disabled={disabled}
            onChange={(e) => onChange('notes', e.target.value)}
            variant="outlined"
            multiline
            rows={3}
            error={!!errors.notes}
            helperText={errors.notes}
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
              {getAllergenDisplay(formData)}
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
                <Chip 
                  key={index} 
                  label={typeof reaction === 'string' ? reaction : reaction?.text || reaction?.display || 'Unknown'} 
                  size="small" 
                  variant="outlined" 
                />
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
  );
};

export default AllergyFormFields;