/**
 * AllergyFormFields Component
 * Enhanced allergy form with clinical context awareness and safety features
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Grid,
  Typography,
  Chip,
  Stack,
  Box,
  Paper,
  Alert,
  useTheme,
  alpha,
  FormControlLabel,
  Checkbox,
  IconButton
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  LocalHospital as HospitalIcon,
  Error as ErrorIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import ResourceSearchAutocomplete from '../../../../search/ResourceSearchAutocomplete';
import { searchService } from '../../../../../services/searchService';
import ClinicalTextField from '../../../common/ClinicalTextField';
import ClinicalSelect from '../../../common/ClinicalSelect';
import { ClinicalResourceCard } from '../../../shared/cards';
import {
  ALLERGY_TYPES,
  CRITICALITY_LEVELS,
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_STATUS_OPTIONS,
  REACTION_SEVERITIES,
  COMMON_REACTIONS,
  getCriticalityColor,
  getAllergenDisplay
} from '../../../../../core/fhir/converters/AllergyConverter';

const AllergyFormFields = ({ 
  formData = {}, 
  errors = {}, 
  onChange, 
  disabled,
  clinicalContext,
  department,
  mode = 'add' 
}) => {
  const theme = useTheme();
  // Create search service for allergens
  const allergySearchService = {
    searchResources: async (query, options = {}) => {
      if (!query || query.length < 2) return [];
      try {
        const results = await searchService.searchAllergens(query);
        return results || [];
      } catch (error) {
        // Allergen search error - returning empty results
        return [];
      }
    }
  };
  
  // Safe form data with defaults
  const safeFormData = useMemo(() => ({
    selectedAllergen: formData.selectedAllergen || null,
    customAllergen: formData.customAllergen || '',
    allergyType: formData.allergyType || 'allergy',
    criticality: formData.criticality || 'unable-to-assess',
    clinicalStatus: formData.clinicalStatus || 'active',
    verificationStatus: formData.verificationStatus || 'confirmed',
    onsetDate: formData.onsetDate || null,
    reactions: formData.reactions || [],
    reactionSeverity: formData.reactionSeverity || 'mild',
    notes: formData.notes || ''
  }), [formData]);

  // Determine urgency based on criticality
  const getFormUrgency = () => {
    if (safeFormData.criticality === 'high') {
      return 'urgent';
    }
    if (safeFormData.criticality === 'low' && safeFormData.clinicalStatus === 'active') {
      return 'high';
    }
    return 'normal';
  };

  const formUrgency = getFormUrgency();

  // Prepare enhanced options with safe defaults
  const allergyTypeOptions = (ALLERGY_TYPES || []).map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Type'
  }));

  const criticalityOptions = (CRITICALITY_LEVELS || []).map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Criticality',
    severity: opt.value === 'high' ? 'critical' : opt.value === 'low' ? 'moderate' : null
  }));

  const clinicalStatusOptions = (CLINICAL_STATUS_OPTIONS || []).map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Status'
  }));

  const verificationStatusOptions = (VERIFICATION_STATUS_OPTIONS || []).map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Verification',
    warning: opt.value === 'unconfirmed' || opt.value === 'refuted'
  }));

  const severityOptions = (REACTION_SEVERITIES || []).map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Severity',
    severity: opt.value === 'severe' ? 'critical' : opt.value === 'moderate' ? 'moderate' : null
  }));

  const commonReactionOptions = (COMMON_REACTIONS || []).map(reaction => ({
    value: reaction,
    label: reaction
  }));

  // Handle allergen selection
  const handleAllergenChange = useCallback((event, newValue) => {
    onChange('selectedAllergen', newValue);
    onChange('customAllergen', newValue ? (newValue.display || newValue.code?.text || '') : safeFormData.customAllergen);
  }, [onChange, safeFormData.customAllergen]);

  // Handle reaction management
  const handleAddReaction = useCallback(() => {
    const newReactions = [...safeFormData.reactions, ''];
    onChange('reactions', newReactions);
  }, [onChange, safeFormData.reactions]);

  const handleRemoveReaction = useCallback((index) => {
    const newReactions = safeFormData.reactions.filter((_, i) => i !== index);
    onChange('reactions', newReactions);
  }, [onChange, safeFormData.reactions]);

  const handleReactionChange = useCallback((index, value) => {
    const newReactions = [...safeFormData.reactions];
    newReactions[index] = value;
    onChange('reactions', newReactions);
  }, [onChange, safeFormData.reactions]);

  // Get criticality color safely
  const getCriticalityColorSafe = (criticality) => {
    const colors = {
      high: theme.palette.error?.main || '#f44336',
      low: theme.palette.warning?.main || '#ff9800',
      'unable-to-assess': theme.palette.grey?.[500] || '#9e9e9e'
    };
    return colors[criticality] || theme.palette.grey?.[500] || '#9e9e9e';
  };

  return (
    <Stack spacing={3}>
      {/* Criticality Alert */}
      {safeFormData.criticality === 'high' && (
        <Alert 
          severity="error" 
          icon={<ErrorIcon />}
          sx={{ 
            borderLeft: `4px solid ${theme.palette.error?.main || '#f44336'}`,
            backgroundColor: alpha(theme.palette.error?.main || '#f44336', 0.05)
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            High Criticality Allergy
          </Typography>
          <Typography variant="caption">
            This allergy poses a significant risk to the patient and will be prominently displayed
          </Typography>
        </Alert>
      )}

      {/* Allergen Selection */}
      <ClinicalResourceCard
        title="Allergen Information"
        icon={<HospitalIcon />}
        urgency={formUrgency}
        department={department}
        clinicalContext={clinicalContext}
        variant="clinical"
      >
        <Stack spacing={3}>
          {/* Allergen Search */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Allergen
            </Typography>
            <ResourceSearchAutocomplete
              label="Search for allergens"
              placeholder="Type to search allergens from dynamic catalog..."
              searchService={allergySearchService}
              resourceTypes={['AllergyIntolerance']}
              value={safeFormData.selectedAllergen}
              onChange={handleAllergenChange}
              disabled={disabled}
              error={!!errors.selectedAllergen}
              helperText={errors.selectedAllergen || "Search allergens from clinical catalog"}
              freeSolo={false}
              showCacheStatus={true}
              enableCache={true}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                const display = getAllergenDisplay(option) || 'Unknown allergen';
                const code = option.code || option.code?.coding?.[0]?.code || '';
                const frequency = option.frequency || option.usage_count || 0;
                const source = option.source || option.searchSource || 'catalog';
                
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack sx={{ width: '100%' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {display}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {code && (
                          <Chip 
                            label={`Code: ${code}`} 
                            size="small" 
                            variant="outlined"
                            color="primary"
                          />
                        )}
                        {frequency > 0 && (
                          <Chip 
                            label={`Freq: ${frequency}`} 
                            size="small" 
                            variant="outlined"
                            color="secondary"
                          />
                        )}
                        <Chip 
                          label={source} 
                          size="small" 
                          variant="outlined"
                          color={source === 'catalog' ? 'success' : 'default'}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                );
              }}
            />
          </Box>

          {/* Custom Allergen */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Or enter a custom allergen:
            </Typography>
            <ClinicalTextField
              fullWidth
              label="Custom Allergen"
              value={safeFormData.customAllergen}
              onChange={(e) => {
                onChange('customAllergen', e.target.value);
                onChange('selectedAllergen', null);
              }}
              placeholder="Enter allergen if not found in search"
              disabled={disabled || !!safeFormData.selectedAllergen}
              clinicalHint="Use for rare allergens or specific formulations"
              department={department}
              clinicalContext={clinicalContext}
            />
          </Box>
        </Stack>
      </ClinicalResourceCard>

      {/* Clinical Details */}
      <Paper 
        sx={{ 
          p: 2, 
          backgroundColor: theme.clinical?.surfaces?.secondary || theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Clinical Details
        </Typography>
        
        <Grid container spacing={2}>
          {/* Allergy Type */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Type"
              value={safeFormData.allergyType}
              onChange={(e) => onChange('allergyType', e.target.value)}
              options={allergyTypeOptions}
              required
              disabled={disabled}
              error={!!errors.allergyType}
              helperText={errors.allergyType}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Criticality */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Criticality"
              value={safeFormData.criticality}
              onChange={(e) => onChange('criticality', e.target.value)}
              options={criticalityOptions}
              required
              disabled={disabled}
              error={!!errors.criticality}
              helperText={errors.criticality}
              showSeverityIndicators={true}
              department={department}
              clinicalContext={clinicalContext}
              urgency={safeFormData.criticality === 'high' ? 'urgent' : 'normal'}
            />
          </Grid>

          {/* Clinical Status */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Clinical Status"
              value={safeFormData.clinicalStatus}
              onChange={(e) => onChange('clinicalStatus', e.target.value)}
              options={clinicalStatusOptions}
              disabled={disabled}
              error={!!errors.clinicalStatus}
              helperText={errors.clinicalStatus}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Verification Status */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Verification Status"
              value={safeFormData.verificationStatus}
              onChange={(e) => onChange('verificationStatus', e.target.value)}
              options={verificationStatusOptions}
              disabled={disabled}
              error={!!errors.verificationStatus}
              helperText={errors.verificationStatus}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Onset Date */}
          <Grid item xs={12} sm={6}>
            <DatePicker
              label="Onset Date"
              value={safeFormData.onsetDate}
              onChange={(date) => onChange('onsetDate', date)}
              disabled={disabled}
              maxDate={new Date()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.onsetDate,
                  helperText: errors.onsetDate || "When was this allergy first identified?"
                }
              }}
            />
          </Grid>

          {/* Reaction Severity */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Typical Reaction Severity"
              value={safeFormData.reactionSeverity}
              onChange={(e) => onChange('reactionSeverity', e.target.value)}
              options={severityOptions}
              disabled={disabled}
              showSeverityIndicators={true}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Reactions */}
      <Paper 
        sx={{ 
          p: 2, 
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Reactions & Manifestations
          </Typography>
          <IconButton
            size="small"
            onClick={handleAddReaction}
            disabled={disabled}
            sx={{ color: theme.palette.primary?.main || '#1976D2' }}
          >
            <AddIcon />
          </IconButton>
        </Stack>
        
        {safeFormData.reactions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No reactions documented. Click + to add reactions.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {safeFormData.reactions.map((reaction, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <ClinicalTextField
                  fullWidth
                  label={`Reaction ${index + 1}`}
                  value={reaction}
                  onChange={(e) => handleReactionChange(index, e.target.value)}
                  disabled={disabled}
                  placeholder="Enter reaction (e.g., rash, anaphylaxis, nausea)"
                  department={department}
                  clinicalContext={clinicalContext}
                />
                <IconButton
                  size="small"
                  onClick={() => handleRemoveReaction(index)}
                  disabled={disabled}
                  sx={{ color: theme.palette.error?.main || '#f44336' }}
                >
                  <RemoveIcon />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Notes */}
      <ClinicalTextField
        fullWidth
        multiline
        rows={3}
        label="Additional Notes"
        value={safeFormData.notes}
        onChange={(e) => onChange('notes', e.target.value)}
        placeholder="Additional clinical observations or patient-reported information..."
        disabled={disabled}
        helperText="Include any relevant history or specific triggers"
        department={department}
        clinicalContext={clinicalContext}
      />

      {/* Allergy Summary */}
      {(safeFormData.selectedAllergen || safeFormData.customAllergen) && (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            backgroundColor: alpha(getCriticalityColorSafe(safeFormData.criticality), 0.05),
            borderColor: getCriticalityColorSafe(safeFormData.criticality)
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <WarningIcon fontSize="small" sx={{ color: getCriticalityColorSafe(safeFormData.criticality) }} />
            <Typography 
              variant="subtitle2" 
              sx={{ color: getCriticalityColorSafe(safeFormData.criticality) }}
            >
              Allergy Summary
            </Typography>
          </Stack>
          <Typography variant="body2">
            <strong>Allergen:</strong> {getAllergenDisplay(safeFormData.selectedAllergen) || safeFormData.customAllergen}
          </Typography>
          <Typography variant="body2">
            <strong>Type:</strong> {safeFormData.allergyType} - {safeFormData.criticality} criticality
          </Typography>
          {safeFormData.reactions.length > 0 && (
            <Typography variant="body2">
              <strong>Reactions:</strong> {safeFormData.reactions.filter(r => r).join(', ')}
            </Typography>
          )}
          <Typography variant="body2">
            <strong>Status:</strong> {safeFormData.clinicalStatus} ({safeFormData.verificationStatus})
          </Typography>
        </Paper>
      )}
    </Stack>
  );
};

export default AllergyFormFields;