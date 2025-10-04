# CLAUDE.md - FHIR Storage Engine Quick Reference

**Purpose**: Essential guide for AI agents working with WintEHR's FHIR storage engine - the core healthcare data layer that powers all clinical operations.

**Last Updated**: 2025-08-12  
**Version**: 2.0 - Comprehensive Architecture Guide

> **CRITICAL**: This module is the foundation of all healthcare data operations. Patient safety and data integrity depend on proper usage.

## 🎯 Overview

**WintEHR FHIR Engine** - Production-ready FHIR R4 storage and search implementation:

### Core Capabilities
- **Complete FHIR R4 Compliance**: 38+ resource types with full validation
- **Advanced Search Engine**: Complex parameter indexing, modifiers, chained searches
- **Patient Compartments**: Efficient patient-centric data access
- **Synthea Data Optimization**: Handles real-world synthetic patient data quirks
- **Performance Optimized**: Query optimization, caching, connection pooling
- **Multi-Version Support**: FHIR R4/R5/R6 with cross-version transformations
- **WebSocket Integration**: Real-time clinical event notifications
- **Audit Trail**: Complete resource history and change tracking

## 📁 Architecture & Directory Structure

```
backend/fhir/
├── CLAUDE.md                    # This guide - critical for AI agents
├── README.md                    # Technical documentation
├── api/                         # FHIR REST API layer
│   ├── router.py               # Main FHIR R4 endpoints (700+ lines)
│   ├── cache.py                # Memory caching system
│   ├── redis_cache.py          # Redis distributed caching
│   ├── notifications.py        # WebSocket event integration
│   └── include_optimizer.py    # _include/_revinclude optimization
├── core/                        # Core FHIR engine
│   ├── storage.py              # 🔥 FHIRStorageEngine - main class (2000+ lines)
│   ├── search_param_extraction.py # Search parameter extraction logic
│   ├── reference_utils.py      # Reference resolution and handling
│   ├── operations.py           # FHIR operations ($everything, etc.)
│   ├── search/                 # Advanced search implementation
│   │   ├── basic.py           # Core search parameter handling
│   │   ├── composite.py       # Composite search parameters
│   │   ├── query_builder.py   # SQL query construction
│   │   └── reference_handler.py # Reference chaining
│   ├── validators/             # Data validation pipeline
│   │   ├── synthea.py         # Synthea-specific validation
│   │   └── pipeline.py        # Validation orchestration
│   ├── converters/             # Multi-version FHIR support
│   └── versioning/             # Version negotiation
├── models/                      # FHIR resource models
│   ├── resource.py             # Base resource model
│   └── fhir_models.py          # Extended FHIR models
└── resource_definitions/        # Official FHIR specifications
    └── official_resources/      # R4/R5/R6 resource definitions
```

## 🔧 Core Components

### Database Schema (6 Critical Tables)

**Created by**: `scripts/setup/init_database_definitive.py`
**Schema**: `fhir.*` (PostgreSQL)

| Table | Purpose | Key Features | Performance |
|-------|---------|--------------|-------------|
| **`fhir.resources`** | Main resource storage | JSONB storage, unique constraints | Primary indexes on `resource_type`, `fhir_id` |
| **`fhir.search_params`** | Search parameter indexes | All search types supported | Compound indexes for fast queries |
| **`fhir.compartments`** | Patient compartments | Patient/$everything optimization | Patient-centric access |
| **`fhir.references`** | Resource relationships | Cross-resource navigation | Reference integrity |
| **`fhir.resource_history`** | Version tracking | Complete audit trail | Temporal queries |
| **`fhir.audit_logs`** | Security audit | Change tracking | Compliance reporting |

**Critical Schema Details**:
```sql
-- Main resource storage with versioning
fhir.resources (
    id BIGSERIAL PRIMARY KEY,
    resource_type VARCHAR(255) NOT NULL,
    fhir_id VARCHAR(255) NOT NULL UNIQUE,
    version_id INTEGER DEFAULT 1,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resource JSONB NOT NULL,  -- Full FHIR resource
    deleted BOOLEAN DEFAULT FALSE
);

-- Search parameter indexing for performance
fhir.search_params (
    id BIGSERIAL PRIMARY KEY,
    resource_id BIGINT NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    param_name VARCHAR(100) NOT NULL,      -- 'patient', 'code', 'status', etc.
    param_type VARCHAR(20) NOT NULL,       -- 'reference', 'token', 'string', etc.
    value_string TEXT,                     -- For string/token params
    value_reference TEXT,                  -- For references
    value_date TIMESTAMP WITH TIME ZONE,   -- For date params
    value_number NUMERIC,                  -- For numeric params
    value_quantity_value NUMERIC,         -- For quantity params
    value_quantity_unit VARCHAR(50)
);
```

### 🔥 FHIRStorageEngine (`core/storage.py`)

**The Heart of WintEHR** - 2000+ line production storage engine

```python
class FHIRStorageEngine:
    """Production FHIR storage with PostgreSQL JSONB backend."""
    
    # === CORE CRUD OPERATIONS ===
    async def create_resource(resource_type: str, data: dict, 
                            validate: bool = True) -> dict
    async def update_resource(resource_type: str, resource_id: str, 
                            data: dict, validate: bool = True) -> dict
    async def get_resource(resource_type: str, resource_id: str) -> Optional[dict]
    async def delete_resource(resource_type: str, resource_id: str) -> dict
    
    # === ADVANCED SEARCH ===
    async def search_resources(resource_type: str, search_params: dict,
                             include_params: List[str] = None,
                             revinclude_params: List[str] = None) -> dict
    async def search_all_resources(search_params: dict) -> dict  # Cross-resource search
    
    # === FHIR OPERATIONS ===
    async def patient_everything(patient_id: str, start: str = None,
                               end: str = None) -> Bundle
    async def observation_lastn(patient_id: str, max_results: int = 1) -> Bundle
    
    # === BUNDLE PROCESSING ===
    async def process_bundle(bundle: dict, validate: bool = True) -> dict
    async def transaction_bundle(bundle: dict) -> dict
    
    # === VERSION MANAGEMENT ===
    async def get_resource_history(resource_type: str, resource_id: str) -> dict
    async def get_version(resource_type: str, resource_id: str, version_id: str) -> dict
```

**Critical Features**:
- **Automatic Search Indexing**: All resources get search parameters indexed on create/update
- **Reference Resolution**: Handles URN references from Synthea data
- **Compartment Management**: Patient compartments updated automatically
- **Validation Pipeline**: SyntheaFHIRValidator with profile support
- **WebSocket Events**: Real-time notifications for clinical workflows
- **Performance Optimized**: Connection pooling, query optimization, caching

### 🔍 SearchParameterExtractor (`core/search_param_extraction.py`)

**Comprehensive search parameter extraction** for all 38+ FHIR resource types:

```python
class SearchParameterExtractor:
    """Centralized search parameter extraction with URN resolution."""
    
    @staticmethod
    def extract_parameters(resource_type: str, resource_data: dict) -> List[dict]:
        """Extract all searchable parameters from a FHIR resource."""
        
    # Supported parameter types:
    # - string: name, family, given
    # - token: identifier, code, status  
    # - reference: patient, subject, encounter
    # - date: birthdate, date, period
    # - number: value, score
    # - quantity: valueQuantity with units
    # - composite: component-code-value, etc.
    
    @classmethod
    def resolve_reference(cls, reference: str) -> str:
        """Resolve URN references to proper FHIR format."""
        # Converts 'urn:uuid:abc-123' -> 'Patient/abc-123'
        # Critical for Synthea data compatibility
```

**Key Resource Support**:
- **Patient**: name, identifier, birthdate, gender, address, telecom
- **Condition**: patient, code, clinical-status, onset-date, category
- **Observation**: patient, code, value, date, category, component-code-value
- **MedicationRequest**: patient, medication, status, authoring-date, category
- **Encounter**: patient, class, status, date, type, participant
- **DiagnosticReport**: patient, code, status, date, category, result
- **Procedure**: patient, code, status, date, category, performer
- **Immunization**: patient, vaccine-code, status, date, lot-number
- **AllergyIntolerance**: patient, code, clinical-status, type, category
- **CarePlan**: patient, status, date, category, activity-code

**URN Resolution**: Automatically converts Synthea URN references (`urn:uuid:*`) to proper FHIR references (`Patient/123`)

### 🔎 SearchParameterHandler (`core/search/basic.py`)

**Advanced FHIR search implementation** with full specification compliance:

```python
class SearchParameterHandler:
    """Comprehensive FHIR search with modifiers and chaining."""
    
    # Search Modifiers Support:
    STRING_MODIFIERS = {':exact', ':contains', ':text'}
    TOKEN_MODIFIERS = {':exact', ':text', ':not', ':above', ':below'}
    DATE_MODIFIERS = {':missing', ':exact', ':ne', ':lt', ':gt', ':ge', ':le'}
    REFERENCE_MODIFIERS = {':missing', ':type', ':identifier'}
    
    def parse_search_params(resource_type: str, raw_params: dict) -> tuple:
        """Parse and validate search parameters."""
        
    def build_search_query(resource_type: str, search_params: dict) -> str:
        """Build optimized SQL query from search parameters."""
```

**Advanced Search Features**:

**1. Search Modifiers**:
```
?name:exact=John          # Exact match
?name:contains=john       # Substring search  
?birthdate:ge=1970-01-01  # Greater than or equal
?status:not=inactive      # Negation
?code:text=diabetes       # Full-text search
```

**2. Chained Parameters**:
```
?subject:Patient.name=Smith              # Chain through patient
?encounter:Encounter.class=inpatient     # Chain through encounter
?medication:Medication.code=aspirin      # Chain through medication
```

**3. Composite Parameters**:
```
?component-code-value=8480-6$lt120       # Blood pressure < 120
?component-code-value=8462-6$gt80        # Diastolic BP > 80
```

**4. Special Parameters**:
```
?_has=Observation:patient:code=diabetes  # Reverse chaining
?_include=Condition:patient              # Include related resources
?_revinclude=Observation:patient         # Include referring resources
?_summary=true                           # Summary format only
```

**5. Performance Optimizations**:
- **Index-based queries**: All searches use search_params indexes
- **Query optimization**: Intelligent JOIN selection
- **Result caching**: Redis/memory caching for frequent searches
- **Pagination**: Efficient _count and _offset handling

### 🛠️ OperationHandler (`core/operations.py`)

**FHIR Operations Implementation** - Critical clinical workflows:

```python
class OperationHandler:
    """Implements FHIR operations for clinical workflows."""
    
    async def patient_everything(patient_id: str, start: str = None, 
                               end: str = None, _type: List[str] = None) -> Bundle:
        """Get all resources related to a patient."""
        # Uses patient compartments for efficiency
        # Supports date range filtering
        # Resource type filtering with _type parameter
        
    async def observation_lastn(patient_id: str, max_results: int = 1,
                              code: str = None, category: str = None) -> Bundle:
        """Get last N observations per code."""
        # Optimized for trend analysis
        # Supports vital signs, lab results grouping
        
    async def patient_match(resource: dict) -> Bundle:
        """Find matching patient records."""
        # Identity resolution for duplicate detection
        
    async def medication_dispense_summary(patient_id: str) -> Bundle:
        """Get medication dispensing summary."""
        # Pharmacy workflow support
```

**Supported Operations**:

| Operation | Endpoint | Purpose | Performance |
|-----------|----------|---------|-------------|
| **Patient/$everything** | `GET /Patient/123/$everything` | Complete patient record | Uses compartments |
| **Observation/$lastn** | `GET /Observation/$lastn?patient=123&max=5` | Latest observations | Optimized queries |
| **Patient/$match** | `POST /Patient/$match` | Identity resolution | Fuzzy matching |
| **Bundle/transaction** | `POST /Bundle` | Atomic operations | ACID compliance |
| **[type]/_search** | `POST /[type]/_search` | Complex searches | Body parameters |

**Patient/$everything Optimization**:
```python
# Uses pre-built compartments for speed
SELECT r.resource FROM fhir.resources r
JOIN fhir.compartments c ON c.resource_id = r.id
WHERE c.compartment_type = 'Patient' 
AND c.compartment_id = $patient_id
AND ($start IS NULL OR r.last_updated >= $start)
AND ($end IS NULL OR r.last_updated <= $end)
```

## ⚠️ Critical Implementation Requirements

### 🔥 Search Parameter Indexing (MANDATORY)

**Every FHIR resource MUST have search parameters indexed** for queries to work:

```python
# Automatic indexing during resource operations:
async def create_resource(self, resource_type: str, data: dict) -> dict:
    # 1. Validate resource
    # 2. Store in fhir.resources
    # 3. Extract search parameters  ← CRITICAL STEP
    # 4. Store in fhir.search_params
    # 5. Update compartments
    # 6. Send notifications
    
    await self._index_search_parameters(resource_type, resource_id, data)
```

**Manual Re-indexing** (if search parameters are missing):
```bash
# Comprehensive search parameter indexing
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index

# Verify search parameter health
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode monitor

# Fix missing patient/subject parameters
docker exec emr-backend python scripts/fix_allergy_intolerance_search_params_v2.py
```

### 🎯 Critical Search Parameters (Patient Safety)

| Parameter | Type | Resources | Purpose | Example |
|-----------|------|-----------|---------|----------|
| **patient/subject** | reference | 25+ resources | Patient-centric queries | `?patient=Patient/123` |
| **_id** | token | All resources | Direct resource access | `?_id=abc-123` |
| **code** | token | Clinical resources | Clinical coding | `?code=73211009` |
| **status** | token | Most resources | Lifecycle state | `?status=active` |
| **date** | date | Temporal resources | Time-based queries | `?date=ge2024-01-01` |
| **identifier** | token | Identity resources | Business identifiers | `?identifier=mrn|12345` |
| **category** | token | Categorized resources | Clinical categories | `?category=vital-signs` |

### 🚨 Synthea Data Quirks (MUST HANDLE)

**URN Reference Format**: Synthea uses `urn:uuid:patient-id` format that requires special handling:

```python
# Problem: Synthea references
"subject": {
    "reference": "urn:uuid:abc-123-def"  # Not standard FHIR
}

# Solution: SearchParameterExtractor.resolve_reference()
@classmethod
def resolve_reference(cls, reference: str) -> str:
    if reference.startswith('urn:uuid:'):
        uuid = reference[9:]  # Remove 'urn:uuid:' prefix
        return cls._urn_to_resource_map.get(uuid, f"Patient/{uuid}")
    return reference
```

**Search Parameter Storage**: URN references are stored in both `value_reference` and `value_string` columns for comprehensive searching.

### 🏗️ Patient Compartments (Performance Critical)

**Purpose**: Enable efficient Patient/$everything operations by pre-computing patient-resource relationships.

```sql
-- Compartments table structure
fhir.compartments (
    id BIGSERIAL PRIMARY KEY,
    compartment_type VARCHAR(50) NOT NULL,     -- 'Patient'
    compartment_id VARCHAR(255) NOT NULL,      -- Patient ID
    resource_type VARCHAR(50) NOT NULL,        -- 'Condition', 'Observation'
    resource_id BIGINT NOT NULL                -- FK to fhir.resources.id
);
```

**Automatic Population**: Compartments are updated during resource create/update based on patient references.

**Manual Population**:
```bash
docker exec emr-backend python scripts/populate_compartments.py
```

### 🔒 Validation Pipeline

**SyntheaFHIRValidator**: Handles real-world data validation with Synthea format support:

```python
class SyntheaFHIRValidator(FHIRValidator):
    def validate_resource(self, resource_type: str, resource_data: dict) -> OperationOutcome:
        # 1. Pre-process Synthea formats
        # 2. Structural validation against FHIR spec
        # 3. Profile validation (if specified)
        # 4. Business rule validation
        # 5. Reference validation
```

**Validation Levels**:
- **Structural**: FHIR resource structure compliance
- **Profile**: US Core and other profile validation  
- **Business**: Clinical business rules
- **References**: Cross-resource reference integrity

## 🚀 Essential Operations & Patterns

### Patient-Centric Clinical Queries

**Most common pattern in clinical applications** - always start with patient:

```python
# Get all active conditions for a patient
conditions = await storage.search_resources("Condition", {
    "patient": "Patient/123",
    "clinical-status": "active"
})

# Get recent vital signs
vitals = await storage.search_resources("Observation", {
    "patient": "Patient/123",
    "category": "vital-signs",
    "date": "ge2024-01-01"
})

# Get complete patient record (efficient)
everything = await storage.patient_everything("123", start="2024-01-01")
```

### Creating Resources (Full Lifecycle)

```python
# Complete resource creation with all steps
patient_data = {
    "resourceType": "Patient",
    "identifier": [{
        "use": "usual",
        "system": "http://hospital.example.org/mrn",
        "value": "MRN12345"
    }],
    "name": [{
        "family": "Smith",
        "given": ["John", "Robert"]
    }],
    "birthDate": "1970-01-01",
    "gender": "male"
}

# Full creation process (automatically handles all steps)
result = await storage.create_resource("Patient", patient_data, validate=True)

# What happens automatically:
# 1. SyntheaFHIRValidator validates structure
# 2. Resource stored in fhir.resources with version_id=1
# 3. Search parameters extracted and indexed in fhir.search_params
# 4. Patient compartment created in fhir.compartments
# 5. WebSocket notification sent for real-time updates
# 6. Resource history entry created

# Result structure:
{
    "id": "auto-generated-uuid",
    "meta": {
        "versionId": "1",
        "lastUpdated": "2024-08-12T10:30:00Z"
    },
    "resourceType": "Patient",
    # ... resource content
}
```

### Advanced Search Patterns

```python
# === BASIC SEARCHES ===
# Patient by name (supports partial matching)
patients = await storage.search_resources("Patient", {
    "name": "Smith"
})

# Active conditions with date range
conditions = await storage.search_resources("Condition", {
    "patient": "Patient/123",
    "clinical-status": "active",
    "onset-date": "ge2024-01-01"
})

# === MODIFIER SEARCHES ===
# Exact name match
patients = await storage.search_resources("Patient", {
    "name:exact": "John Smith"
})

# Recent observations (last 30 days)
observations = await storage.search_resources("Observation", {
    "patient": "Patient/123",
    "date": "ge" + (datetime.now() - timedelta(days=30)).isoformat()
})

# Vital signs with value range
vitals = await storage.search_resources("Observation", {
    "patient": "Patient/123",
    "category": "vital-signs",
    "component-code-value": "8480-6$gt120"  # Systolic BP > 120
})

# === INCLUDE SEARCHES ===
# Get encounters with practitioner details
encounters = await storage.search_resources("Encounter", {
    "patient": "Patient/123",
    "_include": "Encounter:practitioner"
})

# Get medications with prescribing practitioner
meds = await storage.search_resources("MedicationRequest", {
    "patient": "Patient/123",
    "status": "active",
    "_include": "MedicationRequest:requester"
})

# === CHAINED SEARCHES ===
# Find observations for patients named Smith
obs = await storage.search_resources("Observation", {
    "subject:Patient.name": "Smith",
    "category": "vital-signs"
})

# === COMPOSITE SEARCHES ===
# Blood pressure readings with specific values
bp_readings = await storage.search_resources("Observation", {
    "patient": "Patient/123",
    "component-code-value": [
        "8480-6$lt140",  # Systolic < 140
        "8462-6$lt90"    # Diastolic < 90  
    ]
})

# === RESULT FORMAT CONTROL ===
# Summary format for performance
summary = await storage.search_resources("Patient", {
    "_summary": "true",
    "_count": "10"
})

# Specific elements only
basic_info = await storage.search_resources("Patient", {
    "_elements": "name,birthDate,gender"
})
```

### Bundle Processing (ACID Transactions)

```python
# === TRANSACTION BUNDLE ===
# Atomic operations - all succeed or all fail
transaction_bundle = {
    "resourceType": "Bundle",
    "type": "transaction",
    "entry": [
        {
            "fullUrl": "urn:uuid:patient-1",
            "resource": {
                "resourceType": "Patient",
                "name": [{"family": "Smith", "given": ["John"]}]
            },
            "request": {
                "method": "POST",
                "url": "Patient"
            }
        },
        {
            "fullUrl": "urn:uuid:condition-1", 
            "resource": {
                "resourceType": "Condition",
                "subject": {"reference": "urn:uuid:patient-1"},
                "code": {"coding": [{"system": "http://snomed.info/sct", "code": "73211009"}]}
            },
            "request": {
                "method": "POST",
                "url": "Condition"
            }
        }
    ]
}

# Process with full ACID compliance
result = await storage.process_bundle(transaction_bundle)

# === BATCH BUNDLE ===
# Independent operations - some can fail
batch_bundle = {
    "resourceType": "Bundle",
    "type": "batch",
    "entry": [...]  # Same structure as transaction
}

result = await storage.process_bundle(batch_bundle)

# === BUNDLE PROCESSING FEATURES ===
# - Reference resolution: urn:uuid: references resolved to real IDs
# - Conditional operations: ifNoneExist, ifMatch, ifNoneMatch
# - Dependency ordering: Resources created in dependency order
# - Rollback on failure: Transaction bundles rollback on any failure
# - Performance optimized: Bulk operations where possible
```

### Resource Versioning & History

```python
# Get resource history
history = await storage.get_resource_history("Patient", "123")

# Get specific version
version_2 = await storage.get_version("Patient", "123", "2")

# Update creates new version automatically
updated = await storage.update_resource("Patient", "123", updated_data)
# Creates version_id = 3, preserves version 1 and 2
```

## 🐛 Troubleshooting & Performance

### Performance Monitoring

```bash
# Check database performance
docker exec emr-postgres psql -U emr_user -d emr_db -c "
EXPLAIN ANALYZE 
SELECT r.resource FROM fhir.resources r
JOIN fhir.search_params sp ON sp.resource_id = r.id
WHERE sp.param_name = 'patient' AND sp.value_reference = 'Patient/123';"

# Monitor search parameter health
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode monitor

# Check resource distribution
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT resource_type, COUNT(*) as count
FROM fhir.resources 
WHERE deleted = false
GROUP BY resource_type ORDER BY count DESC;"
```

### Empty Search Results (Most Common Issue)

**Root Cause**: Missing search parameter indexes

```bash
# 1. Verify search parameters exist
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT param_name, COUNT(*) 
FROM fhir.search_params 
WHERE resource_type = 'Condition' AND param_name IN ('patient', 'subject')
GROUP BY param_name;"

# 2. Check specific patient references
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT value_reference, value_string, COUNT(*) 
FROM fhir.search_params 
WHERE param_name = 'patient' AND resource_type = 'Condition'
GROUP BY value_reference, value_string LIMIT 5;"

# 3. Re-index search parameters
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index

# 4. Fix URN reference issues (Synthea specific)
docker exec emr-backend python scripts/fix_allergy_intolerance_search_params_v2.py

# 5. Verify fix worked
docker exec emr-backend python scripts/testing/verify_search_params_after_import.py
```

**Debug Search Query**:
```python
# Enable SQL query logging to see actual queries
import logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

# Test search directly
result = await storage.search_resources("Condition", {
    "patient": "Patient/123",
    "clinical-status": "active"
})
print(f"Found {result.get('total', 0)} results")
```

### Reference Resolution Issues

**Synthea URN References**: Most common issue with Synthea data

```bash
# 1. Check reference formats in search_params
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 
    value_reference, 
    value_string,
    COUNT(*) as count
FROM fhir.search_params 
WHERE param_name = 'patient' 
AND (value_reference LIKE 'urn:uuid:%' OR value_string LIKE 'urn:uuid:%')
GROUP BY value_reference, value_string
ORDER BY count DESC LIMIT 10;"

# 2. Verify references table population
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT source_type, target_type, COUNT(*) 
FROM fhir.references 
GROUP BY source_type, target_type 
ORDER BY COUNT(*) DESC;"

# 3. Check for broken references
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT COUNT(*) as broken_refs
FROM fhir.references ref
LEFT JOIN fhir.resources target ON target.fhir_id = ref.target_id 
    AND target.resource_type = ref.target_type
WHERE target.id IS NULL;"

# 4. Fix URN references
docker exec emr-backend python scripts/fix_allergy_intolerance_search_params_v2.py
```

### Performance Issues

**Query Optimization**:
```bash
# 1. Analyze slow queries
docker exec emr-postgres psql -U emr_user -d emr_db -c "
EXPLAIN ANALYZE 
SELECT r.resource 
FROM fhir.resources r
JOIN fhir.search_params sp ON sp.resource_id = r.id
WHERE sp.param_name = 'patient' 
AND sp.value_reference = 'Patient/123'
AND r.resource_type = 'Condition';"

# 2. Check index usage
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'fhir' 
ORDER BY idx_tup_read DESC;"

# 3. Missing indexes (add if needed)
docker exec emr-postgres psql -U emr_user -d emr_db -c "
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_params_composite
ON fhir.search_params(resource_type, param_name, value_reference)
WHERE value_reference IS NOT NULL;"

# 4. Compartment query optimization
docker exec emr-postgres psql -U emr_user -d emr_db -c "
EXPLAIN ANALYZE
SELECT r.resource FROM fhir.resources r
JOIN fhir.compartments c ON c.resource_id = r.id
WHERE c.compartment_type = 'Patient' 
AND c.compartment_id = '123';"
```

**Memory & Connection Issues**:
```python
# Connection pool monitoring
from fhir.core.storage import FHIRStorageEngine

# Check pool status
engine = storage._engine
pool = engine.pool
print(f"Pool size: {pool.size()}")
print(f"Checked in: {pool.checkedin()}")
print(f"Checked out: {pool.checkedout()}")

# Enable connection pool logging
logging.getLogger('sqlalchemy.pool').setLevel(logging.DEBUG)
```

**Cache Performance**:
```bash
# Redis cache stats (if enabled)
docker exec redis redis-cli info stats

# Memory cache monitoring
docker exec emr-backend python -c "
from fhir.api.cache import get_search_cache
cache = get_search_cache()
print(f'Cache size: {cache.currsize}')
print(f'Cache hits: {cache.hits}')
print(f'Cache misses: {cache.misses}')
"
```

## 📝 Best Practices & Patterns

### 🎯 Healthcare Data Integrity (CRITICAL)

1. **Always Use Real Synthea Data**: Never create mock/fake patient data
   - Synthea provides clinically realistic data with proper relationships
   - Mock data lacks the complexity and edge cases of real healthcare scenarios
   - Patient safety depends on realistic data testing

2. **Patient-Centric Queries**: Always start searches with patient context
   ```python
   # ✅ Good - patient-centric
   conditions = await storage.search_resources("Condition", {
       "patient": "Patient/123",
       "clinical-status": "active"
   })
   
   # ❌ Avoid - system-wide queries without patient context
   all_conditions = await storage.search_resources("Condition", {
       "clinical-status": "active"  # Too broad, performance risk
   })
   ```

3. **Validate Before Storage**: Use SyntheaFHIRValidator for all resources
   ```python
   # Always validate
   result = await storage.create_resource("Patient", data, validate=True)
   ```

### 🚀 Performance Optimization

4. **Use Patient Compartments**: Leverage compartments for efficient patient queries
   ```python
   # ✅ Optimal - uses pre-computed compartments
   everything = await storage.patient_everything("123")
   
   # ❌ Slower - multiple individual searches
   conditions = await storage.search_resources("Condition", {"patient": "Patient/123"})
   observations = await storage.search_resources("Observation", {"patient": "Patient/123"})
   ```

5. **Search Parameter Optimization**: Ensure all resources have indexed parameters
   ```bash
   # Verify search parameters after data import
   docker exec emr-backend python scripts/consolidated_search_indexing.py --mode monitor
   ```

6. **Use Summary Queries**: For large result sets, use _summary for better performance
   ```python
   # ✅ Fast for large result sets
   summary = await storage.search_resources("Patient", {
       "_summary": "true",
       "_count": "50"
   })
   ```

### 🔒 Reference Integrity

7. **Handle URN References**: Synthea uses URN format that needs resolution
   - SearchParameterExtractor automatically handles URN → FHIR reference conversion
   - Run URN fix scripts after Synthea data import

8. **Maintain Reference Relationships**: Update references table for navigation
   ```python
   # References are automatically maintained during resource operations
   # Check reference integrity periodically
   ```

### 🔍 Testing & Monitoring

9. **Test with Real Patient Data**: Use actual Synthea patients for all testing
   ```python
   # Get real patient from database
   patients = await storage.search_resources("Patient", {"_count": "1"})
   test_patient_id = patients['entry'][0]['resource']['id']
   ```

10. **Monitor Query Performance**: Check execution plans for slow queries
    ```bash
    # Analyze query performance
    docker exec emr-postgres psql -U emr_user -d emr_db -c "EXPLAIN ANALYZE ..."
    ```

### 🛡️ Error Handling

11. **Graceful Error Handling**: Always handle FHIR operation failures
    ```python
    try:
        result = await storage.create_resource("Patient", data)
    except ValidationError as e:
        # Handle validation failures
        logger.error(f"FHIR validation failed: {e}")
    except Exception as e:
        # Handle storage failures
        logger.error(f"Storage operation failed: {e}")
    ```

### 🔄 Real-time Integration

12. **WebSocket Events**: Leverage real-time notifications for clinical workflows
    ```python
    # Events are automatically sent for resource operations
    # Subscribe to relevant events in frontend:
    # - CONDITION_DIAGNOSED, MEDICATION_PRESCRIBED, etc.
    ```

### 📊 Audit & Compliance

13. **Version Tracking**: Resource history is maintained automatically
    ```python
    # Get complete resource history for audit
    history = await storage.get_resource_history("Patient", "123")
    ```

14. **Audit Logging**: All operations are logged in audit_logs table
    - Resource creation, updates, deletions
    - Search operations (if configured)
    - Bundle processing

### 🎛️ Configuration & Deployment

15. **Environment-Aware Configuration**: Production vs development settings
    ```python
    # Storage engine adapts to environment automatically
    # - Connection pooling settings
    # - Cache configuration
    # - Validation strictness
    ```

## 🔗 Related Documentation & Resources

### Core Documentation
- **[Main CLAUDE.md](../../CLAUDE.md)** - WintEHR project overview and workflows
- **[FHIR API Endpoints](../../docs/API_ENDPOINTS.md)** - Complete API reference
- **[Architecture Overview](../../docs/ARCHITECTURE.md)** - System architecture
- **[Deployment Guide](../../docs/DEPLOYMENT.md)** - Production deployment

### FHIR-Specific Guides
- **[FHIR Explorer](../../docs/modules/fhir-explorer/QUERY_STUDIO_GUIDE.md)** - Interactive FHIR query building
- **[Database Schema](../scripts/setup/init_database_definitive.py)** - Complete database initialization
- **[Search Parameter Scripts](../scripts/consolidated_search_indexing.py)** - Search optimization
- **[Data Validation Scripts](../scripts/testing/validate_fhir_data.py)** - Data quality assurance

### Performance & Troubleshooting
- **[Performance Monitoring](../scripts/testing/check_synthea_resources.py)** - Resource validation
- **[Search Parameter Verification](../scripts/testing/verify_search_params_after_import.py)** - Index health
- **[URN Reference Fix](../scripts/fix_allergy_intolerance_search_params_v2.py)** - Synthea compatibility

### Testing & Validation
- **[FHIR Data Reference](../scripts/testing/FHIR_DATA_REFERENCE.md)** - Test data documentation
- **[Synthea Data Summary](../scripts/testing/test_data_summary.py)** - Data analysis tools
- **[Integration Tests](../scripts/testing/)** - Comprehensive testing suite

## 💡 Expert Tips & Shortcuts

### ⚡ Performance Shortcuts
```python
# Fast patient record access using compartments
patient_data = await storage.patient_everything("123", _type=["Condition", "Observation"])

# Efficient summary queries for dashboards
summary = await storage.search_resources("Patient", {
    "_summary": "true",
    "_elements": "name,birthDate,gender",
    "_count": "20"
})

# Optimized vital signs trending
last_vitals = await storage.observation_lastn("123", max_results=5, category="vital-signs")
```

### 🔧 Developer Shortcuts
```bash
# Quick health check
docker exec emr-backend python -c "from fhir.core.storage import FHIRStorageEngine; print('FHIR Engine OK')"

# Fast search parameter verification
docker exec emr-postgres psql -U emr_user -d emr_db -tAc "SELECT COUNT(*) FROM fhir.search_params WHERE param_name='patient';"

# Resource count by type
docker exec emr-postgres psql -U emr_user -d emr_db -c "SELECT resource_type, COUNT(*) FROM fhir.resources WHERE deleted=false GROUP BY resource_type ORDER BY 2 DESC;"
```

### 🎯 Clinical Query Patterns
```python
# Active medication list
meds = await storage.search_resources("MedicationRequest", {
    "patient": f"Patient/{patient_id}",
    "status": "active",
    "_include": "MedicationRequest:medication"
})

# Problem list with onset dates
problems = await storage.search_resources("Condition", {
    "patient": f"Patient/{patient_id}",
    "clinical-status": "active",
    "_sort": "onset-date"
})

# Recent lab results
labs = await storage.search_resources("DiagnosticReport", {
    "patient": f"Patient/{patient_id}",
    "category": "LAB",
    "date": f"ge{(datetime.now() - timedelta(days=90)).isoformat()}",
    "_include": "DiagnosticReport:result"
})
```

### 🚨 Emergency Debugging
```bash
# If searches return empty:
1. docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index
2. docker exec emr-backend python scripts/fix_allergy_intolerance_search_params_v2.py
3. docker exec emr-backend python scripts/testing/verify_search_params_after_import.py

# If performance is slow:
1. Check PostgreSQL indexes: docker exec emr-postgres psql -U emr_user -d emr_db -c "\di fhir.*"
2. Monitor queries: Enable SQLAlchemy logging
3. Clear cache: Restart Redis or clear memory cache
```

---

## ⚠️ **CRITICAL REMINDER**

**This is the foundation of all healthcare data operations in WintEHR.**

- **Patient Safety**: Incorrect queries can lead to missed diagnoses or medication errors
- **Data Integrity**: Every resource operation affects clinical decision-making
- **Performance Impact**: Poor queries affect clinician workflows and patient care
- **Compliance Requirements**: Audit logs and resource history are legally required

**When in doubt, test with real Synthea data and verify results manually.**

---

**Last Updated**: 2025-08-12 | **Next Review**: 2025-09-12 | **Owner**: FHIR Engine Team