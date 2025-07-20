# CDS Rules Engine Migration Guide

This guide helps you migrate from the legacy CDS services to the new rules engine while ensuring zero downtime and maintaining clinical safety.

## Overview

The new CDS rules engine provides enhanced capabilities while maintaining 100% backward compatibility with existing CDS services. You can migrate gradually, test thoroughly, and roll back if needed.

## Migration Strategy

### Phase 1: Parallel Testing (Recommended Starting Point)

Run both engines in parallel to compare results:

```http
POST /cds-hooks/cds-services/diabetes-management?use_rules_engine=true
```

This executes the rules engine but falls back to legacy if it fails.

### Phase 2: V2 Service Testing

Test new v2 endpoints that use rules engine by default:

```http
POST /cds-hooks/cds-services/medication-prescribe-v2
POST /cds-hooks/cds-services/patient-view-v2
POST /cds-hooks/cds-services/order-select-v2
```

### Phase 3: Hybrid Mode

Enable both engines to get combined results:

```python
# In integration.py
response = await cds_integration.execute_hook(
    hook="patient-view",
    context=context,
    prefetch=prefetch,
    use_legacy=True  # Combines results from both engines
)
```

### Phase 4: Full Migration

Update your client to use v2 services exclusively once validated.

## Service Mapping

| Legacy Service | Rules Engine Equivalent | Key Differences |
|----------------|------------------------|-----------------|
| `diabetes-management` | `patient-view-v2` with chronic disease rules | More comprehensive, includes A1C monitoring, eye exams |
| `hypertension-management` | `patient-view-v2` with chronic disease rules | Adds medication adherence checks |
| `drug-drug-interaction` | `medication-prescribe-v2` with drug interaction rules | Expanded interaction database |
| `preventive-care` | `patient-view-v2` with preventive care rules | Age and gender-specific recommendations |

## Rule Comparison

### Diabetes Management

**Legacy Service**:
- A1C > 9.0 → Critical alert
- A1C > 7.0 → Warning
- Metformin check
- Annual screenings reminder

**Rules Engine**:
- A1C > 9.0 → Critical alert (same)
- A1C > 7.0 → Warning (same)
- Metformin check (same)
- A1C monitoring every 3 months (new)
- Annual eye exam reminder (new)
- Kidney function monitoring (new)

### Drug Interactions

**Legacy Service**:
- 3 hardcoded interactions
- Simple substring matching

**Rules Engine**:
- Expandable interaction database
- Medication class-based checking
- Severity-based prioritization
- Alternative suggestions

## Testing Checklist

### 1. Functional Testing

- [ ] Legacy endpoints return same results
- [ ] V2 endpoints return expected cards
- [ ] Error scenarios handled gracefully
- [ ] Performance meets requirements

### 2. Clinical Validation

- [ ] All critical alerts still fire
- [ ] No false positives introduced
- [ ] Clinical accuracy maintained
- [ ] Priority ordering correct

### 3. Integration Testing

- [ ] Frontend displays cards correctly
- [ ] WebSocket notifications work
- [ ] Audit logging captures events
- [ ] Performance acceptable

### 4. A/B Testing

```javascript
// Frontend example
const useV2 = Math.random() < 0.5; // 50/50 split
const serviceId = useV2 ? 'patient-view-v2' : 'patient-view';

// Track metrics
analytics.track('cds_service_used', {
  service: serviceId,
  version: useV2 ? 'v2' : 'legacy'
});
```

## Rollback Plan

If issues arise, you can instantly rollback:

1. **Service Level**: Use legacy service IDs
2. **Feature Flag**: Set global flag to disable rules engine
3. **Query Parameter**: Remove `use_rules_engine` parameter

## Monitoring

### Key Metrics to Track

1. **Response Times**
   - Legacy service p95
   - Rules engine p95
   - Compare degradation

2. **Card Generation**
   - Cards per request
   - Card types distribution
   - Missing expected cards

3. **Error Rates**
   - Rules engine failures
   - Fallback frequency
   - Timeout rates

4. **Clinical Metrics**
   - Alert acceptance rate
   - False positive rate
   - Clinical outcome correlation

### Sample Monitoring Query

```sql
-- Compare card generation between engines
SELECT 
  service_version,
  COUNT(*) as requests,
  AVG(card_count) as avg_cards,
  AVG(response_time_ms) as avg_response_time,
  SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as errors
FROM cds_execution_log
WHERE timestamp > NOW() - INTERVAL '1 day'
GROUP BY service_version;
```

## Troubleshooting

### Common Issues

1. **Missing Cards**
   - Check rule conditions match your data
   - Verify prefetch includes required fields
   - Review rule priorities

2. **Performance Degradation**
   - Enable caching
   - Reduce categories evaluated
   - Check database indexes

3. **Different Results**
   - Compare rule conditions to legacy logic
   - Check data adapter mappings
   - Verify date calculations

### Debug Mode

Enable detailed logging:

```python
# In your configuration
CDS_RULES_ENGINE_DEBUG = True
CDS_RULES_ENGINE_LOG_LEVEL = "DEBUG"
```

## Custom Rule Migration

Convert legacy service logic to rules:

```python
# Legacy hardcoded logic
if a1c_value >= 9.0:
    cards.append(create_critical_alert())

# Rules engine equivalent
Rule(
    id="dm_high_a1c",
    name="High A1C Alert",
    conditions=[
        RuleCondition(
            field="labResults.a1c.value",
            operator="gte",
            value=9.0,
            data_type="number"
        )
    ],
    actions=[
        RuleAction(
            type="card",
            summary="High A1C Alert",
            detail="A1C ≥ 9.0% requires immediate intervention",
            indicator="critical"
        )
    ]
)
```

## Best Practices

1. **Start Small**: Migrate one service at a time
2. **Monitor Closely**: Track metrics during migration
3. **Validate Clinically**: Have clinicians review results
4. **Document Changes**: Keep audit trail of modifications
5. **Train Users**: Ensure staff understand new features

## Timeline Example

**Week 1-2**: Parallel testing with monitoring
**Week 3-4**: A/B testing with subset of users
**Week 5-6**: Gradual rollout to all users
**Week 7-8**: Deprecate legacy endpoints

## Support

For assistance with migration:
- Review integration tests in `/backend/tests/test_cds_rules_engine_integration.py`
- Check rule definitions in `/backend/api/cds_hooks/rules_engine/clinical_rules.py`
- Monitor health endpoint at `/cds-hooks/health`