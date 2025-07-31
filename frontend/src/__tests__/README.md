# Frontend Testing Guide

## Overview

This directory contains tests for the WintEHR frontend application. We use Jest and React Testing Library for unit and integration testing.

## Test Structure

```
src/
├── __tests__/              # App-level tests
├── components/
│   └── __tests__/         # Component tests
├── services/
│   └── __tests__/         # Service tests
├── hooks/
│   └── __tests__/         # Custom hook tests
├── contexts/
│   └── __tests__/         # Context tests
└── test-utils/            # Testing utilities
    └── test-utils.js      # Custom render with providers
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test ErrorBoundary.test.js
```

## Writing Tests

### Basic Component Test

```javascript
import { render, screen } from '../test-utils/test-utils';
import MyComponent from '../components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Testing with Mock Data

```javascript
import { render, screen, generateMockPatient } from '../test-utils/test-utils';
import PatientCard from '../components/PatientCard';

it('displays patient information', () => {
  const mockPatient = generateMockPatient({
    name: [{ given: ['Jane'], family: 'Smith' }]
  });
  
  render(<PatientCard patient={mockPatient} />);
  expect(screen.getByText('Jane Smith')).toBeInTheDocument();
});
```

### Testing Async Operations

```javascript
import { render, screen, waitFor } from '../test-utils/test-utils';
import PatientList from '../components/PatientList';

it('loads and displays patients', async () => {
  render(<PatientList />);
  
  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
  
  // Check patients are displayed
  expect(screen.getByText('John Doe')).toBeInTheDocument();
});
```

## Test Utilities

### Custom Render

The custom render function in `test-utils.js` wraps components with all necessary providers:
- Theme Provider
- Router
- Auth Context
- FHIR Resource Context
- Error Boundary

### Mock Data Generators

- `generateMockPatient()` - Creates a mock FHIR Patient resource
- `generateMockCondition()` - Creates a mock FHIR Condition resource
- `generateMockMedicationRequest()` - Creates a mock FHIR MedicationRequest

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what users see and do
   - Avoid testing internal state or implementation details

2. **Use Semantic Queries**
   - Prefer `getByRole`, `getByLabelText`, `getByText`
   - Avoid `getByTestId` unless necessary

3. **Mock External Dependencies**
   - Mock API calls with MSW or manual mocks
   - Mock complex components when testing parents

4. **Keep Tests Focused**
   - One assertion per test when possible
   - Use descriptive test names

5. **Handle Async Properly**
   - Use `waitFor` for async operations
   - Clean up timers and promises

## Coverage Goals

- Aim for 80% code coverage
- Focus on critical paths and business logic
- Don't test third-party libraries
- Prioritize integration tests over unit tests for complex workflows

## Common Issues

### Console Warnings
Some Material-UI components may produce warnings in tests. These are suppressed in `setupTests.js`.

### Async Cleanup
Always await async operations and use `waitFor` to prevent "act" warnings.

### Provider Errors
Use the custom render function to ensure all providers are available.

## TODO

- [ ] Add MSW for API mocking
- [ ] Add visual regression tests
- [ ] Add E2E tests with Cypress/Playwright
- [ ] Increase test coverage to 80%
- [ ] Add performance tests