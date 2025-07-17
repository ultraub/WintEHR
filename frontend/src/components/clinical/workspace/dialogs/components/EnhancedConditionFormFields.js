/**
 * EnhancedConditionFormFields Component
 * Enhanced form fields for Condition resource with clinical theming
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Grid,
  Typography,
  Chip,
  Stack,
  Box,
  Paper,
  Alert,
  useTheme,
  alpha
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import ResourceSearchAutocomplete from '../../../../search/ResourceSearchAutocomplete';
import { useCatalogConditionSearch } from '../../../../../hooks/useResourceSearch';
import ClinicalTextField from '../../../common/ClinicalTextField';
import ClinicalSelect from '../../../common/ClinicalSelect';
import ClinicalCard from '../../../common/ClinicalCard';
import {
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_STATUS_OPTIONS,
  CONDITION_CATEGORIES,
  SEVERITY_OPTIONS,
  getStatusColor,
  getProblemDisplay
} from '../../../../../core/fhir/converters/ConditionConverter';
import {
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const EnhancedConditionFormFields = ({ 
  formData = {}, 
  setFormData, 
  errors = {}, 
  mode = 'add',
  disabled = false,
  clinicalContext,
  department 
}) => {
  const theme = useTheme();
  const onChangeRef = useRef();
  const conditionSearch = useCatalogConditionSearch({ enabled: true });
  
  // Create onChange function with ref to avoid stale closures
  onChangeRef.current = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Safe form data with defaults
  const safeFormData = useMemo(() => {
    return {
      selectedProblem: formData.selectedProblem || null,
      problemText: formData.problemText || '',
      clinicalStatus: formData.clinicalStatus || 'active',
      verificationStatus: formData.verificationStatus || 'confirmed',
      severity: formData.severity || '',
      onsetDate: formData.onsetDate || null,
      category: formData.category || 'problem-list-item',
      notes: formData.notes || ''
    };
  }, [formData]);

  // Determine urgency based on severity and status
  const getFormUrgency = () => {
    if (safeFormData.severity === 'severe' || safeFormData.severity === 'critical') {
      return 'high';
    }
    if (safeFormData.clinicalStatus === 'active' && safeFormData.verificationStatus === 'unconfirmed') {
      return 'medium';
    }
    return 'normal';
  };

  const formUrgency = getFormUrgency();

  // Prepare options with clinical enhancements
  const clinicalStatusOptions = CLINICAL_STATUS_OPTIONS.map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Status',
    severity: opt.value === 'active' ? 'moderate' : null
  }));

  const verificationStatusOptions = VERIFICATION_STATUS_OPTIONS.map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Verification',
    warning: opt.value === 'unconfirmed'
  }));

  const severityOptions = SEVERITY_OPTIONS.map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Severity',
    severity: opt.value
  }));

  const categoryOptions = CONDITION_CATEGORIES.map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Type'
  }));

  // Handlers
  const handleSelectedProblemChange = useCallback((event, newValue) => {
    onChangeRef.current('selectedProblem', newValue);
    onChangeRef.current('problemText', newValue ? (newValue.display || newValue.code?.text || '') : '');
  }, []);

  const handleProblemTextChange = useCallback((e) => {
    onChangeRef.current('problemText', e.target.value);
    onChangeRef.current('selectedProblem', null);
  }, []);

  return (
    <Stack spacing={3}>
      {/* Clinical Alert for High Severity */}
      {safeFormData.severity === 'severe' || safeFormData.severity === 'critical' ? (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ 
            borderLeft: `4px solid ${theme.palette.warning?.main || '#ff9800'}`,
            backgroundColor: alpha(theme.palette.warning?.main || '#ff9800', 0.05)
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            High Severity Condition
          </Typography>
          <Typography variant="caption">
            This condition will be prominently displayed in the patient's chart
          </Typography>
        </Alert>
      ) : null}

      {/* Problem Selection Section */}
      <ClinicalCard
        title="Condition Details"
        severity={safeFormData.severity}
        urgency={formUrgency}
        department={department}
        clinicalContext={clinicalContext}
        variant="clinical"
      >
        <Stack spacing={3}>
          {/* Problem Search */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Problem/Condition
            </Typography>
            <ResourceSearchAutocomplete
              label="Search for conditions"
              placeholder="Type to search conditions from dynamic catalog..."
              searchService={conditionSearch.searchService}
              resourceTypes={['Condition']}
              value={safeFormData.selectedProblem}
              onChange={handleSelectedProblemChange}
              disabled={disabled}
              error={!!errors.selectedProblem}
              helperText={errors.selectedProblem || "Search conditions from dynamic clinical catalog"}
              freeSolo={false}
              showCacheStatus={true}
              enableCache={true}
              cacheTTL={10}
              debounceMs={300}
              minQueryLength={2}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return option.display || option.display_name || option.code?.text || option.id || 'Unknown condition';
              }}
              getOptionKey={(option) => {
                if (typeof option === 'string') return option;
                const code = option.code || option.code?.coding?.[0]?.code || option.id;
                return `condition-${code}-${option.system || ''}`;
              }}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                const display = option.display || option.display_name || option.code?.text || 'Unknown condition';
                const code = option.code || option.code?.coding?.[0]?.code || option.id;
                const frequency = option.frequency || option.frequency_count || option.usage_count || 0;
                const source = option.source || option.searchSource || 'catalog';
                const system = option.system || option.code?.coding?.[0]?.system || '';
                
                let codeLabel = 'Code';
                if (system.includes('snomed')) codeLabel = 'SNOMED';
                else if (system.includes('icd-10')) codeLabel = 'ICD-10';
                
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack sx={{ width: '100%' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {display}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {code && (
                          <Chip 
                            label={`${codeLabel}: ${code}`} 
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
              sx={{
                '& .MuiAutocomplete-inputRoot': {
                  transition: theme.transitions.create(['border-color', 'box-shadow']),
                  '&:hover': {
                    borderColor: theme.palette.primary?.main || '#1976D2'
                  }
                }
              }}
            />
          </Box>

          {/* Custom Problem Text */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Or enter a custom problem description:
            </Typography>
            <ClinicalTextField
              fullWidth
              label="Custom Problem Description"
              value={safeFormData.problemText}
              onChange={handleProblemTextChange}
              placeholder="Enter problem if not found in search"
              disabled={disabled || !!safeFormData.selectedProblem}
              clinicalHint="Use this field for rare conditions or patient-specific descriptions"
              department={department}
              clinicalContext={clinicalContext}
            />
          </Box>
        </Stack>
      </ClinicalCard>

      {/* Clinical Status Section */}
      <Paper 
        sx={{ 
          p: 2, 
          backgroundColor: theme.clinical?.surfaces?.secondary || theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Clinical Information
        </Typography>
        
        <Grid container spacing={2}>
          {/* Clinical Status */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Clinical Status"
              value={safeFormData.clinicalStatus}
              onChange={(e) => onChangeRef.current('clinicalStatus', e.target.value)}
              options={clinicalStatusOptions}
              required
              disabled={disabled}
              error={!!errors.clinicalStatus}
              helperText={errors.clinicalStatus}
              showSeverityIndicators={true}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Verification Status */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Verification Status"
              value={safeFormData.verificationStatus}
              onChange={(e) => onChangeRef.current('verificationStatus', e.target.value)}
              options={verificationStatusOptions}
              disabled={disabled}
              error={!!errors.verificationStatus}
              helperText={errors.verificationStatus}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Severity */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Severity"
              value={safeFormData.severity}
              onChange={(e) => onChangeRef.current('severity', e.target.value)}
              options={severityOptions}
              disabled={disabled}
              placeholder="Select severity"
              showSeverityIndicators={true}
              department={department}
              clinicalContext={clinicalContext}
              urgency={safeFormData.severity === 'severe' || safeFormData.severity === 'critical' ? 'high' : 'normal'}
            />
          </Grid>

          {/* Category */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Category"
              value={safeFormData.category}
              onChange={(e) => onChangeRef.current('category', e.target.value)}
              options={categoryOptions}
              disabled={disabled}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Onset Date */}
          <Grid item xs={12} sm={6}>
            <DatePicker
              label="Onset Date"
              value={safeFormData.onsetDate}
              onChange={(date) => onChangeRef.current('onsetDate', date)}
              disabled={disabled}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.onsetDate,
                  helperText: errors.onsetDate || "When did this condition start?",
                  sx: {
                    '& .MuiOutlinedInput-root': {
                      transition: theme.transitions.create(['border-color', 'box-shadow']),
                      '&:hover': {
                        borderColor: theme.palette.primary?.main || '#1976D2'
                      }
                    }
                  }
                }
              }}
              maxDate={new Date()}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Notes Section */}
      <Box>
        <ClinicalTextField
          fullWidth
          multiline
          rows={3}
          label="Clinical Notes"
          value={safeFormData.notes}
          onChange={(e) => onChangeRef.current('notes', e.target.value)}
          placeholder="Additional clinical observations or notes..."
          disabled={disabled}
          clinicalHint="Include relevant history, observations, or treatment considerations"
          department={department}
          clinicalContext={clinicalContext}
          helperText="These notes will be visible to all healthcare providers"
        />
      </Box>

      {/* Clinical Summary Preview */}
      {mode === 'edit' && (safeFormData.selectedProblem || safeFormData.problemText) && (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            backgroundColor: alpha(theme.palette.info?.main || '#2196f3', 0.05),
            borderColor: theme.palette.info?.main || '#2196f3'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <InfoIcon fontSize="small" color="info" />
            <Typography variant="subtitle2" color="info.main">
              Condition Summary
            </Typography>
          </Stack>
          <Typography variant="body2">
            <strong>Problem:</strong> {getProblemDisplay(safeFormData.selectedProblem) || safeFormData.problemText}
          </Typography>
          <Typography variant="body2">
            <strong>Status:</strong> {safeFormData.clinicalStatus} ({safeFormData.verificationStatus})
            {safeFormData.severity && ` - ${safeFormData.severity}`}
          </Typography>
          {safeFormData.onsetDate && (
            <Typography variant="body2">
              <strong>Onset:</strong> {format(new Date(safeFormData.onsetDate), 'MMM dd, yyyy')}
            </Typography>
          )}
        </Paper>
      )}
    </Stack>
  );
};

export default EnhancedConditionFormFields;