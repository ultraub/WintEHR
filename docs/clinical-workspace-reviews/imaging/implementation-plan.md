# Imaging Tab Enhancement Implementation Plan

## Overview

This implementation plan details the systematic enhancement of the Imaging Tab to fully leverage the newly implemented FHIR R4 capabilities. The plan is structured in phases to maximize impact while maintaining system stability and enabling comprehensive testing at each stage.

## Implementation Strategy

### Phase-Based Approach
- **Phase 1**: Advanced Search and Filtering (2-3 weeks)
- **Phase 2**: Provider Integration and Attribution (2-3 weeks)  
- **Phase 3**: Multi-Facility Operations (3-4 weeks)
- **Phase 4**: Complete Workflow Integration (2-3 weeks)
- **Phase 5**: Advanced Features and Optimization (2-3 weeks)

### Success Criteria
- Maintain 100% backward compatibility
- Achieve <50ms additional latency for enhanced features
- Support 1000+ studies per patient efficiently
- Enable enterprise multi-facility deployments

## Phase 1: Advanced ImagingStudy Search and Filtering

### Objectives
- Implement comprehensive FHIR R4 ImagingStudy search parameters
- Enhance filtering capabilities with advanced criteria
- Optimize performance for large study datasets
- Add progressive loading and virtualization

### Technical Implementation

#### 1.1 Enhanced Search Parameter Integration

**New Search Interface Component**
```javascript
// File: frontend/src/components/clinical/workspace/tabs/components/AdvancedImagingFilters.js
const AdvancedImagingFilters = ({ onFiltersChange, availableModalities, availablePerformers }) => {
  const [filters, setFilters] = useState({
    modality: [],
    status: 'all',
    started: { from: null, to: null },
    performer: null,
    identifier: '',
    bodySite: '',
    facility: null,
    endpoint: null
  });

  // Enhanced filter logic with FHIR search parameters
  const buildSearchParams = useCallback(() => {
    const params = {};
    
    if (filters.modality.length > 0) {
      params.modality = filters.modality.join(',');
    }
    
    if (filters.status !== 'all') {
      params.status = filters.status;
    }
    
    if (filters.started.from) {
      params['started'] = `ge${filters.started.from}`;
    }
    
    if (filters.started.to) {
      params['started'] = params['started'] ? 
        `${params['started']}&started=le${filters.started.to}` : 
        `le${filters.started.to}`;
    }
    
    if (filters.performer) {
      params['performer.actor'] = `Practitioner/${filters.performer}`;
    }
    
    if (filters.identifier) {
      params.identifier = filters.identifier;
    }
    
    if (filters.bodySite) {
      params['bodySite.text'] = filters.bodySite;
    }
    
    return params;
  }, [filters]);
};
```

**Enhanced Search Service**
```javascript
// File: frontend/src/services/enhancedImagingSearch.js
export class EnhancedImagingSearchService {
  
  async searchImagingStudies(patientId, searchParams = {}) {
    const baseParams = {
      subject: `Patient/${patientId}`,
      _include: 'ImagingStudy:performer',
      _revinclude: 'ServiceRequest:subject',
      _sort: '-started'
    };
    
    const combinedParams = { ...baseParams, ...searchParams };
    
    try {
      const response = await fetch(`/fhir/R4/ImagingStudy?${new URLSearchParams(combinedParams)}`);
      const bundle = await response.json();
      
      return {
        studies: this.extractStudies(bundle),
        performers: this.extractPerformers(bundle),
        orders: this.extractOrders(bundle),
        total: bundle.total || 0
      };
    } catch (error) {
      console.error('Enhanced imaging search failed:', error);
      throw error;
    }
  }
  
  extractStudies(bundle) {
    return bundle.entry
      ?.filter(entry => entry.resource.resourceType === 'ImagingStudy')
      ?.map(entry => entry.resource) || [];
  }
  
  extractPerformers(bundle) {
    return bundle.entry
      ?.filter(entry => entry.resource.resourceType === 'Practitioner')
      ?.map(entry => entry.resource) || [];
  }
  
  extractOrders(bundle) {
    return bundle.entry
      ?.filter(entry => entry.resource.resourceType === 'ServiceRequest')
      ?.map(entry => entry.resource) || [];
  }
}
```

#### 1.2 Virtual Scrolling for Large Datasets

**Virtualized Study List Component**
```javascript
// File: frontend/src/components/clinical/workspace/tabs/components/VirtualizedStudyList.js
import { FixedSizeList as List } from 'react-window';
import { FixedSizeListItem } from './VirtualizedStudyItem';

const VirtualizedStudyList = ({ studies, onStudyAction, onStudyView }) => {
  const listRef = useRef();
  const [listHeight, setListHeight] = useState(600);
  
  const StudyItemRenderer = ({ index, style }) => (
    <div style={style}>
      <ImagingStudyCard
        study={studies[index]}
        onView={onStudyView}
        onAction={onStudyAction}
      />
    </div>
  );
  
  return (
    <List
      ref={listRef}
      height={listHeight}
      itemCount={studies.length}
      itemSize={200}
      itemData={studies}
    >
      {StudyItemRenderer}
    </List>
  );
};
```

#### 1.3 Progressive Loading Implementation

**Progressive Study Loader**
```javascript
// File: frontend/src/hooks/useProgressiveImagingStudies.js
export const useProgressiveImagingStudies = (patientId, filters = {}) => {
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  
  const loadMore = useCallback(async (offset = 0, limit = 20) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const searchParams = {
        ...filters,
        _count: limit,
        _getpagesoffset: offset
      };
      
      const result = await enhancedImagingSearchService.searchImagingStudies(
        patientId, 
        searchParams
      );
      
      if (offset === 0) {
        setStudies(result.studies);
      } else {
        setStudies(prev => [...prev, ...result.studies]);
      }
      
      setHasMore(result.studies.length === limit);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patientId, filters, loading]);
  
  return { studies, loading, hasMore, error, loadMore };
};
```

### Testing Strategy for Phase 1

#### Unit Tests
```javascript
// File: frontend/src/components/clinical/workspace/tabs/components/__tests__/AdvancedImagingFilters.test.js
describe('AdvancedImagingFilters', () => {
  test('builds correct FHIR search parameters', () => {
    const filters = {
      modality: ['CT', 'MR'],
      status: 'available',
      started: { from: '2025-01-01', to: '2025-01-31' },
      performer: '123'
    };
    
    const params = buildSearchParams(filters);
    expect(params.modality).toBe('CT,MR');
    expect(params.status).toBe('available');
    expect(params['performer.actor']).toBe('Practitioner/123');
  });
});
```

#### Integration Tests
```javascript
// File: frontend/src/services/__tests__/enhancedImagingSearch.test.js
describe('EnhancedImagingSearchService', () => {
  test('performs comprehensive study search', async () => {
    const service = new EnhancedImagingSearchService();
    const result = await service.searchImagingStudies('patient-123', {
      modality: 'CT',
      status: 'available'
    });
    
    expect(result.studies).toBeDefined();
    expect(result.performers).toBeDefined();
    expect(result.orders).toBeDefined();
  });
});
```

## Phase 2: Provider Integration and Attribution

### Objectives
- Integrate Practitioner and PractitionerRole resources
- Add radiologist and technologist attribution
- Implement provider-based filtering and workflows
- Create provider directory integration

### Technical Implementation

#### 2.1 Provider Resolution Service

**Provider Resolver Component**
```javascript
// File: frontend/src/services/providerResolverService.js
export class ProviderResolverService {
  constructor() {
    this.providerCache = new Map();
    this.roleCache = new Map();
  }
  
  async resolveProvider(reference) {
    if (this.providerCache.has(reference)) {
      return this.providerCache.get(reference);
    }
    
    try {
      const response = await fetch(`/fhir/R4/${reference}`);
      const provider = await response.json();
      
      // Fetch associated roles
      const rolesResponse = await fetch(
        `/fhir/R4/PractitionerRole?practitioner=${provider.id}`
      );
      const rolesBundle = await rolesResponse.json();
      
      const enrichedProvider = {
        ...provider,
        roles: rolesBundle.entry?.map(e => e.resource) || [],
        specialties: this.extractSpecialties(rolesBundle),
        organization: this.extractOrganization(rolesBundle)
      };
      
      this.providerCache.set(reference, enrichedProvider);
      return enrichedProvider;
    } catch (error) {
      console.error('Failed to resolve provider:', error);
      return null;
    }
  }
  
  extractSpecialties(rolesBundle) {
    return rolesBundle.entry
      ?.flatMap(entry => entry.resource.specialty || [])
      ?.map(specialty => specialty.coding?.[0]?.display || specialty.text) || [];
  }
  
  getRadiologySpecialties() {
    return [
      'Diagnostic Radiology',
      'Interventional Radiology', 
      'Nuclear Medicine',
      'Radiation Oncology',
      'Neuroradiology',
      'Pediatric Radiology',
      'Musculoskeletal Radiology',
      'Abdominal Radiology',
      'Thoracic Radiology',
      'Breast Imaging'
    ];
  }
}
```

#### 2.2 Enhanced Study Card with Provider Information

**Provider-Enhanced Study Card**
```javascript
// File: frontend/src/components/clinical/workspace/tabs/components/ProviderEnhancedStudyCard.js
const ProviderEnhancedStudyCard = ({ study, onView, onAction }) => {
  const [performers, setPerformers] = useState([]);
  const [assignedRadiologist, setAssignedRadiologist] = useState(null);
  const providerResolver = useProviderResolver();
  
  useEffect(() => {
    const loadProviders = async () => {
      // Load performing technologists
      const performerPromises = study.series
        ?.flatMap(series => series.performer || [])
        ?.map(performer => providerResolver.resolveProvider(performer.actor.reference));
      
      if (performerPromises?.length > 0) {
        const resolvedPerformers = await Promise.all(performerPromises);
        setPerformers(resolvedPerformers.filter(Boolean));
      }
      
      // Assign radiologist based on modality and specialty
      const radiologist = await assignRadiologist(study.modality, study.bodySite);
      setAssignedRadiologist(radiologist);
    };
    
    loadProviders();
  }, [study, providerResolver]);
  
  const assignRadiologist = async (modality, bodySite) => {
    // Intelligent assignment based on subspecialty
    const specialty = determineRequiredSpecialty(modality, bodySite);
    return await providerResolver.findAvailableRadiologist(specialty);
  };
  
  return (
    <Card sx={{ mb: 2 }}>
      {/* Existing study card content */}
      
      {/* Enhanced provider information section */}
      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Provider Information
        </Typography>
        
        {assignedRadiologist && (
          <Stack direction="row" spacing={1} alignItems="center" mb={1}>
            <Avatar sx={{ width: 24, height: 24 }}>
              {assignedRadiologist.name?.[0]?.given?.[0]?.[0]}
            </Avatar>
            <Typography variant="body2">
              Reading: Dr. {assignedRadiologist.name?.[0]?.family}
              {assignedRadiologist.specialties?.[0] && (
                <Chip 
                  label={assignedRadiologist.specialties[0]} 
                  size="small" 
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
          </Stack>
        )}
        
        {performers.map((performer, index) => (
          <Stack key={index} direction="row" spacing={1} alignItems="center" mb={1}>
            <Avatar sx={{ width: 24, height: 24 }}>
              {performer.name?.[0]?.given?.[0]?.[0]}
            </Avatar>
            <Typography variant="body2">
              Technologist: {performer.name?.[0]?.family}
            </Typography>
          </Stack>
        ))}
      </Box>
    </Card>
  );
};
```

#### 2.3 Provider-Based Filtering

**Provider Filter Component**
```javascript
// File: frontend/src/components/clinical/workspace/tabs/components/ProviderFilters.js
const ProviderFilters = ({ onFilterChange, patientId }) => {
  const [radiologists, setRadiologists] = useState([]);
  const [technologists, setTechnologists] = useState([]);
  const [selectedRadiologist, setSelectedRadiologist] = useState('');
  const [selectedTechnologist, setSelectedTechnologist] = useState('');
  
  useEffect(() => {
    loadProviders();
  }, [patientId]);
  
  const loadProviders = async () => {
    // Load radiologists involved in patient imaging
    const radiologistResponse = await fetch(
      `/fhir/R4/PractitionerRole?specialty=394814009&organization.type=dept-radiology`
    );
    const radiologistBundle = await radiologistResponse.json();
    setRadiologists(radiologistBundle.entry?.map(e => e.resource) || []);
    
    // Load technologists
    const techResponse = await fetch(
      `/fhir/R4/PractitionerRole?specialty=159033005&organization.type=dept-radiology`
    );
    const techBundle = await techResponse.json();
    setTechnologists(techBundle.entry?.map(e => e.resource) || []);
  };
  
  return (
    <Stack direction="row" spacing={2}>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Reading Radiologist</InputLabel>
        <Select
          value={selectedRadiologist}
          onChange={(e) => {
            setSelectedRadiologist(e.target.value);
            onFilterChange({ radiologist: e.target.value });
          }}
          label="Reading Radiologist"
        >
          <MenuItem value="">All Radiologists</MenuItem>
          {radiologists.map(role => (
            <MenuItem key={role.id} value={role.practitioner.reference}>
              Dr. {role.practitioner.display}
              {role.specialty?.[0] && ` (${role.specialty[0].coding[0].display})`}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Technologist</InputLabel>
        <Select
          value={selectedTechnologist}
          onChange={(e) => {
            setSelectedTechnologist(e.target.value);
            onFilterChange({ technologist: e.target.value });
          }}
          label="Technologist"
        >
          <MenuItem value="">All Technologists</MenuItem>
          {technologists.map(role => (
            <MenuItem key={role.id} value={role.practitioner.reference}>
              {role.practitioner.display}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
};
```

## Phase 3: Multi-Facility Imaging Operations

### Objectives  
- Integrate Location resources for facility management
- Enable multi-site imaging operations
- Implement facility-based study routing
- Add cross-facility consultation capabilities

### Technical Implementation

#### 3.1 Location Service Integration

**Facility Management Service**
```javascript
// File: frontend/src/services/facilityService.js
export class FacilityService {
  
  async getImagingFacilities() {
    try {
      const response = await fetch(
        `/fhir/R4/Location?type=HOSP&service-category=394914008` // Radiology service
      );
      const bundle = await response.json();
      
      return bundle.entry?.map(entry => ({
        ...entry.resource,
        imagingCapabilities: this.extractImagingCapabilities(entry.resource),
        availableModalities: this.extractModalities(entry.resource)
      })) || [];
    } catch (error) {
      console.error('Failed to load imaging facilities:', error);
      return [];
    }
  }
  
  extractImagingCapabilities(location) {
    // Extract imaging equipment and capabilities from location extensions
    return location.extension
      ?.filter(ext => ext.url.includes('imaging-capability'))
      ?.map(ext => ext.valueCodeableConcept) || [];
  }
  
  async getFacilityStudies(facilityId, searchParams = {}) {
    const params = {
      ...searchParams,
      'endpoint.connection-type': 'dicom-wado-rs',
      'location': `Location/${facilityId}`
    };
    
    const response = await fetch(
      `/fhir/R4/ImagingStudy?${new URLSearchParams(params)}`
    );
    return await response.json();
  }
}
```

#### 3.2 Facility-Based Study Display

**Multi-Facility Study Manager**
```javascript
// File: frontend/src/components/clinical/workspace/tabs/components/MultiFacilityStudyManager.js
const MultiFacilityStudyManager = ({ patientId }) => {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState('all');
  const [studiesByFacility, setStudiesByFacility] = useState({});
  const facilityService = useFacilityService();
  
  useEffect(() => {
    loadFacilities();
  }, []);
  
  useEffect(() => {
    loadStudiesByFacility();
  }, [patientId, selectedFacility]);
  
  const loadFacilities = async () => {
    const facilityList = await facilityService.getImagingFacilities();
    setFacilities(facilityList);
  };
  
  const loadStudiesByFacility = async () => {
    if (selectedFacility === 'all') {
      // Load studies from all facilities
      const studiesMap = {};
      for (const facility of facilities) {
        const studies = await facilityService.getFacilityStudies(
          facility.id, 
          { subject: `Patient/${patientId}` }
        );
        studiesMap[facility.id] = studies.entry?.map(e => e.resource) || [];
      }
      setStudiesByFacility(studiesMap);
    } else {
      // Load studies from selected facility
      const studies = await facilityService.getFacilityStudies(
        selectedFacility,
        { subject: `Patient/${patientId}` }
      );
      setStudiesByFacility({
        [selectedFacility]: studies.entry?.map(e => e.resource) || []
      });
    }
  };
  
  return (
    <Box>
      {/* Facility selector */}
      <FormControl size="small" sx={{ mb: 2, minWidth: 250 }}>
        <InputLabel>Imaging Facility</InputLabel>
        <Select
          value={selectedFacility}
          onChange={(e) => setSelectedFacility(e.target.value)}
          label="Imaging Facility"
        >
          <MenuItem value="all">All Facilities</MenuItem>
          {facilities.map(facility => (
            <MenuItem key={facility.id} value={facility.id}>
              {facility.name}
              <Chip 
                label={`${facility.availableModalities?.length || 0} modalities`} 
                size="small" 
                sx={{ ml: 1 }}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* Studies grouped by facility */}
      {Object.entries(studiesByFacility).map(([facilityId, studies]) => {
        const facility = facilities.find(f => f.id === facilityId);
        return (
          <Box key={facilityId} sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {facility?.name || 'Unknown Facility'} ({studies.length} studies)
            </Typography>
            {studies.map(study => (
              <ImagingStudyCard key={study.id} study={study} />
            ))}
          </Box>
        );
      })}
    </Box>
  );
};
```

## Phase 4: Complete Workflow Integration

### Objectives
- Enhance ServiceRequest integration for complete order correlation
- Implement comprehensive DiagnosticReport workflow
- Add automated status tracking and notifications
- Create seamless order-to-report workflow

### Technical Implementation

#### 4.1 Enhanced Order Correlation

**Order-Study Correlation Service**
```javascript
// File: frontend/src/services/orderStudyCorrelationService.js
export class OrderStudyCorrelationService {
  
  async correlateOrderWithStudy(serviceRequestId, imagingStudyId) {
    // Update ImagingStudy to reference the ServiceRequest
    const study = await this.getImagingStudy(imagingStudyId);
    const updatedStudy = {
      ...study,
      basedOn: [{ reference: `ServiceRequest/${serviceRequestId}` }]
    };
    
    return await this.updateImagingStudy(imagingStudyId, updatedStudy);
  }
  
  async getOrderContext(imagingStudy) {
    if (!imagingStudy.basedOn?.length) {
      return null;
    }
    
    const serviceRequestRef = imagingStudy.basedOn[0].reference;
    const serviceRequest = await this.getServiceRequest(serviceRequestRef);
    
    return {
      orderId: serviceRequest.id,
      orderingProvider: serviceRequest.requester,
      clinicalIndication: serviceRequest.reasonCode,
      priority: serviceRequest.priority,
      orderDate: serviceRequest.authoredOn,
      accessionNumber: serviceRequest.identifier?.[0]?.value
    };
  }
  
  async findStudiesForOrder(serviceRequestId) {
    const response = await fetch(
      `/fhir/R4/ImagingStudy?based-on=ServiceRequest/${serviceRequestId}`
    );
    const bundle = await response.json();
    return bundle.entry?.map(e => e.resource) || [];
  }
}
```

#### 4.2 DiagnosticReport Integration

**Imaging Report Workflow**
```javascript
// File: frontend/src/components/clinical/workspace/tabs/components/ImagingReportWorkflow.js
const ImagingReportWorkflow = ({ study, onReportComplete }) => {
  const [report, setReport] = useState(null);
  const [reportStatus, setReportStatus] = useState('draft');
  const [findings, setFindings] = useState([]);
  const [conclusion, setConclusion] = useState('');
  
  useEffect(() => {
    loadExistingReport();
  }, [study.id]);
  
  const loadExistingReport = async () => {
    // Check for existing DiagnosticReport
    const response = await fetch(
      `/fhir/R4/DiagnosticReport?imagingStudy=ImagingStudy/${study.id}`
    );
    const bundle = await response.json();
    
    if (bundle.entry?.length > 0) {
      const existingReport = bundle.entry[0].resource;
      setReport(existingReport);
      setReportStatus(existingReport.status);
      setConclusion(existingReport.conclusion || '');
      setFindings(existingReport.result || []);
    }
  };
  
  const saveReport = async () => {
    const reportData = {
      resourceType: 'DiagnosticReport',
      status: reportStatus,
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
          code: 'RAD',
          display: 'Radiology'
        }]
      }],
      code: study.procedureCode?.[0] || {
        text: 'Imaging Study Report'
      },
      subject: study.subject,
      encounter: study.encounter,
      effectiveDateTime: new Date().toISOString(),
      issued: new Date().toISOString(),
      performer: [{
        reference: 'Practitioner/current-radiologist' // TODO: Get current user
      }],
      imagingStudy: [{
        reference: `ImagingStudy/${study.id}`
      }],
      conclusion,
      result: findings
    };
    
    if (study.basedOn?.length > 0) {
      reportData.basedOn = study.basedOn;
    }
    
    try {
      let savedReport;
      if (report?.id) {
        // Update existing report
        savedReport = await fhirService.updateResource(
          'DiagnosticReport', 
          report.id, 
          reportData
        );
      } else {
        // Create new report
        savedReport = await fhirService.createResource(
          'DiagnosticReport', 
          reportData
        );
      }
      
      setReport(savedReport);
      onReportComplete?.(savedReport);
      
      // Publish report completion event
      await publish(CLINICAL_EVENTS.IMAGING_REPORT_COMPLETED, {
        reportId: savedReport.id,
        studyId: study.id,
        patientId: study.subject.reference.split('/')[1],
        status: reportStatus
      });
      
    } catch (error) {
      console.error('Failed to save imaging report:', error);
    }
  };
  
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Imaging Report - {study.description}
      </Typography>
      
      {/* Report status */}
      <FormControl size="small" sx={{ mb: 2, minWidth: 150 }}>
        <InputLabel>Report Status</InputLabel>
        <Select
          value={reportStatus}
          onChange={(e) => setReportStatus(e.target.value)}
          label="Report Status"
        >
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="preliminary">Preliminary</MenuItem>
          <MenuItem value="final">Final</MenuItem>
          <MenuItem value="amended">Amended</MenuItem>
        </Select>
      </FormControl>
      
      {/* Conclusion */}
      <TextField
        fullWidth
        multiline
        rows={4}
        label="Clinical Conclusion"
        value={conclusion}
        onChange={(e) => setConclusion(e.target.value)}
        sx={{ mb: 2 }}
      />
      
      {/* Action buttons */}
      <Stack direction="row" spacing={2}>
        <Button 
          variant="contained" 
          onClick={saveReport}
          disabled={!conclusion.trim()}
        >
          Save Report
        </Button>
        <Button 
          variant="outlined"
          onClick={() => setReportStatus('final')}
          disabled={reportStatus === 'final'}
        >
          Finalize
        </Button>
      </Stack>
    </Box>
  );
};
```

## Phase 5: Advanced Features and Optimization

### Objectives
- Implement real-time updates with WebSocket integration
- Add advanced caching and performance optimization
- Create comprehensive audit trails
- Enhance security and access controls

### Technical Implementation

#### 5.1 Real-Time Updates

**WebSocket Integration for Imaging**
```javascript
// File: frontend/src/hooks/useRealtimeImagingUpdates.js
export const useRealtimeImagingUpdates = (patientId) => {
  const { subscribe } = useWebSocket();
  const [updates, setUpdates] = useState([]);
  
  useEffect(() => {
    const unsubscribe = subscribe('imaging-updates', {
      resourceTypes: ['ImagingStudy', 'DiagnosticReport'],
      patients: [patientId],
      events: ['create', 'update', 'status-change']
    }, (update) => {
      setUpdates(prev => [update, ...prev.slice(0, 9)]); // Keep last 10 updates
      
      // Handle specific update types
      switch (update.eventType) {
        case 'study-completed':
          showNotification('New imaging study available', 'success');
          break;
        case 'report-finalized':
          showNotification('Imaging report finalized', 'info');
          break;
        case 'critical-finding':
          showNotification('Critical finding detected', 'error');
          break;
      }
    });
    
    return unsubscribe;
  }, [patientId, subscribe]);
  
  return updates;
};
```

#### 5.2 Advanced Caching Strategy

**Smart Caching for Imaging Resources**
```javascript
// File: frontend/src/services/imagingCacheService.js
export class ImagingCacheService {
  constructor() {
    this.studyCache = new Map();
    this.providerCache = new Map();
    this.facilityCache = new Map();
    this.thumbnailCache = new Map();
  }
  
  async getCachedStudy(studyId, maxAge = 300000) { // 5 minutes default
    const cached = this.studyCache.get(studyId);
    
    if (cached && Date.now() - cached.timestamp < maxAge) {
      return cached.data;
    }
    
    // Fetch fresh data
    const study = await this.fetchStudy(studyId);
    this.studyCache.set(studyId, {
      data: study,
      timestamp: Date.now()
    });
    
    return study;
  }
  
  async preloadThumbnails(studies) {
    const thumbnailPromises = studies.map(async (study) => {
      if (!this.thumbnailCache.has(study.id)) {
        try {
          const thumbnail = await this.generateThumbnail(study);
          this.thumbnailCache.set(study.id, thumbnail);
        } catch (error) {
          // Thumbnail generation failed, continue
        }
      }
    });
    
    await Promise.allSettled(thumbnailPromises);
  }
  
  clearCache() {
    this.studyCache.clear();
    this.providerCache.clear();
    this.facilityCache.clear();
    this.thumbnailCache.clear();
  }
}
```

## Testing Strategy

### Comprehensive Testing Plan

#### Unit Testing
- **Component tests**: Each new component with >90% coverage
- **Service tests**: All service methods with mock dependencies
- **Hook tests**: Custom hooks with state management verification
- **Utility tests**: Helper functions and calculations

#### Integration Testing
- **FHIR search integration**: Verify search parameter handling
- **Provider resolution**: Test provider lookup and caching
- **Facility operations**: Multi-facility workflow testing
- **Report workflow**: End-to-end report creation and finalization

#### Performance Testing
- **Large dataset handling**: Test with 1000+ studies
- **Search response time**: <200ms for filtered searches
- **Virtual scrolling**: Smooth scrolling with large lists
- **Memory usage**: Monitor for memory leaks in long sessions

#### User Acceptance Testing
- **Radiologist workflow**: Complete study interpretation workflow
- **Technologist operations**: Study completion and transfer
- **Administrator setup**: Facility and provider configuration
- **Multi-facility scenarios**: Cross-facility consultation testing

## Risk Mitigation

### Technical Risks
- **Performance degradation**: Implement progressive loading and caching
- **FHIR compliance**: Extensive testing with FHIR validation tools
- **Data consistency**: Robust error handling and retry mechanisms
- **Integration complexity**: Phased implementation with rollback capability

### User Experience Risks
- **Learning curve**: Comprehensive documentation and training materials
- **Workflow disruption**: Maintain backward compatibility throughout
- **Performance expectations**: Clear communication about new capabilities
- **Change management**: Gradual feature rollout with user feedback

## Success Metrics

### Performance Metrics
- Search response time: <200ms for advanced searches
- Study loading time: <500ms for individual studies
- Large dataset handling: Support 1000+ studies without degradation
- Memory usage: <100MB additional overhead

### Functional Metrics
- Provider attribution: 100% of studies show performing providers
- Multi-facility support: Seamless operation across facilities
- Order correlation: 95% accurate order-to-study matching
- Report workflow: Complete order-to-report cycle in <30 minutes

### User Experience Metrics
- User satisfaction: >85% positive feedback on new features
- Workflow efficiency: 25% reduction in time to complete imaging workflow
- Error rates: <1% errors in enhanced features
- Training effectiveness: 90% users proficient within 2 weeks

## Conclusion

This implementation plan provides a comprehensive roadmap for enhancing the Imaging Tab to fully leverage FHIR R4 capabilities. The phased approach ensures manageable development cycles while delivering immediate value at each stage. The focus on performance, testing, and user experience ensures successful adoption and scalability for enterprise healthcare environments.

The implementation will transform the Imaging Tab from a capable study viewer into a comprehensive radiology workflow management system, providing exceptional educational value while delivering production-ready enterprise imaging capabilities.