# WintEHR Backend Tests

Comprehensive test suite for the HAPI-unified CDS Hooks architecture.

## Test Structure

```
tests/
├── conftest.py                              # Shared fixtures and test configuration
├── api/
│   └── cds_hooks/
│       ├── test_local_provider.py          # LocalServiceProvider unit tests
│       ├── test_remote_provider.py         # RemoteServiceProvider unit tests
│       ├── test_cds_hooks_router.py        # API endpoint integration tests
│       ├── test_registration.py            # External service registration tests
│       └── test_failure_tracking.py        # Failure tracking and auto-disable tests
└── README.md                                # This file
```

## Running Tests

### Run All Tests
```bash
# From backend directory
pytest tests/ -v

# With coverage
pytest tests/ --cov=api.cds_hooks --cov-report=html
```

### Run Specific Test Files
```bash
# LocalServiceProvider tests
pytest tests/api/cds_hooks/test_local_provider.py -v

# RemoteServiceProvider tests
pytest tests/api/cds_hooks/test_remote_provider.py -v

# API endpoint tests
pytest tests/api/cds_hooks/test_cds_hooks_router.py -v

# Registration tests
pytest tests/api/cds_hooks/test_registration.py -v

# Failure tracking tests
pytest tests/api/cds_hooks/test_failure_tracking.py -v
```

### Run Specific Test Classes or Methods
```bash
# Run specific test class
pytest tests/api/cds_hooks/test_local_provider.py::TestLocalServiceProvider -v

# Run specific test method
pytest tests/api/cds_hooks/test_local_provider.py::TestLocalServiceProvider::test_execute_with_valid_service -v
```

### Run with Markers
```bash
# Run only async tests
pytest tests/ -v -m asyncio

# Run only integration tests
pytest tests/ -v -m integration
```

## Test Coverage

### LocalServiceProvider Tests (`test_local_provider.py`)
- ✅ Dynamic class import and instantiation
- ✅ Service execution with prefetch building
- ✅ should_execute conditional logic
- ✅ Error handling (ImportError, missing extensions, service exceptions)
- ✅ Context handling (dict and object formats)

### RemoteServiceProvider Tests (`test_remote_provider.py`)
- ✅ API key authentication
- ✅ OAuth2 authentication
- ✅ HMAC signature authentication
- ✅ Failure tracking increment
- ✅ Auto-disable after 5 failures
- ✅ Success resets failure count
- ✅ Disabled service handling
- ✅ HTTP timeout handling
- ✅ Malformed response handling
- ✅ HTTP error status codes

### CDS Hooks Router Tests (`test_cds_hooks_router.py`)
- ✅ Service discovery from HAPI FHIR
- ✅ Discovery filtering by service-origin
- ✅ Empty discovery results
- ✅ HAPI error handling in discovery
- ✅ Built-in service execution routing
- ✅ External service execution routing
- ✅ Service not found handling
- ✅ Invalid service origin handling
- ✅ PlanDefinition to CDS service conversion
- ✅ Extension value extraction
- ✅ Prefetch template building
- ✅ Execution logging and timing

### Registration Tests (`test_registration.py`)
- ✅ Single hook registration
- ✅ Batch registration (multiple hooks)
- ✅ Incremental addition to existing service
- ✅ PlanDefinition creation with extensions
- ✅ Prefetch template serialization
- ✅ Unique service ID generation
- ✅ Input validation (fields, auth types, URLs)
- ✅ Credentials encryption
- ✅ Service metadata storage

### Failure Tracking Tests (`test_failure_tracking.py`)
- ✅ First failure tracking
- ✅ Consecutive failure increment
- ✅ Auto-disable at threshold (5 failures)
- ✅ Failure reset on success
- ✅ Error message logging
- ✅ Disabled service skip execution
- ✅ Manual re-enable
- ✅ Different failure types (connection, timeout, HTTP error, malformed)
- ✅ Graceful degradation patterns

## Test Fixtures

Common fixtures defined in `conftest.py`:

### Database Fixtures
- `test_db` - In-memory SQLite database for testing
- `event_loop` - Async event loop for async tests

### Mock Fixtures
- `mock_hapi_client` - Mocked HAPI FHIR client
- `mock_local_service` - Mocked local CDS service
- `async_client` - Async HTTP client for testing

### Data Fixtures
- `sample_plan_definition` - Built-in service PlanDefinition
- `external_plan_definition` - External service PlanDefinition
- `sample_cds_request` - CDS Hooks request
- `external_service_metadata` - External service configuration

## Test Patterns

### Async Test Pattern
```python
@pytest.mark.asyncio
async def test_async_operation(provider, sample_data):
    """Test async operation"""
    result = await provider.execute(sample_data)
    assert result is not None
```

### Mock Pattern
```python
with patch('module.Class') as mock_class:
    mock_instance = AsyncMock()
    mock_instance.method.return_value = expected_value
    mock_class.return_value = mock_instance

    result = await function_under_test()

    assert mock_instance.method.called
```

### Database Test Pattern
```python
def test_with_database(test_db):
    """Test with database operations"""
    test_db.execute = AsyncMock()
    test_db.commit = AsyncMock()

    # Test logic

    assert test_db.execute.called
    assert test_db.commit.called
```

## Testing Best Practices

1. **Use fixtures** - Leverage conftest.py fixtures for common setup
2. **Test isolation** - Each test should be independent
3. **Mock external dependencies** - Mock HAPI FHIR, HTTP clients, database
4. **Test error paths** - Don't just test happy paths
5. **Descriptive names** - Test method names should clearly state what's being tested
6. **Arrange-Act-Assert** - Structure tests in clear phases
7. **Async awareness** - Use @pytest.mark.asyncio for async tests
8. **Coverage** - Aim for >80% code coverage

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example CI configuration
test:
  script:
    - cd backend
    - pip install -r requirements.txt
    - pip install pytest pytest-asyncio pytest-cov
    - pytest tests/ -v --cov=api.cds_hooks --cov-report=xml
```

## Contributing

When adding new features to the CDS Hooks implementation:

1. Write tests first (TDD approach)
2. Ensure all existing tests pass
3. Add new tests for new functionality
4. Update this README if adding new test files
5. Maintain >80% code coverage

## Troubleshooting

### Import Errors
If you get import errors, make sure you're running from the backend directory:
```bash
cd backend
pytest tests/
```

### Async Warnings
If you see async warnings, ensure all async tests use `@pytest.mark.asyncio`:
```python
@pytest.mark.asyncio
async def test_my_async_function():
    ...
```

### Database Errors
If database tests fail, check that SQLite is properly installed and the test database can be created in memory.

## Resources

- **Pytest Documentation**: https://docs.pytest.org/
- **Pytest-asyncio**: https://pytest-asyncio.readthedocs.io/
- **HAPI FHIR**: https://hapifhir.io/
- **CDS Hooks Specification**: https://cds-hooks.org/
