"""
CDS Hooks Router v2
Implements CDS Hooks 1.0 specification compliant endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import uuid
import logging

from database import get_db_session
from .hook_persistence import (
    get_persistence_manager, 
    load_hooks_from_database, 
    save_sample_hooks_to_database
)
from .feedback_persistence import (
    get_feedback_manager,
    process_cds_feedback,
    get_service_analytics,
    log_hook_execution
)
from .prefetch_engine import (
    get_prefetch_engine,
    execute_hook_prefetch
)
from .models import (
    CDSHookRequest,
    CDSHookResponse,
    CDSServicesResponse,
    CDSService,
    Card,
    Source,
    Suggestion,
    Action,
    Link,
    FeedbackRequest,
    HookType,
    IndicatorType,
    ActionType,
    PatientViewContext,
    MedicationPrescribeContext,
    OrderSignContext,
    HookConfiguration,
    HookCondition,
    HookAction
)
from .medication_prescribe_hooks import medication_prescribe_hooks
from .rules_engine.integration import cds_integration
from .rules_engine.safety import safety_manager, FeatureFlag

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["CDS Hooks"])

# Include action execution router
from .action_router import router as action_router
router.include_router(action_router, prefix="", tags=["CDS Actions"])

# Include audit trail router
from .audit_router import router as audit_router
router.include_router(audit_router, prefix="", tags=["CDS Audit"])

# Sample hook configurations - in production, these would be stored in database
SAMPLE_HOOKS = {
    "patient-greeter": HookConfiguration(
        id="patient-greeter",
        hook=HookType.PATIENT_VIEW,
        title="Patient Greeter",
        description="Greets the patient and provides basic information",
        enabled=True,
        conditions=[],  # No conditions - always shows
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Welcome to Patient Chart",
                    "detail": "Review patient's clinical summary and recent activities.",
                    "indicator": "info",
                    "source": {"label": "EMR System"},
                    "links": [
                        {
                            "label": "View Clinical Guidelines",
                            "url": "https://www.cdc.gov/clinical-guidelines",
                            "type": "absolute"
                        }
                    ]
                }
            )
        ],
        displayBehavior={
            "defaultMode": "popup",
            "indicatorOverrides": {
                "critical": "modal",
                "warning": "popup",
                "info": "inline"
            },
            "acknowledgment": {
                "required": False,
                "reasonRequired": False
            },
            "snooze": {
                "enabled": True,
                "defaultDuration": 60
            }
        }
    ),
    "senior-care-reminder": HookConfiguration(
        id="senior-care-reminder",
        hook=HookType.PATIENT_VIEW,
        title="Senior Care Reminder",
        description="Reminds about preventive care for patients 65+",
        enabled=True,
        conditions=[
            HookCondition(
                type="patient-age",
                parameters={"operator": ">=", "value": "65"}
            )
        ],
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Senior Care Reminder",
                    "detail": "Patient is 65+ years old. Consider annual wellness visit and preventive screenings.",
                    "indicator": "info",
                    "source": {"label": "Preventive Care System"},
                    "suggestions": [
                        {
                            "label": "Schedule Annual Wellness Visit",
                            "uuid": str(uuid.uuid4()),
                            "actions": [
                                {
                                    "type": "create",
                                    "description": "Create wellness visit appointment",
                                    "resource": {
                                        "resourceType": "Appointment",
                                        "status": "proposed",
                                        "appointmentType": {
                                            "coding": [{
                                                "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
                                                "code": "WELLNESS",
                                                "display": "Wellness Exam"
                                            }]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            )
        ]
    ),
    "diabetes-management": HookConfiguration(
        id="diabetes-management",
        hook=HookType.PATIENT_VIEW,
        title="Diabetes Management Alert",
        description="Alerts for patients with diabetes",
        enabled=True,
        conditions=[
            HookCondition(
                type="diagnosis-code",
                parameters={
                    "codes": ["44054006", "73211009", "714628002", "127013003", "90781000119102"],
                    "system": "http://snomed.info/sct"
                }
            )
        ],
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Diabetes Care Reminder",
                    "detail": "Patient has diabetes. Check A1C levels and foot exam status.",
                    "indicator": "warning",
                    "source": {"label": "Chronic Disease Management"},
                    "suggestions": [
                        {
                            "label": "Order A1C Test",
                            "uuid": str(uuid.uuid4()),
                            "actions": [
                                {
                                    "type": "create",
                                    "description": "Order hemoglobin A1C test",
                                    "resource": {
                                        "resourceType": "ServiceRequest",
                                        "status": "draft",
                                        "intent": "order",
                                        "code": {
                                            "coding": [{
                                                "system": "http://loinc.org",
                                                "code": "4548-4",
                                                "display": "Hemoglobin A1c/Hemoglobin.total in Blood"
                                            }]
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                }
            )
        ]
    ),
    "medication-allergy-check": HookConfiguration(
        id="medication-allergy-check",
        hook=HookType.MEDICATION_PRESCRIBE,
        title="Medication Allergy Check",
        description="Checks for potential allergies when prescribing medications",
        enabled=True,
        conditions=[],
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Allergy Check",
                    "detail": "Please verify patient allergies before prescribing",
                    "indicator": "info",
                    "source": {"label": "Medication Safety System"}
                }
            )
        ]
    ),
    "drug-interaction-check": HookConfiguration(
        id="drug-interaction-check",
        hook=HookType.MEDICATION_PRESCRIBE,
        title="Drug Interaction Check",
        description="Checks for drug-drug interactions",
        enabled=True,
        conditions=[
            HookCondition(
                type="medication-active",
                parameters={"codes": ["any"]}  # Check for any active medications
            )
        ],
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Drug Interaction Alert",
                    "detail": "Check for potential drug interactions with current medications",
                    "indicator": "warning",
                    "source": {"label": "Drug Interaction System"}
                }
            )
        ]
    ),
    "hypertension-management": HookConfiguration(
        id="hypertension-management",
        hook=HookType.PATIENT_VIEW,
        title="Hypertension Management",
        description="Hypertension care reminders",
        enabled=True,
        conditions=[
            HookCondition(
                type="diagnosis-code",
                parameters={
                    "codes": ["38341003", "827069000", "78975002", "194774006"],
                    "system": "http://snomed.info/sct"
                }
            )
        ],
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Hypertension Care Reminder",
                    "detail": "Patient has hypertension. Consider BP monitoring and medication review.",
                    "indicator": "info",
                    "source": {"label": "Cardiovascular Care System"},
                    "suggestions": [
                        {
                            "label": "Order BP Monitoring",
                            "uuid": str(uuid.uuid4()),
                            "actions": [
                                {
                                    "type": "create",
                                    "description": "Create BP monitoring plan",
                                    "resource": {
                                        "resourceType": "CarePlan",
                                        "status": "draft",
                                        "intent": "plan",
                                        "category": [{"coding": [{"code": "734163000", "display": "Care plan"}]}]
                                    }
                                }
                            ]
                        }
                    ]
                }
            )
        ]
    ),
    "lab-value-critical": HookConfiguration(
        id="lab-value-critical",
        hook=HookType.PATIENT_VIEW,
        title="Critical Lab Values",
        description="Alerts for critical lab values",
        enabled=True,
        conditions=[
            HookCondition(
                type="lab-value",
                parameters={
                    "code": "33747-0",  # Glucose
                    "operator": "gt",
                    "value": "400",
                    "timeframe": "7"
                }
            )
        ],
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Critical Lab Alert",
                    "detail": "Patient has critical lab values requiring immediate attention",
                    "indicator": "critical",
                    "source": {"label": "Laboratory System"}
                }
            )
        ]
    ),
    "annual-wellness-reminder": HookConfiguration(
        id="annual-wellness-reminder",
        hook=HookType.ENCOUNTER_START,
        title="Annual Wellness Visit Reminder",
        description="Reminds about annual wellness visits",
        enabled=True,
        conditions=[
            HookCondition(
                type="patient-age",
                parameters={"operator": ">=", "value": "18"}
            )
        ],
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Annual Wellness Due",
                    "detail": "Consider scheduling annual wellness visit and preventive screenings",
                    "indicator": "info",
                    "source": {"label": "Preventive Care System"}
                }
            )
        ]
    ),
    "discharge-planning": HookConfiguration(
        id="discharge-planning",
        hook=HookType.ENCOUNTER_DISCHARGE,
        title="Discharge Planning",
        description="Discharge planning reminders",
        enabled=True,
        conditions=[],
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Discharge Planning",
                    "detail": "Ensure discharge planning is complete: medications reconciled, follow-up scheduled",
                    "indicator": "warning",
                    "source": {"label": "Discharge Planning System"},
                    "suggestions": [
                        {
                            "label": "Medication Reconciliation",
                            "uuid": str(uuid.uuid4()),
                            "actions": [
                                {
                                    "type": "create",
                                    "description": "Complete medication reconciliation",
                                    "resource": {
                                        "resourceType": "Task",
                                        "status": "requested",
                                        "intent": "order",
                                        "description": "Complete medication reconciliation for discharge"
                                    }
                                }
                            ]
                        }
                    ]
                }
            )
        ]
    ),
    "order-appropriateness": HookConfiguration(
        id="order-appropriateness",
        hook=HookType.ORDER_SIGN,
        title="Order Appropriateness",
        description="Checks order appropriateness",
        enabled=True,
        conditions=[],
        actions=[
            HookAction(
                type="show-card",
                parameters={
                    "summary": "Order Review",
                    "detail": "Please review order appropriateness and clinical indication",
                    "indicator": "info",
                    "source": {"label": "Clinical Decision Support"}
                }
            )
        ]
    )
}

# Add medication prescribe hooks
medication_hooks = medication_prescribe_hooks.get_medication_prescribe_hooks()
for hook in medication_hooks:
    SAMPLE_HOOKS[hook.id] = hook


class CDSHookEngine:
    """CDS Hook execution engine"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def evaluate_hook(self, hook_config: HookConfiguration, request: CDSHookRequest) -> List[Card]:
        """Evaluate a CDS hook against the given request"""
        cards = []
        
        logger.debug(f"Evaluating hook: {hook_config.id} for patient: {request.context.get('patientId')}")
        
        # Check if conditions are met
        if await self._evaluate_conditions(hook_config.conditions, request):
            logger.debug(f"Conditions met for hook: {hook_config.id}")
            # Execute actions
            for action in hook_config.actions:
                card = await self._execute_action(action, request)
                if card:
                    cards.append(card)
        else:
            logger.debug(f"Conditions NOT met for hook: {hook_config.id}")
        
        return cards
    
    async def _evaluate_conditions(self, conditions: List[HookCondition], request: CDSHookRequest) -> bool:
        """Evaluate all conditions (AND logic) - More forgiving approach"""
        if not conditions:
            return True  # No conditions means always trigger
        
        # Be more forgiving - if any condition evaluation fails due to missing data,
        # we should still consider showing the hook (unless explicitly configured otherwise)
        successful_evaluations = 0
        failed_evaluations = 0
        
        for condition in conditions:
            try:
                result = await self._evaluate_condition(condition, request)
                if result:
                    successful_evaluations += 1
                else:
                    failed_evaluations += 1
            except Exception as e:
                logger.warning(f"Condition evaluation failed, being forgiving: {e}")
                # Don't fail the entire hook for data issues
                failed_evaluations += 1
        
        # If we have any successful evaluations, show the hook
        # This makes the system more forgiving for missing data
        if successful_evaluations > 0:
            return True
        
        # If all conditions failed but we have no successful ones, 
        # still show basic hooks (like patient-greeter) that should always appear
        return failed_evaluations == 0
    
    async def _evaluate_condition(self, condition: HookCondition, request: CDSHookRequest) -> bool:
        """Evaluate a single condition - More forgiving approach"""
        try:
            condition_type = condition.type
            parameters = condition.parameters
            patient_id = request.context.get('patientId')
            
            if not patient_id:
                logger.warning("No patient ID in context - being forgiving")
                # Some hooks might not require patient context
                return condition_type in ['system-status', 'user-preference', 'time-based']
            
            logger.debug(f"Checking condition type: {condition_type} with parameters: {parameters}")
            
            # Make condition evaluation more forgiving by handling missing data gracefully
            if condition_type == 'patient-age':
                return await self._check_patient_age(patient_id, parameters)
            elif condition_type == 'patient-gender':
                return await self._check_patient_gender(patient_id, parameters)
            elif condition_type == 'diagnosis-code':
                return await self._check_diagnosis_code(patient_id, parameters)
            elif condition_type == 'medication-active':
                return await self._check_active_medication(patient_id, parameters)
            elif condition_type == 'lab-value':
                return await self._check_lab_value(patient_id, parameters)
            elif condition_type == 'vital-sign':
                return await self._check_vital_sign(patient_id, parameters)
            elif condition_type == 'always':
                return True
            elif condition_type == 'never':
                return False
            
            logger.debug(f"Unknown condition type: {condition_type} - allowing")
            return True  # Be forgiving for unknown condition types
            
        except Exception as e:
            logger.error(f"Error evaluating condition {condition.type}: {e}")
            # Be forgiving - don't fail the entire hook for one bad condition
            return True
    
    async def _check_patient_age(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check patient age condition"""
        try:
            # Get patient data from FHIR storage
            query = text("""
                SELECT resource 
                FROM fhir.resources 
                WHERE resource_type = 'Patient' 
                AND resource->>'id' = :patient_id
                AND deleted = false
                LIMIT 1
            """)
            result = await self.db.execute(query, {'patient_id': patient_id})
            row = result.first()
            
            if not row:
                logger.warning(f"Patient {patient_id} not found")
                return False
            
            patient_dict = row.resource
            birth_date_str = patient_dict.get('birthDate')
            
            if not birth_date_str:
                logger.warning(f"No birthDate for patient {patient_id}")
                return False
            
            # Parse birth date
            from datetime import datetime
            try:
                birth_date = datetime.strptime(birth_date_str, '%Y-%m-%d').date()
            except ValueError:
                logger.error(f"Invalid birthDate format for patient {patient_id}: {birth_date_str}")
                return False
            
            # Calculate age
            age = (datetime.now().date() - birth_date).days / 365.25
            operator = parameters.get('operator', 'eq')
            value = float(parameters.get('value', 0))
            
            logger.debug(f"Patient age check: age={age:.1f}, operator={operator}, value={value}")
            
            if operator == 'eq':
                return abs(age - value) < 1  # Within 1 year
            elif operator == 'gt':
                return age > value
            elif operator == 'ge' or operator == '>=':
                result = age >= value
                logger.debug(f"Age check result: {age:.1f} >= {value} = {result}")
                return result
            elif operator == 'lt':
                return age < value
            elif operator == 'le':
                return age <= value
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking patient age: {e}")
            return False
    
    async def _check_patient_gender(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check patient gender condition"""
        try:
            query = text("""
                SELECT resource 
                FROM fhir.resources 
                WHERE resource_type = 'Patient' 
                AND resource->>'id' = :patient_id
                AND deleted = false
                LIMIT 1
            """)
            result = await self.db.execute(query, {'patient_id': patient_id})
            row = result.first()
            
            if not row:
                return False
            
            patient_dict = row.resource
            target_gender = parameters.get('value', '').lower()
            patient_gender = (patient_dict.get('gender') or '').lower()
            
            return patient_gender == target_gender
            
        except Exception as e:
            logger.error(f"Error checking patient gender: {e}")
            return False
    
    async def _check_diagnosis_code(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check for specific diagnosis codes"""
        try:
            codes = parameters.get('codes', [])
            if isinstance(codes, str):
                codes = codes.split(',')
                codes = [code.strip() for code in codes if code.strip()]
            elif not isinstance(codes, list):
                codes = []
            
            if not codes:
                logger.warning(f"No codes to check for patient {patient_id}")
                return False
            
            logger.debug(f"Checking diagnosis codes {codes} for patient {patient_id}")
            
            # Query to find conditions with any of the specified codes
            query = text("""
                SELECT COUNT(*) as count
                FROM fhir.resources 
                WHERE resource_type = 'Condition' 
                AND deleted = false
                AND resource->'subject'->>'reference' = :patient_ref
                AND (
                    EXISTS (
                        SELECT 1 FROM jsonb_array_elements(resource->'code'->'coding') AS coding
                        WHERE coding->>'code' = ANY(:codes)
                    )
                    OR resource->'code'->>'text' ILIKE ANY(:text_patterns)
                )
            """)
            
            text_patterns = [f'%{code}%' for code in codes] + ['%diabetes%', '%prediabetes%']
            
            result = await self.db.execute(query, {
                'patient_ref': f'Patient/{patient_id}',
                'codes': codes,
                'text_patterns': text_patterns
            })
            
            count = result.scalar()
            logger.debug(f"Found {count} matching conditions for patient {patient_id}")
            
            operator = parameters.get('operator', 'in')
            if operator == 'in':
                return count > 0
            elif operator == 'not-in':
                return count == 0
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking diagnosis codes: {e}")
            return False
    
    async def _check_active_medication(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check for active medications"""
        try:
            codes = parameters.get('codes', [])
            if isinstance(codes, str):
                codes = codes.split(',')
                codes = [code.strip() for code in codes if code.strip()]
            
            if not codes:
                return False
            
            query = text("""
                SELECT COUNT(*) as count
                FROM fhir.resources 
                WHERE resource_type = 'MedicationRequest' 
                AND deleted = false
                AND resource->'subject'->>'reference' = :patient_ref
                AND resource->>'status' = 'active'
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(
                        COALESCE(resource->'medicationCodeableConcept'->'coding', '[]'::jsonb)
                    ) AS coding
                    WHERE coding->>'code' = ANY(:codes)
                )
            """)
            
            result = await self.db.execute(query, {
                'patient_ref': f'Patient/{patient_id}',
                'codes': codes
            })
            
            count = result.scalar()
            return count > 0
            
        except Exception as e:
            logger.error(f"Error checking active medications: {e}")
            return False
    
    async def _check_lab_value(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check lab values against thresholds"""
        try:
            code = parameters.get('code') or parameters.get('labTest')
            operator = parameters.get('operator', 'gt')
            value = float(parameters.get('value', 0))
            timeframe = int(parameters.get('timeframe', 90))  # days
            
            if not code:
                logger.debug(f"No lab code provided in parameters: {parameters}")
                return False
            
            # Handle negative timeframe values (means unlimited lookback)
            if timeframe < 0:
                timeframe = 36500  # 100 years - effectively unlimited
            
            cutoff_date = (datetime.now() - timedelta(days=timeframe)).isoformat()
            
            logger.debug(f"Lab value check: patient={patient_id}, code={code}, operator={operator}, value={value}, timeframe={timeframe} days")
            
            # Try both reference formats: urn:uuid: and Patient/
            query = text("""
                SELECT resource
                FROM fhir.resources 
                WHERE resource_type = 'Observation' 
                AND deleted = false
                AND (
                    resource->'subject'->>'reference' = :patient_ref_fhir
                    OR resource->'subject'->>'reference' = :patient_ref_uuid
                )
                AND (
                    resource->'category'->0->'coding'->0->>'code' = 'laboratory'
                    OR resource->'category' @> '[{"coding": [{"code": "laboratory"}]}]'
                )
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(resource->'code'->'coding') AS coding
                    WHERE coding->>'code' = :code
                )
                AND resource->>'effectiveDateTime' >= :cutoff_date
                ORDER BY resource->>'effectiveDateTime' DESC
                LIMIT 1
            """)
            
            result = await self.db.execute(query, {
                'patient_ref_fhir': f'Patient/{patient_id}',
                'patient_ref_uuid': f'urn:uuid:{patient_id}',
                'code': code,
                'cutoff_date': cutoff_date
            })
            
            row = result.first()
            if not row:
                logger.debug(f"No lab values found for code {code} within {timeframe} days for patient {patient_id}")
                return operator == 'missing'
            
            obs_dict = row.resource
            value_quantity = obs_dict.get('valueQuantity')
            
            if not value_quantity or 'value' not in value_quantity:
                logger.debug(f"No valueQuantity found in observation for patient {patient_id}")
                return False
            
            lab_value = float(value_quantity['value'])
            
            logger.debug(f"Lab value comparison: {lab_value} {operator} {value}")
            
            if operator == 'gt':
                result = lab_value > value
            elif operator == 'ge':
                result = lab_value >= value
            elif operator == 'lt':
                result = lab_value < value
            elif operator == 'le':
                result = lab_value <= value
            elif operator == 'eq':
                result = abs(lab_value - value) < 0.01
            else:
                result = False
            
            logger.debug(f"Lab value check result: {result} (lab_value={lab_value}, operator={operator}, threshold={value})")
            return result
            
        except Exception as e:
            logger.error(f"Error checking lab values for patient {patient_id}: {e}")
            return False
    
    async def _check_vital_sign(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check vital signs against normal ranges"""
        try:
            vital_type = parameters.get('type')
            operator = parameters.get('operator', 'gt')
            value = float(parameters.get('value', 0))
            timeframe = int(parameters.get('timeframe', 7))  # days
            
            if not vital_type:
                return False
            
            cutoff_date = (datetime.now() - timedelta(days=timeframe)).isoformat()
            
            query = text("""
                SELECT resource
                FROM fhir.resources 
                WHERE resource_type = 'Observation' 
                AND deleted = false
                AND resource->'subject'->>'reference' = :patient_ref
                AND resource->>'category' = 'vital-signs'
                AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(resource->'code'->'coding') AS coding
                    WHERE coding->>'code' = :vital_type
                )
                AND resource->>'effectiveDateTime' >= :cutoff_date
                ORDER BY resource->>'effectiveDateTime' DESC
                LIMIT 1
            """)
            
            result = await self.db.execute(query, {
                'patient_ref': f'Patient/{patient_id}',
                'vital_type': vital_type,
                'cutoff_date': cutoff_date
            })
            
            row = result.first()
            if not row:
                return False
            
            obs_dict = row.resource
            
            # Handle blood pressure components
            if vital_type == '85354-9' and 'component' in obs_dict:
                component = parameters.get('component', 'systolic')
                for comp in obs_dict['component']:
                    comp_code = comp.get('code', {}).get('coding', [{}])[0].get('code')
                    if ((component == 'systolic' and comp_code == '8480-6') or 
                        (component == 'diastolic' and comp_code == '8462-4')):
                        vital_value = float(comp.get('valueQuantity', {}).get('value', 0))
                        break
                else:
                    return False
            # Regular vital signs
            elif 'valueQuantity' in obs_dict:
                vital_value = float(obs_dict['valueQuantity'].get('value', 0))
            else:
                return False
            
            if operator == 'gt':
                return vital_value > value
            elif operator == 'ge':
                return vital_value >= value
            elif operator == 'lt':
                return vital_value < value
            elif operator == 'le':
                return vital_value <= value
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking vital signs: {e}")
            return False
    
    async def _execute_action(self, action: HookAction, request: CDSHookRequest) -> Optional[Card]:
        """Execute an action and return a CDS card"""
        try:
            action_type = action.type
            parameters = action.parameters
            
            if action_type == 'show-card':
                # Create card from parameters
                card = Card(
                    summary=parameters.get('summary', 'Clinical Alert'),
                    detail=parameters.get('detail', ''),
                    indicator=IndicatorType(parameters.get('indicator', 'info')),
                    source=Source(**parameters.get('source', {"label": "Clinical Decision Support"})),
                    uuid=str(uuid.uuid4())
                )
                
                # Add optional fields
                if 'suggestions' in parameters:
                    card.suggestions = [
                        Suggestion(
                            label=s.get('label', 'Suggestion'),
                            uuid=s.get('uuid', str(uuid.uuid4())),
                            actions=[
                                Action(
                                    type=ActionType(a.get('type', 'create')),
                                    description=a.get('description', ''),
                                    resource=a.get('resource', {})
                                )
                                for a in s.get('actions', [])
                            ]
                        )
                        for s in parameters['suggestions']
                    ]
                
                if 'links' in parameters:
                    card.links = [
                        Link(
                            label=l.get('label', 'Link'),
                            url=l.get('url', ''),
                            type=l.get('type', 'absolute'),
                            appContext=l.get('appContext', '')
                        )
                        for l in parameters['links']
                    ]
                
                return card
            
            # Handle medication prescribe specific actions
            elif action_type in ['check-interactions', 'check-allergies', 'dosing-guidance', 'renal-dosing']:
                # Delegate to medication prescribe hooks
                cards = []
                if action_type == 'check-interactions':
                    cards = await medication_prescribe_hooks.execute_drug_interaction_check(request)
                elif action_type == 'check-allergies':
                    cards = await medication_prescribe_hooks.execute_allergy_check(request)
                elif action_type == 'dosing-guidance':
                    cards = await medication_prescribe_hooks.execute_age_based_dosing(request)
                
                # Return the first card if any
                return cards[0] if cards else None
            
            return None
            
        except Exception as e:
            logger.error(f"Error executing action: {e}")
            return None


# CDS Hooks Discovery Endpoint
@router.get("/cds-services", response_model=CDSServicesResponse)
async def discover_services(db: AsyncSession = Depends(get_db_session)):
    """CDS Hooks discovery endpoint - returns available services"""
    services = []
    
    try:
        # Load hooks from database first
        db_hooks = await load_hooks_from_database(db)
        
        # If no hooks in database, initialize with sample hooks
        if not db_hooks:
            logger.info("No hooks found in database, initializing with sample hooks")
            await save_sample_hooks_to_database(db, SAMPLE_HOOKS)
            db_hooks = await load_hooks_from_database(db)
        
        # Use database hooks if available, otherwise fall back to sample hooks
        hooks_to_use = db_hooks if db_hooks else SAMPLE_HOOKS
        
        for hook_id, hook_config in hooks_to_use.items():
            if hook_config.enabled:
                service = CDSService(
                    hook=hook_config.hook,
                    title=hook_config.title,
                    description=hook_config.description,
                    id=hook_id,
                    prefetch=hook_config.prefetch,
                    usageRequirements=hook_config.usageRequirements
                )
                services.append(service)
        
        logger.debug(f"Discovered {len(services)} enabled CDS services")
        
    except Exception as e:
        logger.error(f"Error in service discovery: {e}")
        # Fallback to sample hooks
        for hook_id, hook_config in SAMPLE_HOOKS.items():
            if hook_config.enabled:
                service = CDSService(
                    hook=hook_config.hook,
                    title=hook_config.title,
                    description=hook_config.description,
                    id=hook_id,
                    prefetch=hook_config.prefetch,
                    usageRequirements=hook_config.usageRequirements
                )
                services.append(service)
    
    return CDSServicesResponse(services=services)


# CDS Service Execution Endpoint
@router.post("/cds-services/{service_id}", response_model=CDSHookResponse)
async def execute_service(
    service_id: str,
    request: CDSHookRequest,
    db: AsyncSession = Depends(get_db_session),
    use_rules_engine: bool = False  # Query parameter to optionally use rules engine
):
    """Execute a specific CDS service"""
    # Check if we should use the rules engine for certain services
    rules_engine_services = {
        "medication-prescribe-v2", "patient-view-v2", "order-select-v2",
        "encounter-start-v2", "encounter-discharge-v2"
    }
    
    # Use rules engine for v2 services or if explicitly requested
    if service_id in rules_engine_services or use_rules_engine:
        try:
            # Convert context to dict format expected by rules engine
            context_dict = request.context if isinstance(request.context, dict) else request.context.dict()
            
            # Execute with rules engine
            response = await cds_integration.execute_hook(
                hook=request.hook.value,
                context=context_dict,
                prefetch=request.prefetch,
                use_legacy=True  # Include legacy results for better coverage
            )
            
            # Convert response to CDSHookResponse format
            cards = []
            for card_data in response.get("cards", []):
                card = Card(
                    summary=card_data.get("summary", ""),
                    detail=card_data.get("detail", ""),
                    indicator=IndicatorType(card_data.get("indicator", "info")),
                    source=Source(**card_data.get("source", {"label": "CDS Rules Engine"})),
                    uuid=card_data.get("uuid", str(uuid.uuid4()))
                )
                
                if "suggestions" in card_data:
                    card.suggestions = card_data["suggestions"]
                if "links" in card_data:
                    card.links = card_data["links"]
                
                cards.append(card)
            
            return CDSHookResponse(cards=cards)
            
        except Exception as e:
            logger.error(f"Error executing CDS service {service_id} with rules engine: {e}")
            # Fall through to legacy execution
    
    # Legacy execution path
    # Get the hook configuration from database first, then fallback to sample hooks
    try:
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config:
            hook_config = SAMPLE_HOOKS.get(service_id)
    except Exception as e:
        logger.warning(f"Error accessing database for hook {service_id}: {e}")
        hook_config = SAMPLE_HOOKS.get(service_id)
    
    if not hook_config:
        raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
    
    # Check if hook is enabled
    if not hook_config.enabled:
        return CDSHookResponse(cards=[])
    
    # Validate hook type matches
    if hook_config.hook != request.hook:
        raise HTTPException(
            status_code=400, 
            detail=f"Hook type mismatch: service expects {hook_config.hook}, got {request.hook}"
        )
    
    # Execute prefetch if configured and not provided
    if hook_config.prefetch and not request.prefetch:
        try:
            prefetch_start = datetime.now()
            request.prefetch = await execute_hook_prefetch(
                db, 
                hook_config.prefetch, 
                request.context if isinstance(request.context, dict) else request.context.dict()
            )
            prefetch_time = int((datetime.now() - prefetch_start).total_seconds() * 1000)
            logger.debug(f"Executed prefetch for {service_id} in {prefetch_time}ms")
        except Exception as e:
            logger.warning(f"Prefetch execution failed for {service_id}: {e}")
            # Continue without prefetch data
            request.prefetch = {}
    
    # Create execution engine
    engine = CDSHookEngine(db)
    
    # Execute hook with performance tracking
    start_time = datetime.now()
    execution_success = True
    error_message = None
    cards = []
    
    try:
        cards = await engine.evaluate_hook(hook_config, request)
        response = CDSHookResponse(cards=cards)
    except Exception as e:
        logger.error(f"Error executing CDS Service {service_id}: {str(e)}")
        execution_success = False
        error_message = str(e)
        # CDS Hooks should be non-blocking - return empty cards on error
        response = CDSHookResponse(cards=[])
    
    # Calculate execution time
    execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
    
    # Log the execution (fire and forget - don't block response)
    try:
        patient_id = request.context.get('patientId') if isinstance(request.context, dict) else None
        user_id = request.context.get('userId') if isinstance(request.context, dict) else None
        
        await log_hook_execution(
            db=db,
            service_id=service_id,
            hook_type=request.hook.value,
            patient_id=patient_id,
            user_id=user_id,
            context=request.context if isinstance(request.context, dict) else request.context.dict(),
            request_data=request.dict(),
            response_data=response.dict(),
            cards_returned=len(cards),
            execution_time_ms=execution_time_ms,
            success=execution_success,
            error_message=error_message
        )
    except Exception as log_error:
        logger.warning(f"Failed to log hook execution: {log_error}")
        # Don't fail the response due to logging issues
    
    return response


# CDS Service Feedback Endpoint
@router.post("/cds-services/{service_id}/feedback")
async def provide_feedback(
    service_id: str,
    feedback: FeedbackRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Provide feedback on CDS service recommendations - CDS Hooks v2.0 compliant"""
    try:
        # Verify the service exists
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config and service_id not in SAMPLE_HOOKS:
            raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
        
        # Process and store the feedback
        # The feedback request contains an array of feedback items
        if not feedback.feedback or len(feedback.feedback) == 0:
            raise HTTPException(status_code=400, detail="No feedback items provided")
        
        # Process each feedback item
        feedback_ids = []
        for feedback_item in feedback.feedback:
            feedback_data = {
                'hookInstance': getattr(feedback_item, 'hookInstance', None),
                'service': service_id,
                'card': feedback_item.card,
                'outcome': feedback_item.outcome,
                'overrideReason': getattr(feedback_item, 'overrideReason', None) or getattr(feedback_item, 'overrideReasons', None),
                'acceptedSuggestions': getattr(feedback_item, 'acceptedSuggestions', None),
                # Extract additional context if available from the request
                'userId': getattr(feedback, 'userId', None),
                'patientId': getattr(feedback, 'patientId', None),
                'encounterId': getattr(feedback, 'encounterId', None),
                'context': getattr(feedback, 'context', None),
                'outcomeTimestamp': getattr(feedback_item, 'outcomeTimestamp', None)
            }
            
            feedback_id = await process_cds_feedback(db, feedback_data)
            feedback_ids.append(feedback_id)
            
            logger.info(f"Stored feedback {feedback_id} for service {service_id}: outcome={feedback_item.outcome}")
        
        # Return success response per CDS Hooks specification
        return {
            "status": "success",
            "feedbackIds": feedback_ids,
            "message": f"Feedback received and stored successfully ({len(feedback_ids)} items)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing feedback for service {service_id}: {e}")
        # CDS Hooks specification allows for graceful error handling
        raise HTTPException(
            status_code=500, 
            detail="Failed to process feedback. The feedback has been logged for manual review."
        )


# CDS Analytics Endpoint
@router.get("/cds-services/{service_id}/analytics")
async def get_feedback_analytics(
    service_id: str,
    days: int = 30,
    db: AsyncSession = Depends(get_db_session)
):
    """Get analytics for a specific CDS service"""
    try:
        # Verify the service exists
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config and service_id not in SAMPLE_HOOKS:
            raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
        
        # Get analytics
        analytics = await get_service_analytics(db, service_id, days)
        
        return {
            "status": "success",
            "service_id": service_id,
            "analytics": analytics,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting analytics for service {service_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve analytics"
        )


# Global Analytics Endpoint
@router.get("/cds-services/analytics/summary")
async def get_global_analytics(
    days: int = 30,
    db: AsyncSession = Depends(get_db_session)
):
    """Get analytics summary for all CDS services"""
    try:
        feedback_manager = await get_feedback_manager(db)
        summary = await feedback_manager.get_analytics_summary(period_days=days)
        
        return {
            "status": "success",
            "period_days": days,
            "summary": summary,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting global analytics: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve analytics summary"
        )


# Prefetch Analysis Endpoint
@router.get("/cds-services/{service_id}/prefetch-analysis")
async def analyze_prefetch_patterns(
    service_id: str,
    days: int = 30,
    db: AsyncSession = Depends(get_db_session)
):
    """Analyze prefetch patterns for optimization"""
    try:
        # Verify the service exists
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(service_id)
        if not hook_config and service_id not in SAMPLE_HOOKS:
            raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
        
        # Get prefetch analysis
        engine = await get_prefetch_engine(db)
        analysis = await engine.analyze_prefetch_patterns(service_id, days)
        
        # Add current prefetch configuration
        if hook_config and hook_config.prefetch:
            analysis['current_prefetch_config'] = hook_config.prefetch
        
        # Add recommended prefetch based on hook type
        if hook_config:
            analysis['recommended_prefetch'] = engine.get_recommended_prefetch(
                hook_config.hook.value
            )
        
        return {
            "status": "success",
            "service_id": service_id,
            "analysis": analysis,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing prefetch patterns for service {service_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze prefetch patterns"
        )


# Hook Management Endpoints (for CRUD operations)
@router.get("/hooks", response_model=List[HookConfiguration])
async def list_hooks(
    hook_type: Optional[str] = None,
    enabled_only: bool = True,
    db: AsyncSession = Depends(get_db_session)
):
    """List all CDS hooks"""
    try:
        manager = await get_persistence_manager(db)
        return await manager.list_hooks(hook_type=hook_type, enabled_only=enabled_only)
    except Exception as e:
        logger.error(f"Error listing hooks from database: {e}")
        # Fallback to sample hooks
        hooks = list(SAMPLE_HOOKS.values())
        if hook_type:
            hooks = [h for h in hooks if h.hook.value == hook_type]
        if enabled_only:
            hooks = [h for h in hooks if h.enabled]
        return hooks


@router.post("/hooks", response_model=HookConfiguration)
async def create_hook(
    hook_config: HookConfiguration, 
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new CDS hook"""
    try:
        manager = await get_persistence_manager(db)
        
        # Check if hook already exists
        existing = await manager.get_hook(hook_config.id)
        if existing:
            raise HTTPException(status_code=409, detail="Hook ID already exists")
        
        # Save to database
        return await manager.save_hook(hook_config, "api-user")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating hook: {e}")
        raise HTTPException(status_code=500, detail="Failed to create hook")


# Hook Management Endpoints (specific routes before parameterized routes)
@router.get("/hooks/backup")
async def backup_hooks(db: AsyncSession = Depends(get_db_session)):
    """Create a backup of all hook configurations"""
    try:
        manager = await get_persistence_manager(db)
        backup = await manager.backup_hooks()
        
        # Include sample hooks in backup
        backup['sample_hooks'] = {k: v.dict() for k, v in SAMPLE_HOOKS.items()}
        
        return backup
        
    except Exception as e:
        logger.error(f"Error creating hooks backup: {e}")
        raise HTTPException(status_code=500, detail="Failed to create backup")

@router.post("/hooks/restore")
async def restore_hooks(backup_data: Dict[str, Any], db: AsyncSession = Depends(get_db_session)):
    """Restore hooks from backup data"""
    try:
        manager = await get_persistence_manager(db)
        restored_count = await manager.restore_hooks(backup_data)
        
        return {
            "message": f"Successfully restored {restored_count} hooks",
            "restored_count": restored_count
        }
        
    except Exception as e:
        logger.error(f"Error restoring hooks: {e}")
        raise HTTPException(status_code=500, detail="Failed to restore hooks")

@router.post("/hooks/sync-samples")
async def sync_sample_hooks(db: AsyncSession = Depends(get_db_session)):
    """Sync sample hooks to database"""
    try:
        await save_sample_hooks_to_database(db, SAMPLE_HOOKS)
        db_hooks = await load_hooks_from_database(db)
        
        return {
            "message": f"Successfully synced {len(SAMPLE_HOOKS)} sample hooks",
            "hooks_count": len(db_hooks),
            "hooks": list(db_hooks.keys())
        }
    except Exception as e:
        logger.error(f"Error syncing sample hooks: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync sample hooks")

@router.get("/hooks/{hook_id}", response_model=HookConfiguration)
async def get_hook(hook_id: str, db: AsyncSession = Depends(get_db_session)):
    """Get a specific CDS hook"""
    try:
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(hook_id)
        if not hook_config:
            # Fallback to sample hooks
            hook_config = SAMPLE_HOOKS.get(hook_id)
        if not hook_config:
            raise HTTPException(status_code=404, detail="Hook not found")
        return hook_config
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving hook {hook_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve hook")


@router.put("/hooks/{hook_id}", response_model=HookConfiguration)
async def update_hook(
    hook_id: str, 
    hook_config: HookConfiguration, 
    db: AsyncSession = Depends(get_db_session)
):
    """Update a CDS hook"""
    try:
        manager = await get_persistence_manager(db)
        
        # Check if hook exists
        existing = await manager.get_hook(hook_id)
        if not existing and hook_id not in SAMPLE_HOOKS:
            raise HTTPException(status_code=404, detail="Hook not found")
        
        # Ensure the ID matches
        hook_config.id = hook_id
        
        # Save to database
        return await manager.save_hook(hook_config, "api-user")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating hook {hook_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update hook")


@router.delete("/hooks/{hook_id}")
async def delete_hook(hook_id: str, db: AsyncSession = Depends(get_db_session)):
    """Delete a CDS hook"""
    try:
        manager = await get_persistence_manager(db)
        
        # Try to delete from database first
        deleted = await manager.delete_hook(hook_id)
        
        if not deleted:
            # Check if it exists in sample hooks
            if hook_id not in SAMPLE_HOOKS:
                raise HTTPException(status_code=404, detail="Hook not found")
            # For sample hooks, we can't delete them, just disable
            raise HTTPException(status_code=400, detail="Cannot delete sample hooks, only disable them")
        
        return {"message": f"Hook {hook_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting hook {hook_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete hook")


# Additional hook management endpoints
@router.patch("/hooks/{hook_id}/toggle")
async def toggle_hook(hook_id: str, enabled: bool, db: AsyncSession = Depends(get_db_session)):
    """Enable or disable a CDS hook"""
    try:
        manager = await get_persistence_manager(db)
        success = await manager.toggle_hook(hook_id, enabled)
        
        if not success:
            # Try sample hooks
            if hook_id in SAMPLE_HOOKS:
                SAMPLE_HOOKS[hook_id].enabled = enabled
                return {"message": f"Hook {hook_id} {'enabled' if enabled else 'disabled'} successfully"}
            raise HTTPException(status_code=404, detail="Hook not found")
        
        return {"message": f"Hook {hook_id} {'enabled' if enabled else 'disabled'} successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling hook {hook_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle hook")

@router.post("/hooks/test/{hook_id}")
async def test_hook(
    hook_id: str,
    test_context: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session)
):
    """Test a specific hook with provided context"""
    try:
        # Get hook configuration
        manager = await get_persistence_manager(db)
        hook_config = await manager.get_hook(hook_id)
        if not hook_config:
            hook_config = SAMPLE_HOOKS.get(hook_id)
        
        if not hook_config:
            raise HTTPException(status_code=404, detail="Hook not found")
        
        # Create test request
        test_request = CDSHookRequest(
            hook=hook_config.hook,
            hookInstance=f"test-{hook_id}-{datetime.now().timestamp()}",
            context=test_context
        )
        
        # Execute hook
        engine = CDSHookEngine(db)
        cards = await engine.evaluate_hook(hook_config, test_request)
        
        return {
            "hook_id": hook_id,
            "test_context": test_context,
            "cards": [card.dict() for card in cards],
            "cards_count": len(cards),
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing hook {hook_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to test hook")

# Rules Engine Management Endpoints
@router.get("/rules-engine/statistics")
async def get_rules_statistics():
    """Get statistics about the rules engine"""
    try:
        stats = await cds_integration.get_rule_statistics()
        return {
            "status": "success",
            "statistics": stats,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting rules statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get rules statistics")


@router.post("/rules-engine/evaluate")
async def evaluate_rules(
    context: Dict[str, Any],
    categories: Optional[List[str]] = None,
    priorities: Optional[List[str]] = None
):
    """Directly evaluate rules against provided context"""
    try:
        # Execute rules engine
        response = await cds_integration.rules_engine.evaluate(
            context=context,
            categories=categories,
            priorities=priorities
        )
        
        return {
            "status": "success",
            "response": response,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error evaluating rules: {e}")
        raise HTTPException(status_code=500, detail="Failed to evaluate rules")


@router.patch("/rules-engine/rules/{rule_set_name}/{rule_id}/toggle")
async def toggle_rule(rule_set_name: str, rule_id: str, enabled: bool):
    """Enable or disable a specific rule"""
    try:
        cds_integration.toggle_rule(rule_set_name, rule_id, enabled)
        return {
            "status": "success",
            "message": f"Rule {rule_id} {'enabled' if enabled else 'disabled'}",
            "rule_set": rule_set_name,
            "rule_id": rule_id,
            "enabled": enabled
        }
    except Exception as e:
        logger.error(f"Error toggling rule: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle rule")


# Safety and Feature Flag Endpoints
@router.get("/rules-engine/safety/metrics")
async def get_safety_metrics():
    """Get safety metrics and circuit breaker status"""
    try:
        metrics = safety_manager.get_metrics()
        return {
            "status": "success",
            "metrics": metrics,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting safety metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get safety metrics")


@router.patch("/rules-engine/safety/feature-flags/{flag}")
async def set_feature_flag(flag: str, enabled: bool):
    """Enable or disable a feature flag"""
    try:
        feature_flag = FeatureFlag(flag)
        safety_manager.set_feature_flag(feature_flag, enabled)
        return {
            "status": "success",
            "message": f"Feature flag {flag} set to {enabled}",
            "flag": flag,
            "enabled": enabled
        }
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid feature flag: {flag}")
    except Exception as e:
        logger.error(f"Error setting feature flag: {e}")
        raise HTTPException(status_code=500, detail="Failed to set feature flag")


@router.get("/rules-engine/safety/health")
async def rules_engine_health():
    """Get rules engine health status including circuit breakers"""
    try:
        health = safety_manager.health_check()
        return health
    except Exception as e:
        logger.error(f"Error checking rules engine health: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@router.post("/rules-engine/safety/circuit-breaker/{service}/reset")
async def reset_circuit_breaker(service: str):
    """Reset a circuit breaker for a specific service"""
    try:
        if service in safety_manager.circuit_breakers:
            breaker = safety_manager.circuit_breakers[service]
            breaker.state = "closed"
            breaker.failure_count = 0
            breaker.success_count = 0
            breaker.opened_at = None
            
            return {
                "status": "success",
                "message": f"Circuit breaker for {service} reset",
                "service": service,
                "new_state": "closed"
            }
        else:
            raise HTTPException(status_code=404, detail=f"Circuit breaker for {service} not found")
    except Exception as e:
        logger.error(f"Error resetting circuit breaker: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset circuit breaker")


@router.get("/rules-engine/safety/ab-test/results")
async def get_ab_test_results():
    """Get A/B test results comparing rules engine to legacy"""
    try:
        if not safety_manager.is_enabled(FeatureFlag.A_B_TESTING_ENABLED):
            return {
                "status": "disabled",
                "message": "A/B testing is not enabled",
                "timestamp": datetime.now().isoformat()
            }
        
        results = dict(safety_manager.ab_test_results)
        
        # Calculate success rates
        for group in results:
            if results[group]["total"] > 0:
                results[group]["success_rate"] = (
                    results[group]["success"] / results[group]["total"] * 100
                )
            else:
                results[group]["success_rate"] = 0
        
        return {
            "status": "success",
            "results": results,
            "allocation": safety_manager.ab_test_allocation,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting A/B test results: {e}")
        raise HTTPException(status_code=500, detail="Failed to get A/B test results")


# Health check endpoint
@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db_session)):
    """Health check endpoint"""
    try:
        # Test database connectivity
        db_hooks = await load_hooks_from_database(db)
        db_status = "connected"
        db_hooks_count = len(db_hooks)
    except Exception as e:
        db_status = f"error: {str(e)}"
        db_hooks_count = 0
    
    # Get rules engine statistics
    try:
        rules_stats = await cds_integration.get_rule_statistics()
        rules_engine_status = "healthy"
    except Exception as e:
        rules_stats = {}
        rules_engine_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "service": "CDS Hooks",
        "version": "2.0",
        "sample_hooks_count": len(SAMPLE_HOOKS),
        "database_status": db_status,
        "database_hooks_count": db_hooks_count,
        "total_hooks": db_hooks_count + len(SAMPLE_HOOKS),
        "rules_engine_status": rules_engine_status,
        "rules_engine_statistics": rules_stats,
        "timestamp": datetime.now().isoformat()
    }