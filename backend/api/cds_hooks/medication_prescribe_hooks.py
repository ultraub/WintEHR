"""
Medication Prescribe CDS Hooks
Implements medication-prescribe hooks for drug interaction and allergy checking
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import uuid
import logging

from .models import (
    HookConfiguration,
    HookCondition,
    HookAction,
    HookType,
    Card,
    Source,
    Suggestion,
    Action,
    IndicatorType,
    CDSHookRequest,
    CDSHookResponse,
    MedicationPrescribeContext
)

logger = logging.getLogger(__name__)

class MedicationPrescribeHooks:
    """CDS Hooks for medication prescribing safety"""
    
    def __init__(self):
        self.drug_interactions = self._load_drug_interactions()
        self.allergy_mappings = self._load_allergy_mappings()
    
    def _load_drug_interactions(self) -> Dict[str, List[Dict]]:
        """Load drug interaction database"""
        return {
            # ACE Inhibitors
            "lisinopril": [
                {
                    "interacting_drug": "potassium",
                    "severity": "major",
                    "description": "ACE inhibitors increase potassium levels. Concurrent use with potassium supplements may cause hyperkalemia.",
                    "recommendation": "Monitor potassium levels closely. Consider dose reduction or alternative therapy."
                },
                {
                    "interacting_drug": "nsaid",
                    "severity": "moderate",
                    "description": "NSAIDs may reduce the antihypertensive effect of ACE inhibitors and increase nephrotoxicity risk.",
                    "recommendation": "Monitor blood pressure and renal function. Use lowest effective NSAID dose."
                }
            ],
            # Beta Blockers
            "metoprolol": [
                {
                    "interacting_drug": "calcium_channel_blocker",
                    "severity": "major",
                    "description": "Combination may cause severe bradycardia, heart block, or hypotension.",
                    "recommendation": "Monitor heart rate and blood pressure closely. Consider alternative therapy."
                },
                {
                    "interacting_drug": "insulin",
                    "severity": "moderate",
                    "description": "Beta blockers may mask signs of hypoglycemia and prolong recovery.",
                    "recommendation": "Monitor blood glucose closely. Educate patient about hypoglycemia symptoms."
                }
            ],
            # Antibiotics
            "amoxicillin": [
                {
                    "interacting_drug": "warfarin",
                    "severity": "moderate",
                    "description": "Antibiotics may enhance the anticoagulant effect of warfarin.",
                    "recommendation": "Monitor INR closely. May need warfarin dose adjustment."
                }
            ],
            "azithromycin": [
                {
                    "interacting_drug": "warfarin",
                    "severity": "moderate",
                    "description": "Macrolide antibiotics may enhance anticoagulant effect.",
                    "recommendation": "Monitor INR closely during and after antibiotic course."
                },
                {
                    "interacting_drug": "qt_prolonging",
                    "severity": "major",
                    "description": "Azithromycin may prolong QT interval. Risk increased with other QT-prolonging drugs.",
                    "recommendation": "Avoid combination if possible. Monitor ECG if used together."
                }
            ],
            # NSAIDs
            "ibuprofen": [
                {
                    "interacting_drug": "warfarin",
                    "severity": "major",
                    "description": "NSAIDs increase bleeding risk when combined with anticoagulants.",
                    "recommendation": "Avoid combination. Consider acetaminophen alternative."
                },
                {
                    "interacting_drug": "ace_inhibitor",
                    "severity": "moderate",
                    "description": "NSAIDs may reduce antihypertensive effect and increase nephrotoxicity.",
                    "recommendation": "Monitor blood pressure and renal function."
                }
            ],
            # SSRIs
            "sertraline": [
                {
                    "interacting_drug": "maoi",
                    "severity": "contraindicated",
                    "description": "Risk of serotonin syndrome with MAOI combination.",
                    "recommendation": "Contraindicated. Wait 14 days after discontinuing MAOI."
                },
                {
                    "interacting_drug": "nsaid",
                    "severity": "moderate",
                    "description": "SSRIs may increase bleeding risk when combined with NSAIDs.",
                    "recommendation": "Monitor for bleeding. Consider PPI for GI protection."
                }
            ]
        }
    
    def _load_allergy_mappings(self) -> Dict[str, List[str]]:
        """Load allergy to medication mappings"""
        return {
            "penicillin": [
                "amoxicillin", "ampicillin", "penicillin", "amoxicillin-clavulanate"
            ],
            "sulfa": [
                "sulfamethoxazole", "trimethoprim-sulfamethoxazole", "furosemide", "hydrochlorothiazide"
            ],
            "nsaid": [
                "ibuprofen", "naproxen", "aspirin", "diclofenac", "celecoxib", "indomethacin"
            ],
            "ace_inhibitor": [
                "lisinopril", "enalapril", "captopril", "ramipril"
            ],
            "beta_blocker": [
                "metoprolol", "atenolol", "propranolol", "carvedilol"
            ]
        }
    
    def get_medication_prescribe_hooks(self) -> List[HookConfiguration]:
        """Get all medication-prescribe hook configurations"""
        return [
            # Drug Interaction Check
            HookConfiguration(
                id="drug-interaction-check",
                hook=HookType.MEDICATION_PRESCRIBE,
                title="Drug Interaction Checker",
                description="Checks for drug-drug interactions in medication orders",
                enabled=True,
                conditions=[],  # Apply to all medication prescriptions
                actions=[
                    HookAction(
                        type="check-interactions",
                        parameters={
                            "check_type": "drug_interaction",
                            "severity_threshold": "moderate"
                        }
                    )
                ]
            ),
            # Allergy Check
            HookConfiguration(
                id="allergy-check",
                hook=HookType.MEDICATION_PRESCRIBE,
                title="Allergy Checker",
                description="Checks for medication allergies and contraindications",
                enabled=True,
                conditions=[],  # Apply to all medication prescriptions
                actions=[
                    HookAction(
                        type="check-allergies",
                        parameters={
                            "check_type": "allergy_contraindication",
                            "severity_threshold": "any"
                        }
                    )
                ]
            ),
            # Age-based Dosing
            HookConfiguration(
                id="age-based-dosing",
                hook=HookType.MEDICATION_PRESCRIBE,
                title="Age-based Dosing Alert",
                description="Provides dosing alerts for pediatric and geriatric patients",
                enabled=True,
                conditions=[
                    HookCondition(
                        type="patient-age",
                        parameters={"operator": "outside_range", "min_age": "18", "max_age": "64"}
                    )
                ],
                actions=[
                    HookAction(
                        type="dosing-guidance",
                        parameters={
                            "check_type": "age_based_dosing",
                            "population": "special"
                        }
                    )
                ]
            ),
            # Renal Dosing
            HookConfiguration(
                id="renal-dosing-check",
                hook=HookType.MEDICATION_PRESCRIBE,
                title="Renal Dosing Alert",
                description="Alerts for medications requiring renal dose adjustment",
                enabled=True,
                conditions=[],
                actions=[
                    HookAction(
                        type="renal-dosing",
                        parameters={
                            "check_type": "renal_adjustment",
                            "medications": ["metformin", "lisinopril", "digoxin"]
                        }
                    )
                ]
            )
        ]
    
    async def execute_drug_interaction_check(self, request: CDSHookRequest) -> List[Card]:
        """Execute drug interaction checking"""
        cards = []
        
        try:
            # Get the medication being prescribed
            context = request.context
            if not isinstance(context, MedicationPrescribeContext):
                return cards
            
            prescribed_med = self._extract_medication_name(context.draftOrders[0] if context.draftOrders else {})
            if not prescribed_med:
                return cards
            
            # Get patient's current medications from prefetch
            current_meds = self._extract_current_medications(request.prefetch)
            
            # Check for interactions
            interactions = self._check_interactions(prescribed_med, current_meds)
            
            for interaction in interactions:
                card = Card(
                    uuid=str(uuid.uuid4()),
                    summary=f"Drug Interaction: {prescribed_med} ↔ {interaction['interacting_medication']}",
                    detail=interaction['description'],
                    indicator=self._get_indicator_for_severity(interaction['severity']),
                    source=Source(label="Drug Interaction Database", url=""),
                    suggestions=[
                        Suggestion(
                            label="Review Interaction",
                            uuid=str(uuid.uuid4()),
                            actions=[
                                Action(
                                    type="update",
                                    description=interaction['recommendation'],
                                    resource={}
                                )
                            ]
                        )
                    ] if interaction['severity'] in ['major', 'contraindicated'] else []
                )
                cards.append(card)
        
        except Exception as e:
            logger.error(f"Error in drug interaction check: {e}")
        
        return cards
    
    async def execute_allergy_check(self, request: CDSHookRequest) -> List[Card]:
        """Execute allergy checking"""
        cards = []
        
        try:
            # Get the medication being prescribed
            context = request.context
            if not isinstance(context, MedicationPrescribeContext):
                return cards
            
            prescribed_med = self._extract_medication_name(context.draftOrders[0] if context.draftOrders else {})
            if not prescribed_med:
                return cards
            
            # Get patient allergies from prefetch
            allergies = self._extract_patient_allergies(request.prefetch)
            
            # Check for allergy matches
            allergy_alerts = self._check_allergies(prescribed_med, allergies)
            
            for alert in allergy_alerts:
                card = Card(
                    uuid=str(uuid.uuid4()),
                    summary=f"Allergy Alert: {prescribed_med}",
                    detail=f"Patient has documented allergy to {alert['allergen']}. {alert['description']}",
                    indicator=IndicatorType.CRITICAL if alert['severity'] == 'high' else IndicatorType.WARNING,
                    source=Source(label="Patient Allergy List", url=""),
                    suggestions=[
                        Suggestion(
                            label="Consider Alternative",
                            uuid=str(uuid.uuid4()),
                            actions=[
                                Action(
                                    type="delete",
                                    description="Remove this medication order",
                                    resource=context.draftOrders[0] if context.draftOrders else {}
                                )
                            ]
                        )
                    ]
                )
                cards.append(card)
        
        except Exception as e:
            logger.error(f"Error in allergy check: {e}")
        
        return cards
    
    async def execute_age_based_dosing(self, request: CDSHookRequest) -> List[Card]:
        """Execute age-based dosing guidance"""
        cards = []
        
        try:
            # Get patient age
            patient_age = self._extract_patient_age(request.prefetch)
            if patient_age is None:
                return cards
            
            # Get the medication being prescribed
            context = request.context
            if not isinstance(context, MedicationPrescribeContext):
                return cards
            
            prescribed_med = self._extract_medication_name(context.draftOrders[0] if context.draftOrders else {})
            if not prescribed_med:
                return cards
            
            # Generate age-specific guidance
            guidance = self._get_age_specific_guidance(prescribed_med, patient_age)
            
            if guidance:
                card = Card(
                    uuid=str(uuid.uuid4()),
                    summary=f"Age-specific Dosing: {prescribed_med}",
                    detail=guidance['message'],
                    indicator=IndicatorType.INFO,
                    source=Source(label="Dosing Guidelines", url=""),
                    suggestions=[]
                )
                cards.append(card)
        
        except Exception as e:
            logger.error(f"Error in age-based dosing check: {e}")
        
        return cards
    
    # Helper methods
    
    def _extract_medication_name(self, draft_order: Dict) -> Optional[str]:
        """Extract medication name from draft order"""
        if not draft_order:
            return None
        
        med_concept = draft_order.get('medicationCodeableConcept', {})
        return (med_concept.get('text') or 
                (med_concept.get('coding', [{}])[0].get('display') if med_concept.get('coding') else None))
    
    def _extract_current_medications(self, prefetch: Dict) -> List[str]:
        """Extract current medications from prefetch data"""
        medications = []
        
        medication_requests = prefetch.get('medicationRequests', {}).get('entry', [])
        for entry in medication_requests:
            resource = entry.get('resource', {})
            if resource.get('status') == 'active':
                med_concept = resource.get('medicationCodeableConcept', {})
                med_name = (med_concept.get('text') or 
                           (med_concept.get('coding', [{}])[0].get('display') if med_concept.get('coding') else None))
                if med_name:
                    medications.append(med_name.lower())
        
        return medications
    
    def _extract_patient_allergies(self, prefetch: Dict) -> List[Dict]:
        """Extract patient allergies from prefetch data"""
        allergies = []
        
        allergy_intolerances = prefetch.get('allergyIntolerances', {}).get('entry', [])
        for entry in allergy_intolerances:
            resource = entry.get('resource', {})
            if resource.get('clinicalStatus', {}).get('coding', [{}])[0].get('code') == 'active':
                allergen = resource.get('code', {})
                allergy_info = {
                    'allergen': allergen.get('text') or (allergen.get('coding', [{}])[0].get('display') if allergen.get('coding') else 'Unknown'),
                    'severity': resource.get('criticality', 'unknown'),
                    'reactions': [r.get('manifestation', [{}])[0].get('text', '') for r in resource.get('reaction', [])]
                }
                allergies.append(allergy_info)
        
        return allergies
    
    def _extract_patient_age(self, prefetch: Dict) -> Optional[int]:
        """Extract patient age from prefetch data"""
        patient_data = prefetch.get('patient', {})
        birth_date = patient_data.get('birthDate')
        
        if birth_date:
            from datetime import date
            today = date.today()
            birth = datetime.strptime(birth_date, '%Y-%m-%d').date()
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
            return age
        
        return None
    
    def _check_interactions(self, prescribed_med: str, current_meds: List[str]) -> List[Dict]:
        """Check for drug interactions"""
        interactions = []
        prescribed_lower = prescribed_med.lower()
        
        # Get interactions for the prescribed medication
        med_interactions = self.drug_interactions.get(prescribed_lower, [])
        
        for interaction in med_interactions:
            interacting_class = interaction['interacting_drug']
            
            # Check if any current medication matches the interacting class
            for current_med in current_meds:
                if self._medication_matches_class(current_med, interacting_class):
                    interactions.append({
                        'interacting_medication': current_med,
                        'severity': interaction['severity'],
                        'description': interaction['description'],
                        'recommendation': interaction['recommendation']
                    })
        
        return interactions
    
    def _check_allergies(self, prescribed_med: str, allergies: List[Dict]) -> List[Dict]:
        """Check for allergy contraindications"""
        alerts = []
        prescribed_lower = prescribed_med.lower()
        
        for allergy in allergies:
            allergen = allergy['allergen'].lower()
            
            # Check direct matches and known cross-reactions
            if self._medication_matches_allergen(prescribed_lower, allergen):
                alerts.append({
                    'allergen': allergy['allergen'],
                    'severity': allergy['severity'],
                    'description': f"Cross-reaction possible with documented {allergen} allergy",
                    'reactions': allergy['reactions']
                })
        
        return alerts
    
    def _medication_matches_class(self, medication: str, drug_class: str) -> bool:
        """Check if medication belongs to a drug class"""
        med_lower = medication.lower()
        
        class_mappings = {
            'nsaid': ['ibuprofen', 'naproxen', 'aspirin', 'diclofenac'],
            'ace_inhibitor': ['lisinopril', 'enalapril', 'captopril'],
            'beta_blocker': ['metoprolol', 'atenolol', 'propranolol'],
            'calcium_channel_blocker': ['amlodipine', 'nifedipine', 'diltiazem'],
            'qt_prolonging': ['azithromycin', 'ciprofloxacin', 'haloperidol'],
            'maoi': ['phenelzine', 'tranylcypromine', 'selegiline']
        }
        
        if drug_class in class_mappings:
            return any(med in med_lower for med in class_mappings[drug_class])
        
        return drug_class.lower() in med_lower
    
    def _medication_matches_allergen(self, medication: str, allergen: str) -> bool:
        """Check if medication matches an allergen"""
        # Direct name match
        if allergen in medication:
            return True
        
        # Check allergy mappings
        for allergy_class, medications in self.allergy_mappings.items():
            if allergy_class in allergen:
                return any(med in medication for med in medications)
        
        return False
    
    def _get_indicator_for_severity(self, severity: str) -> IndicatorType:
        """Get card indicator based on severity"""
        severity_map = {
            'contraindicated': IndicatorType.CRITICAL,
            'major': IndicatorType.CRITICAL,
            'moderate': IndicatorType.WARNING,
            'minor': IndicatorType.INFO
        }
        return severity_map.get(severity, IndicatorType.INFO)
    
    def _get_age_specific_guidance(self, medication: str, age: int) -> Optional[Dict]:
        """Get age-specific dosing guidance"""
        med_lower = medication.lower()
        
        if age < 18:
            # Pediatric guidance
            pediatric_alerts = {
                'aspirin': 'Avoid in children due to Reye syndrome risk',
                'ibuprofen': 'Use weight-based dosing. Avoid in infants <6 months',
                'amoxicillin': 'Use weight-based dosing: 20-40 mg/kg/day'
            }
            
            for med, alert in pediatric_alerts.items():
                if med in med_lower:
                    return {'message': f"Pediatric Alert: {alert}"}
        
        elif age >= 65:
            # Geriatric guidance
            geriatric_alerts = {
                'metformin': 'Monitor renal function closely in elderly patients',
                'lisinopril': 'Start with lower dose (5mg) in elderly patients',
                'ibuprofen': 'Use with caution due to increased GI and CV risk'
            }
            
            for med, alert in geriatric_alerts.items():
                if med in med_lower:
                    return {'message': f"Geriatric Alert: {alert}"}
        
        return None

# Create singleton instance
medication_prescribe_hooks = MedicationPrescribeHooks()