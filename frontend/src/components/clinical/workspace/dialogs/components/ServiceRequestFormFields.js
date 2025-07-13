/**
 * ServiceRequestFormFields Component
 * Specialized form fields for ServiceRequest resource management
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
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Divider,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { format } from 'date-fns';
import {
  SERVICE_REQUEST_STATUS_OPTIONS,
  SERVICE_REQUEST_INTENT_OPTIONS,
  SERVICE_REQUEST_PRIORITY_OPTIONS,
  ORDER_CATEGORIES,
  COMMON_LAB_TESTS,
  COMMON_IMAGING_STUDIES,
  getStatusColor,
  getPriorityColor,
  getCategoryIcon,
  getTestDisplay,
  getTestsForCategory,
  validateClinicalAppropriateness
} from '../config/serviceRequestDialogConfig';

const ServiceRequestFormFields = ({ formData = {}, errors = {}, onChange, disabled, patientConditions = [], recentOrders = [] }) => {
  const [searchLoading, setSearchLoading] = useState(false);
  const [testOptions, setTestOptions] = useState([]);
  const [clinicalWarnings, setClinicalWarnings] = useState([]);

  // Provide safe defaults for form data to prevent undefined values
  const safeFormData = {
    selectedTest: formData.selectedTest || null,
    customTest: formData.customTest || '',
    category: formData.category || 'laboratory',
    priority: formData.priority || 'routine',
    status: formData.status || 'active',
    intent: formData.intent || 'order',
    indication: formData.indication || '',
    notes: formData.notes || '',
    scheduledDate: formData.scheduledDate || null,
    fastingRequired: formData.fastingRequired || false,
    urgentContact: formData.urgentContact || false,
    providerPin: formData.providerPin || ''
  };

  // Update test options when category changes
  React.useEffect(() => {
    const categoryTests = getTestsForCategory(safeFormData.category);
    setTestOptions(categoryTests);
    
    // Clear selected test if it doesn't match new category
    if (safeFormData.selectedTest && 
        safeFormData.selectedTest.category !== safeFormData.category) {
      onChange('selectedTest', null);
    }
  }, [safeFormData.category]);

  // Initialize options with existing test if in edit mode
  React.useEffect(() => {
    if (safeFormData.selectedTest && testOptions.length === 0) {
      setTestOptions([safeFormData.selectedTest]);
    }
  }, [safeFormData.selectedTest]);

  // Run clinical validation when test or other key fields change
  React.useEffect(() => {
    if (safeFormData.selectedTest || safeFormData.customTest) {
      const warnings = validateClinicalAppropriateness(safeFormData, patientConditions, recentOrders);
      setClinicalWarnings(warnings);
    }
  }, [safeFormData.selectedTest, safeFormData.customTest, safeFormData.fastingRequired]);

  // Handle category change
  const handleCategoryChange = (newCategory) => {
    onChange('category', newCategory);
    onChange('selectedTest', null); // Clear test selection
    onChange('customTest', ''); // Clear custom test
  };

  // Handle test selection
  const handleTestSelection = (newTest) => {
    onChange('selectedTest', newTest);
    if (newTest) {
      onChange('customTest', ''); // Clear custom test when selecting from list
    }
  };

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* Category Selection */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Order Category
          </Typography>
          <Grid container spacing={1}>
            {ORDER_CATEGORIES.map(category => (
              <Grid item key={category.value}>
                <Card 
                  variant={safeFormData.category === category.value ? "elevation" : "outlined"}
                  sx={{ 
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    bgcolor: safeFormData.category === category.value ? 'primary.light' : 'background.paper',
                    color: safeFormData.category === category.value ? 'primary.contrastText' : 'text.primary'
                  }}
                  onClick={() => !disabled && handleCategoryChange(category.value)}
                >
                  <CardContent sx={{ textAlign: 'center', py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                    <Typography variant="h4" component="div" sx={{ mb: 0.5 }}>
                      {getCategoryIcon(category.value)}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {category.display}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Test/Procedure Search */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            {safeFormData.category === 'laboratory' ? 'Laboratory Test' : 
             safeFormData.category === 'imaging' ? 'Imaging Study' : 
             'Test/Procedure'}
          </Typography>
          <Autocomplete
            options={testOptions}
            getOptionLabel={(option) => option.display}
            groupBy={(option) => option.category}
            value={safeFormData.selectedTest}
            loading={searchLoading}
            disabled={disabled}
            isOptionEqualToValue={(option, value) => {
              if (!option || !value) return false;
              return option.code === value.code && option.system === value.system;
            }}
            onChange={(event, newValue) => handleTestSelection(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={`Search ${safeFormData.category} tests`}
                placeholder="Type to search or select from common tests..."
                variant="outlined"
                error={!!errors.selectedTest}
                helperText={errors.selectedTest}
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
                    Code: {option.code} • Category: {option.category}
                  </Typography>
                </Stack>
              </Box>
            )}
            noOptionsText="No tests found for this category"
          />
        </Grid>

        {/* Custom Test/Procedure */}
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Or enter a custom test/procedure:
          </Typography>
          <TextField
            fullWidth
            label="Custom Test/Procedure"
            value={safeFormData.customTest}
            onChange={(e) => {
              onChange('customTest', e.target.value);
              onChange('selectedTest', null);
            }}
            variant="outlined"
            disabled={disabled}
            error={!!errors.customTest}
            helperText={errors.customTest || "Enter a test not found in the standard catalog"}
          />
        </Grid>

        <Grid item xs={12}>
          <Divider>
            <Typography variant="caption" color="text.secondary">
              Order Details
            </Typography>
          </Divider>
        </Grid>

        {/* Status, Intent, Priority */}
        <Grid item xs={4}>
          <FormControl fullWidth error={!!errors.status}>
            <InputLabel>Status</InputLabel>
            <Select
              value={safeFormData.status}
              label="Status"
              disabled={disabled}
              onChange={(e) => onChange('status', e.target.value)}
              required
            >
              {SERVICE_REQUEST_STATUS_OPTIONS.map(status => (
                <MenuItem key={status.value} value={status.value}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2">{status.display}</Typography>
                    <Chip 
                      size="small" 
                      label={status.value} 
                      color={getStatusColor(status.value)}
                      variant="outlined"
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={4}>
          <FormControl fullWidth error={!!errors.intent}>
            <InputLabel>Intent</InputLabel>
            <Select
              value={safeFormData.intent}
              label="Intent"
              disabled={disabled}
              onChange={(e) => onChange('intent', e.target.value)}
              required
            >
              {SERVICE_REQUEST_INTENT_OPTIONS.map(intent => (
                <MenuItem key={intent.value} value={intent.value}>
                  {intent.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={4}>
          <FormControl fullWidth error={!!errors.priority}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={safeFormData.priority}
              label="Priority"
              disabled={disabled}
              onChange={(e) => onChange('priority', e.target.value)}
              required
            >
              {SERVICE_REQUEST_PRIORITY_OPTIONS.map(priority => (
                <MenuItem key={priority.value} value={priority.value}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2">{priority.display}</Typography>
                    <Chip 
                      size="small" 
                      label={priority.value} 
                      color={getPriorityColor(priority.value)}
                      variant="outlined"
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Clinical Indication */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Clinical Indication"
            value={safeFormData.indication}
            onChange={(e) => onChange('indication', e.target.value)}
            variant="outlined"
            disabled={disabled}
            error={!!errors.indication}
            helperText={errors.indication || "Why is this test/procedure being ordered?"}
            placeholder="e.g., Rule out diabetes, Follow-up abnormal cholesterol..."
            required
            multiline
            rows={2}
          />
        </Grid>

        {/* Scheduled Date */}
        <Grid item xs={12}>
          <DateTimePicker
            label="Scheduled Date/Time (Optional)"
            value={safeFormData.scheduledDate}
            disabled={disabled}
            onChange={(newValue) => onChange('scheduledDate', newValue)}
            slotProps={{
              textField: { 
                fullWidth: true,
                error: !!errors.scheduledDate,
                helperText: errors.scheduledDate || "When should this test/procedure be performed?"
              }
            }}
            minDateTime={new Date()}
          />
        </Grid>

        {/* Special Requirements */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Special Requirements
          </Typography>
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={safeFormData.fastingRequired}
                  onChange={(e) => onChange('fastingRequired', e.target.checked)}
                  disabled={disabled}
                />
              }
              label="Fasting required"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={safeFormData.urgentContact}
                  onChange={(e) => onChange('urgentContact', e.target.checked)}
                  disabled={disabled}
                />
              }
              label="Contact provider urgently with results"
            />
          </Stack>
        </Grid>

        {/* Additional Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Additional Notes"
            value={safeFormData.notes}
            disabled={disabled}
            onChange={(e) => onChange('notes', e.target.value)}
            variant="outlined"
            multiline
            rows={3}
            error={!!errors.notes}
            helperText={errors.notes || "Additional instructions or clinical context"}
            placeholder="Special instructions, patient preparation, clinical context..."
          />
        </Grid>

        {/* Provider PIN (for authorization) */}
        {safeFormData.status === 'active' && (
          <Grid item xs={12}>
            <Divider>
              <Typography variant="caption" color="text.secondary">
                Authorization Required
              </Typography>
            </Divider>
            <TextField
              fullWidth
              label="Provider PIN"
              type="password"
              value={safeFormData.providerPin}
              onChange={(e) => onChange('providerPin', e.target.value)}
              variant="outlined"
              disabled={disabled}
              error={!!errors.providerPin}
              helperText={errors.providerPin || "PIN required to authorize active orders"}
              placeholder="Enter your 4-digit PIN"
              required
              sx={{ mt: 2 }}
            />
          </Grid>
        )}
      </Grid>

      {/* Clinical Warnings */}
      {clinicalWarnings.length > 0 && (
        <Stack spacing={1}>
          {clinicalWarnings.map((warning, index) => (
            <Alert 
              key={index} 
              severity={warning.severity} 
              variant="outlined"
            >
              {warning.message}
            </Alert>
          ))}
        </Stack>
      )}

      {/* Order Preview */}
      {(safeFormData.selectedTest || safeFormData.customTest) && safeFormData.indication && (
        <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Order Preview:
          </Typography>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" component="span">
                {getCategoryIcon(safeFormData.category)}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {getTestDisplay(safeFormData)}
              </Typography>
              <Chip 
                label={safeFormData.status} 
                size="small" 
                color={getStatusColor(safeFormData.status)}
              />
              <Chip 
                label={safeFormData.priority} 
                size="small" 
                color={getPriorityColor(safeFormData.priority)}
                variant="outlined"
              />
            </Stack>
            
            <Typography variant="body2">
              <strong>Category:</strong> {ORDER_CATEGORIES.find(c => c.value === safeFormData.category)?.display}
            </Typography>
            
            <Typography variant="body2">
              <strong>Indication:</strong> {safeFormData.indication}
            </Typography>
            
            {safeFormData.scheduledDate && (
              <Typography variant="body2">
                <strong>Scheduled:</strong> {format(safeFormData.scheduledDate, 'MMM d, yyyy h:mm a')}
              </Typography>
            )}
            
            {(safeFormData.fastingRequired || safeFormData.urgentContact) && (
              <Typography variant="body2">
                <strong>Special Requirements:</strong>{' '}
                {safeFormData.fastingRequired && 'Fasting required'}
                {safeFormData.fastingRequired && safeFormData.urgentContact && ', '}
                {safeFormData.urgentContact && 'Urgent contact required'}
              </Typography>
            )}
            
            {safeFormData.notes && (
              <Typography variant="body2">
                <strong>Notes:</strong> {safeFormData.notes}
              </Typography>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default ServiceRequestFormFields;