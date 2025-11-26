"""
CDS Hook Execution Engine

Evaluates hook configurations against CDS requests,
handling condition evaluation and action execution.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import uuid
import logging
import httpx

from sqlalchemy.ext.asyncio import AsyncSession

from shared.exceptions import (
    FHIRConnectionError,
    FHIRResourceNotFoundError,
    CDSExecutionError,
    CDSRuleEvaluationError,
)
from ..models import (
    CDSHookRequest,
    Card,
    Source,
    Suggestion,
    Action,
    Link,
    HookConfiguration,
    HookCondition,
    HookAction,
    IndicatorType,
    ActionType,
)
from ..hooks import medication_prescribe_hooks
from services.fhir_client_config import get_resource, search_resources

logger = logging.getLogger(__name__)


class OverrideReason:
    """Override reason for CDS cards"""
    def __init__(self, code: str = "", display: str = "", system: str = ""):
        self.code = code
        self.display = display
        self.system = system


class CDSHookEngine:
    """CDS Hook execution engine"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def evaluate_hook(self, hook_config: HookConfiguration, request: CDSHookRequest) -> List[Card]:
        """Evaluate a CDS hook against the given request"""
        cards = []

        logger.info(f"Evaluating hook: {hook_config.id} for patient: {request.context.get('patientId')}")
        logger.info(f"Hook has {len(hook_config.conditions)} conditions to evaluate")
        logger.info(f"Hook conditions: {[{'type': c.type, 'params': c.parameters} for c in hook_config.conditions]}")

        # Check if conditions are met
        if await self._evaluate_conditions(hook_config.conditions, request):
            logger.info(f"Conditions met for hook: {hook_config.id}")
            # Execute actions
            for action in hook_config.actions:
                card = await self._execute_action(action, request)
                if card:
                    cards.append(card)
        else:
            logger.info(f"Conditions NOT met for hook: {hook_config.id}")

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
            except (FHIRConnectionError, FHIRResourceNotFoundError) as e:
                logger.warning(f"FHIR data unavailable for condition evaluation: {e.message}")
                # Don't fail the entire hook for FHIR data issues
                failed_evaluations += 1
            except CDSRuleEvaluationError as e:
                logger.warning(f"Condition evaluation failed: {e.message}")
                failed_evaluations += 1
            except (ValueError, TypeError, KeyError) as e:
                logger.warning(f"Data parsing error in condition evaluation: {e}")
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

            logger.info(f"Evaluating condition type: {condition_type} with parameters: {parameters} for patient: {patient_id}")

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

        except (FHIRConnectionError, FHIRResourceNotFoundError) as e:
            logger.error(f"FHIR error evaluating condition {condition.type}: {e.message}")
            # Be forgiving - don't fail the entire hook for FHIR data issues
            return True
        except (ValueError, TypeError, KeyError) as e:
            logger.error(f"Data parsing error in condition {condition.type}: {e}")
            return True

    async def _check_patient_age(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check patient age condition using HAPI FHIR"""
        try:
            # Get patient data from HAPI FHIR
            patient = get_resource('Patient', patient_id)

            if not patient:
                logger.warning(f"Patient {patient_id} not found in HAPI FHIR")
                return False

            birth_date_str = patient.birthDate.isostring if hasattr(patient, 'birthDate') else None

            if not birth_date_str:
                logger.warning(f"No birthDate for patient {patient_id}")
                return False

            # Parse birth date
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
            elif operator == 'ge':
                result = age >= value
                logger.debug(f"Age check result: {age:.1f} >= {value} = {result}")
                return result
            elif operator == 'lt':
                return age < value
            elif operator == 'le':
                return age <= value

            return False

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise FHIRResourceNotFoundError(
                    message=f"Patient {patient_id} not found",
                    resource_type="Patient",
                    resource_id=patient_id,
                    cause=e
                )
            raise FHIRConnectionError(
                message=f"FHIR server error checking patient age: {e.response.status_code}",
                cause=e
            )
        except (httpx.RequestError, httpx.TimeoutException) as e:
            raise FHIRConnectionError(
                message=f"Cannot connect to FHIR server for patient age check",
                cause=e
            )
        except (ValueError, TypeError, KeyError) as e:
            logger.error(f"Data parsing error checking patient age: {e}")
            return False

    async def _check_patient_gender(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check patient gender condition using HAPI FHIR"""
        try:
            # Get patient data from HAPI FHIR
            patient = get_resource('Patient', patient_id)

            if not patient:
                return False

            target_gender = parameters.get('value', '').lower()
            patient_gender = (patient.gender or '').lower() if hasattr(patient, 'gender') else ''

            return patient_gender == target_gender

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise FHIRResourceNotFoundError(
                    message=f"Patient {patient_id} not found",
                    resource_type="Patient",
                    resource_id=patient_id,
                    cause=e
                )
            raise FHIRConnectionError(
                message=f"FHIR server error checking patient gender",
                cause=e
            )
        except (httpx.RequestError, httpx.TimeoutException) as e:
            raise FHIRConnectionError(
                message=f"Cannot connect to FHIR server for patient gender check",
                cause=e
            )
        except (AttributeError, TypeError) as e:
            logger.error(f"Data parsing error checking patient gender: {e}")
            return False

    async def _check_diagnosis_code(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check for specific diagnosis codes using HAPI FHIR"""
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

            # Search conditions from HAPI FHIR for this patient
            conditions = search_resources('Condition', {
                'patient': f'Patient/{patient_id}'
            })

            if not conditions:
                logger.debug(f"No conditions found for patient {patient_id}")
                return False

            # Check if any condition has matching codes
            found_count = 0
            for condition in conditions:
                if hasattr(condition, 'code') and condition.code:
                    if hasattr(condition.code, 'coding'):
                        for coding in condition.code.coding:
                            if hasattr(coding, 'code') and coding.code in codes:
                                found_count += 1
                                break

            logger.debug(f"Found {found_count} matching conditions for patient {patient_id}")

            operator = parameters.get('operator', 'in')
            if operator in ('in', 'equals'):  # Support both 'in' and 'equals' operators
                return found_count > 0
            elif operator == 'not-in':
                return found_count == 0

            return False

        except httpx.HTTPStatusError as e:
            raise FHIRConnectionError(
                message=f"FHIR server error checking diagnosis codes for patient {patient_id}",
                cause=e
            )
        except (httpx.RequestError, httpx.TimeoutException) as e:
            raise FHIRConnectionError(
                message=f"Cannot connect to FHIR server for diagnosis code check",
                cause=e
            )
        except (AttributeError, TypeError, KeyError) as e:
            logger.error(f"Data parsing error checking diagnosis codes: {e}")
            return False

    async def _check_active_medication(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check for active medications using HAPI FHIR

        Supports multiple parameter formats:
        - Legacy: codes (array of medication codes)
        - Catalog: medication/medications/drugClass (single or array)

        Supports operators: 'in', 'equals', 'not-in', 'contains', 'any'
        """
        try:
            # Extract codes from multiple parameter formats for backward compatibility
            codes = parameters.get('codes') or \
                    parameters.get('medication') or \
                    parameters.get('medications') or \
                    parameters.get('drugClass')

            # Normalize to list
            if isinstance(codes, str):
                codes = codes.split(',')
                codes = [code.strip() for code in codes if code.strip()]
            elif codes is None:
                codes = []
            elif not isinstance(codes, list):
                codes = [codes]

            # Get operator (default to 'in' for backward compatibility)
            operator = parameters.get('operator', 'in')

            # Handle special 'any' case - just check if patient has any active medications
            if codes == ['any'] or operator == 'any':
                medications = search_resources('MedicationRequest', {
                    'patient': f'Patient/{patient_id}',
                    'status': 'active'
                })
                return len(medications) > 0 if medications else False

            # Require codes for other operators
            if not codes:
                logger.warning(f"No medication codes provided for patient {patient_id}")
                return False

            # Search medication requests from HAPI FHIR
            medications = search_resources('MedicationRequest', {
                'patient': f'Patient/{patient_id}',
                'status': 'active'
            })

            if not medications:
                # No medications found
                return operator == 'not-in'  # True only for 'not-in' operator

            # Count matching medications
            found_count = 0
            matched_codes = set()

            for med in medications:
                if hasattr(med, 'medicationCodeableConcept') and med.medicationCodeableConcept:
                    if hasattr(med.medicationCodeableConcept, 'coding'):
                        for coding in med.medicationCodeableConcept.coding:
                            if hasattr(coding, 'code'):
                                # Check for matches based on operator
                                if operator == 'contains':
                                    # Partial match (code contains any of the search codes)
                                    if any(search_code.lower() in coding.code.lower() for search_code in codes):
                                        found_count += 1
                                        matched_codes.add(coding.code)
                                        break
                                else:
                                    # Exact match
                                    if coding.code in codes:
                                        found_count += 1
                                        matched_codes.add(coding.code)
                                        break

            logger.debug(f"Found {found_count} matching medications for patient {patient_id}: {matched_codes}")

            # Apply operator logic
            if operator in ('in', 'equals'):
                # At least one medication matches
                return found_count > 0
            elif operator == 'not-in':
                # No medications match
                return found_count == 0
            elif operator == 'contains':
                # Already handled in the loop above
                return found_count > 0
            else:
                logger.warning(f"Unknown operator '{operator}' for medication check, defaulting to 'in'")
                return found_count > 0

        except httpx.HTTPStatusError as e:
            raise FHIRConnectionError(
                message=f"FHIR server error checking active medications for patient {patient_id}",
                cause=e
            )
        except (httpx.RequestError, httpx.TimeoutException) as e:
            raise FHIRConnectionError(
                message=f"Cannot connect to FHIR server for medication check",
                cause=e
            )
        except (AttributeError, TypeError, KeyError) as e:
            logger.error(f"Data parsing error checking active medications: {e}")
            return False

    async def _check_lab_value(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check lab values against thresholds using HAPI FHIR

        Standard parameters:
        - code: Lab test code (LOINC code recommended) - PRIMARY
        - labTest: Legacy parameter name, maps to code - BACKWARD COMPATIBILITY
        - operator: Comparison operator (gt, gte, lt, lte, eq, between, etc.)
        - value: Threshold value to compare against
        - timeframe: Lookback period in days (default: 90, -1 for unlimited)
        """
        try:
            # Accept both 'code' (standard) and 'labTest' (legacy) for backward compatibility
            code = parameters.get('code') or parameters.get('labTest')
            operator = parameters.get('operator', 'gt')
            value = float(parameters.get('value', 0))
            timeframe = int(parameters.get('timeframe', 90))  # days

            logger.info(f"Lab value check - Initial parameters: {parameters}")
            logger.info(f"Lab value check - Extracted values: code={code}, operator={operator}, value={value}, patient_id={patient_id}")

            if not code:
                logger.debug(f"No lab code provided in parameters: {parameters}")
                return False

            # Handle negative timeframe values (means unlimited lookback)
            if timeframe < 0:
                timeframe = 36500  # 100 years - effectively unlimited

            cutoff_date = (datetime.now() - timedelta(days=timeframe)).isoformat()

            logger.info(f"Lab value check: patient={patient_id}, code={code}, operator={operator}, value={value}, timeframe={timeframe} days, cutoff_date={cutoff_date}")

            # Search observations from HAPI FHIR
            observations = search_resources('Observation', {
                'patient': f'Patient/{patient_id}',
                'category': 'laboratory',
                'code': code,
                'date': f'ge{cutoff_date}'
            })

            if not observations:
                logger.info(f"No lab values found for code {code} within {timeframe} days for patient {patient_id}")
                return operator == 'missing'

            # Get the most recent observation (HAPI should return sorted by date DESC)
            obs = observations[0] if observations else None

            if not obs:
                return operator == 'missing'

            # Get value from observation
            lab_value = None
            if hasattr(obs, 'valueQuantity') and obs.valueQuantity:
                if hasattr(obs.valueQuantity, 'value'):
                    lab_value = float(obs.valueQuantity.value)

            if lab_value is None:
                logger.debug(f"No valueQuantity found in observation for patient {patient_id}")
                return False

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

        except httpx.HTTPStatusError as e:
            raise FHIRConnectionError(
                message=f"FHIR server error checking lab values for patient {patient_id}",
                cause=e
            )
        except (httpx.RequestError, httpx.TimeoutException) as e:
            raise FHIRConnectionError(
                message=f"Cannot connect to FHIR server for lab value check",
                cause=e
            )
        except (AttributeError, TypeError, KeyError, ValueError) as e:
            logger.error(f"Data parsing error checking lab values for patient {patient_id}: {e}")
            return False

    async def _check_vital_sign(self, patient_id: str, parameters: Dict[str, Any]) -> bool:
        """Check vital signs against normal ranges using HAPI FHIR"""
        try:
            vital_type = parameters.get('type')
            operator = parameters.get('operator', 'gt')
            value = float(parameters.get('value', 0))
            timeframe = int(parameters.get('timeframe', 7))  # days

            if not vital_type:
                return False

            cutoff_date = (datetime.now() - timedelta(days=timeframe)).isoformat()

            # Search vital signs from HAPI FHIR
            observations = search_resources('Observation', {
                'patient': f'Patient/{patient_id}',
                'category': 'vital-signs',
                'code': vital_type,
                'date': f'ge{cutoff_date}'
            })

            if not observations:
                return False

            # Get the most recent observation
            obs = observations[0] if observations else None

            if not obs:
                return False

            vital_value = None

            # Handle blood pressure components
            if vital_type == '85354-9' and hasattr(obs, 'component'):
                component = parameters.get('component', 'systolic')
                for comp in obs.component:
                    comp_code = None
                    if hasattr(comp, 'code') and hasattr(comp.code, 'coding'):
                        comp_code = comp.code.coding[0].code if comp.code.coding else None

                    if ((component == 'systolic' and comp_code == '8480-6') or
                        (component == 'diastolic' and comp_code == '8462-4')):
                        if hasattr(comp, 'valueQuantity') and hasattr(comp.valueQuantity, 'value'):
                            vital_value = float(comp.valueQuantity.value)
                            break

                if vital_value is None:
                    return False

            # Regular vital signs
            elif hasattr(obs, 'valueQuantity') and obs.valueQuantity:
                if hasattr(obs.valueQuantity, 'value'):
                    vital_value = float(obs.valueQuantity.value)

            if vital_value is None:
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

        except httpx.HTTPStatusError as e:
            raise FHIRConnectionError(
                message=f"FHIR server error checking vital signs for patient {patient_id}",
                cause=e
            )
        except (httpx.RequestError, httpx.TimeoutException) as e:
            raise FHIRConnectionError(
                message=f"Cannot connect to FHIR server for vital sign check",
                cause=e
            )
        except (AttributeError, TypeError, KeyError, ValueError) as e:
            logger.error(f"Data parsing error checking vital signs: {e}")
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

                if 'overrideReasons' in parameters:
                    card.overrideReasons = [
                        OverrideReason(
                            code=reason.get('code', reason.get('key', '')),
                            display=reason.get('display', reason.get('label', '')),
                            system=reason.get('system', '')
                        )
                        for reason in parameters['overrideReasons']
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

        except CDSExecutionError:
            raise  # Re-raise CDS-specific exceptions
        except (FHIRConnectionError, FHIRResourceNotFoundError):
            raise  # Re-raise FHIR-specific exceptions
        except (ValueError, TypeError, KeyError, AttributeError) as e:
            logger.error(f"Error executing action {action.type}: {e}")
            return None


def get_hook_engine(db: AsyncSession) -> CDSHookEngine:
    """Get a CDSHookEngine instance"""
    return CDSHookEngine(db)
