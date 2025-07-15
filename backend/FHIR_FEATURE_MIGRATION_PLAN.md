# FHIR Feature Migration Plan

**Date**: 2025-07-15  
**Purpose**: Port Phase 1-3 features from enhanced router to active router  
**Status**: In Progress

## Executive Summary

The enhanced router (`api/fhir/fhir_router.py`) contains all Phase 1-3 FHIR search features but uses incompatible database patterns. The active router (`fhir_api/router.py`) has clean architecture but lacks critical features. This plan outlines how to port the missing features.

## Missing Features to Port

### 1. Composite Search Parameters
**Source**: `api/fhir/composite_search.py`
**Target**: Add to `core/fhir/search.py`

Features to port:
- `code-value-quantity` for Observation
- `component-code-value-quantity` for Observation components
- `code-value-concept` for conditions
- Composite parameter parsing logic

### 2. _has Parameter Support
**Source**: `_process_has_parameters()` in enhanced router
**Target**: Add to `core/fhir/search.py`

Features to port:
- Reverse chaining logic
- Multi-level _has queries
- Resource filtering based on referencing resources

### 3. Advanced Search Parameters

#### MedicationDispense
- `lot-number` - Search by batch.lotNumber
- `expiration-date` - Search by batch.expirationDate

#### Observation
- `based-on` - Search by basedOn reference to ServiceRequest

#### General Parameters
- Token system search with `:of-type` modifier
- `:missing` modifier for all resource types
- Date modifiers: `ge`, `le`, `gt`, `lt`, `eq`

### 4. _include/_revinclude Implementation
**Source**: `_process_includes()` and `_process_revincludes()` in enhanced router
**Target**: Complete stubs in active router

Features to port:
- Multi-level includes
- Wildcard support (`*`)
- Proper bundle entry marking (mode: include)

### 5. Query Builder Enhancements
**Source**: `api/fhir/query_builder.py`
**Target**: Enhance `core/fhir/storage.py`

Features to port:
- JSONB path queries for nested searches
- Complex date range handling
- Quantity comparisons with units
- String search modifiers (:exact, :contains)

## Migration Approach

### Option 1: Direct Feature Port (Recommended)
Port individual features to the active router while maintaining its clean architecture.

**Pros**:
- Maintains clean architecture
- Gradual migration reduces risk
- Can test feature by feature

**Cons**:
- More development effort
- Potential for inconsistencies

### Option 2: Replace Active Router
Replace the entire active router with enhanced router after refactoring.

**Pros**:
- All features immediately available
- Less development effort

**Cons**:
- High risk of breaking changes
- Requires significant refactoring
- Database pattern incompatibility

### Option 3: Hybrid Approach
Create a new unified router combining best of both.

**Pros**:
- Clean slate approach
- Best practices from both

**Cons**:
- Most development effort
- Requires extensive testing

## Implementation Steps (Option 1 - Recommended)

### Phase 1: Core Search Infrastructure (Week 1)
1. **Enhance SearchParameterHandler**
   ```python
   # In core/fhir/search.py
   class SearchParameterHandler:
       def parse_composite_parameter(self, param: str, value: str):
           """Parse composite search parameters"""
           
       def parse_has_parameter(self, param: str) -> Dict:
           """Parse _has parameter"""
   ```

2. **Add Composite Search Support**
   - Port CompositeSearchHandler class
   - Integrate with FHIRStorageEngine
   - Add composite parameter definitions

3. **Implement _has Parameter**
   - Port _process_has_parameters function
   - Add to search parameter parsing
   - Test with Patient?_has:Observation:patient:code

### Phase 2: Resource-Specific Parameters (Week 1-2)
1. **MedicationDispense Enhancements**
   ```python
   # Add to search parameter definitions
   "MedicationDispense": {
       "lot-number": {
           "type": "string",
           "path": "batch.lotNumber"
       },
       "expiration-date": {
           "type": "date",
           "path": "batch.expirationDate"
       }
   }
   ```

2. **Observation Enhancements**
   ```python
   # Add based-on parameter
   "Observation": {
       "based-on": {
           "type": "reference",
           "path": "basedOn",
           "target": ["ServiceRequest", "MedicationRequest", "CarePlan"]
       }
   }
   ```

### Phase 3: Advanced Modifiers (Week 2)
1. **String Modifiers**
   - Implement :exact (case-sensitive exact match)
   - Implement :contains (case-insensitive substring)
   - Add to all string parameters

2. **Date Modifiers**
   - Enhance date parsing for ge/le/gt/lt/eq
   - Add proper timezone handling
   - Support partial dates (2024, 2024-01)

3. **Missing Modifier**
   - Implement :missing=true/false
   - Add to all searchable parameters
   - Use SQL IS NULL/IS NOT NULL

### Phase 4: Include/Revinclude (Week 2-3)
1. **Complete _process_includes**
   ```python
   async def _process_includes(
       storage: FHIRStorageEngine, 
       bundle: Bundle, 
       includes: List[str]
   ):
       """Process _include parameters with full support"""
   ```

2. **Complete _process_revincludes**
   ```python
   async def _process_revincludes(
       storage: FHIRStorageEngine,
       bundle: Bundle, 
       revincludes: List[str]
   ):
       """Process _revinclude parameters"""
   ```

### Phase 5: Testing & Validation (Week 3)
1. **Unit Tests**
   - Test each new search parameter
   - Test composite searches
   - Test _has queries

2. **Integration Tests**
   - Test with frontend
   - Test with real Synthea data
   - Performance testing

3. **Migration Testing**
   - Run parallel tests (beta vs production)
   - Compare results
   - Validate no regressions

## Code Examples

### Composite Search Implementation
```python
# In core/fhir/search.py
def apply_composite_search(self, query, param: str, value: str):
    """Apply composite search parameter"""
    if self.resource_type == "Observation":
        if param == "code-value-quantity":
            # Parse composite value
            parts = value.split("$")
            if len(parts) == 2:
                code = parts[0]
                quantity_value = parts[1]
                
                # Apply both conditions
                query = query.filter(
                    and_(
                        func.jsonb_path_exists(
                            FHIRResource.resource,
                            '$.code.coding[*].code ? (@ == $code)',
                            json.dumps({"code": code})
                        ),
                        func.jsonb_path_exists(
                            FHIRResource.resource,
                            '$.valueQuantity.value ? (@ > $value)',
                            json.dumps({"value": float(quantity_value[2:])})
                        )
                    )
                )
    return query
```

### _has Parameter Implementation
```python
# In core/fhir/storage.py
async def apply_has_filter(
    self, 
    resource_type: str, 
    has_param: str
) -> List[str]:
    """Apply _has parameter to find resources"""
    # Parse _has:ResourceType:reference:parameter=value
    parts = has_param.split(":")
    if len(parts) >= 4:
        ref_resource_type = parts[1]
        ref_field = parts[2]
        search_param = ":".join(parts[3:])
        
        # First, find resources matching the search
        matching_resources = await self.search_resources(
            ref_resource_type,
            {search_param: value}
        )
        
        # Extract IDs that reference our resource type
        referenced_ids = set()
        for resource in matching_resources:
            ref = resource.get(ref_field, {}).get("reference", "")
            if ref.startswith(f"{resource_type}/"):
                referenced_ids.add(ref.split("/")[1])
                
        return list(referenced_ids)
```

## Success Criteria

1. **Feature Parity**
   - All Phase 1-3 features working in active router
   - No regressions in existing functionality
   - Performance maintained or improved

2. **Code Quality**
   - Clean, maintainable code
   - Comprehensive test coverage
   - Proper documentation

3. **Frontend Compatibility**
   - All frontend features continue working
   - No breaking changes to API contracts
   - Seamless migration path

## Risk Mitigation

1. **Incremental Deployment**
   - Deploy features one at a time
   - Use feature flags if needed
   - Monitor each deployment

2. **Parallel Testing**
   - Keep beta endpoint active during migration
   - Compare results between endpoints
   - Validate data consistency

3. **Rollback Plan**
   - Each feature can be disabled independently
   - Database changes are backward compatible
   - Keep enhanced router as fallback

## Timeline

- Week 1: Core infrastructure + MedicationDispense/Observation
- Week 2: Advanced modifiers + Include/Revinclude
- Week 3: Testing, validation, and deployment
- Week 4: Monitoring and optimization

## Next Steps

1. Review and approve this migration plan
2. Create feature branch for migration
3. Begin Phase 1 implementation
4. Set up automated testing pipeline
5. Schedule daily progress reviews

---

This migration plan ensures we get all the benefits of the Phase 1-3 features while maintaining the clean architecture of the active router.