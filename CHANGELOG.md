# Changelog

This file documents significant changes and updates to the MedGenEMR project.

## 2025-07-17
- **Documentation Overhaul**: Comprehensive review and cleanup of project documentation.
  - New `README.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT_GUIDE.md`, `docs/DEPLOYMENT_GUIDE.md` created.
  - Removed numerous outdated markdown files from root, `docs/`, `frontend/src/docs/`, `backend/`, and `frontend/` directories.

## 2025-01-17
- **Major Performance Optimizations for Clinical Workspace**
  - Reduced resource counts: Default 50→20, Observations 100→30, MAX_RESOURCES 200→50
  - Added date filtering: Observations (6 months), DiagnosticReports (1 year)
  - Removed progressive loading that caused 3x $everything calls
  - Implemented _since parameter with 3-month default window
  - Created specialized hooks for each clinical module (useClinicalResources)
  - Memory usage reduced from 500MB+ to under 100MB
  - API calls reduced by 60-70% through better caching
- **Fixed CPOE and Provider Issues**
  - Fixed provider directory 404 errors by registering routers
  - Fixed lab catalog endpoint mismatch
  - Fixed CPOE search display for all order types
  - Fixed login page provider list loading
- Created comprehensive performance optimization guide in `docs/performance/`

## 2025-01-16
- Fixed frontend memory leaks causing 500MB+ RAM usage
- Reduced resource loading from 500-1000 to 20-100 per type
- Added proper cleanup for timeouts and in-flight requests
- Implemented resource cache size limits (200 max per type)
- Added automatic old resource cleanup to prevent unbounded growth
- Memory usage reduced from 500MB+ to typical 50-100MB
- Implemented complete FHIR R4 advanced search features:
  - Chained searches (e.g., Patient?general-practitioner.name=Smith)
  - _has parameter for reverse chaining (e.g., Patient?_has:Observation:patient:code=1234-5)
  - $everything operation with full parameter support (_since, _type, _count, _offset)
- Fixed _include for Medication resources (issue was test data, not implementation)
- All advanced FHIR features now fully functional and tested

## 2025-07-16
- Consolidated all FHIR-related code into unified `backend/fhir/` module structure
- Resolved Python namespace conflicts (renamed `fhir/resources/` to `fhir/resource_definitions/`)
- Fixed FastAPI type validation issues with custom Pydantic models
- Updated all import paths across 88 files to use new FHIR module structure
- Verified all FHIR endpoints functional with proper Bundle structure
- Created comprehensive backend consolidation documentation
- Implemented complete FHIR R4 _has parameter (reverse chaining) functionality
- Added support for all major search parameter types in _has queries
- Implemented nested _has for recursive reverse chaining
- Created comprehensive test suite and manual testing script for _has parameter
- Updated search documentation with _has parameter guide

## 2025-01-16
- Implemented complete FHIR R4 $everything operation
- Added full parameter support (_since, _type, _count, _offset)
- Included all 50+ patient compartment resource types
- Implemented reference following for related resources
- Added proper Bundle pagination with navigation links
- Created comprehensive test suite for $everything operation
- Updated router to use OperationHandler for all operations
- Fixed SQL syntax error in patient_everything endpoint

## 2025-07-14
- Implemented R4/R5 agnostic handling for medication resources
- Fixed MedicationRequest and MedicationDispense R5 to R4B conversion
- Resolved reason field and numberOfRepeatsAllowed validation errors
- All medication workflows (prescribe, verify, dispense) working correctly
- Fixed DocumentReference validation "integer is required" errors
- Resolved dict() to json() conversion for preserving data types
- Simplified document validation to avoid reconstruction issues
- Fixed encounterId null issue using activeEncounter from context
- Removed console.warn statements from EnhancedNoteEditor
- Integrated noteTemplatesService replacing hardcoded templates
- Enhanced smart phrase expansion with date/time macros

## 2025-07-12
- Fixed dynamic clinical catalog 404 errors
- Resolved frontend proxy configuration conflicts
- Implemented direct backend connection for development
- Verified all dynamic catalog endpoints working
- Confirmed autocomplete search functionality

## 2025-01-10
- Integrated Context7 MCP server via HTTP transport
- Enhanced all agents with Context7 real-time capabilities
- Updated hook system for automatic Context7 integration
- Added cross-session knowledge persistence
- Implemented CLI support for direct Context7 queries

## 2025-01-08
- Implemented comprehensive agent system
- Added automated quality gates
- Removed all console.log/print statements
- Enhanced security and testing infrastructure
- Improved error handling with ErrorBoundary
- Added pagination and performance enhancements
