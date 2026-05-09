"""
CDS Hooks Built-in Services (v3.0 Architecture)

This module contains built-in CDS services using the new CDSService base class pattern.
Services are automatically registered with the global ServiceRegistry on import.

Educational Focus:
- Demonstrates CDSService inheritance pattern
- Shows class-level metadata definition
- Illustrates condition-based filtering with ConditionEngine
- Shows proper Card creation with suggestions

Migration Notes:
    These services were migrated from service_implementations.py to follow
    the v3.0 architecture pattern with:
    - Class-level metadata instead of __init__ parameters
    - CDSService abstract base class inheritance
    - HookType enum for hook specification
    - Integration with ConditionEngine for declarative conditions
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from dateutil import parser
import logging

from ..base_service import CDSService, SimpleCDSService, HookType
from ...models import Card

logger = logging.getLogger(__name__)


# =============================================================================
# Screening Services
# =============================================================================

class ColonoscopyScreeningService(CDSService):
    """
    Age-based colonoscopy screening reminder service.

    Recommends colonoscopy screening for patients 50+ years old
    who haven't had a recent screening procedure.

    Educational Notes:
        - Demonstrates age-based condition evaluation
        - Shows prefetch usage for procedure history lookup
        - Includes actionable suggestion for ordering screening
    """

    service_id = "colonoscopy-screening"
    hook_type = HookType.PATIENT_VIEW
    title = "Colonoscopy Screening Reminder"
    description = "Reminds providers when patients are due for colonoscopy screening"
    prefetch_templates = {
        "patient": "Patient/{{context.patientId}}",
        "procedures": "Procedure?patient={{context.patientId}}&code=http://snomed.info/sct|73761001&_count=5"
    }

    # Service-specific configuration
    min_age = 50
    screening_name = "Colonoscopy"

    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> bool:
        """Check if patient meets age criteria for screening."""
        patient = prefetch.get("patient")
        if not patient:
            return False

        birth_date = patient.get("birthDate")
        if not birth_date:
            return False

        try:
            birth = parser.parse(birth_date)
            age = (datetime.now() - birth).days // 365
            return age >= self.min_age
        except Exception as e:
            logger.debug(f"Age calculation failed: {e}")
            return False

    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> List[Card]:
        """Generate screening reminder card if no recent screening found."""
        # Check if screening was recently done
        procedures = prefetch.get("procedures", {}).get("entry", [])
        recent_screening = any(
            self.screening_name.lower() in proc.get("resource", {}).get("code", {}).get("text", "").lower()
            for proc in procedures
        )

        if recent_screening:
            return []  # No card needed - screening is up to date

        return [self.create_card(
            summary=f"{self.screening_name} screening recommended",
            indicator="warning",
            detail=f"Patient is {self.min_age}+ years old and due for {self.screening_name} screening.",
            source_label="Preventive Care Guidelines",
            suggestions=[{
                "label": f"Order {self.screening_name}",
                "uuid": f"order-{self.screening_name.lower()}",
                "isRecommended": True,
                "actions": [{
                    "type": "create",
                    "description": f"Order {self.screening_name} screening",
                    "resource": {
                        "resourceType": "ServiceRequest",
                        "status": "draft",
                        "intent": "order",
                        "code": {
                            "coding": [{
                                "system": "http://snomed.info/sct",
                                "code": "73761001",
                                "display": "Colonoscopy"
                            }],
                            "text": self.screening_name
                        }
                    }
                }]
            }]
        )]


class MammographyScreeningService(CDSService):
    """
    Gender and age-based mammography screening service.

    Recommends mammography screening for female patients 40+ years old.

    Educational Notes:
        - Demonstrates compound condition (gender + age)
        - Shows gender-specific healthcare recommendations
        - Aligns with breast cancer screening guidelines
    """

    service_id = "mammography-screening"
    hook_type = HookType.PATIENT_VIEW
    title = "Mammography Screening Reminder"
    description = "Reminds providers when female patients are due for mammography"
    prefetch_templates = {
        "patient": "Patient/{{context.patientId}}"
    }

    # Service-specific configuration
    gender = "female"
    min_age = 40

    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> bool:
        """Check if patient meets gender and age criteria."""
        patient = prefetch.get("patient")
        if not patient:
            return False

        # Check gender
        if patient.get("gender", "").lower() != self.gender:
            return False

        # Check age
        birth_date = patient.get("birthDate")
        if not birth_date:
            return False

        try:
            birth = parser.parse(birth_date)
            age = (datetime.now() - birth).days // 365
            return age >= self.min_age
        except Exception as e:
            logger.debug(f"Age calculation failed: {e}")
            return False

    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> List[Card]:
        """Generate mammography reminder card."""
        return [self.create_card(
            summary="Mammography screening due",
            indicator="info",
            detail=f"Patient is a {self.gender} over {self.min_age} and due for mammography screening.",
            source_label="Breast Cancer Screening Guidelines",
            suggestions=[{
                "label": "Order Mammogram",
                "uuid": "order-mammogram",
                "isRecommended": True,
                "actions": [{
                    "type": "create",
                    "description": "Order mammography screening",
                    "resource": {
                        "resourceType": "ServiceRequest",
                        "status": "draft",
                        "intent": "order",
                        "code": {
                            "coding": [{
                                "system": "http://snomed.info/sct",
                                "code": "71651007",
                                "display": "Mammography"
                            }],
                            "text": "Mammography"
                        }
                    }
                }]
            }]
        )]


# =============================================================================
# Medication Services
# =============================================================================

class MedicationInteractionService(CDSService):
    """
    Drug interaction checking service for medication prescribing.

    Checks for potential drug interactions when new medications are prescribed.

    Educational Notes:
        - Demonstrates medication-prescribe hook usage
        - Shows interaction between current and new medications
        - Critical indicator for serious interactions
    """

    service_id = "drug-interactions"
    hook_type = HookType.MEDICATION_PRESCRIBE
    title = "Drug Interaction Checker"
    description = "Checks for potential drug interactions when prescribing medications"
    prefetch_templates = {
        "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
    }

    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> bool:
        """Always execute for medication-prescribe hook."""
        return context.get("hook") == "medication-prescribe"

    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> List[Card]:
        """Check for drug interactions and generate warning cards."""
        cards = []

        # Get current medications
        current_meds = prefetch.get("medications", {}).get("entry", [])
        new_meds = context.get("medications", [])

        # Extract current drug names
        current_drug_names = [
            med.get("resource", {}).get("medicationCodeableConcept", {}).get("text", "").lower()
            for med in current_meds
        ]

        # Check each new medication for interactions
        for new_med in new_meds:
            med_name = new_med.get("medicationCodeableConcept", {}).get("text", "").lower()

            # Example interaction: Warfarin + Aspirin
            if "warfarin" in current_drug_names and "aspirin" in med_name:
                cards.append(self.create_card(
                    summary="Drug interaction warning: Aspirin + Warfarin",
                    indicator="critical",
                    detail="Concurrent use of Aspirin and Warfarin significantly increases bleeding risk. "
                           "Consider alternative antiplatelet therapy or close INR monitoring.",
                    source_label="Drug Interaction Database",
                    suggestions=[{
                        "label": "Use alternative antiplatelet",
                        "uuid": "alternative-med",
                        "actions": []
                    }],
                    override_reasons=[
                        {"code": "patient-informed", "display": "Patient informed of risks"},
                        {"code": "benefit-outweighs", "display": "Benefits outweigh risks"}
                    ]
                ))

            # Example: ACE inhibitor + Potassium-sparing diuretic
            ace_inhibitors = ["lisinopril", "enalapril", "ramipril", "benazepril"]
            k_sparing = ["spironolactone", "eplerenone", "triamterene"]

            if any(ace in current_drug_names for ace in ace_inhibitors) and \
               any(k in med_name for k in k_sparing):
                cards.append(self.create_card(
                    summary="Drug interaction warning: Hyperkalemia risk",
                    indicator="warning",
                    detail="ACE inhibitor combined with potassium-sparing diuretic increases "
                           "hyperkalemia risk. Monitor potassium levels closely.",
                    source_label="Drug Interaction Database",
                    suggestions=[{
                        "label": "Order potassium level",
                        "uuid": "order-k-level",
                        "isRecommended": True,
                        "actions": [{
                            "type": "create",
                            "description": "Order serum potassium",
                            "resource": {
                                "resourceType": "ServiceRequest",
                                "status": "draft",
                                "intent": "order",
                                "code": {
                                    "coding": [{
                                        "system": "http://loinc.org",
                                        "code": "2823-3",
                                        "display": "Potassium [Moles/volume] in Serum or Plasma"
                                    }]
                                }
                            }
                        }]
                    }]
                ))

        return cards


# =============================================================================
# Lab Value Services
# =============================================================================

class PotassiumMonitorService(CDSService):
    """
    Critical potassium level monitoring service.

    Alerts providers to critically high or low potassium values.

    Educational Notes:
        - Demonstrates lab value monitoring pattern
        - Shows LOINC code-based lab identification
        - Critical indicator for life-threatening values
    """

    service_id = "potassium-monitor"
    hook_type = HookType.PATIENT_VIEW
    title = "Potassium Level Monitor"
    description = "Alerts on critical potassium levels"
    prefetch_templates = {
        "recentLabs": "Observation?patient={{context.patientId}}&code=http://loinc.org|2823-3&_count=5&_sort=-date"
    }

    # Service-specific configuration
    lab_code = "2823-3"  # LOINC code for serum potassium
    critical_high = 6.0  # mEq/L
    critical_low = 2.5   # mEq/L

    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> bool:
        """Execute if we have recent lab results."""
        observations = prefetch.get("recentLabs", {}).get("entry", [])
        return len(observations) > 0

    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> List[Card]:
        """Check for critical potassium values."""
        cards = []
        observations = prefetch.get("recentLabs", {}).get("entry", [])

        for obs in observations:
            resource = obs.get("resource", {})

            # Verify this is the lab we're monitoring
            coding = resource.get("code", {}).get("coding", [])
            if not any(c.get("code") == self.lab_code for c in coding):
                continue

            # Get the value
            value = resource.get("valueQuantity", {}).get("value")
            unit = resource.get("valueQuantity", {}).get("unit", "mEq/L")
            if value is None:
                continue

            lab_name = resource.get("code", {}).get("text", "Potassium")

            if value > self.critical_high:
                cards.append(self.create_card(
                    summary=f"Critical high {lab_name}: {value} {unit}",
                    indicator="critical",
                    detail=f"Potassium level of {value} {unit} exceeds critical threshold of "
                           f"{self.critical_high} {unit}. Immediate evaluation recommended.",
                    source_label="Lab Critical Values",
                    suggestions=[{
                        "label": "Order repeat potassium",
                        "uuid": "repeat-k",
                        "actions": [{
                            "type": "create",
                            "description": "Order stat serum potassium",
                            "resource": {
                                "resourceType": "ServiceRequest",
                                "status": "draft",
                                "intent": "order",
                                "priority": "stat",
                                "code": {
                                    "coding": [{
                                        "system": "http://loinc.org",
                                        "code": "2823-3"
                                    }]
                                }
                            }
                        }]
                    }]
                ))
            elif value < self.critical_low:
                cards.append(self.create_card(
                    summary=f"Critical low {lab_name}: {value} {unit}",
                    indicator="critical",
                    detail=f"Potassium level of {value} {unit} below critical threshold of "
                           f"{self.critical_low} {unit}. Immediate evaluation recommended.",
                    source_label="Lab Critical Values",
                    suggestions=[{
                        "label": "Order potassium replacement",
                        "uuid": "k-replacement",
                        "actions": []
                    }]
                ))

        return cards


# =============================================================================
# Diagnosis-Based Services
# =============================================================================

class DiabetesCareService(CDSService):
    """
    Diabetes management reminder service.

    Provides care reminders for patients with diabetes diagnoses,
    especially when combined with polypharmacy concerns.

    Educational Notes:
        - Demonstrates condition-based filtering
        - Shows polypharmacy risk assessment
        - Combines multiple clinical factors in decision logic
    """

    service_id = "diabetes-care"
    hook_type = HookType.PATIENT_VIEW
    title = "Diabetes Care Reminder"
    description = "Care reminders for diabetic patients, especially those with polypharmacy"
    prefetch_templates = {
        "patient": "Patient/{{context.patientId}}",
        "conditions": "Condition?patient={{context.patientId}}&clinical-status=active",
        "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
    }

    # Service-specific configuration
    diabetes_keywords = ["diabetes", "diabetic", "dm", "type 2", "type 1"]
    polypharmacy_threshold = 5

    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> bool:
        """Execute if patient has diabetes diagnosis."""
        conditions = prefetch.get("conditions", {}).get("entry", [])

        for condition in conditions:
            resource = condition.get("resource", {})
            code_text = resource.get("code", {}).get("text", "").lower()

            if any(keyword in code_text for keyword in self.diabetes_keywords):
                return True

        return False

    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> List[Card]:
        """Generate diabetes care cards with polypharmacy assessment."""
        cards = []
        medications = prefetch.get("medications", {}).get("entry", [])
        med_count = len(medications)

        # Check for polypharmacy
        if med_count >= self.polypharmacy_threshold:
            cards.append(self.create_card(
                summary="Polypharmacy risk in diabetic patient",
                indicator="warning",
                detail=f"Patient has diabetes and is on {med_count} medications. "
                       f"Consider comprehensive medication review to identify opportunities "
                       f"for simplification and reduce drug interaction risks.",
                source_label="Diabetes Care Guidelines",
                suggestions=[{
                    "label": "Schedule medication review",
                    "uuid": "med-review",
                    "isRecommended": True,
                    "actions": [{
                        "type": "create",
                        "description": "Schedule comprehensive medication review",
                        "resource": {
                            "resourceType": "Appointment",
                            "status": "proposed",
                            "appointmentType": {
                                "coding": [{
                                    "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
                                    "code": "FOLLOWUP"
                                }],
                                "text": "Medication Review"
                            }
                        }
                    }]
                }],
                links=[{
                    "label": "Diabetes Medication Guidelines",
                    "url": "https://www.ada.org/clinical-resources/standards-of-care",
                    "type": "absolute"
                }]
            ))
        else:
            # Standard diabetes care reminder
            cards.append(self.create_card(
                summary="Diabetes care reminder",
                indicator="info",
                detail="Review HbA1c results and ensure diabetes management goals are being met.",
                source_label="Diabetes Care Guidelines",
                suggestions=[{
                    "label": "Order HbA1c",
                    "uuid": "order-hba1c",
                    "actions": [{
                        "type": "create",
                        "description": "Order Hemoglobin A1c",
                        "resource": {
                            "resourceType": "ServiceRequest",
                            "status": "draft",
                            "intent": "order",
                            "code": {
                                "coding": [{
                                    "system": "http://loinc.org",
                                    "code": "4548-4",
                                    "display": "Hemoglobin A1c"
                                }]
                            }
                        }
                    }]
                }]
            ))

        return cards


# =============================================================================
# Patient Greeting Service
# =============================================================================

class PatientGreeterService(SimpleCDSService):
    """
    Simple patient greeting service for demonstration.

    Shows basic patient information when chart is opened.
    Uses SimpleCDSService which always executes.

    Educational Notes:
        - Demonstrates SimpleCDSService usage
        - Shows info-level card with patient summary
        - Useful for onboarding and demonstration purposes
    """

    service_id = "patient-greeter"
    hook_type = HookType.PATIENT_VIEW
    title = "Patient Summary"
    description = "Displays patient summary information on chart open"
    prefetch_templates = {
        "patient": "Patient/{{context.patientId}}"
    }

    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> List[Card]:
        """Generate a welcome card with patient summary."""
        patient = prefetch.get("patient", {})

        # Extract patient name
        names = patient.get("name", [{}])
        name_obj = names[0] if names else {}
        given = " ".join(name_obj.get("given", []))
        family = name_obj.get("family", "")
        full_name = f"{given} {family}".strip() or "Unknown Patient"

        # Calculate age
        birth_date = patient.get("birthDate", "")
        age_str = ""
        if birth_date:
            try:
                birth = parser.parse(birth_date)
                age = (datetime.now() - birth).days // 365
                age_str = f", {age} years old"
            except Exception:
                pass

        # Get gender
        gender = patient.get("gender", "").title()

        return [self.create_card(
            summary=f"Viewing chart for {full_name}",
            indicator="info",
            detail=f"**Patient**: {full_name}{age_str}\n\n"
                   f"**Gender**: {gender or 'Not specified'}\n\n"
                   f"**DOB**: {birth_date or 'Not recorded'}",
            source_label="Patient Demographics"
        )]


class OrderCompositionContextService(CDSService):
    """
    Reference implementation of a CDS Hooks 2.0 `order-select` service.

    Fires during composition for ServiceRequest, MedicationRequest, and
    Immunization drafts. Returns one info card per resource type
    summarizing what the clinician is composing and flagging similar
    recent activity from the patient record.

    Educational notes:
    - Reads `context.selections` (a list of `Bundle/<id>#<rt>/<id>`
      reference strings — the canonical CDS Hooks 2.0 format) and
      resolves them back to entries in `context.draftOrders`. This
      reference-resolution pattern is non-obvious from the spec wording
      and is the recommended starting point for students writing
      order-select services.
    - Filters by resource type in `should_execute` to avoid noise on
      hooks that don't carry composable orders.
    - Demonstrates multi-type dispatch in `execute`: one card per
      resource type group lets students see how to author a single
      service that handles all order entry surfaces.

    Card source label is "Order Composition Context (reference example)"
    so students learn this is a built-in pattern they can model.
    """

    service_id = "order-composition-context"
    hook_type = HookType.ORDER_SELECT
    title = "Order Composition Context"
    description = (
        "Fires during composition for service requests, medication "
        "requests, and immunizations. Echoes draft codes and flags "
        "similar recent activity. Reference example for authoring "
        "order-select services."
    )
    prefetch_templates = {
        "patient": "Patient/{{context.patientId}}",
        "recentLabOrders": (
            "ServiceRequest?patient={{context.patientId}}"
            "&category=laboratory&_count=20&_sort=-authored"
        ),
        "recentMedications": (
            "MedicationRequest?patient={{context.patientId}}"
            "&_count=20&_sort=-authoredon"
        ),
        "recentImmunizations": (
            "Immunization?patient={{context.patientId}}"
            "&_count=20&_sort=-occurrence-date"
        ),
    }

    SUPPORTED_TYPES = ("ServiceRequest", "MedicationRequest", "Immunization")
    TYPE_LABELS = {
        "ServiceRequest": "Order",
        "MedicationRequest": "Medication",
        "Immunization": "Vaccine",
    }

    @staticmethod
    def _resolve_selection(selection_ref: str, draft_orders: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse `Bundle/<bid>#<rt>/<id>` and find the matching entry.

        The reference format is fixed by CDS Hooks 2.0. Robust to
        callers that pass malformed refs (returns None instead of
        raising).
        """
        try:
            _bundle_part, frag = selection_ref.split("#", 1)
            rt, draft_id = frag.split("/", 1)
        except (ValueError, AttributeError):
            return None
        for entry in (draft_orders or {}).get("entry", []):
            r = entry.get("resource", {})
            if r.get("resourceType") == rt and r.get("id") == draft_id:
                return r
        return None

    @classmethod
    def _resolve_focused(cls, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        selections = context.get("selections", []) or []
        draft_orders = context.get("draftOrders") or {}
        focused: List[Dict[str, Any]] = []
        for sel in selections:
            r = cls._resolve_selection(sel, draft_orders)
            if r is not None:
                focused.append(r)
        return focused

    @staticmethod
    def _code_text(resource: Dict[str, Any]) -> str:
        rt = resource.get("resourceType")
        cc = (
            resource.get("code") if rt == "ServiceRequest"
            else resource.get("medicationCodeableConcept") if rt == "MedicationRequest"
            else resource.get("vaccineCode") if rt == "Immunization"
            else None
        )
        if not cc:
            return "(unspecified)"
        text = cc.get("text")
        if text:
            return text
        coding = cc.get("coding") or [{}]
        return coding[0].get("display") or "(unspecified)"

    @classmethod
    def _recent_codes(cls, bundle: Optional[Dict[str, Any]]) -> set:
        out = set()
        for entry in (bundle or {}).get("entry", []):
            r = entry.get("resource", {})
            txt = cls._code_text(r)
            if txt and txt != "(unspecified)":
                out.add(txt.lower())
        return out

    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> bool:
        return any(
            r.get("resourceType") in self.SUPPORTED_TYPES
            for r in self._resolve_focused(context)
        )

    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any]
    ) -> List[Card]:
        focused = self._resolve_focused(context)
        if not focused:
            return []

        # Group focused resources by type so we can emit one card per
        # type with the relevant recent-activity comparison.
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for r in focused:
            rt = r.get("resourceType")
            if rt in self.SUPPORTED_TYPES:
                groups.setdefault(rt, []).append(r)

        recent_by_type = {
            "ServiceRequest": self._recent_codes(prefetch.get("recentLabOrders")),
            "MedicationRequest": self._recent_codes(prefetch.get("recentMedications")),
            "Immunization": self._recent_codes(prefetch.get("recentImmunizations")),
        }

        cards: List[Card] = []
        for rt, items in groups.items():
            label = self.TYPE_LABELS[rt]
            codes = [self._code_text(i) for i in items]
            recent = recent_by_type.get(rt, set())
            overlap = [c for c in codes if c.lower() in recent]

            detail_lines = [
                f"Composing {label.lower()}: {', '.join(codes)}",
            ]
            if overlap:
                detail_lines.append(
                    f"⚠️ Similar {label.lower()} in last 7 days: {', '.join(overlap)}"
                )
            else:
                detail_lines.append(
                    f"No similar {label.lower()}s found in recent activity."
                )

            summary_codes = ", ".join(codes)
            if len(summary_codes) > 80:
                summary_codes = summary_codes[:77] + "..."

            cards.append(self.create_card(
                summary=f"{label} context: {summary_codes}",
                indicator="info",
                detail="\n\n".join(detail_lines),
                source_label="Order Composition Context (reference example)",
            ))
        return cards


# =============================================================================
# Service Registration Helper
# =============================================================================

def get_builtin_services() -> List[CDSService]:
    """
    Get all built-in service instances.

    Returns a list of instantiated service objects ready for registration
    with the ServiceRegistry.

    Returns:
        List of CDSService instances
    """
    return [
        ColonoscopyScreeningService(),
        MammographyScreeningService(),
        MedicationInteractionService(),
        PotassiumMonitorService(),
        DiabetesCareService(),
        PatientGreeterService(),
        OrderCompositionContextService(),
    ]


def register_builtin_services(registry) -> None:
    """
    Register all built-in services with the provided registry.

    Args:
        registry: ServiceRegistry instance to register services with
    """
    from ...registry import register_service

    for service in get_builtin_services():
        register_service(
            service=service,
            category="builtin"
        )
        logger.info(f"Registered builtin service: {service.service_id}")


# Exports
__all__ = [
    # Service classes
    "ColonoscopyScreeningService",
    "MammographyScreeningService",
    "MedicationInteractionService",
    "PotassiumMonitorService",
    "DiabetesCareService",
    "PatientGreeterService",
    "OrderCompositionContextService",
    # Helper functions
    "get_builtin_services",
    "register_builtin_services",
]
