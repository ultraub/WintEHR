# FHIR API Test Failure Summary

**Generated**: 2025-01-20  
**Test Run**: 20250720_184823

## Quick Reference: Failed Tests (28)

### 1. Delete Operations
- **Test**: `test_delete_resource`
- **Issue**: Returns 404 instead of 410 Gone for deleted resources
- **Fix**: Implement soft delete with proper 410 Gone status

### 2. Conditional Create
- **Test**: `test_conditional_create`
- **Issue**: If-None-Exist header not processed, creates duplicate
- **Fix**: Process If-None-Exist header and return existing resource

### 3. Malformed JSON Handling
- **Test**: `test_malformed_json`
- **Issue**: Returns 500 instead of 400 for invalid JSON
- **Fix**: Add proper JSON validation with 400 Bad Request response

### 4. Boundary Conditions
- **Test**: `test_boundary_conditions`
- **Issue**: Negative _count parameter causes 500 error
- **Fix**: Validate query parameters, return 400 for invalid values

### 5. Resource ID Constraints
- **Test**: `test_resource_id_constraints`
- **Issue**: Creating resource with specific ID returns 404
- **Fix**: Support client-assigned IDs or return proper error

### 6. Transaction Rollback
- **Test**: `test_transaction_rollback`
- **Issue**: Invalid transaction succeeds instead of rolling back
- **Fix**: Implement proper transaction validation and rollback

### 7. Content Type Negotiation
- **Test**: `test_content_type_negotiation`
- **Issue**: Returns application/json instead of application/fhir+json
- **Fix**: Set correct Content-Type header for FHIR responses

### 8. Resource Meta Elements
- **Test**: `test_resource_meta_elements`
- **Issue**: lastUpdated format has too many decimal places
- **Fix**: Format timestamps to FHIR instant precision (max 3 decimals)

### 9. Search Parameter Types
- **Test**: `test_search_parameter_types`
- **Issue**: RiskAssessment resource type not supported
- **Fix**: Add support for missing resource types or return proper error

### 10. Error Response Compliance
- **Test**: `test_error_response_compliance`
- **Issue**: Invalid resource creates successfully instead of failing
- **Fix**: Add proper resource validation before creation

### 11. HTTP Methods Compliance
- **Test**: `test_http_methods_compliance`
- **Issue**: HEAD method returns 405 Method Not Allowed
- **Fix**: Implement HEAD method support

### 12. Chained Search
- **Test**: `test_chained_search_single_level`
- **Issue**: Reference format mismatch (urn:uuid vs Patient/)
- **Fix**: Normalize reference formats in search results

### 13. Multiple Parameter Search
- **Test**: `test_multiple_parameter_combination`
- **Issue**: Reference format inconsistency
- **Fix**: Ensure consistent reference formatting

### 14. Missing Parameter Search
- **Test**: `test_missing_parameter_search`
- **Issue**: :missing modifier not filtering correctly
- **Fix**: Implement proper :missing search modifier

### 15. Reference Search Variations
- **Test**: `test_reference_search_variations`
- **Issue**: Different reference formats return different results
- **Fix**: Normalize reference search handling

### 16. Sorting
- **Test**: `test_search_with_sorting`
- **Issue**: _sort parameter not working
- **Fix**: Implement sort functionality

### 17. Count Parameter
- **Test**: `test_search_count_parameter`
- **Issue**: _count=0 not handled correctly
- **Fix**: Handle edge cases for _count parameter

### 18. Global Search
- **Test**: `test_global_search`
- **Issue**: Cross-resource type search not supported
- **Fix**: Implement global search or return proper error

### 19. Patient Everything
- **Test**: `test_patient_everything_operation`
- **Issue**: Operation not returning complete results
- **Fix**: Ensure all patient compartment resources included

### 20. Resource History
- **Test**: `test_resource_history`
- **Issue**: History endpoint not implemented
- **Fix**: Implement _history endpoint

### 21. Type History
- **Test**: `test_resource_type_history`
- **Issue**: Type-level history not implemented
- **Fix**: Implement resource type _history

### 22. System History
- **Test**: `test_system_history`
- **Issue**: System-level history not implemented
- **Fix**: Implement system _history

### 23. Validate Operation
- **Test**: `test_validate_operation`
- **Issue**: $validate operation not implemented
- **Fix**: Implement resource validation operation

### 24. Invalid Validate
- **Test**: `test_validate_invalid_resource`
- **Issue**: $validate not returning proper errors
- **Fix**: Implement validation with OperationOutcome

### 25. Meta Operations
- **Test**: `test_meta_operations`
- **Issue**: $meta operations not implemented
- **Fix**: Implement meta operations

### 26. Conditional Update
- **Test**: `test_conditional_update_operation`
- **Issue**: Conditional update not working
- **Fix**: Implement If-Match header processing

### 27. Condition Search by Patient
- **Test**: `test_condition_search_by_patient`
- **Issue**: Patient parameter search failing
- **Fix**: Ensure patient search parameter indexed

### 28. Pagination Navigation
- **Test**: `test_search_result_pagination_navigation`
- **Issue**: Pagination links not working
- **Fix**: Implement proper pagination with navigation links

## Priority Fixes

### High Priority (Breaking Core Functionality)
1. Fix error handling (return 400/422 instead of 500)
2. Implement conditional operations (If-None-Exist)
3. Fix delete operations (410 Gone)
4. Fix reference format consistency

### Medium Priority (FHIR Compliance)
1. Implement history operations
2. Add validation operations
3. Fix content type headers
4. Implement missing search modifiers

### Low Priority (Nice to Have)
1. Support all resource types
2. Implement meta operations
3. Add HEAD method support
4. Global search functionality