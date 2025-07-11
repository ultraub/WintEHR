# MedGenEMR Testing Strategy

**Comprehensive testing framework covering unit, integration, E2E, and performance testing**

## Overview

MedGenEMR implements a multi-layered testing strategy to ensure clinical data integrity, FHIR compliance, and robust user workflows. Our testing pyramid includes:

1. **Unit Tests** - Individual component and function testing
2. **Integration Tests** - FHIR API and database integration
3. **E2E Tests** - Complete clinical workflow testing  
4. **Performance Tests** - Load and stress testing
5. **Security Tests** - Authentication and authorization
6. **Compliance Tests** - FHIR R4 standard validation

## Quick Start

### Run All Tests
```bash
# Complete test suite
./test-automation/run-all-tests.sh

# Specific test categories
./test-automation/run-all-tests.sh --no-e2e        # Skip E2E tests
./test-automation/run-all-tests.sh --parallel      # Run unit tests in parallel
./test-automation/run-all-tests.sh --headed        # Run E2E tests with browser UI
```

### Test Environment Setup
```bash
# Ensure system is running
./unified-deploy.sh --patients 5 --providers 3 --orgs 2

# Install E2E test dependencies
cd e2e-tests && npm install

# Verify test environment
curl http://localhost:8000/health
curl http://localhost/
```

## Testing Layers

### 1. Unit Tests

#### Backend Unit Tests (Python/pytest)
```bash
# Run backend unit tests
docker-compose exec backend python -m pytest tests/ \
  --verbose \
  --cov=. \
  --cov-report=html \
  --cov-report=term

# Test specific modules
docker-compose exec backend python -m pytest tests/test_fhir_storage.py
docker-compose exec backend python -m pytest tests/test_clinical_services.py
```

**Coverage Requirements:**
- Minimum 80% code coverage
- Critical FHIR operations: 95% coverage
- Authentication/authorization: 100% coverage

**Test Categories:**
- FHIR resource validation
- Database operations
- Authentication mechanisms
- Clinical decision support
- API endpoint functionality

#### Frontend Unit Tests (Jest/React Testing Library)
```bash
# Run frontend unit tests
cd frontend
npm test -- --coverage --watchAll=false

# Test specific components
npm test -- --testNamePattern="Clinical Workspace"
npm test -- --testNamePattern="FHIR Resource"
```

**Test Focus Areas:**
- React component rendering
- Context providers and hooks
- FHIR data transformations
- User interaction flows
- Error boundary handling

### 2. Integration Tests

#### FHIR API Integration
```bash
# Comprehensive FHIR testing
docker-compose exec backend python test_fhir_comprehensive.py

# Clinical workflow testing
docker-compose exec backend python test_complete_clinical_workflow.py
```

**Test Scenarios:**
- CRUD operations for all FHIR resource types
- Search parameter functionality
- Bundle operations (transaction/batch)
- Version negotiation
- Capability statement validation

#### Database Integration
```bash
# Database schema validation
docker-compose exec backend python scripts/validate_database_schema.py

# Data integrity testing
docker-compose exec backend python test_data_integrity.py
```

### 3. End-to-End Tests (Cypress)

#### Test Structure
```
e2e-tests/
├── cypress/
│   ├── e2e/
│   │   ├── smoke/           # Basic functionality tests
│   │   ├── critical/        # Critical workflow tests
│   │   ├── api/            # FHIR API compliance tests
│   │   └── performance/    # Performance benchmarks
│   ├── support/
│   │   ├── commands.js     # Custom Cypress commands
│   │   └── e2e.js         # Global test configuration
│   └── fixtures/          # Test data and mocks
```

#### Running E2E Tests
```bash
cd e2e-tests

# Run all E2E tests
npm run test:e2e

# Run specific test suites
npm run test:smoke      # Smoke tests
npm run test:critical   # Critical workflows
npm run test:api        # API compliance

# Interactive mode for debugging
npm run cypress:open
```

#### E2E Test Categories

**Smoke Tests** - Basic functionality verification
- Application loads without errors
- Authentication works
- Patient selection functions
- Tab navigation operates correctly
- FHIR API responds appropriately

**Critical Workflow Tests** - Complete clinical scenarios
- Medication ordering workflow
- Laboratory result interpretation
- Condition management
- Clinical decision support triggers
- Pharmacy dispensing process
- Imaging study management

**API Compliance Tests** - FHIR R4 standard validation
- Resource CRUD operations
- Search parameter compliance
- Bundle transaction support
- Version negotiation
- Error handling standards

### 4. Performance Tests

#### Load Testing
```bash
# Basic load testing
docker-compose exec backend python test_performance_load.py

# Stress testing with multiple users
cd performance-tests
k6 run load-test.js
```

**Performance Benchmarks:**
- API response time: <500ms for 95th percentile
- Database queries: <100ms for simple queries
- Page load time: <3 seconds for clinical workspaces
- Memory usage: <2GB per container under normal load

#### Performance Monitoring
```bash
# Monitor during tests
docker stats

# Database performance
docker-compose exec postgres psql -U emr_user emr_db -c "
  SELECT query, mean_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_time DESC 
  LIMIT 10;"
```

### 5. Security Tests

#### Authentication Testing
```bash
# Authentication flow testing
cd e2e-tests
npm run test:auth

# JWT token validation
docker-compose exec backend python test_auth_security.py
```

**Security Test Areas:**
- Login/logout functionality
- Session management
- Role-based access control
- API endpoint protection
- Input validation and sanitization
- SQL injection prevention

#### Vulnerability Scanning
```bash
# Dependency vulnerability scanning
cd frontend && npm audit
cd backend && safety check

# Container security scanning
docker scout cves
```

### 6. FHIR Compliance Tests

#### Standard Compliance
```bash
# FHIR R4 validation
cd e2e-tests
npm run test:fhir-compliance

# Capability statement validation
curl http://localhost:8000/fhir/R4/metadata | jq .
```

**Compliance Areas:**
- Resource structure validation
- Search parameter support
- HTTP status code compliance
- Content negotiation
- Version header handling
- OperationOutcome formatting

## Test Data Management

### Test Data Strategy
- **Synthetic Data**: Realistic clinical data generated via Synthea
- **Isolation**: Each test gets clean, predictable data
- **Cleanup**: Automatic cleanup after test completion
- **Versioning**: Test data versioned with application code

### Test Data Generation
```bash
# Generate test-specific data
./unified-deploy.sh --patients 5 --providers 3 --orgs 2

# Clean test artifacts
docker-compose exec backend python -c "
import asyncio
import asyncpg

async def cleanup_test_data():
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    await conn.execute('DELETE FROM fhir.resources WHERE resource::text LIKE \\'%Test%\\'')
    await conn.close()

asyncio.run(cleanup_test_data())
"
```

### Data Fixtures
```javascript
// Cypress test fixtures
cy.fixture('test-patient.json').then(patient => {
  cy.createFHIRResource('Patient', patient);
});

cy.fixture('test-medication-request.json').then(medicationRequest => {
  cy.createFHIRResource('MedicationRequest', medicationRequest);
});
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: MedGenEMR Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run unit tests
        run: |
          docker-compose up -d postgres
          docker-compose run backend pytest
          docker-compose run frontend npm test

  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    steps:
      - name: Run integration tests
        run: |
          ./unified-deploy.sh --patients 5
          ./test-automation/run-all-tests.sh --no-e2e

  e2e-tests:
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - name: Run E2E tests
        run: |
          ./unified-deploy.sh --patients 10
          cd e2e-tests && npm ci
          npm run test:e2e:headless
```

### Quality Gates
- All unit tests must pass
- Integration tests must pass
- E2E smoke tests must pass
- Code coverage must meet thresholds
- No critical security vulnerabilities
- FHIR compliance tests must pass

## Test Reporting

### Coverage Reports
```bash
# Backend coverage
docker-compose exec backend python -m pytest --cov-report=html
# Report: backend/htmlcov/index.html

# Frontend coverage  
cd frontend && npm test -- --coverage
# Report: frontend/coverage/lcov-report/index.html
```

### E2E Test Artifacts
```bash
# Test videos and screenshots
ls e2e-tests/cypress/videos/
ls e2e-tests/cypress/screenshots/

# Test reports
ls test-results/reports/
```

### Consolidated Reporting
```bash
# Generate comprehensive test report
./test-automation/run-all-tests.sh
# Report: test-results/reports/test-summary.html
```

## Test Environment Management

### Environment Isolation
Each test environment is completely isolated:
- Separate database schemas for concurrent testing
- Clean Docker containers for each test run
- Isolated test data that doesn't affect other tests
- Predictable initial state for every test

### Test Environment Lifecycle
```bash
# Setup test environment
./unified-deploy.sh --patients 5 --providers 3 --orgs 2

# Run tests
./test-automation/run-all-tests.sh

# Cleanup
docker-compose down -v
```

## Debugging Tests

### Frontend Test Debugging
```bash
# Debug React components
cd frontend
npm test -- --verbose --watchAll=false

# Debug with browser
npm test -- --debug --watchAll=false
```

### Backend Test Debugging
```bash
# Debug with pytest
docker-compose exec backend python -m pytest -vvv -s tests/test_specific.py

# Debug with logging
docker-compose exec backend python -m pytest --log-level=DEBUG
```

### E2E Test Debugging
```bash
# Run with browser visible
cd e2e-tests
npm run cypress:open

# Debug specific test
npx cypress run --spec "cypress/e2e/critical/medication-workflow.cy.js" --headed

# Enable debug logs
DEBUG=cypress:* npm run test:e2e
```

## Best Practices

### Test Writing Guidelines
1. **Arrange-Act-Assert Pattern**: Clear test structure
2. **Descriptive Test Names**: What is being tested and expected outcome
3. **Independent Tests**: No dependencies between tests
4. **Realistic Data**: Use Synthea-generated clinical data
5. **Error Scenarios**: Test both success and failure cases

### Test Maintenance
1. **Regular Review**: Update tests with feature changes
2. **Flaky Test Management**: Identify and fix unstable tests
3. **Performance Monitoring**: Track test execution times
4. **Coverage Analysis**: Ensure critical paths are tested

### Clinical Testing Considerations
1. **Patient Safety**: Validate all clinical calculations
2. **Data Integrity**: Ensure FHIR resource consistency
3. **Workflow Completeness**: Test entire clinical scenarios
4. **Decision Support**: Validate CDS hook behavior
5. **Audit Trail**: Verify proper logging and tracking

## Troubleshooting

### Common Test Issues
```bash
# Test environment not ready
curl http://localhost:8000/health
docker-compose ps

# Database connection issues
docker-compose exec postgres pg_isready -U emr_user

# Frontend build issues
cd frontend && npm install
docker-compose build frontend

# E2E test failures
cd e2e-tests && npm install
npx cypress verify
```

### Test Data Issues
```bash
# Reset test data
docker-compose down -v
./unified-deploy.sh --fresh --patients 5

# Verify data integrity
docker-compose exec backend python scripts/validate_database_schema.py
```

### Performance Test Issues
```bash
# Check system resources
docker stats
df -h
free -m

# Optimize test performance
docker system prune -f
docker volume prune -f
```

This comprehensive testing strategy ensures that MedGenEMR maintains high quality, reliability, and compliance with healthcare standards while supporting rapid development and deployment cycles.