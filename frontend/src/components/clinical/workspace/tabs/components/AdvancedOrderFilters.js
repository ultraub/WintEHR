/**
 * Advanced Order Filters Component
 * 
 * Provides comprehensive FHIR R4 search capabilities for ServiceRequest and MedicationRequest resources
 * with advanced filtering options using 25+ FHIR R4 search parameters for enhanced clinical workflow management.
 * 
 * Leverages comprehensive FHIR R4 ServiceRequest search parameters:
 * - Basic: status, priority, category, intent, code
 * - Temporal: authored, occurrence, based-on
 * - Clinical: reason-code, reason-reference, body-site, specimen
 * - Workflow: requester, performer, subject, encounter
 * - Advanced: identifier, instantiates-canonical, replaces, requisition
 * - Patient-specific: insurance, patient-instruction
 * 
 * Enhanced with provider directory integration and dynamic clinical catalogs.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Autocomplete,
  Grid,
  Divider,
  Tooltip,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Assignment as OrderIcon,
  LocalHospital as MedicalIcon,
  Science as LabIcon,
  CameraAlt as ImagingIcon,
  Tune as AdvancedIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useClinicalWorkflow } from '../../../../../contexts/ClinicalWorkflowContext';
import { useFHIRResource } from '../../../../../contexts/FHIRResourceContext';
import { cdsClinicalDataService } from '../../../../../services/cdsClinicalDataService';
import { useProviderDirectory } from '../../../../../hooks/useProviderDirectory';
import { format, subDays, subMonths, subYears } from 'date-fns';

const AdvancedOrderFilters = ({ 
  onFiltersChange, 
  initialFilters = {},
  showAdvanced = false,
  compact = false,
  patientId 
}) => {
  const { currentPatient } = useFHIRResource();
  const { searchProviders, getProvidersBySpecialty } = useProviderDirectory();
  const [filters, setFilters] = useState({
    // Basic FHIR R4 ServiceRequest filters
    status: initialFilters.status || '',
    priority: initialFilters.priority || '',
    category: initialFilters.category || '',
    code: initialFilters.code || '',
    orderType: initialFilters.orderType || '', // ServiceRequest vs MedicationRequest
    
    // Temporal filters (FHIR R4 authored and occurrence)
    dateRange: initialFilters.dateRange || '',
    authoredFrom: initialFilters.authoredFrom || null,
    authoredTo: initialFilters.authoredTo || null,
    occurrenceFrom: initialFilters.occurrenceFrom || null,
    occurrenceTo: initialFilters.occurrenceTo || null,
    
    // Clinical context filters (FHIR R4 reason-code, body-site)
    requester: initialFilters.requester || '',
    performer: initialFilters.performer || '',
    performerType: initialFilters.performerType || '',
    reasonCode: initialFilters.reasonCode || '',
    reasonReference: initialFilters.reasonReference || '',
    bodySite: initialFilters.bodySite || '',
    specimen: initialFilters.specimen || '',
    
    // Workflow filters (FHIR R4 intent, based-on, replaces)
    intent: initialFilters.intent || '',
    basedOn: initialFilters.basedOn || '',
    replaces: initialFilters.replaces || '',
    requisition: initialFilters.requisition || '',
    asNeeded: initialFilters.asNeeded || false,
    
    // Advanced FHIR R4 search parameters
    freeText: initialFilters.freeText || '',
    identifier: initialFilters.identifier || '',
    instantiatesCanonical: initialFilters.instantiatesCanonical || '',
    instantiatesUri: initialFilters.instantiatesUri || '',
    encounter: initialFilters.encounter || '',
    insurance: initialFilters.insurance || '',
    patientInstruction: initialFilters.patientInstruction || '',
    
    // Quantity and dosage filters
    quantity: initialFilters.quantity || '',
    dosageInstruction: initialFilters.dosageInstruction || ''
  });

  const [availableOptions, setAvailableOptions] = useState({
    categories: [],
    orderCodes: [],
    reasonCodes: [],
    bodySites: [],
    requesters: [],
    performers: [],
    performerTypes: [],
    specimens: [],
    encounters: []
  });

  const [expanded, setExpanded] = useState(showAdvanced);
  const [isLoading, setIsLoading] = useState(false);

  // Load available filter options from dynamic catalogs
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Notify parent of filter changes
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(buildSearchParams());
    }
  }, [filters, onFiltersChange]);

  const loadFilterOptions = async () => {
    try {
      setIsLoading(true);
      
      // Get comprehensive catalogs from dynamic clinical data service
      const [procedures, medications, conditions, labTests] = await Promise.all([
        cdsClinicalDataService.getProcedureCatalog('', null, 50),
        cdsClinicalDataService.getDynamicMedicationCatalog('', 50),
        cdsClinicalDataService.getDynamicConditionCatalog('', 50),
        cdsClinicalDataService.getLabCatalog('', null, 30)
      ]);

      // Load providers from provider directory
      const [requestingProviders, performingProviders] = await Promise.all([
        searchProviders('', { includeRoles: true, limit: 20 }),
        getProvidersBySpecialty(['laboratory', 'radiology', 'pharmacy'], { limit: 30 })
      ]);

      // Extract comprehensive categories from FHIR resources
      const procedureCategories = procedures.map(p => ({
        code: p.category?.coding?.[0]?.code || 'procedure',
        display: p.category?.coding?.[0]?.display || p.category?.text || 'Procedure',
        system: p.category?.coding?.[0]?.system
      }));

      const labCategories = [
        { code: '108252007', display: 'Laboratory procedure', system: 'http://snomed.info/sct' },
        { code: '363679005', display: 'Imaging', system: 'http://snomed.info/sct' },
        { code: '387713003', display: 'Surgical procedure', system: 'http://snomed.info/sct' }
      ];

      const medicationCategories = [
        { code: 'inpatient', display: 'Inpatient', system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-category' },
        { code: 'outpatient', display: 'Outpatient', system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-category' },
        { code: 'community', display: 'Community', system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-category' },
        { code: 'discharge', display: 'Discharge', system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-category' }
      ];

      // Extract order codes (procedures + lab tests + medications)
      const orderCodes = [
        ...procedures.map(p => ({
          code: p.code?.coding?.[0]?.code,
          display: p.code?.coding?.[0]?.display || p.code?.text,
          system: p.code?.coding?.[0]?.system,
          type: 'procedure'
        })),
        ...labTests.map(l => ({
          code: l.code?.coding?.[0]?.code,
          display: l.code?.coding?.[0]?.display || l.code?.text,
          system: l.code?.coding?.[0]?.system,
          type: 'laboratory'
        })),
        ...medications.slice(0, 15).map(m => ({
          code: m.code?.coding?.[0]?.code,
          display: m.code?.coding?.[0]?.display || m.code?.text,
          system: m.code?.coding?.[0]?.system,
          type: 'medication'
        }))
      ].filter(code => code.code && code.display);

      // Extract reason codes from conditions with SNOMED CT codes
      const reasonCodes = conditions.map(c => ({
        code: c.code?.coding?.[0]?.code,
        display: c.code?.coding?.[0]?.display || c.code?.text,
        system: c.code?.coding?.[0]?.system || 'http://snomed.info/sct'
      })).filter(r => r.code);

      // Enhanced body sites from SNOMED CT
      const bodySites = [
        { code: '69536005', display: 'Head structure', system: 'http://snomed.info/sct' },
        { code: '51185008', display: 'Thoracic structure', system: 'http://snomed.info/sct' },
        { code: '818983008', display: 'Abdomen', system: 'http://snomed.info/sct' },
        { code: '12921003', display: 'Pelvis', system: 'http://snomed.info/sct' },
        { code: '66019005', display: 'Extremity', system: 'http://snomed.info/sct' },
        { code: '7771000', display: 'Left side', system: 'http://snomed.info/sct' },
        { code: '24028007', display: 'Right side', system: 'http://snomed.info/sct' }
      ];

      // Performer types from FHIR practitioner-role value set
      const performerTypes = [
        { code: 'doctor', display: 'Doctor', system: 'http://snomed.info/sct' },
        { code: 'nurse', display: 'Nurse', system: 'http://snomed.info/sct' },
        { code: 'pharmacist', display: 'Pharmacist', system: 'http://snomed.info/sct' },
        { code: 'researcher', display: 'Researcher', system: 'http://snomed.info/sct' },
        { code: 'teacher', display: 'Teacher', system: 'http://snomed.info/sct' },
        { code: 'ict', display: 'ICT professional', system: 'http://snomed.info/sct' }
      ];

      // Specimen types for lab orders
      const specimens = [
        { code: '119297000', display: 'Blood specimen', system: 'http://snomed.info/sct' },
        { code: '122575003', display: 'Urine specimen', system: 'http://snomed.info/sct' },
        { code: '119342007', display: 'Saliva specimen', system: 'http://snomed.info/sct' },
        { code: '258435002', display: 'Tumor tissue', system: 'http://snomed.info/sct' },
        { code: '119295008', display: 'Specimen obtained by aspiration', system: 'http://snomed.info/sct' }
      ];

      setAvailableOptions({
        categories: [...procedureCategories, ...labCategories, ...medicationCategories],
        orderCodes: orderCodes.slice(0, 40), // Limit for performance
        reasonCodes: reasonCodes.slice(0, 25),
        bodySites,
        requesters: requestingProviders.map(p => ({
          id: p.id,
          display: p.displayName || `${p.name?.[0]?.given?.join(' ')} ${p.name?.[0]?.family}`,
          specialty: p.roles?.[0]?.specialty?.[0]?.coding?.[0]?.display
        })),
        performers: performingProviders.map(p => ({
          id: p.id,
          display: p.displayName || `${p.name?.[0]?.given?.join(' ')} ${p.name?.[0]?.family}`,
          department: p.roles?.[0]?.organization?.display
        })),
        performerTypes,
        specimens,
        encounters: [] // Would be populated from recent encounters
      });
    } catch (error) {
      // Error loading filter options - fallback to basic options
      // Fallback to basic options if dynamic loading fails
      setAvailableOptions({
        categories: [{ code: 'procedure', display: 'Procedure' }],
        orderCodes: [],
        reasonCodes: [],
        bodySites: [{ code: 'body', display: 'Body' }],
        requesters: [],
        performers: [],
        performerTypes: [],
        specimens: [],
        encounters: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buildSearchParams = () => {
    const params = new URLSearchParams();
    
    // Core FHIR R4 ServiceRequest search parameters
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.category) params.append('category', filters.category);
    if (filters.code) params.append('code', filters.code);
    if (filters.intent) params.append('intent', filters.intent);
    if (filters.orderType) params.append('_type', filters.orderType);
    
    // Temporal filters - authored parameter (FHIR R4)
    if (filters.authoredFrom) {
      params.append('authored', `ge${format(filters.authoredFrom, 'yyyy-MM-dd')}`);
    }
    if (filters.authoredTo) {
      params.append('authored', `le${format(filters.authoredTo, 'yyyy-MM-dd')}`);
    }
    
    // Occurrence date filtering (FHIR R4)
    if (filters.occurrenceFrom) {
      params.append('occurrence-date', `ge${format(filters.occurrenceFrom, 'yyyy-MM-dd')}`);
    }
    if (filters.occurrenceTo) {
      params.append('occurrence-date', `le${format(filters.occurrenceTo, 'yyyy-MM-dd')}`);
    }
    
    // Quick date ranges using authored parameter
    if (filters.dateRange) {
      const now = new Date();
      const ranges = {
        'today': { from: new Date(now.setHours(0,0,0,0)), to: new Date(now.setHours(23,59,59,999)) },
        'week': { from: subDays(now, 7), to: now },
        'month': { from: subDays(now, 30), to: now },
        '3months': { from: subDays(now, 90), to: now },
        '6months': { from: subMonths(now, 6), to: now },
        'year': { from: subYears(now, 1), to: now }
      };
      const range = ranges[filters.dateRange];
      if (range) {
        params.append('authored', `ge${format(range.from, 'yyyy-MM-dd')}`);
        params.append('authored', `le${format(range.to, 'yyyy-MM-dd')}`);
      }
    }
    
    // Clinical context filters (FHIR R4)
    if (filters.requester) {
      const requesterRef = filters.requester.startsWith('Practitioner/') ? 
        filters.requester : `Practitioner/${filters.requester}`;
      params.append('requester', requesterRef);
    }
    if (filters.performer) {
      const performerRef = filters.performer.startsWith('Practitioner/') ? 
        filters.performer : `Practitioner/${filters.performer}`;
      params.append('performer', performerRef);
    }
    if (filters.performerType) params.append('performer-type', filters.performerType);
    if (filters.reasonCode) params.append('reason-code', filters.reasonCode);
    if (filters.reasonReference) params.append('reason-reference', filters.reasonReference);
    if (filters.bodySite) params.append('body-site', filters.bodySite);
    if (filters.specimen) params.append('specimen', filters.specimen);
    
    // Workflow filters (FHIR R4)
    if (filters.basedOn) params.append('based-on', filters.basedOn);
    if (filters.replaces) params.append('replaces', filters.replaces);
    if (filters.requisition) params.append('requisition', filters.requisition);
    if (filters.encounter) params.append('encounter', filters.encounter);
    if (filters.asNeeded) params.append('as-needed', 'true');
    
    // Advanced FHIR R4 search parameters
    if (filters.freeText) params.append('_content', filters.freeText);
    if (filters.identifier) params.append('identifier', filters.identifier);
    if (filters.instantiatesCanonical) params.append('instantiates-canonical', filters.instantiatesCanonical);
    if (filters.instantiatesUri) params.append('instantiates-uri', filters.instantiatesUri);
    if (filters.insurance) params.append('insurance', filters.insurance);
    if (filters.patientInstruction) params.append('_text', filters.patientInstruction); // Full-text search for instructions
    
    // Quantity and dosage filters (for MedicationRequest)
    if (filters.quantity) params.append('quantity', filters.quantity);
    if (filters.dosageInstruction) params.append('_text', filters.dosageInstruction);
    
    // Patient context (always include if available)
    const activePatient = currentPatient;
    if (activePatient?.id || patientId) {
      params.append('subject', `Patient/${activePatient?.id || patientId}`);
    }
    
    // Sort by authored date (most recent first)
    params.append('_sort', '-authored');
    
    // Include related resources for enhanced display
    params.append('_include', 'ServiceRequest:requester');
    params.append('_include', 'ServiceRequest:performer');
    params.append('_include', 'ServiceRequest:subject');
    
    return params;
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      // Basic FHIR R4 ServiceRequest filters
      status: '',
      priority: '',
      category: '',
      code: '',
      orderType: '',
      
      // Temporal filters
      dateRange: '',
      authoredFrom: null,
      authoredTo: null,
      occurrenceFrom: null,
      occurrenceTo: null,
      
      // Clinical context filters
      requester: '',
      performer: '',
      performerType: '',
      reasonCode: '',
      reasonReference: '',
      bodySite: '',
      specimen: '',
      
      // Workflow filters
      intent: '',
      basedOn: '',
      replaces: '',
      requisition: '',
      asNeeded: false,
      
      // Advanced FHIR R4 search parameters
      freeText: '',
      identifier: '',
      instantiatesCanonical: '',
      instantiatesUri: '',
      encounter: '',
      insurance: '',
      patientInstruction: '',
      
      // Quantity and dosage filters
      quantity: '',
      dosageInstruction: ''
    });
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => 
      value && value !== '' && value !== false && value !== null
    ).length;
  };

  const getOrderTypeIcon = (type) => {
    switch (type) {
      case 'ServiceRequest':
        return <OrderIcon />;
      case 'MedicationRequest':
        return <MedicalIcon />;
      default:
        return <FilterIcon />;
    }
  };

  if (compact) {
    return (
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              label="Priority"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="routine">Routine</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="asap">ASAP</MenuItem>
              <MenuItem value="stat">STAT</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              label="Period"
            >
              <MenuItem value="">All Time</MenuItem>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">Last Week</MenuItem>
              <MenuItem value="month">Last Month</MenuItem>
              <MenuItem value="3months">Last 3 Months</MenuItem>
            </Select>
          </FormControl>
          
          {getActiveFilterCount() > 0 && (
            <Chip 
              label={`${getActiveFilterCount()} active`} 
              size="small" 
              color="primary" 
            />
          )}
          
          <IconButton size="small" onClick={handleClearFilters}>
            <ClearIcon />
          </IconButton>
        </Stack>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <AdvancedIcon />
              <Typography variant="h6">
                Advanced Order Filters
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {getActiveFilterCount() > 0 && (
                <Chip 
                  label={`${getActiveFilterCount()} filters active`} 
                  size="small" 
                  color="primary" 
                />
              )}
              <Button
                size="small"
                onClick={handleClearFilters}
                startIcon={<ClearIcon />}
              >
                Clear All
              </Button>
            </Stack>
          </Stack>

          {/* Basic Filters */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Order Type</InputLabel>
                <Select
                  value={filters.orderType}
                  onChange={(e) => handleFilterChange('orderType', e.target.value)}
                  label="Order Type"
                  startAdornment={getOrderTypeIcon(filters.orderType)}
                >
                  <MenuItem value="">All Orders</MenuItem>
                  <MenuItem value="ServiceRequest">Service Requests</MenuItem>
                  <MenuItem value="MedicationRequest">Medication Requests</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="on-hold">On Hold</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="entered-in-error">Entered in Error</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={filters.priority}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  label="Priority"
                >
                  <MenuItem value="">All Priorities</MenuItem>
                  <MenuItem value="routine">Routine</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="asap">ASAP</MenuItem>
                  <MenuItem value="stat">STAT</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Quick Range</InputLabel>
                <Select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  label="Quick Range"
                >
                  <MenuItem value="">All Time</MenuItem>
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="week">Last Week</MenuItem>
                  <MenuItem value="month">Last Month</MenuItem>
                  <MenuItem value="3months">Last 3 Months</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Advanced Filters Accordion */}
          <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                Advanced Filters & Search
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={3}>
                {/* Date Range Pickers */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Custom Date Range
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <DatePicker
                        label="Authored From"
                        value={filters.authoredFrom}
                        onChange={(date) => handleFilterChange('authoredFrom', date)}
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <DatePicker
                        label="Authored To"
                        value={filters.authoredTo}
                        onChange={(date) => handleFilterChange('authoredTo', date)}
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <DatePicker
                        label="Occurrence From"
                        value={filters.occurrenceFrom}
                        onChange={(date) => handleFilterChange('occurrenceFrom', date)}
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <DatePicker
                        label="Occurrence To"
                        value={filters.occurrenceTo}
                        onChange={(date) => handleFilterChange('occurrenceTo', date)}
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Clinical Context Filters */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Clinical Context
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <Autocomplete
                        size="small"
                        options={availableOptions.categories}
                        getOptionLabel={(option) => option.display || ''}
                        value={availableOptions.categories.find(c => c.code === filters.category) || null}
                        onChange={(event, value) => handleFilterChange('category', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Category" />
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={4}>
                      <Autocomplete
                        size="small"
                        options={availableOptions.orderCodes}
                        getOptionLabel={(option) => option.display || ''}
                        value={availableOptions.orderCodes.find(c => c.code === filters.code) || null}
                        onChange={(event, value) => handleFilterChange('code', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Order Code" />
                        )}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Box>
                              <Typography variant="body2">{option.display}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.type} • {option.code}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={4}>
                      <Autocomplete
                        size="small"
                        options={availableOptions.reasonCodes}
                        getOptionLabel={(option) => option.display || ''}
                        value={availableOptions.reasonCodes.find(r => r.code === filters.reasonCode) || null}
                        onChange={(event, value) => handleFilterChange('reasonCode', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Reason/Indication" />
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={4}>
                      <Autocomplete
                        size="small"
                        options={availableOptions.bodySites}
                        getOptionLabel={(option) => option.display || ''}
                        value={availableOptions.bodySites.find(b => b.code === filters.bodySite) || null}
                        onChange={(event, value) => handleFilterChange('bodySite', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Body Site" />
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={4}>
                      <Autocomplete
                        size="small"
                        options={availableOptions.specimens}
                        getOptionLabel={(option) => option.display || ''}
                        value={availableOptions.specimens.find(s => s.code === filters.specimen) || null}
                        onChange={(event, value) => handleFilterChange('specimen', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Specimen Type" />
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Reason Reference"
                        value={filters.reasonReference}
                        onChange={(e) => handleFilterChange('reasonReference', e.target.value)}
                        placeholder="Reference to condition/observation..."
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Workflow Filters */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Workflow Assignment
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <Autocomplete
                        size="small"
                        options={availableOptions.requesters}
                        getOptionLabel={(option) => option.display || ''}
                        value={availableOptions.requesters.find(r => r.id === filters.requester) || null}
                        onChange={(event, value) => handleFilterChange('requester', value?.id || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Ordering Provider" />
                        )}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Box>
                              <Typography variant="body2">{option.display}</Typography>
                              {option.specialty && (
                                <Typography variant="caption" color="text.secondary">
                                  {option.specialty}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={4}>
                      <Autocomplete
                        size="small"
                        options={availableOptions.performers}
                        getOptionLabel={(option) => option.display || ''}
                        value={availableOptions.performers.find(p => p.id === filters.performer) || null}
                        onChange={(event, value) => handleFilterChange('performer', value?.id || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Performing Provider" />
                        )}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Box>
                              <Typography variant="body2">{option.display}</Typography>
                              {option.department && (
                                <Typography variant="caption" color="text.secondary">
                                  {option.department}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={4}>
                      <Autocomplete
                        size="small"
                        options={availableOptions.performerTypes}
                        getOptionLabel={(option) => option.display || ''}
                        value={availableOptions.performerTypes.find(pt => pt.code === filters.performerType) || null}
                        onChange={(event, value) => handleFilterChange('performerType', value?.code || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Performer Type" />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Advanced Search Options */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Advanced Search
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Free Text Search"
                        value={filters.freeText}
                        onChange={(e) => handleFilterChange('freeText', e.target.value)}
                        placeholder="Search in order content..."
                        InputProps={{
                          startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Order Identifier"
                        value={filters.identifier}
                        onChange={(e) => handleFilterChange('identifier', e.target.value)}
                        placeholder="Enter order ID or number..."
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Patient Instructions"
                        value={filters.patientInstruction}
                        onChange={(e) => handleFilterChange('patientInstruction', e.target.value)}
                        placeholder="Search instructions..."
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Requisition"
                        value={filters.requisition}
                        onChange={(e) => handleFilterChange('requisition', e.target.value)}
                        placeholder="Requisition ID..."
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Workflow Options */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Workflow & Relationship Options
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Intent</InputLabel>
                        <Select
                          value={filters.intent}
                          onChange={(e) => handleFilterChange('intent', e.target.value)}
                          label="Intent"
                        >
                          <MenuItem value="">All</MenuItem>
                          <MenuItem value="proposal">Proposal</MenuItem>
                          <MenuItem value="plan">Plan</MenuItem>
                          <MenuItem value="directive">Directive</MenuItem>
                          <MenuItem value="order">Order</MenuItem>
                          <MenuItem value="original-order">Original Order</MenuItem>
                          <MenuItem value="reflex-order">Reflex Order</MenuItem>
                          <MenuItem value="filler-order">Filler Order</MenuItem>
                          <MenuItem value="instance-order">Instance Order</MenuItem>
                          <MenuItem value="option">Option</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Based On"
                        value={filters.basedOn}
                        onChange={(e) => handleFilterChange('basedOn', e.target.value)}
                        placeholder="Reference to plan/order..."
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Replaces"
                        value={filters.replaces}
                        onChange={(e) => handleFilterChange('replaces', e.target.value)}
                        placeholder="Replaced order reference..."
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Encounter"
                        value={filters.encounter}
                        onChange={(e) => handleFilterChange('encounter', e.target.value)}
                        placeholder="Encounter reference..."
                      />
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 2 }}>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={filters.asNeeded}
                            onChange={(e) => handleFilterChange('asNeeded', e.target.checked)}
                          />
                        }
                        label="PRN/As Needed Only"
                      />
                    </Stack>
                  </Box>
                  
                  {/* Additional Advanced FHIR R4 Parameters */}
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Advanced FHIR R4 Parameters
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Instantiates Canonical"
                          value={filters.instantiatesCanonical}
                          onChange={(e) => handleFilterChange('instantiatesCanonical', e.target.value)}
                          placeholder="ActivityDefinition URL..."
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Instantiates URI"
                          value={filters.instantiatesUri}
                          onChange={(e) => handleFilterChange('instantiatesUri', e.target.value)}
                          placeholder="External definition URI..."
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Insurance"
                          value={filters.insurance}
                          onChange={(e) => handleFilterChange('insurance', e.target.value)}
                          placeholder="Coverage reference..."
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Search Summary */}
          {getActiveFilterCount() > 0 && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="body2">
                Active filters will be applied to order search. Use "Clear All" to reset filters.
              </Typography>
            </Alert>
          )}
        </Stack>
      </Paper>
    </LocalizationProvider>
  );
};

export default AdvancedOrderFilters;