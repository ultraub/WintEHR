# Clinical Workspace Module Implementation Plan

**Created**: 2025-01-10  
**Status**: Implementation Planning  
**Priority**: High

## Executive Summary

This comprehensive plan addresses critical gaps in the Clinical Workspace module:
1. **Immediate Fixes**: Missing ClinicalWorkflow integration, mock data removal, error handling
2. **Architecture Enhancement**: Multi-version FHIR support (R4, R5, R6)
3. **Compliance**: Full FHIR standards compliance and validation

## Part 1: Immediate Implementation Fixes

### 1.1 ClinicalWorkflow Context Integration

**Affected Components**: EncountersTab, ImagingTab, CDSHooksTab

#### Implementation Pattern
```javascript
// Standard integration pattern for each tab
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

const TabComponent = ({ patient }) => {
  const { publish, subscribe } = useClinicalWorkflow();
  
  // Subscribe to relevant events
  useEffect(() => {
    const unsubscribers = [];
    
    // Subscribe to events this tab cares about
    const relevantEvents = [
      CLINICAL_EVENTS.ORDER_PLACED,
      CLINICAL_EVENTS.RESULT_RECEIVED,
      CLINICAL_EVENTS.MEDICATION_DISPENSED
    ];
    
    relevantEvents.forEach(eventType => {
      const unsubscribe = subscribe(eventType, (data) => {
        if (data.patientId === patient?.id) {
          refreshData();
        }
      });
      unsubscribers.push(unsubscribe);
    });
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [subscribe, patient?.id]);
  
  // Publish events when actions occur
  const handleAction = async (actionData) => {
    try {
      // Perform action
      await performAction(actionData);
      
      // Publish event
      await publish(CLINICAL_EVENTS.RELEVANT_EVENT, {
        patientId: patient.id,
        ...actionData
      });
    } catch (error) {
      handleError(error);
    }
  };
};
```

#### Integration Details by Tab

**EncountersTab**:
- Subscribe to: ORDER_PLACED, RESULT_RECEIVED, MEDICATION_PRESCRIBED
- Publish: ENCOUNTER_CREATED, ENCOUNTER_UPDATED, DOCUMENTATION_ADDED

**ImagingTab**:
- Subscribe to: ORDER_PLACED (for imaging orders), RESULT_RECEIVED
- Publish: IMAGING_STUDY_VIEWED, REPORT_GENERATED, COMPARISON_REQUESTED

**CDSHooksTab**:
- Subscribe to: All clinical events for triggering decision support
- Publish: CDS_ALERT_TRIGGERED, CDS_RECOMMENDATION_ACCEPTED

### 1.2 CarePlanTab Mock Data Replacement

**Current Issue**: Progress percentage hardcoded (0%, 60%, 100%)

#### FHIR-Compliant Goal Progress Solution
```javascript
// Create Goal observations for tracking progress
const createGoalProgressObservation = async (goalId, progressValue, patientId) => {
  const observation = {
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '8099-1',
        display: 'Goal achievement status'
      }]
    },
    subject: { reference: `Patient/${patientId}` },
    focus: [{ reference: `Goal/${goalId}` }],
    effectiveDateTime: new Date().toISOString(),
    valueQuantity: {
      value: progressValue,
      unit: '%',
      system: 'http://unitsofmeasure.org',
      code: '%'
    }
  };
  
  return await fhirService.createResource('Observation', observation);
};

// Calculate progress from observations
const calculateGoalProgress = (goal, observations) => {
  // Find all observations related to this goal
  const goalObservations = observations.filter(obs => 
    obs.focus?.some(ref => ref.reference === `Goal/${goal.id}`)
  );
  
  if (goalObservations.length === 0) {
    return 0;
  }
  
  // Get the most recent observation
  const latestObservation = goalObservations.sort((a, b) => 
    new Date(b.effectiveDateTime) - new Date(a.effectiveDateTime)
  )[0];
  
  return latestObservation.valueQuantity?.value || 0;
};

// Update GoalCard component
const GoalCard = ({ goal, patient }) => {
  const [progress, setProgress] = useState(0);
  const { resources: observations } = usePatientResources(patient?.id, 'Observation');
  
  useEffect(() => {
    if (observations && goal) {
      const calculatedProgress = calculateGoalProgress(goal, observations);
      setProgress(calculatedProgress);
    }
  }, [observations, goal]);
  
  // Use actual progress instead of hardcoded values
  const progressPercentage = progress;
};
```

### 1.3 Comprehensive Error Handling

**Pattern for all tabs**:
```javascript
const TabComponent = ({ patient }) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  
  const handleError = (error, context) => {
    console.error(`Error in ${context}:`, error);
    
    // Set local error state for display
    setError({
      message: error.message || 'An unexpected error occurred',
      context,
      timestamp: new Date().toISOString()
    });
    
    // Show user-friendly notification
    enqueueSnackbar(
      error.userMessage || 'Operation failed. Please try again.',
      { variant: 'error' }
    );
    
    // Log to monitoring service (future)
    // errorTrackingService.logError(error, { context, patient: patient?.id });
  };
  
  const performOperation = async () => {
    try {
      setLoading(true);
      setError(null);
      // ... operation logic
    } catch (err) {
      handleError(err, 'performOperation');
      // Optionally rethrow for caller handling
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  // Error display component
  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      >
        <AlertTitle>Error in {error.context}</AlertTitle>
        {error.message}
      </Alert>
    );
  }
};
```

## Part 2: Multi-Version FHIR Architecture

### 2.1 Version Abstraction Layer Design

```python
# backend/core/fhir/version_abstraction.py
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from enum import Enum

class FHIRVersion(Enum):
    R4 = "4.0.1"
    R4B = "4.3.0"
    R5 = "5.0.0"
    R6 = "6.0.0"  # Future

class FHIRVersionHandler(ABC):
    """Abstract base class for FHIR version handlers"""
    
    @abstractmethod
    def get_version(self) -> FHIRVersion:
        pass
    
    @abstractmethod
    def validate_resource(self, resource: Dict[str, Any]) -> bool:
        pass
    
    @abstractmethod
    def transform_to_r4(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Transform resource to R4 format for storage"""
        pass
    
    @abstractmethod
    def transform_from_r4(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Transform R4 resource to target version"""
        pass
    
    @abstractmethod
    def get_search_parameters(self, resource_type: str) -> List[str]:
        pass

class FHIRR4Handler(FHIRVersionHandler):
    def get_version(self) -> FHIRVersion:
        return FHIRVersion.R4
    
    def validate_resource(self, resource: Dict[str, Any]) -> bool:
        # R4 validation logic
        return True  # Already R4
    
    def transform_to_r4(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        return resource  # No transformation needed
    
    def transform_from_r4(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        return resource  # No transformation needed

class FHIRR5Handler(FHIRVersionHandler):
    def get_version(self) -> FHIRVersion:
        return FHIRVersion.R5
    
    def validate_resource(self, resource: Dict[str, Any]) -> bool:
        # R5 specific validation
        return self._validate_r5_structure(resource)
    
    def transform_to_r4(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Transform R5 to R4 for storage"""
        transformed = resource.copy()
        
        # Handle R5 -> R4 differences
        if resource.get('resourceType') == 'Patient':
            # R5 uses 'link' instead of R4's 'link'
            if 'link' in transformed:
                # Transform link structure
                pass
        
        # Remove R5-only fields
        r5_only_fields = self._get_r5_only_fields(resource.get('resourceType'))
        for field in r5_only_fields:
            transformed.pop(field, None)
        
        return transformed
    
    def transform_from_r4(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Transform R4 to R5 for output"""
        transformed = resource.copy()
        
        # Add R5 required fields
        if resource.get('resourceType') == 'Patient':
            # Add R5 specific fields
            pass
        
        return transformed

class FHIRVersionManager:
    """Manages multiple FHIR version handlers"""
    
    def __init__(self):
        self._handlers = {
            FHIRVersion.R4: FHIRR4Handler(),
            FHIRVersion.R5: FHIRR5Handler(),
            # R6 handler when available
        }
    
    def get_handler(self, version: FHIRVersion) -> FHIRVersionHandler:
        if version not in self._handlers:
            raise ValueError(f"Unsupported FHIR version: {version}")
        return self._handlers[version]
    
    def detect_version(self, resource: Dict[str, Any]) -> FHIRVersion:
        """Detect FHIR version from resource"""
        # Check meta.profile
        if 'meta' in resource and 'profile' in resource['meta']:
            profiles = resource['meta']['profile']
            for profile in profiles:
                if 'hl7.org/fhir/R5' in profile:
                    return FHIRVersion.R5
                elif 'hl7.org/fhir/R4' in profile:
                    return FHIRVersion.R4
        
        # Check for version-specific fields
        if self._has_r5_fields(resource):
            return FHIRVersion.R5
        
        # Default to R4
        return FHIRVersion.R4
```

### 2.2 Storage Layer Enhancement

```python
# backend/core/fhir/storage_multiversion.py
class MultiVersionFHIRStorageEngine(FHIRStorageEngine):
    """Enhanced storage engine with multi-version support"""
    
    def __init__(self, db_session):
        super().__init__(db_session)
        self.version_manager = FHIRVersionManager()
    
    async def create_resource(
        self, 
        resource_type: str, 
        data: dict,
        version: FHIRVersion = None
    ) -> dict:
        """Create resource with version support"""
        # Detect version if not provided
        if version is None:
            version = self.version_manager.detect_version(data)
        
        handler = self.version_manager.get_handler(version)
        
        # Validate resource for its version
        if not handler.validate_resource(data):
            raise ValueError(f"Invalid {version.value} resource")
        
        # Transform to R4 for storage
        r4_data = handler.transform_to_r4(data)
        
        # Store original version in meta
        if 'meta' not in r4_data:
            r4_data['meta'] = {}
        r4_data['meta']['_originalVersion'] = version.value
        
        # Create using base method
        created = await super().create_resource(resource_type, r4_data)
        
        # Transform back to requested version
        return handler.transform_from_r4(created)
    
    async def get_resource(
        self,
        resource_type: str,
        resource_id: str,
        version: FHIRVersion = FHIRVersion.R4
    ) -> dict:
        """Get resource in specified version"""
        # Get R4 resource from storage
        resource = await super().get_resource(resource_type, resource_id)
        
        # Transform to requested version
        handler = self.version_manager.get_handler(version)
        return handler.transform_from_r4(resource)
```

### 2.3 API Layer Multi-Version Support

```python
# backend/api/fhir/multiversion_router.py
from fastapi import APIRouter, Depends, Header
from typing import Optional

def get_fhir_version(
    accept: Optional[str] = Header(None),
    _format: Optional[str] = Query(None)
) -> FHIRVersion:
    """Determine FHIR version from request"""
    # Check _format parameter
    if _format:
        if 'fhir+json; fhirVersion=4.0' in _format:
            return FHIRVersion.R4
        elif 'fhir+json; fhirVersion=5.0' in _format:
            return FHIRVersion.R5
    
    # Check Accept header
    if accept:
        if 'fhirVersion=5.0' in accept:
            return FHIRVersion.R5
        elif 'fhirVersion=4.0' in accept:
            return FHIRVersion.R4
    
    # Default to R4
    return FHIRVersion.R4

# Create version-specific routers
r4_router = APIRouter(prefix="/R4", tags=["FHIR R4"])
r5_router = APIRouter(prefix="/R5", tags=["FHIR R5"])

# Shared endpoint logic
async def create_resource_endpoint(
    resource_type: str,
    resource: dict,
    version: FHIRVersion,
    storage: MultiVersionFHIRStorageEngine = Depends(get_storage)
):
    """Create resource with version support"""
    try:
        created = await storage.create_resource(
            resource_type,
            resource,
            version=version
        )
        return JSONResponse(
            content=created,
            status_code=201,
            headers={
                "Content-Type": f"application/fhir+json; fhirVersion={version.value}"
            }
        )
    except Exception as e:
        return OperationOutcome.error(str(e))

# R4 endpoints
@r4_router.post("/{resource_type}")
async def create_r4_resource(
    resource_type: str,
    resource: dict,
    storage: MultiVersionFHIRStorageEngine = Depends(get_storage)
):
    return await create_resource_endpoint(
        resource_type, 
        resource, 
        FHIRVersion.R4,
        storage
    )

# R5 endpoints
@r5_router.post("/{resource_type}")
async def create_r5_resource(
    resource_type: str,
    resource: dict,
    storage: MultiVersionFHIRStorageEngine = Depends(get_storage)
):
    return await create_resource_endpoint(
        resource_type,
        resource,
        FHIRVersion.R5,
        storage
    )
```

### 2.4 Frontend Multi-Version Support

```javascript
// frontend/src/services/fhirMultiVersionService.js
class FHIRMultiVersionService {
  constructor() {
    this.defaultVersion = 'R4';
    this.supportedVersions = ['R4', 'R5'];
  }
  
  async createResource(resourceType, resource, options = {}) {
    const version = options.version || this.defaultVersion;
    const endpoint = `/fhir/${version}/${resourceType}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': `application/fhir+json; fhirVersion=${this.getVersionNumber(version)}`,
        'Accept': `application/fhir+json; fhirVersion=${this.getVersionNumber(version)}`,
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(resource)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create ${resourceType}`);
    }
    
    return response.json();
  }
  
  getVersionNumber(version) {
    const versionMap = {
      'R4': '4.0.1',
      'R5': '5.0.0'
    };
    return versionMap[version] || '4.0.1';
  }
  
  // Version-specific transformations for frontend
  transformResourceForDisplay(resource, fromVersion, toVersion) {
    if (fromVersion === toVersion) return resource;
    
    // Handle version differences in display
    const transformed = { ...resource };
    
    if (resource.resourceType === 'Patient' && fromVersion === 'R5' && toVersion === 'R4') {
      // Handle R5->R4 display differences
      // e.g., different field names or structures
    }
    
    return transformed;
  }
}

// Hook for version-aware FHIR operations
export const useFHIRMultiVersion = (defaultVersion = 'R4') => {
  const [version, setVersion] = useState(defaultVersion);
  const service = useMemo(() => new FHIRMultiVersionService(), []);
  
  const createResource = useCallback(async (resourceType, resource) => {
    return service.createResource(resourceType, resource, { version });
  }, [service, version]);
  
  return {
    version,
    setVersion,
    createResource,
    supportedVersions: service.supportedVersions
  };
};
```

## Part 3: Migration Framework

### 3.1 Version Migration Tools

```python
# backend/core/fhir/migrations/version_migrator.py
class FHIRVersionMigrator:
    """Handles migration between FHIR versions"""
    
    def __init__(self):
        self.migrations = {
            (FHIRVersion.R4, FHIRVersion.R5): R4ToR5Migration(),
            (FHIRVersion.R5, FHIRVersion.R4): R5ToR4Migration(),
        }
    
    def migrate_resource(
        self,
        resource: Dict[str, Any],
        from_version: FHIRVersion,
        to_version: FHIRVersion
    ) -> Dict[str, Any]:
        """Migrate resource between versions"""
        if from_version == to_version:
            return resource
        
        migration_key = (from_version, to_version)
        if migration_key not in self.migrations:
            raise ValueError(f"No migration path from {from_version} to {to_version}")
        
        migration = self.migrations[migration_key]
        return migration.migrate(resource)

class R4ToR5Migration:
    """Migrates resources from R4 to R5"""
    
    def migrate(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        resource_type = resource.get('resourceType')
        
        if resource_type == 'Patient':
            return self._migrate_patient(resource)
        elif resource_type == 'Observation':
            return self._migrate_observation(resource)
        # ... other resource types
        
        return resource
    
    def _migrate_patient(self, patient: Dict[str, Any]) -> Dict[str, Any]:
        migrated = patient.copy()
        
        # R5 changes for Patient
        # 1. contact.relationship is now CodeableConcept (was Coding in R4)
        if 'contact' in migrated:
            for contact in migrated['contact']:
                if 'relationship' in contact:
                    # Transform to CodeableConcept
                    contact['relationship'] = [{
                        'coding': contact['relationship']
                    }]
        
        # 2. Add new R5 fields
        migrated['meta'] = migrated.get('meta', {})
        migrated['meta']['profile'] = ['http://hl7.org/fhir/R5/Patient']
        
        return migrated
```

### 3.2 Bulk Migration Support

```python
# backend/scripts/migrate_fhir_versions.py
import asyncio
from typing import List, Dict
import click

class BulkVersionMigrator:
    def __init__(self, storage_engine, version_migrator):
        self.storage = storage_engine
        self.migrator = version_migrator
    
    async def migrate_all_resources(
        self,
        from_version: FHIRVersion,
        to_version: FHIRVersion,
        resource_types: List[str] = None
    ):
        """Migrate all resources to a new version"""
        if resource_types is None:
            resource_types = SUPPORTED_RESOURCE_TYPES
        
        results = {
            'success': 0,
            'failed': 0,
            'errors': []
        }
        
        for resource_type in resource_types:
            click.echo(f"Migrating {resource_type} resources...")
            
            # Get all resources of this type
            resources = await self.storage.search_resources(
                resource_type,
                {"_count": 1000}  # Process in batches
            )
            
            for resource in resources:
                try:
                    # Migrate resource
                    migrated = self.migrator.migrate_resource(
                        resource,
                        from_version,
                        to_version
                    )
                    
                    # Update in storage
                    await self.storage.update_resource(
                        resource_type,
                        resource['id'],
                        migrated,
                        version=to_version
                    )
                    
                    results['success'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append({
                        'resource': f"{resource_type}/{resource['id']}",
                        'error': str(e)
                    })
            
        return results

@click.command()
@click.option('--from-version', type=click.Choice(['R4', 'R5']), required=True)
@click.option('--to-version', type=click.Choice(['R4', 'R5']), required=True)
@click.option('--resource-types', multiple=True)
@click.option('--dry-run', is_flag=True)
async def migrate_versions(from_version, to_version, resource_types, dry_run):
    """Migrate FHIR resources between versions"""
    # Setup
    storage = await get_storage_engine()
    version_migrator = FHIRVersionMigrator()
    bulk_migrator = BulkVersionMigrator(storage, version_migrator)
    
    if dry_run:
        click.echo("DRY RUN - No changes will be made")
    
    # Run migration
    results = await bulk_migrator.migrate_all_resources(
        FHIRVersion[from_version],
        FHIRVersion[to_version],
        list(resource_types) if resource_types else None
    )
    
    # Report results
    click.echo(f"\nMigration Complete:")
    click.echo(f"  Success: {results['success']}")
    click.echo(f"  Failed: {results['failed']}")
    
    if results['errors']:
        click.echo("\nErrors:")
        for error in results['errors'][:10]:  # Show first 10
            click.echo(f"  {error['resource']}: {error['error']}")
```

## Part 4: Testing Requirements

### 4.1 Unit Tests for Version Support

```python
# backend/tests/test_fhir_versions.py
import pytest
from core.fhir.version_abstraction import FHIRVersionManager, FHIRVersion

class TestFHIRVersionSupport:
    @pytest.fixture
    def version_manager(self):
        return FHIRVersionManager()
    
    def test_r4_to_r5_patient_migration(self, version_manager):
        """Test Patient resource migration from R4 to R5"""
        r4_patient = {
            "resourceType": "Patient",
            "id": "123",
            "contact": [{
                "relationship": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0131",
                    "code": "E"
                }],
                "name": {
                    "family": "Smith"
                }
            }]
        }
        
        r5_handler = version_manager.get_handler(FHIRVersion.R5)
        r5_patient = r5_handler.transform_from_r4(r4_patient)
        
        # Verify R5 structure
        assert r5_patient['contact'][0]['relationship'][0]['coding'] is not None
    
    def test_version_detection(self, version_manager):
        """Test automatic version detection"""
        r5_resource = {
            "resourceType": "Patient",
            "meta": {
                "profile": ["http://hl7.org/fhir/R5/Patient"]
            }
        }
        
        detected = version_manager.detect_version(r5_resource)
        assert detected == FHIRVersion.R5
    
    @pytest.mark.asyncio
    async def test_multi_version_storage(self, storage_engine):
        """Test storing and retrieving in different versions"""
        # Create R5 patient
        r5_patient = create_r5_patient()
        created = await storage_engine.create_resource(
            "Patient",
            r5_patient,
            version=FHIRVersion.R5
        )
        
        # Retrieve as R4
        r4_patient = await storage_engine.get_resource(
            "Patient",
            created['id'],
            version=FHIRVersion.R4
        )
        
        # Verify R4 structure
        assert 'resourceType' in r4_patient
        assert r4_patient['resourceType'] == 'Patient'
```

### 4.2 Integration Tests

```javascript
// frontend/src/tests/multiversion.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { useFHIRMultiVersion } from '../services/fhirMultiVersionService';

describe('Multi-version FHIR Support', () => {
  test('creates resource with R5 version', async () => {
    const { result } = renderHook(() => useFHIRMultiVersion('R5'));
    
    const patient = {
      resourceType: 'Patient',
      name: [{ family: 'Test', given: ['Multi', 'Version'] }]
    };
    
    let created;
    await act(async () => {
      created = await result.current.createResource('Patient', patient);
    });
    
    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
  });
  
  test('switches between versions', () => {
    const { result } = renderHook(() => useFHIRMultiVersion());
    
    expect(result.current.version).toBe('R4');
    
    act(() => {
      result.current.setVersion('R5');
    });
    
    expect(result.current.version).toBe('R5');
  });
});
```

## Part 5: Compliance Validation

### 5.1 FHIR Compliance Suite

```python
# backend/core/fhir/compliance/validator.py
from fhir.resources.R4B import fhirdate
from fhir.resources import construct_fhir_element
import jsonschema

class FHIRComplianceValidator:
    """Comprehensive FHIR compliance validation"""
    
    def __init__(self, version: FHIRVersion):
        self.version = version
        self.schema_loader = FHIRSchemaLoader(version)
    
    def validate_resource(self, resource: Dict[str, Any]) -> ValidationResult:
        """Perform comprehensive validation"""
        result = ValidationResult()
        
        # 1. Structure validation
        structure_errors = self._validate_structure(resource)
        result.add_errors('structure', structure_errors)
        
        # 2. Cardinality validation
        cardinality_errors = self._validate_cardinality(resource)
        result.add_errors('cardinality', cardinality_errors)
        
        # 3. Value set validation
        valueset_errors = self._validate_valuesets(resource)
        result.add_errors('valueset', valueset_errors)
        
        # 4. Reference validation
        reference_errors = self._validate_references(resource)
        result.add_errors('reference', reference_errors)
        
        # 5. Business rule validation
        business_errors = self._validate_business_rules(resource)
        result.add_errors('business', business_errors)
        
        return result
    
    def _validate_structure(self, resource: Dict[str, Any]) -> List[str]:
        """Validate resource structure against schema"""
        errors = []
        resource_type = resource.get('resourceType')
        
        if not resource_type:
            errors.append("Missing resourceType")
            return errors
        
        schema = self.schema_loader.get_schema(resource_type)
        try:
            jsonschema.validate(resource, schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Schema validation failed: {e.message}")
        
        return errors
    
    def _validate_cardinality(self, resource: Dict[str, Any]) -> List[str]:
        """Validate field cardinality requirements"""
        errors = []
        resource_type = resource.get('resourceType')
        cardinality_rules = self.schema_loader.get_cardinality_rules(resource_type)
        
        for field, rule in cardinality_rules.items():
            value = resource.get(field)
            
            if rule['min'] > 0 and not value:
                errors.append(f"Required field '{field}' is missing")
            
            if rule['max'] == 1 and isinstance(value, list):
                errors.append(f"Field '{field}' must not be an array")
            
            if rule['max'] != '*' and isinstance(value, list) and len(value) > rule['max']:
                errors.append(f"Field '{field}' exceeds maximum cardinality of {rule['max']}")
        
        return errors
```

### 5.2 Continuous Compliance Monitoring

```python
# backend/api/clinical/compliance_monitor.py
class ComplianceMonitor:
    """Monitor FHIR compliance in real-time"""
    
    def __init__(self, storage_engine):
        self.storage = storage_engine
        self.validator = FHIRComplianceValidator(FHIRVersion.R4)
        self.metrics = ComplianceMetrics()
    
    async def validate_on_create(self, resource_type: str, resource: Dict[str, Any]):
        """Validate resource on creation"""
        result = self.validator.validate_resource(resource)
        
        # Log validation results
        self.metrics.record_validation(resource_type, result)
        
        if not result.is_valid():
            # Determine if we should reject or warn
            if result.has_critical_errors():
                raise ValidationError(f"Critical validation errors: {result.get_critical_errors()}")
            else:
                # Log warnings but allow creation
                logger.warning(f"Validation warnings for {resource_type}: {result.get_warnings()}")
        
        return result
    
    async def audit_compliance(self, resource_types: List[str] = None):
        """Audit existing resources for compliance"""
        if resource_types is None:
            resource_types = SUPPORTED_RESOURCE_TYPES
        
        report = ComplianceReport()
        
        for resource_type in resource_types:
            resources = await self.storage.search_resources(resource_type, {"_count": 100})
            
            for resource in resources:
                result = self.validator.validate_resource(resource)
                report.add_result(resource_type, resource['id'], result)
        
        return report
```

## Implementation Timeline

### Phase 1: Immediate Fixes (Week 1)
- Day 1-2: Implement ClinicalWorkflow integration for 3 tabs
- Day 3-4: Replace CarePlanTab mock data with FHIR observations
- Day 5: Implement comprehensive error handling

### Phase 2: Version Abstraction Design (Week 2)
- Day 1-2: Design and implement version abstraction layer
- Day 3-4: Create version handlers for R4 and R5
- Day 5: Implement version detection and transformation logic

### Phase 3: Storage & API Updates (Week 3)
- Day 1-2: Enhance storage engine with multi-version support
- Day 3-4: Update API endpoints for version negotiation
- Day 5: Implement frontend multi-version service

### Phase 4: Migration Framework (Week 4)
- Day 1-2: Build migration tools and transformers
- Day 3-4: Create bulk migration scripts
- Day 5: Test migration scenarios

### Phase 5: Testing & Validation (Week 5)
- Day 1-2: Write comprehensive unit tests
- Day 3-4: Integration testing for version support
- Day 5: Compliance validation suite

### Phase 6: Documentation & Deployment (Week 6)
- Day 1-2: Update all documentation
- Day 3-4: Create migration guides
- Day 5: Deploy and monitor

## Success Metrics

1. **Immediate Fixes**
   - 100% of tabs have ClinicalWorkflow integration
   - No mock data in production code
   - Zero empty catch blocks

2. **Multi-Version Support**
   - Support for R4, R5 (R6 ready)
   - < 100ms version transformation time
   - 100% backward compatibility

3. **Compliance**
   - 100% FHIR validation pass rate
   - Automated compliance monitoring
   - Version-specific validation rules

4. **Testing**
   - > 80% code coverage for new features
   - All version transformations tested
   - E2E tests for multi-version scenarios

## Risk Mitigation

1. **Data Loss Risk**: All transformations are non-destructive, original data preserved
2. **Performance Risk**: Caching layer for transformed resources
3. **Compatibility Risk**: Extensive testing, gradual rollout
4. **Complexity Risk**: Clear abstraction boundaries, comprehensive documentation

## Conclusion

This implementation plan provides a systematic approach to:
1. Fix immediate gaps in the Clinical Workspace module
2. Implement robust multi-version FHIR support
3. Ensure full FHIR standards compliance

The phased approach allows for incremental delivery while maintaining system stability. The architecture is designed to be extensible for future FHIR versions (R6 and beyond) without requiring major refactoring.