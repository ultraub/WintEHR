# MedGenEMR Comprehensive Testing Guide

## Overview

This guide documents all testing procedures for MedGenEMR, including FHIR API tests, integration tests, and system validation.

## Test Suites

### 1. FHIR API Comprehensive Tests (`test_fhir_comprehensive.py`)
**Coverage**: 33 tests
- Basic CRUD operations (7 tests)
- Complex search queries (7 tests)
- Chained queries (3 tests)
- Bundle operations (2 tests)
- Multi-version support (3 tests)
- Content negotiation (5 tests)
- Performance tests (6 tests)

### 2. Clinical Workspace Integration (`test_clinical_workspace.py`)
**Coverage**: All clinical tabs
- Chart Review Tab (Conditions, Medications, Allergies, Immunizations)
- Orders Tab (Lab orders, status updates)
- Results Tab (Lab results, reference ranges)
- Pharmacy Tab (Prescription to dispense workflow)
- Cross-tab workflow integration

### 3. WebSocket Real-time Updates (`test_websocket_realtime.py`)
**Coverage**: Real-time notifications
- Resource create notifications
- Resource update notifications
- Resource delete notifications
- Cross-patient isolation
- Authentication and subscription

### 4. CDS Hooks Integration (`test_cds_hooks_integration.py`)
**Coverage**: Clinical decision support
- CDS service discovery
- Patient-view hook
- Medication-prescribe hook
- Order-select hook
- Prefetch data handling
- Custom CDS rule creation

### 5. Error Handling and Edge Cases (`test_error_handling.py`)
**Coverage**: System resilience
- Invalid resource types
- Malformed JSON handling
- Missing required fields
- Invalid references
- Concurrent update conflicts
- Search parameter validation
- Transaction rollback
- Large payload handling
- Authorization errors
- Rate limiting

## Running Tests

### Prerequisites

1. **System Requirements**:
   ```bash
   # Backend must be running
   cd backend && ./start.sh
   
   # Install test dependencies
   pip install aiohttp websockets
   ```

2. **Database Setup**:
   - PostgreSQL must be running
   - Test data must be loaded (Synthea patients)

### Individual Test Execution

```bash
# Run specific test suite
python test_fhir_comprehensive.py
python test_clinical_workspace.py
python test_websocket_realtime.py
python test_cds_hooks_integration.py
python test_error_handling.py
```

### Run All Tests

```bash
# Comprehensive test runner
python run_all_tests.py
```

This will:
- Check prerequisites
- Run all test suites in sequence
- Generate comprehensive report
- Save results to timestamped file

### Quick Validation

```bash
# System validation script
../scripts/validate_fhir_system.sh
```

## Test Environment Configuration

### Authentication Modes

1. **Training Mode** (default):
   ```bash
   export JWT_ENABLED=false
   ```
   Users: demo/password, nurse/password, admin/password

2. **Production Mode**:
   ```bash
   export JWT_ENABLED=true
   ```
   Requires JWT tokens

### Test Data

- Uses Synthea-generated FHIR resources
- 10+ test patients pre-loaded
- No mock data or hardcoded IDs

## Expected Results

### Success Criteria

1. **FHIR API Tests**: 97%+ pass rate (32/33 tests)
2. **Clinical Workspace**: All CRUD operations functional
3. **WebSocket**: Real-time updates working
4. **CDS Hooks**: All hooks returning cards
5. **Error Handling**: All error cases handled gracefully

### Known Issues

1. **Transaction Bundle Decimal**: Requires live environment verification
2. **References Table**: Schema mismatch (disabled)

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Backend not accessible | Start backend: `cd backend && ./start.sh` |
| Missing packages | Install: `pip install aiohttp websockets` |
| Authentication failures | Check JWT_ENABLED environment variable |
| No test patients | Load data: `python scripts/synthea_master.py full --count 10` |
| WebSocket connection fails | Ensure backend WebSocket service is running |

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Run specific test with verbose output
python test_fhir_comprehensive.py -v
```

## CI/CD Integration

### GitHub Actions

```yaml
name: FHIR API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Python
        uses: actions/setup-python@v2
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install aiohttp websockets
      - name: Run tests
        run: python run_all_tests.py
```

### Docker Testing

```bash
# Run tests in Docker
docker exec emr-backend python run_all_tests.py
```

## Performance Benchmarks

### Expected Performance

- **Single Resource CRUD**: < 100ms
- **Complex Search**: < 500ms
- **Bundle Processing**: < 1s for 50 entries
- **WebSocket Notification**: < 50ms
- **CDS Hook Response**: < 200ms

### Load Testing

```bash
# Run performance tests
python test_fhir_comprehensive.py --performance-only
```

## Reporting

### Test Results Format

Results are saved to `test_results_YYYYMMDD_HHMMSS.txt`:
- Test suite status
- Individual test results
- Duration metrics
- Failure details

### Metrics Dashboard

Key metrics to monitor:
- API response times
- Error rates
- WebSocket latency
- CDS hook performance
- Database query times

## Best Practices

1. **Always run tests before commits**
2. **Fix failing tests immediately**
3. **Add tests for new features**
4. **Keep test data realistic (Synthea)**
5. **Monitor test execution times**

## Extending Tests

### Adding New Tests

1. Create test file: `test_new_feature.py`
2. Follow existing patterns
3. Add to `run_all_tests.py`
4. Document in this guide

### Test Template

```python
async def test_new_feature(self):
    """Test description"""
    start_time = time.time()
    try:
        # Test implementation
        self.log_test("Test Name", True, "Success", time.time() - start_time)
    except Exception as e:
        self.log_test("Test Name", False, f"Error: {str(e)}", time.time() - start_time)
```

## Maintenance

### Regular Tasks

- **Weekly**: Run full test suite
- **Monthly**: Review test coverage
- **Quarterly**: Update test data
- **Annually**: Performance baseline update

### Test Data Refresh

```bash
# Refresh test data
cd backend
python scripts/synthea_master.py generate --count 10
python scripts/synthea_master.py import
```

## Contact

For test failures or questions:
- Check logs: `docker-compose logs backend`
- Review this guide
- Contact development team

---

**Remember**: A passing test suite ensures patient safety and system reliability!