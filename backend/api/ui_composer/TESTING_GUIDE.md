# UI Composer Multi-LLM Provider Testing Guide

## Overview

The UI Composer testing framework provides comprehensive tools for evaluating and comparing different LLM providers (Claude, GPT-4, Gemini) in generating clinical UI components and FHIR queries.

## Quick Start

### 1. Configure Providers

First, ensure you have API keys configured for the providers you want to test:

```bash
# Required for each provider
export ANTHROPIC_API_KEY=your-key
export OPENAI_API_KEY=your-key
export GEMINI_API_KEY=your-key

# Optional: Azure OpenAI
export AZURE_OPENAI_API_KEY=your-key
export AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
export AZURE_OPENAI_DEPLOYMENT=your-deployment
```

### 2. Run Basic Tests

```bash
# Check provider availability
python api/ui_composer/run_provider_tests.py --mode status

# Run basic functionality test
python api/ui_composer/run_provider_tests.py --mode basic

# Quick evaluation (2 scenarios)
python api/ui_composer/run_provider_tests.py --quick
```

### 3. Run Comprehensive Evaluation

```bash
# Full evaluation suite
python api/ui_composer/run_provider_tests.py --mode evaluate

# Specific scenario
python api/ui_composer/run_provider_tests.py --scenario diabetes_monitoring

# Specific providers
python api/ui_composer/run_provider_tests.py --providers "anthropic,openai"
```

## Test Components

### 1. Provider Comparison Tests (`test_provider_comparison.py`)

Compares how different providers interpret and respond to clinical requests:

```python
# Run standalone
python api/ui_composer/test_provider_comparison.py

# Output includes:
# - Performance metrics (response times)
# - Quality scores (intent accuracy, resource selection)
# - Feature comparison matrix
# - Recommendations for each use case
```

### 2. Provider Switching Tests (`test_provider_switching.py`)

Tests the system's ability to switch between providers seamlessly:

```python
# Run standalone
python api/ui_composer/test_provider_switching.py

# Tests:
# - Provider availability detection
# - Smooth provider switching
# - Fallback mechanisms
# - Concurrent request handling
```

### 3. Multi-Provider Generation Tests (`test_multi_provider_generation.py`)

Tests actual UI component generation with different providers:

```python
# Run standalone
python api/ui_composer/test_multi_provider_generation.py

# Generates:
# - Side-by-side component comparisons
# - Quality analysis for each component
# - Saved components for manual review
```

### 4. Formal Test Suite (`test_ui_composer_providers.py`)

Pytest-based test suite for CI/CD integration:

```bash
# Run with pytest
pytest tests/test_ui_composer_providers.py -v

# Run specific test
pytest tests/test_ui_composer_providers.py::test_provider_switching -v

# With coverage
pytest tests/test_ui_composer_providers.py --cov=api.ui_composer
```

## Evaluation Framework

### Clinical Scenarios

The framework tests 5 core clinical scenarios:

1. **Basic Vital Signs** - Simple display requirement
2. **Hypertension Management** - Medium complexity dashboard
3. **Diabetes Monitoring** - Multi-resource integration
4. **Sepsis Risk Assessment** - Complex analysis with alerts
5. **Population Health** - Analytics across patient populations

### Quality Metrics

Each provider is evaluated on:

- **Intent Accuracy** (25%) - Understanding clinical intent
- **Resource Selection** (20%) - Choosing appropriate FHIR resources
- **Query Efficiency** (15%) - Optimized FHIR queries
- **UI Appropriateness** (20%) - Selecting suitable UI components
- **Code Quality** (20%) - Generated React code quality

### Performance Metrics

- Response time per request
- Success rate across scenarios
- Consistency (standard deviation)
- Resource efficiency

## Frontend Testing

### Provider Test Harness Component

The `ProviderTestHarness` component provides visual testing:

```javascript
// Add to any clinical workspace
import ProviderTestHarness from './modules/ui-composer/components/ProviderTestHarness';

<ProviderTestHarness patientId={currentPatient.id} />
```

Features:
- Scenario selection dropdown
- Provider selection
- Real-time comparison
- Code preview with syntax highlighting
- Live component preview

## Test Reports

### Evaluation Reports

After running evaluations, reports are saved in `evaluation_results/`:

```
evaluation_results/
├── evaluation_20240108_143022.json      # Raw results
├── evaluation_report_20240108_143022.md  # Markdown report
└── test_report_20240108_143500.md       # Test summary
```

### Report Contents

1. **Performance Summary** - Provider rankings by metric
2. **Scenario Results** - Detailed results per scenario
3. **Recommendations** - Which provider for which use case
4. **Quality Analysis** - Code quality metrics

## Interpreting Results

### Provider Strengths

Based on testing, typical strengths:

- **Claude**: Best clinical understanding, high-quality code
- **GPT-4**: Fast response times, good general purpose
- **Gemini**: Strong on complex queries, good explanations

### Use Case Recommendations

The framework provides specific recommendations:

```
Best for vital signs display: anthropic (score: 0.92)
Best for complex analytics: gemini (score: 0.88)
Fastest overall: openai (avg: 1.2s)
Most reliable: anthropic (success rate: 98%)
```

## Continuous Testing

### Automated Testing Pipeline

```bash
# Add to CI/CD pipeline
python api/ui_composer/run_provider_tests.py --mode all --output-dir ci-results

# Check for regressions
if [ $? -ne 0 ]; then
  echo "Provider tests failed"
  exit 1
fi
```

### Weekly Evaluation

Schedule comprehensive evaluations:

```bash
# Weekly cron job
0 0 * * 0 cd /path/to/medgenemr && python api/ui_composer/run_provider_tests.py --mode evaluate
```

## Troubleshooting

### Common Issues

1. **Provider not available**
   - Check API key environment variables
   - Verify network connectivity
   - Check provider service status

2. **Generation failures**
   - Review error logs in evaluation results
   - Check for rate limiting
   - Verify FHIR resource availability

3. **Inconsistent results**
   - Some variation is normal
   - Check temperature settings (should be 0)
   - Review prompt consistency

### Debug Mode

Enable detailed logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Then run tests
```

## Best Practices

1. **Test Regularly** - Providers update their models frequently
2. **Use Multiple Scenarios** - Don't rely on single test cases
3. **Compare Like-for-Like** - Use same prompts across providers
4. **Document Findings** - Track changes over time
5. **Test in Production Context** - Use real FHIR data when possible

## Future Enhancements

Planned improvements:

1. **Automated A/B Testing** - Route % of requests to different providers
2. **Cost Analysis** - Track token usage and costs
3. **Clinical Accuracy Validation** - Expert review of outputs
4. **Custom Scenario Builder** - UI for creating test scenarios
5. **Performance Optimization** - Caching and request batching