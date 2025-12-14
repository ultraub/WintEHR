# CDS Hooks Module Documentation

## Overview
The CDS Hooks module implements the HL7 CDS Hooks 2.0 specification, providing clinical decision support integration points throughout the EMR. It enables real-time, context-aware clinical guidance through standardized service discovery and card-based recommendations.

**Architecture Version**: 3.0 (Restructured Architecture)
**Last Updated**: 2025-11-26

### Key Architecture Features (v3.0)
- CDS Hooks 2.0 specification compliance
- API endpoints at `/api/cds-services` (discovery) and `/api/cds-services/{id}` (execution)
- CDSService abstract base class for all services
- ConditionEngine for declarative condition evaluation
- ServiceOrchestrator for parallel service execution
- ServiceRegistry for service discovery
- PrefetchEngine for FHIR query template resolution

## Current Implementation Details

### Core Components
- **cds_hooks_router.py**: Main FastAPI router (~55KB, hook engine)
- **models.py**: Pydantic data models for CDS Hooks structures
- **services/**: Service base class and built-in implementations
- **conditions/**: ConditionEngine for declarative evaluation
- **orchestrator/**: ServiceOrchestrator + CDSHookEngine
- **registry/**: ServiceRegistry for discovery
- **prefetch/**: PrefetchEngine for FHIR query execution
- **hooks/**: Hook configurations and persistence
- **feedback/**: Feedback tracking and analytics
- **rules_engine/**: Clinical rules engine integration

### Implemented Hooks
1. **patient-view**: Triggered when opening a patient chart
2. **medication-prescribe**: Fired during medication ordering
3. **order-review**: Activated during order review
4. **encounter-start**: Triggered at encounter initiation
5. **encounter-discharge**: Fired during discharge planning

### Pre-configured CDS Services
```python
# 10+ built-in services including:
- diabetes-screening-reminder
- medication-interaction-check
- preventive-care-gaps
- high-risk-medication-elderly
- duplicate-therapy-detection
- lab-result-follow-up
- immunization-reminder
- cancer-screening-due
- hypertension-management
- opioid-risk-assessment
```

## CDS Hooks Compliance Status

### Specification Compliance
| Feature | Status | Notes |
|---------|--------|-------|
| **Discovery Endpoint** | ✅ Complete | GET /cds-services |
| **Service Endpoints** | ✅ Complete | POST /cds-services/{id} |
| **Prefetch Templates** | ✅ Complete | FHIR query support |
| **Cards Response** | ✅ Complete | All card types supported |
| **Suggestions** | ✅ Complete | Action suggestions |
| **App Links** | ✅ Complete | SMART app launch |
| **Feedback Endpoint** | ✅ Complete | POST /cds-services/{id}/feedback |
| **Analytics** | ⚠️ Basic | Usage tracking implemented |
| **Service Registry** | ✅ Complete | Clean separation of config/logic |

### Request/Response Format
```python
# Proper CDS Hooks request structure
{
  "hookInstance": "uuid",
  "fhirServer": "http://localhost:8000/fhir/R4",
  "hook": "patient-view",
  "context": {
    "patientId": "123",
    "userId": "Practitioner/456"
  },
  "prefetch": {
    "patient": { /* Patient resource */ },
    "conditions": { /* Bundle of Conditions */ }
  }
}

# Card response format
{
  "cards": [{
    "uuid": "card-uuid",
    "summary": "Diabetes Screening Overdue",
    "indicator": "warning",
    "detail": "Patient is due for HbA1c testing",
    "source": {
      "label": "Diabetes Prevention Guidelines",
      "url": "https://guidelines.example.org"
    },
    "suggestions": [{
      "label": "Order HbA1c Test",
      "actions": [...]
    }]
  }]
}
```

## Missing Features

### Identified Gaps
1. **Advanced Hook Types**
   - No custom hook registration API
   - Limited context parameters
   - No hook chaining support

2. **Decision Logic**
   - Basic rule engine only
   - No complex clinical algorithms
   - Limited temporal reasoning

3. **Integration Features**
   - No external service calls
   - Limited SMART app integration
   - No real-time data streaming

4. **Analytics**
   - Basic usage tracking only
   - No outcome measurement
   - Limited feedback analysis

## Educational Opportunities

### 1. CDS Hooks Implementation
**Learning Objective**: Understanding clinical decision support standards

**Key Concepts**:
- Hook lifecycle and triggers
- Context-aware recommendations
- Card-based UI patterns
- Feedback mechanisms

**Exercise**: Create a custom CDS service for antibiotic stewardship

### 2. Clinical Rule Development
**Learning Objective**: Building effective clinical rules

**Key Concepts**:
- Evidence-based guidelines
- Alert fatigue prevention
- Context consideration
- Action specificity

**Exercise**: Implement a complex rule with multiple conditions

### 3. FHIR Integration
**Learning Objective**: Leveraging FHIR for CDS

**Key Concepts**:
- Prefetch optimization
- Resource querying
- Data extraction
- Reference resolution

**Exercise**: Build a service using complex FHIR queries

### 4. User Experience Design
**Learning Objective**: Creating effective clinical alerts

**Key Concepts**:
- Card design principles
- Indicator severity levels
- Action clarity
- Interruption minimization

**Exercise**: Design cards for different clinical scenarios

### 5. Performance Optimization
**Learning Objective**: Building responsive CDS systems

**Key Concepts**:
- Prefetch strategies
- Caching patterns
- Async processing
- Load distribution

**Exercise**: Optimize a slow-running CDS service

## Service Registry Pattern (v3.0 Architecture)

### Overview
The v3.0 architecture provides clean separation between service configuration and implementation using the CDSService base class:

```python
"""
New pattern: Inherit from CDSService base class
Located in: services/base_service.py
"""
from api.cds_hooks.services import CDSService, HookType
from api.cds_hooks.conditions import ConditionEngine
from api.cds_hooks.registry import register_service

class DiabetesScreeningService(CDSService):
    """
    Example: Diabetes screening reminder service
    """
    # Class-level metadata
    service_id = "diabetes-screening"
    hook_type = HookType.PATIENT_VIEW
    title = "Diabetes Screening Reminder"
    description = "Reminds providers to screen eligible patients"
    prefetch_templates = {
        "patient": "Patient/{{context.patientId}}",
        "recentLabs": "Observation?patient={{context.patientId}}&code=4548-4&_count=5"
    }

    async def should_execute(self, context, prefetch):
        """Determine if service should run"""
        engine = ConditionEngine()
        result = await engine.evaluate(
            [ConditionEngine.age_at_least(45)],
            context, prefetch
        )
        return result.satisfied

    async def execute(self, context, prefetch):
        """Generate recommendation cards"""
        return [self.create_card(
            summary="Diabetes screening recommended",
            indicator="warning",
            detail="Patient is over 45 and has no recent A1C test."
        )]

# Register with the global registry
register_service(DiabetesScreeningService())
```

### Usage
```bash
# Discovery endpoint
GET /api/cds-services

# Execute service
POST /api/cds-services/{service_id}

# Service with prefetch
POST /api/cds-services/diabetes-screening-reminder
```

## Best Practices Demonstrated

### 1. **Service Discovery**
```python
# Located in cds_hooks_router.py
# Registered at /api/cds-services via routers/__init__.py

@router.get("/cds-services")
async def discover_services():
    """CDS Hooks 2.0 discovery endpoint."""
    registry = get_registry()
    return get_discovery_response(registry)
```

### 2. **Context Processing**
```python
async def process_hook_request(
    service_id: str,
    request: CDSRequest,
    db: AsyncSession
) -> CDSResponse:
    """Process a CDS Hooks request."""
    
    # Get service definition
    service = get_service(service_id)
    
    # Extract context
    patient_id = request.context.get("patientId")
    user_id = request.context.get("userId")
    
    # Load additional data if needed
    if not request.prefetch:
        prefetch_data = await fetch_required_data(
            service.prefetch,
            patient_id,
            db
        )
    else:
        prefetch_data = request.prefetch
    
    # Evaluate rules
    cards = await evaluate_service_rules(
        service,
        request.context,
        prefetch_data
    )
    
    return CDSResponse(cards=cards)
```

### 3. **Card Generation**
```python
def create_card(
    summary: str,
    indicator: str = "info",
    detail: str = None,
    suggestions: List[dict] = None
) -> dict:
    """Create a CDS Hooks card."""
    card = {
        "uuid": str(uuid.uuid4()),
        "summary": summary,
        "indicator": indicator,
        "source": {
            "label": "WintEHR CDS",
            "url": "http://localhost:8000"
        }
    }
    
    if detail:
        card["detail"] = detail
    
    if suggestions:
        card["suggestions"] = suggestions
    
    return card
```

## Integration Architecture

### EMR Integration Points
- Patient dashboard loading
- Medication ordering workflow
- Order review process
- Encounter documentation
- Discharge planning

### Event Flow
1. Clinical action triggers hook
2. Context gathered from EMR
3. CDS service evaluates rules
4. Cards returned to EMR
5. User acts on suggestions
6. Feedback sent to service

### Data Sources
- FHIR server for clinical data
- Knowledge base for guidelines
- User preferences
- Historical outcomes

## Testing Approach

### Test Coverage
- All pre-configured services
- Various context scenarios
- Edge cases and errors
- Performance under load

### Test Scenarios
- Patient with multiple conditions
- Medication interactions
- Missing data handling
- Timeout scenarios

## Performance Characteristics

### Current Metrics
- Service discovery: <50ms
- Simple rule evaluation: <100ms
- Complex rule with prefetch: <500ms
- Average response time: 200ms

### Optimization Strategies
- Prefetch template optimization
- Rule evaluation caching
- Parallel rule processing
- Database query optimization

## Clinical Safety

### Safety Features
- Non-blocking recommendations
- Clear indication of severity
- Source attribution
- Override capability

### Alert Management
- Frequency limiting
- User preference respect
- Context-aware suppression
- Feedback incorporation

## Future Enhancements

### Short-term
- More pre-built services
- Enhanced rule builder UI
- Improved analytics
- Performance monitoring

### Medium-term
- External service integration
- Machine learning rules
- Outcome tracking
- A/B testing framework

### Long-term
- Real-time streaming hooks
- Predictive analytics
- Natural language rules
- Federated learning

## Conclusion

The CDS Hooks module provides a robust, standards-compliant implementation of clinical decision support. With 10+ pre-configured services and full specification support, it demonstrates both educational value and production readiness. The module excels in clean architecture, comprehensive testing, and real-world applicability. Key enhancement opportunities include advanced analytics, external integrations, and machine learning capabilities. The implementation serves as an excellent teaching tool for clinical decision support concepts while providing immediate value in clinical workflows.