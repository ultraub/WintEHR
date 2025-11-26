import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import api from '../services/api';

const EditableModal = ({
  open,
  onClose,
  onSave,
  type, // 'medication', 'condition', 'observation', 'encounter'
  data = null, // null for new, object for edit
  patientId,
  encounterId = null
}) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState([]);

  const isEditing = Boolean(data);

  useEffect(() => {
    if (open) {
      if (type === 'medication' || type === 'encounter') {
        fetchProviders();
      }
      resetForm();
    }
  }, [open, data, type]);

  const fetchProviders = async () => {
    try {
      const response = await api.get('/api/providers');
      setProviders(response.data);
    } catch (err) {
      
    }
  };

  const resetForm = () => {
    if (isEditing) {
      setFormData({ ...data });
    } else {
      // Initialize new form based on type
      switch (type) {
        case 'medication':
          setFormData({
            patient_id: patientId,
            encounter_id: encounterId,
            medication_name: '',
            dosage: '',
            frequency: 'Once daily',
            route: 'oral',
            start_date: new Date().toISOString().split('T')[0],
            status: 'active',
            prescriber_id: providers[0]?.id || ''
          });
          break;
        case 'condition':
          setFormData({
            patient_id: patientId,
            icd10_code: '',
            description: '',
            clinical_status: 'active',
            verification_status: 'confirmed',
            onset_date: new Date().toISOString().split('T')[0]
          });
          break;
        case 'observation':
          setFormData({
            patient_id: patientId,
            encounter_id: encounterId,
            // observation_type: 'laboratory', // Field is null in current dataset
            code: '',
            display: '',
            value: '',
            unit: '',
            observation_date: new Date().toISOString()
          });
          break;
        case 'encounter':
          setFormData({
            patient_id: patientId,
            provider_id: providers[0]?.id || '',
            location_id: '',
            encounter_type: 'outpatient',
            chief_complaint: '',
            notes: '',
            status: 'finished',
            encounter_date: new Date().toISOString()
          });
          break;
        default:
          setFormData({});
      }
    }
    setError(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (isEditing) {
        // Update existing record
        response = await api.put(`/api/${type}s/${data.id}`, formData);
      } else {
        // Create new record
        response = await api.post(`/api/${type}s`, formData);
      }

      onSave(response.data);
      onClose();
    } catch (err) {
      
      setError(err.response?.data?.detail || `Failed to ${isEditing ? 'update' : 'create'} ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const renderMedicationForm = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Medication Name"
          value={formData.medication_name || ''}
          onChange={(e) => handleInputChange('medication_name', e.target.value)}
          required
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          label="Dosage"
          value={formData.dosage || ''}
          onChange={(e) => handleInputChange('dosage', e.target.value)}
          placeholder="e.g., 10mg"
          required
        />
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth>
          <InputLabel>Frequency</InputLabel>
          <Select
            value={formData.frequency || 'Once daily'}
            onChange={(e) => handleInputChange('frequency', e.target.value)}
            label="Frequency"
          >
            <MenuItem value="Once daily">Once daily</MenuItem>
            <MenuItem value="Twice daily">Twice daily</MenuItem>
            <MenuItem value="Three times daily">Three times daily</MenuItem>
            <MenuItem value="Four times daily">Four times daily</MenuItem>
            <MenuItem value="As needed">As needed</MenuItem>
            <MenuItem value="Weekly">Weekly</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth>
          <InputLabel>Route</InputLabel>
          <Select
            value={formData.route || 'oral'}
            onChange={(e) => handleInputChange('route', e.target.value)}
            label="Route"
          >
            <MenuItem value="oral">Oral</MenuItem>
            <MenuItem value="intravenous">Intravenous</MenuItem>
            <MenuItem value="intramuscular">Intramuscular</MenuItem>
            <MenuItem value="subcutaneous">Subcutaneous</MenuItem>
            <MenuItem value="topical">Topical</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            value={formData.status || 'active'}
            onChange={(e) => handleInputChange('status', e.target.value)}
            label="Status"
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="stopped">Stopped</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          type="date"
          label="Start Date"
          InputLabelProps={{ shrink: true }}
          value={formData.start_date || ''}
          onChange={(e) => handleInputChange('start_date', e.target.value)}
          required
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          type="date"
          label="End Date (Optional)"
          InputLabelProps={{ shrink: true }}
          value={formData.end_date || ''}
          onChange={(e) => handleInputChange('end_date', e.target.value)}
        />
      </Grid>
      {providers.length > 0 && (
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Prescriber</InputLabel>
            <Select
              value={formData.prescriber_id || ''}
              onChange={(e) => handleInputChange('prescriber_id', e.target.value)}
              label="Prescriber"
            >
              {providers.map((provider) => (
                <MenuItem key={provider.id} value={provider.id}>
                  Dr. {provider.first_name} {provider.last_name} - {provider.specialty}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      )}
    </Grid>
  );

  const renderConditionForm = () => (
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <TextField
          fullWidth
          label="ICD-10 Code"
          value={formData.icd10_code || ''}
          onChange={(e) => handleInputChange('icd10_code', e.target.value)}
          placeholder="e.g., I10"
          required
        />
      </Grid>
      <Grid item xs={8}>
        <TextField
          fullWidth
          label="Description"
          value={formData.description || ''}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="e.g., Essential hypertension"
          required
        />
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth>
          <InputLabel>Clinical Status</InputLabel>
          <Select
            value={formData.clinical_status || 'active'}
            onChange={(e) => handleInputChange('clinical_status', e.target.value)}
            label="Clinical Status"
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          type="date"
          label="Onset Date"
          InputLabelProps={{ shrink: true }}
          value={formData.onset_date || ''}
          onChange={(e) => handleInputChange('onset_date', e.target.value)}
          required
        />
      </Grid>
    </Grid>
  );

  const renderObservationForm = () => (
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <FormControl fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            value={formData.observation_type || ''} // Default removed since field is null
            onChange={(e) => handleInputChange('observation_type', e.target.value)}
            label="Type"
          >
            <MenuItem value="laboratory">Laboratory</MenuItem>
            <MenuItem value="vital-signs">Vital Signs</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          label="Test Code"
          value={formData.code || ''}
          onChange={(e) => handleInputChange('code', e.target.value)}
          placeholder="e.g., 33747-0"
          required
        />
      </Grid>
      <Grid item xs={8}>
        <TextField
          fullWidth
          label="Test Name"
          value={formData.display || ''}
          onChange={(e) => handleInputChange('display', e.target.value)}
          placeholder="e.g., Hemoglobin A1c"
          required
        />
      </Grid>
      <Grid item xs={4}>
        <TextField
          fullWidth
          label="Value"
          value={formData.value || ''}
          onChange={(e) => handleInputChange('value', e.target.value)}
          placeholder="e.g., 7.2"
          required
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          label="Unit"
          value={formData.value_unit || ''}
          onChange={(e) => handleInputChange('unit', e.target.value)}
          placeholder="e.g., %"
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          type="datetime-local"
          label="Test Date"
          InputLabelProps={{ shrink: true }}
          value={formData.observation_date?.slice(0, 16) || ''}
          onChange={(e) => handleInputChange('observation_date', e.target.value + ':00')}
          required
        />
      </Grid>
    </Grid>
  );

  const renderEncounterForm = () => (
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <FormControl fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            value={formData.encounter_type || 'outpatient'}
            onChange={(e) => handleInputChange('encounter_type', e.target.value)}
            label="Type"
          >
            <MenuItem value="outpatient">Outpatient</MenuItem>
            <MenuItem value="inpatient">Inpatient</MenuItem>
            <MenuItem value="emergency">Emergency</MenuItem>
            <MenuItem value="virtual">Virtual</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          type="datetime-local"
          label="Encounter Date"
          InputLabelProps={{ shrink: true }}
          value={formData.encounter_date?.slice(0, 16) || ''}
          onChange={(e) => handleInputChange('encounter_date', e.target.value + ':00')}
          required
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Chief Complaint"
          value={formData.chief_complaint || ''}
          onChange={(e) => handleInputChange('chief_complaint', e.target.value)}
          placeholder="e.g., Follow-up for diabetes"
          required
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Clinical Notes"
          value={formData.notes || ''}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          placeholder="Enter clinical documentation..."
        />
      </Grid>
      {providers.length > 0 && (
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Provider</InputLabel>
            <Select
              value={formData.provider_id || ''}
              onChange={(e) => handleInputChange('provider_id', e.target.value)}
              label="Provider"
              required
            >
              {providers.map((provider) => (
                <MenuItem key={provider.id} value={provider.id}>
                  Dr. {provider.first_name} {provider.last_name} - {provider.specialty}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      )}
    </Grid>
  );

  const renderForm = () => {
    switch (type) {
      case 'medication':
        return renderMedicationForm();
      case 'condition':
        return renderConditionForm();
      case 'observation':
        return renderObservationForm();
      case 'encounter':
        return renderEncounterForm();
      default:
        return <Alert severity="error">Unknown form type: {type}</Alert>;
    }
  };

  const getTitle = () => {
    const action = isEditing ? 'Edit' : 'Add';
    const typeNames = {
      medication: 'Medication',
      condition: 'Condition',
      observation: 'Lab Result',
      encounter: 'Encounter'
    };
    return `${action} ${typeNames[type] || type}`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>{getTitle()}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {renderForm()}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Saving...' : (isEditing ? 'Update' : 'Add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditableModal;