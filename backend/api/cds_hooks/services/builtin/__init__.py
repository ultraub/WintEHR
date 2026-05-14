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
# Cross-order CDS — demonstrates the Order Composer's bundle firing
# =============================================================================
#
# These two services exist to *demonstrate* what unified-level order-select
# firing buys you. They scan ALL draft orders in the bundle, not just the
# single "selected" one, and flag interactions that are only visible across
# multiple drafts. Per-tab order-select firing (the pre-composer world)
# couldn't produce these warnings — neither pair-finding nor
# panel-component overlap is detectable from a single draft.
#
# Both services intentionally use small, hand-curated lookup tables so the
# educational story is "here's the cross-order pattern" rather than "here's
# a production drug-interaction database". Students replace the tables (or
# back them with a CQL service authored in the studio) once they understand
# the firing model.

# (drug_a_substr, drug_b_substr, indicator, summary, detail)
# Substring match on the medication's display text — same approach the
# legacy MedicationInteractionService uses, kept consistent for cohesion.
_INTERACTION_PAIRS = [
    (
        "warfarin", "aspirin", "critical",
        "Warfarin + Aspirin: major bleeding risk",
        "Concurrent anticoagulation and antiplatelet therapy substantially "
        "increases major bleeding risk. Use only with a clear indication, "
        "monitor INR more frequently, and document the risk/benefit rationale.",
    ),
    (
        "warfarin", "ibuprofen", "warning",
        "Warfarin + Ibuprofen: bleeding + GI risk",
        "NSAIDs displace warfarin from protein binding (INR rises) and add "
        "antiplatelet effect plus GI mucosal injury. Prefer acetaminophen "
        "for analgesia in anticoagulated patients.",
    ),
    (
        "lisinopril", "spironolactone", "warning",
        "ACE inhibitor + K-sparing diuretic: hyperkalemia risk",
        "Combining lisinopril with spironolactone (or eplerenone/triamterene) "
        "raises serum potassium. Monitor K+ within 1 week of starting and "
        "after any dose change.",
    ),
    (
        "metformin", "iodinated contrast", "warning",
        "Metformin around iodinated contrast: lactic acidosis risk",
        "Hold metformin at the time of and for 48h after IV iodinated contrast "
        "in patients with eGFR < 60 or AKI risk. Resume after renal function "
        "is reassessed.",
    ),
    (
        "ciprofloxacin", "warfarin", "warning",
        "Ciprofloxacin + Warfarin: INR elevation",
        "Fluoroquinolones inhibit warfarin metabolism. Expect INR to rise "
        "within 3–5 days of starting; check INR within a week and consider "
        "an empiric 10–20% warfarin dose reduction.",
    ),
    (
        "tramadol", "ssri", "warning",
        "Tramadol + SSRI: serotonin syndrome risk",
        "Combining tramadol with SSRIs/SNRIs raises risk of serotonin "
        "syndrome and lowers seizure threshold. Prefer alternative analgesia "
        "in patients on serotonergic antidepressants.",
    ),
]

# SSRI generic-name substrings, expanded once at module load so the lookup
# stays a simple substring scan over the bundle's medication text.
_SSRI_NAMES = ("fluoxetine", "sertraline", "citalopram", "escitalopram", "paroxetine", "fluvoxamine")


class DrugDrugInteractionCohortService(CDSService):
    """
    Scans ALL MedicationRequest drafts in the order-select bundle for
    drug-drug interactions across the cohort.

    Cross-order intelligence — the point this service proves:
    the cohort of drafts must be visible at the same time for pair-finding
    to work. If order-select fired per-tab (the pre-composer model), this
    service would see a single draft and miss every pair entirely. The
    `MedicationInteractionService` shipped for the legacy medication-prescribe
    hook can only compare ONE new med against an active-medications prefetch;
    it cannot reason about the user's drafts as a cohort.

    Educational notes:
    - Reads `context.draftOrders.entry[].resource` — the full Bundle, not
      just `context.selections`. We want the cohort even when the
      composer only "focuses" a single entry.
    - Pair detection is order-independent and case-insensitive. We do
      substring matching against the rendered display text because RxNorm
      codes vary by formulation/strength and the educational signal is
      stronger when matching the drug NAME the student typed.
    - The SSRI rule expands to a small list of common SSRIs so the demo
      fires on realistic Synthea data, not just a literal "ssri" string.
    """

    service_id = "drug-drug-interaction-cohort"
    hook_type = HookType.ORDER_SELECT
    title = "Drug-Drug Interaction (cohort)"
    description = (
        "Scans all medication drafts in the Order Composer at once and "
        "flags interacting pairs. Demonstrates the cohort-firing pattern "
        "the unified Order Composer enables."
    )
    # No FHIR prefetch — the relevant data is in context.draftOrders.
    prefetch_templates: Dict[str, str] = {}

    @staticmethod
    def _med_text(resource: Dict[str, Any]) -> str:
        mc = resource.get("medicationCodeableConcept") or {}
        return (mc.get("text") or (mc.get("coding") or [{}])[0].get("display") or "").lower()

    @staticmethod
    def _name_matches(name: str, needle: str) -> bool:
        if needle == "ssri":
            return any(s in name for s in _SSRI_NAMES)
        return needle in name

    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any],
    ) -> bool:
        # Quick gate: at least two medication drafts in the cohort.
        entries = (context.get("draftOrders") or {}).get("entry", [])
        meds = [
            e.get("resource") for e in entries
            if e.get("resource", {}).get("resourceType") == "MedicationRequest"
        ]
        return len(meds) >= 2

    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any],
    ) -> List[Card]:
        entries = (context.get("draftOrders") or {}).get("entry", [])
        drafts = [
            e.get("resource", {}) for e in entries
            if e.get("resource", {}).get("resourceType") == "MedicationRequest"
        ]
        med_texts = [(self._med_text(d), d) for d in drafts]

        cards: List[Card] = []
        seen_pairs: set = set()
        for needle_a, needle_b, indicator, summary, detail in _INTERACTION_PAIRS:
            matches_a = [d for (n, d) in med_texts if self._name_matches(n, needle_a)]
            matches_b = [d for (n, d) in med_texts if self._name_matches(n, needle_b)]
            if not matches_a or not matches_b:
                continue
            for a in matches_a:
                for b in matches_b:
                    if a is b:
                        # Same draft matched both sides — skip.
                        continue
                    key = tuple(sorted([a.get("id", ""), b.get("id", "")]))
                    if key in seen_pairs:
                        continue
                    seen_pairs.add(key)
                    name_a = self._med_text(a) or "(unspecified)"
                    name_b = self._med_text(b) or "(unspecified)"
                    cards.append(self.create_card(
                        summary=summary,
                        indicator=indicator,
                        detail=f"{detail}\n\nDrafts implicated: {name_a}; {name_b}",
                        source_label="Drug-Drug Interaction (cohort demo)",
                    ))
        return cards


# Hand-curated panel-component map. Keys are LOINC codes for common
# panels; values are the LOINC codes a clinician would also order
# individually that are already inside the panel. The student-facing
# point: ordering a panel + one of its components is duplicate work
# AND a duplicate bill — easy to do by accident in a long draft list,
# impossible to detect from a single draft.
_PANEL_COMPONENTS: Dict[str, Dict[str, Any]] = {
    # Basic Metabolic Panel
    "24320-4": {
        "label": "Basic Metabolic Panel (BMP)",
        "components": {
            "2345-7": "Glucose",
            "2951-2": "Sodium",
            "2823-3": "Potassium",
            "2075-0": "Chloride",
            "2028-9": "CO2",
            "3094-0": "BUN",
            "2160-0": "Creatinine",
            "17861-6": "Calcium",
        },
    },
    # Comprehensive Metabolic Panel
    "24323-8": {
        "label": "Comprehensive Metabolic Panel (CMP)",
        "components": {
            "2345-7": "Glucose",
            "2951-2": "Sodium",
            "2823-3": "Potassium",
            "2075-0": "Chloride",
            "2028-9": "CO2",
            "3094-0": "BUN",
            "2160-0": "Creatinine",
            "17861-6": "Calcium",
            "1751-7": "Albumin",
            "2885-2": "Total protein",
            "1920-8": "AST",
            "1742-6": "ALT",
            "6768-6": "Alkaline phosphatase",
            "1975-2": "Total bilirubin",
        },
    },
    # Complete Blood Count (with differential variant)
    "58410-2": {
        "label": "Complete Blood Count (CBC) with differential",
        "components": {
            "6690-2": "WBC",
            "789-8": "RBC",
            "718-7": "Hemoglobin",
            "4544-3": "Hematocrit",
            "777-3": "Platelets",
            "770-8": "Neutrophils %",
            "736-9": "Lymphocytes %",
        },
    },
    # Lipid Panel
    "24331-1": {
        "label": "Lipid Panel",
        "components": {
            "2093-3": "Total cholesterol",
            "2085-9": "HDL cholesterol",
            "2089-1": "LDL cholesterol",
            "2571-8": "Triglycerides",
        },
    },
    # Hepatic Function Panel
    "24325-3": {
        "label": "Hepatic Function Panel",
        "components": {
            "1751-7": "Albumin",
            "1920-8": "AST",
            "1742-6": "ALT",
            "6768-6": "Alkaline phosphatase",
            "1975-2": "Total bilirubin",
            "1968-7": "Direct bilirubin",
            "2885-2": "Total protein",
        },
    },
}


class PanelComponentOverlapService(CDSService):
    """
    Warns when the draft cohort contains a lab panel AND a separate draft
    for one of that panel's components — duplicate work in clinical and
    billing terms.

    Cross-order intelligence — same point as the DDI service: pair-finding
    is impossible from a single draft. A clinician composing a CMP + a
    standalone glucose order is a real, common mistake (CMP fatigue: you
    add the panel reflexively, then the resident also adds the glucose).
    The composer's bundle-level firing makes this detectable for the
    first time.

    Educational notes:
    - Operates only on ServiceRequest drafts with a laboratory category.
    - Compares the FIRST LOINC coding on each draft to the panel map.
      Real labs sometimes carry multiple codings (LOINC + an internal
      code); we keep the demo simple by trusting the first coding.
    - Emits one card per (panel, component) pair detected. Students see
      both items by name in the card body so the duplicate is obvious.
    """

    service_id = "panel-component-overlap"
    hook_type = HookType.ORDER_SELECT
    title = "Panel/Component Overlap"
    description = (
        "Detects when a draft includes a lab panel and a separate draft "
        "for one of its components (e.g., CMP + glucose). Demonstrates "
        "cross-order CDS firing the Order Composer enables."
    )
    prefetch_templates: Dict[str, str] = {}

    LAB_CATEGORY_CODES = {"108252007", "laboratory", "laboratory-procedure"}

    @classmethod
    def _is_lab(cls, sr: Dict[str, Any]) -> bool:
        for cat in (sr.get("category") or []):
            for coding in (cat.get("coding") or []):
                if coding.get("code") in cls.LAB_CATEGORY_CODES:
                    return True
            if cat.get("text", "").strip().lower() == "laboratory":
                return True
        return False

    @staticmethod
    def _loinc_code(sr: Dict[str, Any]) -> Optional[str]:
        for coding in ((sr.get("code") or {}).get("coding") or []):
            if (coding.get("system") or "").lower().endswith("loinc.org"):
                return coding.get("code")
        # Fall back to the first coding if no LOINC marker is set.
        coding = ((sr.get("code") or {}).get("coding") or [{}])[0]
        return coding.get("code")

    async def should_execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any],
    ) -> bool:
        entries = (context.get("draftOrders") or {}).get("entry", [])
        labs = [
            e.get("resource") for e in entries
            if e.get("resource", {}).get("resourceType") == "ServiceRequest"
            and self._is_lab(e.get("resource", {}))
        ]
        return len(labs) >= 2

    async def execute(
        self,
        context: Dict[str, Any],
        prefetch: Dict[str, Any],
    ) -> List[Card]:
        entries = (context.get("draftOrders") or {}).get("entry", [])
        labs = [
            e.get("resource", {}) for e in entries
            if e.get("resource", {}).get("resourceType") == "ServiceRequest"
            and self._is_lab(e.get("resource", {}))
        ]
        # Build a map: LOINC code → list of drafts requesting it.
        by_code: Dict[str, List[Dict[str, Any]]] = {}
        for lab in labs:
            code = self._loinc_code(lab)
            if code:
                by_code.setdefault(code, []).append(lab)

        cards: List[Card] = []
        for panel_code, panel_info in _PANEL_COMPONENTS.items():
            if panel_code not in by_code:
                continue
            overlapping_codes = [
                (c, d) for c, d in panel_info["components"].items()
                if c in by_code
            ]
            if not overlapping_codes:
                continue
            panel_label = panel_info["label"]
            component_descriptions = "; ".join(
                f"{display} ({code})" for code, display in overlapping_codes
            )
            cards.append(self.create_card(
                summary=f"Overlap: {panel_label} already covers {len(overlapping_codes)} ordered component(s)",
                indicator="warning",
                detail=(
                    f"Draft list includes {panel_label} ({panel_code}) AND the "
                    f"following individual component(s): {component_descriptions}. "
                    "These results are already produced by the panel — the "
                    "standalone orders add cost without adding information. "
                    "Consider removing the duplicates before signing."
                ),
                source_label="Panel/Component Overlap (cohort demo)",
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
        DrugDrugInteractionCohortService(),
        PanelComponentOverlapService(),
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
    "DrugDrugInteractionCohortService",
    "PanelComponentOverlapService",
    # Helper functions
    "get_builtin_services",
    "register_builtin_services",
]
