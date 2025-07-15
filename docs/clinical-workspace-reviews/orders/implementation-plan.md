# Orders Tab Enhancement Implementation Plan

**Date**: July 15, 2025  
**Scope**: Enhanced CPOE capabilities leveraging FHIR R4 resources  
**Timeline**: 4-6 weeks implementation  
**Priority**: High-impact enhancements  

## Implementation Overview

This plan details the systematic enhancement of the Orders Tab to fully leverage newly available FHIR R4 capabilities, focusing on advanced filtering, provider directory integration, geographic ordering, and task-based workflow management.

## Phase 1: Advanced Order Filtering (Week 1-2)

### 1.1 Enhanced ServiceRequest Search Parameter Integration

**Objective**: Implement comprehensive ServiceRequest search parameter utilization

**Files to Modify**:
- `/frontend/src/components/clinical/workspace/tabs/OrdersTab.js`
- `/frontend/src/services/fhirService.js`
- `/frontend/src/hooks/useFHIRResources.js`

**Implementation Steps**:

1. **Create Advanced Filter Component**
```javascript
// New file: /frontend/src/components/clinical/workspace/tabs/components/AdvancedOrderFilters.js
const AdvancedOrderFilters = ({ 
  filters, 
  onFiltersChange, 
  availableProviders, 
  availableLocations 
}) => {
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2}>
        {/* Existing filters */}
        <Grid item xs={12} md={3}>
          <TextField
            label="Search orders..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />
        </Grid>
        
        {/* New advanced filters */}
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Requester</InputLabel>
            <Select
              multiple
              value={filters.requester || []}
              onChange={(e) => onFiltersChange({ ...filters, requester: e.target.value })}
            >
              {availableProviders.map(provider => (
                <MenuItem key={provider.id} value={provider.id}>
                  {provider.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Performer</InputLabel>
            <Select
              multiple
              value={filters.performer || []}
              onChange={(e) => onFiltersChange({ ...filters, performer: e.target.value })}
            >
              {availableProviders.map(provider => (
                <MenuItem key={provider.id} value={provider.id}>
                  {provider.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Location</InputLabel>
            <Select
              multiple
              value={filters.location || []}
              onChange={(e) => onFiltersChange({ ...filters, location: e.target.value })}
            >
              {availableLocations.map(location => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <DateRangePicker
            label="Date Range"
            value={filters.dateRange}
            onChange={(newValue) => onFiltersChange({ ...filters, dateRange: newValue })}
          />
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select
              multiple
              value={filters.priority || []}
              onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value })}
            >
              <MenuItem value="routine">Routine</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="asap">ASAP</MenuItem>
              <MenuItem value="stat">STAT</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Intent</InputLabel>
            <Select
              multiple
              value={filters.intent || []}
              onChange={(e) => onFiltersChange({ ...filters, intent: e.target.value })}
            >
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
      </Grid>
      
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Button 
          variant="outlined" 
          onClick={() => onFiltersChange({})}
          startIcon={<ClearIcon />}
        >
          Clear Filters
        </Button>
        <Button 
          variant="outlined" 
          onClick={() => saveFilterPreset(filters)}
          startIcon={<SaveIcon />}
        >
          Save Preset
        </Button>
      </Box>
    </Paper>
  );
};
```

2. **Enhanced FHIR Service Methods**
```javascript
// Update: /frontend/src/services/fhirService.js
export const searchServiceRequests = async (patientId, searchParams = {}) => {
  const params = new URLSearchParams();
  
  // Patient filter
  if (patientId) {
    params.append('patient', patientId);
  }
  
  // Advanced search parameters
  if (searchParams.requester?.length) {
    searchParams.requester.forEach(id => params.append('requester', `Practitioner/${id}`));
  }
  
  if (searchParams.performer?.length) {
    searchParams.performer.forEach(id => params.append('performer', `Practitioner/${id}`));
  }
  
  if (searchParams.category?.length) {
    searchParams.category.forEach(cat => params.append('category', cat));
  }
  
  if (searchParams.priority?.length) {
    searchParams.priority.forEach(p => params.append('priority', p));
  }
  
  if (searchParams.intent?.length) {
    searchParams.intent.forEach(i => params.append('intent', i));
  }
  
  if (searchParams.status?.length) {
    searchParams.status.forEach(s => params.append('status', s));
  }
  
  if (searchParams.dateRange?.start) {
    params.append('authored', `ge${searchParams.dateRange.start}`);
  }
  
  if (searchParams.dateRange?.end) {
    params.append('authored', `le${searchParams.dateRange.end}`);
  }
  
  if (searchParams.encounter) {
    params.append('encounter', `Encounter/${searchParams.encounter}`);
  }
  
  if (searchParams.identifier) {
    params.append('identifier', searchParams.identifier);
  }
  
  if (searchParams.code) {
    params.append('code', searchParams.code);
  }
  
  // Sorting
  if (searchParams.sort) {
    params.append('_sort', searchParams.sort);
  }
  
  // Pagination
  if (searchParams.count) {
    params.append('_count', searchParams.count);
  }
  
  if (searchParams.offset) {
    params.append('_offset', searchParams.offset);
  }
  
  const response = await fetch(`/api/fhir/R4/ServiceRequest?${params.toString()}`, {
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Failed to search service requests: ${response.statusText}`);
  }
  
  return response.json();
};

export const searchMedicationRequests = async (patientId, searchParams = {}) => {
  const params = new URLSearchParams();
  
  // Patient filter
  if (patientId) {
    params.append('patient', patientId);
  }
  
  // MedicationRequest specific parameters
  if (searchParams.requester?.length) {
    searchParams.requester.forEach(id => params.append('requester', `Practitioner/${id}`));
  }
  
  if (searchParams.medication) {
    params.append('medication', searchParams.medication);
  }
  
  if (searchParams.status?.length) {
    searchParams.status.forEach(s => params.append('status', s));
  }
  
  if (searchParams.intent?.length) {
    searchParams.intent.forEach(i => params.append('intent', i));
  }
  
  if (searchParams.priority?.length) {
    searchParams.priority.forEach(p => params.append('priority', p));
  }
  
  if (searchParams.dateRange?.start) {
    params.append('authoredon', `ge${searchParams.dateRange.start}`);
  }
  
  if (searchParams.dateRange?.end) {
    params.append('authoredon', `le${searchParams.dateRange.end}`);
  }
  
  const response = await fetch(`/api/fhir/R4/MedicationRequest?${params.toString()}`, {
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Failed to search medication requests: ${response.statusText}`);
  }
  
  return response.json();
};
```

3. **Enhanced Hook for Advanced Filtering**
```javascript
// New file: /frontend/src/hooks/useAdvancedOrderSearch.js
export const useAdvancedOrderSearch = (patientId) => {
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  
  const searchOrders = useCallback(async (searchFilters = filters) => {
    setLoading(true);
    try {
      // Search both ServiceRequests and MedicationRequests
      const [serviceRequests, medicationRequests] = await Promise.all([
        searchServiceRequests(patientId, searchFilters),
        searchMedicationRequests(patientId, searchFilters)
      ]);
      
      // Combine and sort results
      const allOrders = [
        ...(serviceRequests.entry?.map(entry => entry.resource) || []),
        ...(medicationRequests.entry?.map(entry => entry.resource) || [])
      ];
      
      // Sort by authored date (most recent first)
      allOrders.sort((a, b) => {
        const dateA = new Date(a.authoredOn || a.occurrenceDateTime || 0);
        const dateB = new Date(b.authoredOn || b.occurrenceDateTime || 0);
        return dateB - dateA;
      });
      
      setOrders(allOrders);
      setTotalCount(allOrders.length);
    } catch (error) {
      console.error('Error searching orders:', error);
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [patientId, filters]);
  
  return {
    filters,
    setFilters,
    orders,
    loading,
    totalCount,
    searchOrders
  };
};
```

### 1.2 Filter Persistence and Presets

**Implementation**:
```javascript
// New file: /frontend/src/services/orderFilterPresets.js
const FILTER_PRESETS_KEY = 'order_filter_presets';

export const saveFilterPreset = (name, filters) => {
  const presets = getFilterPresets();
  presets[name] = {
    ...filters,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
};

export const getFilterPresets = () => {
  try {
    return JSON.parse(localStorage.getItem(FILTER_PRESETS_KEY) || '{}');
  } catch {
    return {};
  }
};

export const deleteFilterPreset = (name) => {
  const presets = getFilterPresets();
  delete presets[name];
  localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
};

export const getDefaultPresets = () => ({
  'My Orders': { requester: ['current-user-id'] },
  'Urgent Orders': { priority: ['urgent', 'stat'] },
  'Recent Orders': { dateRange: { start: subDays(new Date(), 7).toISOString() } },
  'Lab Orders': { category: ['laboratory'] },
  'Imaging Orders': { category: ['imaging'] },
  'Active Medications': { resourceType: 'MedicationRequest', status: ['active'] }
});
```

## Phase 2: Provider Directory Integration (Week 2-3)

### 2.1 Provider Data Service

**New Service Implementation**:
```javascript
// New file: /frontend/src/services/providerDirectoryService.js
class ProviderDirectoryService {
  async getProviders(searchParams = {}) {
    const params = new URLSearchParams();
    
    if (searchParams.name) {
      params.append('name', searchParams.name);
    }
    
    if (searchParams.specialty) {
      params.append('specialty', searchParams.specialty);
    }
    
    if (searchParams.organization) {
      params.append('organization', searchParams.organization);
    }
    
    if (searchParams.location) {
      params.append('location', searchParams.location);
    }
    
    const response = await fetch(`/api/fhir/R4/Practitioner?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch providers: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getPractitionerRoles(practitionerId) {
    const response = await fetch(`/api/fhir/R4/PractitionerRole?practitioner=Practitioner/${practitionerId}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch practitioner roles: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getOrganizations(searchParams = {}) {
    const params = new URLSearchParams();
    
    if (searchParams.name) {
      params.append('name', searchParams.name);
    }
    
    if (searchParams.type) {
      params.append('type', searchParams.type);
    }
    
    const response = await fetch(`/api/fhir/R4/Organization?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch organizations: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getProviderPreferences(providerId) {
    // Get provider-specific order preferences
    try {
      const response = await fetch(`/api/clinical/provider-preferences/${providerId}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.warn('Provider preferences not available:', error);
    }
    
    return {};
  }
  
  async saveProviderPreferences(providerId, preferences) {
    const response = await fetch(`/api/clinical/provider-preferences/${providerId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferences)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save provider preferences: ${response.statusText}`);
    }
    
    return response.json();
  }
}

export const providerDirectoryService = new ProviderDirectoryService();
```

### 2.2 Provider-Specific Ordering Components

**Provider Selection Component**:
```javascript
// New file: /frontend/src/components/clinical/workspace/tabs/components/ProviderSelector.js
const ProviderSelector = ({ 
  selectedProvider, 
  onProviderChange, 
  required = false,
  label = "Select Provider"
}) => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const debouncedSearch = useCallback(
    debounce(async (term) => {
      setLoading(true);
      try {
        const result = await providerDirectoryService.getProviders({ name: term });
        setProviders(result.entry?.map(entry => entry.resource) || []);
      } catch (error) {
        console.error('Error fetching providers:', error);
        setProviders([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );
  
  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);
  
  return (
    <Autocomplete
      value={selectedProvider}
      onChange={(event, newValue) => onProviderChange(newValue)}
      options={providers}
      getOptionLabel={(provider) => provider ? `${provider.name?.[0]?.given?.[0]} ${provider.name?.[0]?.family}` : ''}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, provider) => (
        <Box component="li" {...props}>
          <Box>
            <Typography variant="body1">
              {provider.name?.[0]?.given?.[0]} {provider.name?.[0]?.family}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {provider.qualification?.[0]?.code?.text}
            </Typography>
          </Box>
        </Box>
      )}
    />
  );
};
```

### 2.3 Enhanced Order Creation with Provider Context

**Modified CPOE Dialog**:
```javascript
// Update: CPOEDialog.js to include provider-specific features
const CPOEDialog = ({ open, onClose, patientId, onSave, initialProvider }) => {
  const [selectedProvider, setSelectedProvider] = useState(initialProvider);
  const [providerPreferences, setProviderPreferences] = useState({});
  const [orderTemplates, setOrderTemplates] = useState([]);
  
  useEffect(() => {
    if (selectedProvider) {
      loadProviderPreferences(selectedProvider.id);
      loadProviderOrderTemplates(selectedProvider.id);
    }
  }, [selectedProvider]);
  
  const loadProviderPreferences = async (providerId) => {
    try {
      const preferences = await providerDirectoryService.getProviderPreferences(providerId);
      setProviderPreferences(preferences);
    } catch (error) {
      console.error('Error loading provider preferences:', error);
    }
  };
  
  const loadProviderOrderTemplates = async (providerId) => {
    // Load provider-specific order templates
    try {
      const templates = await orderTemplateService.getProviderTemplates(providerId);
      setOrderTemplates(templates);
    } catch (error) {
      console.error('Error loading order templates:', error);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6">Provider Order Entry</Typography>
          {selectedProvider && (
            <Chip 
              label={`${selectedProvider.name?.[0]?.given?.[0]} ${selectedProvider.name?.[0]?.family}`}
              color="primary"
              size="small"
            />
          )}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Provider Selection */}
          <ProviderSelector
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
            required
            label="Ordering Provider"
          />
          
          {/* Provider Templates */}
          {orderTemplates.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Order Templates</InputLabel>
              <Select
                value=""
                onChange={(e) => applyOrderTemplate(e.target.value)}
                label="Order Templates"
              >
                {orderTemplates.map(template => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          
          {/* Rest of CPOE form with provider preferences applied */}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
```

## Phase 3: Geographic Ordering Capabilities (Week 3-4)

### 3.1 Location Service Implementation

**Location Management Service**:
```javascript
// New file: /frontend/src/services/locationService.js
class LocationService {
  async getLocations(searchParams = {}) {
    const params = new URLSearchParams();
    
    if (searchParams.name) {
      params.append('name', searchParams.name);
    }
    
    if (searchParams.type) {
      params.append('type', searchParams.type);
    }
    
    if (searchParams.organization) {
      params.append('organization', searchParams.organization);
    }
    
    if (searchParams.address) {
      params.append('address', searchParams.address);
    }
    
    const response = await fetch(`/api/fhir/R4/Location?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch locations: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getLocationOrderCatalog(locationId) {
    // Get location-specific order catalogs
    try {
      const response = await fetch(`/api/clinical/location-catalog/${locationId}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.warn('Location catalog not available:', error);
    }
    
    return [];
  }
  
  async getLocationProtocols(locationId) {
    // Get location-specific protocols
    try {
      const response = await fetch(`/api/clinical/location-protocols/${locationId}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.warn('Location protocols not available:', error);
    }
    
    return [];
  }
}

export const locationService = new LocationService();
```

### 3.2 Multi-Facility Order Management

**Location-Aware Ordering Component**:
```javascript
// New file: /frontend/src/components/clinical/workspace/tabs/components/LocationOrderManager.js
const LocationOrderManager = ({ patientId, currentLocation, onLocationChange }) => {
  const [locations, setLocations] = useState([]);
  const [locationCatalog, setLocationCatalog] = useState([]);
  const [orderRouting, setOrderRouting] = useState({});
  
  useEffect(() => {
    loadLocations();
  }, []);
  
  useEffect(() => {
    if (currentLocation) {
      loadLocationCatalog(currentLocation.id);
      loadOrderRouting(currentLocation.id);
    }
  }, [currentLocation]);
  
  const loadLocations = async () => {
    try {
      const result = await locationService.getLocations();
      setLocations(result.entry?.map(entry => entry.resource) || []);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };
  
  const loadLocationCatalog = async (locationId) => {
    try {
      const catalog = await locationService.getLocationOrderCatalog(locationId);
      setLocationCatalog(catalog);
    } catch (error) {
      console.error('Error loading location catalog:', error);
    }
  };
  
  const loadOrderRouting = async (locationId) => {
    try {
      const routing = await locationService.getLocationProtocols(locationId);
      setOrderRouting(routing);
    } catch (error) {
      console.error('Error loading order routing:', error);
    }
  };
  
  return (
    <Card>
      <CardHeader 
        title="Location-Based Ordering"
        subheader={currentLocation?.name}
      />
      <CardContent>
        <Stack spacing={3}>
          {/* Location Selection */}
          <FormControl fullWidth>
            <InputLabel>Ordering Location</InputLabel>
            <Select
              value={currentLocation?.id || ''}
              onChange={(e) => {
                const location = locations.find(l => l.id === e.target.value);
                onLocationChange(location);
              }}
              label="Ordering Location"
            >
              {locations.map(location => (
                <MenuItem key={location.id} value={location.id}>
                  <Box>
                    <Typography variant="body1">{location.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {location.type?.[0]?.display} • {location.address?.city}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Location-Specific Catalog */}
          {locationCatalog.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Location-Specific Services
              </Typography>
              <Grid container spacing={1}>
                {locationCatalog.map(service => (
                  <Grid item xs={12} sm={6} md={4} key={service.id}>
                    <Chip 
                      label={service.name}
                      size="small"
                      clickable
                      onClick={() => selectLocationService(service)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
          
          {/* Order Routing Information */}
          {orderRouting.routing && (
            <Alert severity="info">
              <Typography variant="body2">
                Orders from this location will be routed to: {orderRouting.routing.destination}
              </Typography>
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
```

## Phase 4: Task-Based Workflow Management (Week 4-5)

### 4.1 Task Workflow Service

**Task Management Service**:
```javascript
// New file: /frontend/src/services/taskWorkflowService.js
class TaskWorkflowService {
  async createOrderApprovalTask(order, approver) {
    const task = {
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      code: {
        coding: [{
          system: 'http://hl7.org/fhir/CodeSystem/task-code',
          code: 'approve',
          display: 'Activate/approve the focal resource'
        }]
      },
      focus: {
        reference: `${order.resourceType}/${order.id}`
      },
      for: {
        reference: `Patient/${order.subject.reference.split('/')[1]}`
      },
      requester: {
        reference: `Practitioner/${order.requester.reference.split('/')[1]}`
      },
      owner: {
        reference: `Practitioner/${approver.id}`
      },
      authoredOn: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      businessStatus: {
        text: 'Pending approval'
      },
      description: `Approval required for ${order.resourceType}: ${this.getOrderDescription(order)}`
    };
    
    const response = await fetch('/api/fhir/R4/Task', {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/fhir+json'
      },
      body: JSON.stringify(task)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create approval task: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getOrderTasks(orderId, orderType) {
    const response = await fetch(`/api/fhir/R4/Task?focus=${orderType}/${orderId}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch order tasks: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async updateTaskStatus(taskId, status, output = null) {
    const task = await this.getTask(taskId);
    
    task.status = status;
    task.lastModified = new Date().toISOString();
    
    if (output) {
      task.output = task.output || [];
      task.output.push(output);
    }
    
    const response = await fetch(`/api/fhir/R4/Task/${taskId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/fhir+json'
      },
      body: JSON.stringify(task)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update task: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getTask(taskId) {
    const response = await fetch(`/api/fhir/R4/Task/${taskId}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch task: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  getOrderDescription(order) {
    if (order.resourceType === 'MedicationRequest') {
      return order.medication?.concept?.text || 
             order.medication?.concept?.coding?.[0]?.display ||
             'Medication Order';
    } else if (order.resourceType === 'ServiceRequest') {
      return order.code?.text || 
             order.code?.coding?.[0]?.display ||
             'Service Order';
    }
    return 'Order';
  }
}

export const taskWorkflowService = new TaskWorkflowService();
```

### 4.2 Approval Workflow Components

**Order Approval Dashboard**:
```javascript
// New file: /frontend/src/components/clinical/workspace/tabs/components/OrderApprovalDashboard.js
const OrderApprovalDashboard = ({ currentUser }) => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadPendingApprovals();
  }, [currentUser]);
  
  const loadPendingApprovals = async () => {
    setLoading(true);
    try {
      // Get tasks assigned to current user for approval
      const response = await fetch(
        `/api/fhir/R4/Task?status=requested&owner=Practitioner/${currentUser.id}&code=approve`,
        { headers: getAuthHeaders() }
      );
      
      if (response.ok) {
        const result = await response.json();
        setPendingApprovals(result.entry?.map(entry => entry.resource) || []);
      }
    } catch (error) {
      console.error('Error loading pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async (task) => {
    try {
      await taskWorkflowService.updateTaskStatus(task.id, 'completed', {
        type: {
          coding: [{
            system: 'http://hl7.org/fhir/task-output-type',
            code: 'approved'
          }]
        },
        valueString: 'Order approved'
      });
      
      // Update the order status to active
      await activateOrder(task.focus.reference);
      
      // Refresh the list
      await loadPendingApprovals();
      
      // Publish workflow event
      await publish(CLINICAL_EVENTS.ORDER_APPROVED, {
        taskId: task.id,
        orderId: task.focus.reference,
        approver: currentUser.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error approving order:', error);
    }
  };
  
  const handleReject = async (task, reason) => {
    try {
      await taskWorkflowService.updateTaskStatus(task.id, 'failed', {
        type: {
          coding: [{
            system: 'http://hl7.org/fhir/task-output-type',
            code: 'rejected'
          }]
        },
        valueString: reason
      });
      
      // Update the order status to cancelled
      await cancelOrder(task.focus.reference, reason);
      
      // Refresh the list
      await loadPendingApprovals();
      
      // Publish workflow event
      await publish(CLINICAL_EVENTS.ORDER_REJECTED, {
        taskId: task.id,
        orderId: task.focus.reference,
        approver: currentUser.id,
        reason: reason,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error rejecting order:', error);
    }
  };
  
  return (
    <Card>
      <CardHeader 
        title="Pending Approvals"
        subheader={`${pendingApprovals.length} orders awaiting approval`}
        action={
          <IconButton onClick={loadPendingApprovals} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <CardContent>
        {loading ? (
          <CircularProgress />
        ) : pendingApprovals.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No pending approvals
          </Typography>
        ) : (
          <List>
            {pendingApprovals.map(task => (
              <ListItem key={task.id} divider>
                <ListItemText
                  primary={task.description}
                  secondary={
                    <>
                      <Typography variant="caption" display="block">
                        Requested: {format(parseISO(task.authoredOn), 'MMM d, yyyy h:mm a')}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Patient: {task.for?.display || 'Unknown'}
                      </Typography>
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleApprove(task)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => openRejectDialog(task)}
                    >
                      Reject
                    </Button>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
```

## Phase 5: Enhanced Order Management Features (Week 5-6)

### 5.1 Order Sets and Templates

**Order Set Service**:
```javascript
// New file: /frontend/src/services/orderSetService.js
class OrderSetService {
  async getOrderSets(category = null) {
    const params = new URLSearchParams();
    if (category) {
      params.append('category', category);
    }
    
    const response = await fetch(`/api/clinical/order-sets?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch order sets: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async createOrdersFromSet(orderSetId, patientId, customizations = {}) {
    const response = await fetch(`/api/clinical/order-sets/${orderSetId}/create-orders`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        patientId,
        customizations
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create orders from set: ${response.statusText}`);
    }
    
    return response.json();
  }
}

export const orderSetService = new OrderSetService();
```

### 5.2 Order Relationship Management

**Order Relationship Tracking**:
```javascript
// New file: /frontend/src/components/clinical/workspace/tabs/components/OrderRelationshipView.js
const OrderRelationshipView = ({ order, allOrders }) => {
  const [relatedOrders, setRelatedOrders] = useState({
    basedOn: [],
    replaces: [],
    replacedBy: [],
    partOf: []
  });
  
  useEffect(() => {
    findRelatedOrders();
  }, [order, allOrders]);
  
  const findRelatedOrders = () => {
    const relationships = {
      basedOn: [],
      replaces: [],
      replacedBy: [],
      partOf: []
    };
    
    // Find orders this order is based on
    if (order.basedOn) {
      order.basedOn.forEach(ref => {
        const relatedOrder = allOrders.find(o => 
          ref.reference === `${o.resourceType}/${o.id}`
        );
        if (relatedOrder) {
          relationships.basedOn.push(relatedOrder);
        }
      });
    }
    
    // Find orders this order replaces
    if (order.replaces) {
      order.replaces.forEach(ref => {
        const relatedOrder = allOrders.find(o => 
          ref.reference === `${o.resourceType}/${o.id}`
        );
        if (relatedOrder) {
          relationships.replaces.push(relatedOrder);
        }
      });
    }
    
    // Find orders that replace this order
    const replacingOrders = allOrders.filter(o => 
      o.replaces?.some(ref => 
        ref.reference === `${order.resourceType}/${order.id}`
      )
    );
    relationships.replacedBy = replacingOrders;
    
    setRelatedOrders(relationships);
  };
  
  const renderRelatedOrder = (relatedOrder, relationship) => (
    <Box key={relatedOrder.id} sx={{ mb: 1 }}>
      <Typography variant="body2">
        <strong>{relationship}:</strong> {getOrderTitle(relatedOrder)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {relatedOrder.status} • {format(parseISO(relatedOrder.authoredOn), 'MMM d, yyyy')}
      </Typography>
    </Box>
  );
  
  const hasRelationships = Object.values(relatedOrders).some(arr => arr.length > 0);
  
  if (!hasRelationships) {
    return null;
  }
  
  return (
    <Card sx={{ mt: 2 }}>
      <CardHeader title="Related Orders" />
      <CardContent>
        {relatedOrders.basedOn.map(order => 
          renderRelatedOrder(order, 'Based on')
        )}
        {relatedOrders.replaces.map(order => 
          renderRelatedOrder(order, 'Replaces')
        )}
        {relatedOrders.replacedBy.map(order => 
          renderRelatedOrder(order, 'Replaced by')
        )}
      </CardContent>
    </Card>
  );
};
```

## Testing Strategy

### Unit Tests
```javascript
// Test files to create:
// - /frontend/src/components/clinical/workspace/tabs/__tests__/AdvancedOrderFilters.test.js
// - /frontend/src/services/__tests__/providerDirectoryService.test.js
// - /frontend/src/hooks/__tests__/useAdvancedOrderSearch.test.js
// - /frontend/src/services/__tests__/taskWorkflowService.test.js
```

### Integration Tests
```javascript
// E2E test scenarios:
// - Advanced filtering with multiple criteria
// - Provider-specific ordering workflow
// - Location-based order routing
// - Approval workflow end-to-end
// - Order relationship tracking
```

## Performance Considerations

1. **Debounced Search**: Implement 300ms debounce for search inputs
2. **Pagination**: Server-side pagination for large result sets
3. **Caching**: Provider and location data caching
4. **Virtual Scrolling**: Maintain for large order lists
5. **Lazy Loading**: Load related data on demand

## Migration Strategy

1. **Backward Compatibility**: All existing functionality preserved
2. **Feature Flags**: Gradual rollout of new features
3. **Data Migration**: No data structure changes required
4. **User Training**: Contextual help for new features

## Success Metrics

1. **Functional Metrics**:
   - All 14 ServiceRequest search parameters utilized
   - Provider directory fully integrated
   - Geographic ordering operational
   - Task workflows implemented

2. **Performance Metrics**:
   - Search response time < 500ms
   - Filter application < 100ms
   - Order creation time unchanged
   - No degradation in existing functionality

3. **User Experience Metrics**:
   - Advanced filtering adoption rate
   - Provider-specific ordering usage
   - Approval workflow efficiency
   - User satisfaction scores

## Timeline Summary

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1-2 | Advanced Filtering | Enhanced search, filter presets |
| 2-3 | Provider Integration | Provider selection, preferences |
| 3-4 | Geographic Ordering | Location services, routing |
| 4-5 | Task Workflows | Approval processes, delegation |
| 5-6 | Order Management | Order sets, relationships |

This implementation plan provides a systematic approach to enhancing the Orders Tab with comprehensive FHIR R4 capabilities while maintaining the existing high-quality user experience and clinical workflow integration.