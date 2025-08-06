"""
Clinical Rules Library

Pre-defined clinical decision support rules for common scenarios.
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta
from .core import Rule, RuleCondition, RuleAction, RuleCategory, RulePriority, RuleSet


class ClinicalRulesLibrary:
    """Library of pre-defined clinical rules"""
    
    @staticmethod
    def create_medication_safety_rules() -> List[Rule]:
        """Create medication safety and drug interaction rules"""
        rules = []
        
        # Drug-Drug Interaction: Warfarin + NSAIDs
        rules.append(Rule(
            id="med_safety_001",
            name="Warfarin-NSAID Interaction",
            description="Alert for potential bleeding risk with warfarin and NSAIDs",
            category=RuleCategory.DRUG_INTERACTIONS,
            priority=RulePriority.HIGH,
            conditions=[
                RuleCondition(
                    field="activeMedications[].code",
                    operator="contains",
                    value="warfarin"
                ),
                RuleCondition(
                    field="newMedication.code",
                    operator="regex",
                    value="(ibuprofen|naproxen|diclofenac|celecoxib)"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="Drug Interaction Alert: Warfarin + NSAID",
                    detail="NSAIDs increase bleeding risk when taken with warfarin. Consider alternative pain management.",
                    indicator="warning",
                    suggestions=[{
                        "label": "Use acetaminophen instead",
                        "actions": [{
                            "type": "create",
                            "resource": {
                                "resourceType": "MedicationRequest",
                                "medicationCodeableConcept": {
                                    "coding": [{
                                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                                        "code": "161",
                                        "display": "Acetaminophen"
                                    }]
                                }
                            }
                        }]
                    }],
                    links=[{
                        "label": "Warfarin Drug Interactions",
                        "url": "https://www.uptodate.com/contents/warfarin-drug-interactions"
                    }]
                )
            ]
        ))
        
        # Renal Dosing for Metformin
        rules.append(Rule(
            id="med_safety_002",
            name="Metformin Renal Dosing",
            description="Check renal function before prescribing metformin",
            category=RuleCategory.MEDICATION_SAFETY,
            priority=RulePriority.HIGH,
            conditions=[
                RuleCondition(
                    field="newMedication.code",
                    operator="contains",
                    value="metformin"
                ),
                RuleCondition(
                    field="labResults.creatinine.value",
                    operator="gt",
                    value=1.5,
                    data_type="number"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="Renal Dosing Alert: Metformin",
                    detail="Patient has elevated creatinine. Metformin is contraindicated with eGFR < 30 mL/min.",
                    indicator="warning",
                    suggestions=[{
                        "label": "Calculate eGFR",
                        "actions": [{
                            "type": "external",
                            "url": "/clinical/calculators/egfr"
                        }]
                    }]
                )
            ]
        ))
        
        # Duplicate Therapy Check
        rules.append(Rule(
            id="med_safety_003",
            name="Duplicate Therapy Check",
            description="Alert for medications in the same therapeutic class",
            category=RuleCategory.MEDICATION_SAFETY,
            priority=RulePriority.MEDIUM,
            conditions=[
                RuleCondition(
                    field="activeMedications[].class",
                    operator="eq",
                    value="ACE_INHIBITOR"
                ),
                RuleCondition(
                    field="newMedication.class",
                    operator="eq",
                    value="ACE_INHIBITOR"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="Duplicate Therapy Alert",
                    detail="Patient is already on an ACE inhibitor. Adding another may increase risk of adverse effects.",
                    indicator="warning"
                )
            ]
        ))
        
        return rules
    
    @staticmethod
    def create_chronic_disease_rules() -> List[Rule]:
        """Create chronic disease management rules"""
        rules = []
        
        # Diabetes A1C Monitoring
        rules.append(Rule(
            id="dm_001",
            name="Diabetes A1C Monitoring",
            description="Remind to check A1C every 3-6 months for diabetic patients",
            category=RuleCategory.CHRONIC_DISEASE,
            priority=RulePriority.MEDIUM,
            conditions=[
                RuleCondition(
                    field="conditions[].code",
                    operator="regex",
                    value="E11.*"  # ICD-10 for Type 2 Diabetes
                ),
                RuleCondition(
                    field="labResults.a1c.date",
                    operator="lt",
                    value=(datetime.now() - timedelta(days=90)).isoformat(),
                    data_type="date"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="A1C Monitoring Due",
                    detail="Patient with diabetes has not had A1C checked in >3 months. ADA recommends checking every 3-6 months.",
                    indicator="info",
                    suggestions=[{
                        "label": "Order A1C test",
                        "actions": [{
                            "type": "create",
                            "resource": {
                                "resourceType": "ServiceRequest",
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
                )
            ]
        ))
        
        # Hypertension BP Goal
        rules.append(Rule(
            id="htn_001",
            name="Hypertension BP Goal Alert",
            description="Alert when BP is above goal for hypertensive patients",
            category=RuleCategory.CHRONIC_DISEASE,
            priority=RulePriority.MEDIUM,
            conditions=[
                RuleCondition(
                    field="conditions[].code",
                    operator="regex",
                    value="I10"  # Essential hypertension
                ),
                RuleCondition(
                    field="vitalSigns.systolicBP.value",
                    operator="gte",
                    value=140,
                    data_type="number"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="Blood Pressure Above Goal",
                    detail="Patient's BP is above goal (140/90). Consider medication adjustment or lifestyle counseling.",
                    indicator="warning",
                    links=[{
                        "label": "AHA Hypertension Guidelines",
                        "url": "https://www.heart.org/en/health-topics/high-blood-pressure"
                    }]
                )
            ]
        ))
        
        # Diabetes Eye Exam Reminder
        rules.append(Rule(
            id="dm_002",
            name="Annual Diabetic Eye Exam",
            description="Remind for annual eye exam in diabetic patients",
            category=RuleCategory.PREVENTIVE_CARE,
            priority=RulePriority.LOW,
            conditions=[
                RuleCondition(
                    field="conditions[].code",
                    operator="regex",
                    value="E11.*"
                ),
                RuleCondition(
                    field="procedures.eyeExam.date",
                    operator="lt",
                    value=(datetime.now() - timedelta(days=365)).isoformat(),
                    data_type="date"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="Annual Eye Exam Due",
                    detail="Diabetic patient is due for annual dilated eye exam to screen for retinopathy.",
                    indicator="info",
                    suggestions=[{
                        "label": "Refer to ophthalmology",
                        "actions": [{
                            "type": "create",
                            "resource": {
                                "resourceType": "ServiceRequest",
                                "code": {
                                    "text": "Ophthalmology referral - diabetic eye exam"
                                },
                                "reasonCode": [{
                                    "text": "Annual diabetic eye exam"
                                }]
                            }
                        }]
                    }]
                )
            ]
        ))
        
        return rules
    
    @staticmethod
    def create_preventive_care_rules() -> List[Rule]:
        """Create preventive care and screening rules"""
        rules = []
        
        # Flu Vaccine Reminder
        rules.append(Rule(
            id="prev_001",
            name="Annual Flu Vaccine",
            description="Remind for annual influenza vaccination",
            category=RuleCategory.PREVENTIVE_CARE,
            priority=RulePriority.LOW,
            conditions=[
                RuleCondition(
                    field="immunizations.influenza.date",
                    operator="lt",
                    value=(datetime.now() - timedelta(days=365)).isoformat(),
                    data_type="date"
                ),
                RuleCondition(
                    field="currentMonth",
                    operator="gte",
                    value=9,  # September or later
                    data_type="number"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="Flu Vaccine Due",
                    detail="Patient is due for annual influenza vaccination. CDC recommends yearly flu vaccine.",
                    indicator="info",
                    suggestions=[{
                        "label": "Order flu vaccine",
                        "actions": [{
                            "type": "create",
                            "resource": {
                                "resourceType": "Immunization",
                                "vaccineCode": {
                                    "coding": [{
                                        "system": "http://hl7.org/fhir/sid/cvx",
                                        "code": "140",
                                        "display": "Influenza, seasonal"
                                    }]
                                }
                            }
                        }]
                    }]
                )
            ]
        ))
        
        # Mammogram Screening
        rules.append(Rule(
            id="prev_002",
            name="Mammogram Screening",
            description="Breast cancer screening for women 50-74",
            category=RuleCategory.PREVENTIVE_CARE,
            priority=RulePriority.MEDIUM,
            conditions=[
                RuleCondition(
                    field="patient.gender",
                    operator="eq",
                    value="female"
                ),
                RuleCondition(
                    field="patient.age",
                    operator="gte",
                    value=50,
                    data_type="number"
                ),
                RuleCondition(
                    field="patient.age",
                    operator="lte",
                    value=74,
                    data_type="number"
                ),
                RuleCondition(
                    field="procedures.mammogram.date",
                    operator="lt",
                    value=(datetime.now() - timedelta(days=730)).isoformat(),  # 2 years
                    data_type="date"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="Mammogram Screening Due",
                    detail="Patient is due for breast cancer screening. USPSTF recommends mammogram every 2 years for women 50-74.",
                    indicator="info",
                    suggestions=[{
                        "label": "Order mammogram",
                        "actions": [{
                            "type": "create",
                            "resource": {
                                "resourceType": "ServiceRequest",
                                "code": {
                                    "coding": [{
                                        "system": "http://loinc.org",
                                        "code": "24606-6",
                                        "display": "Mammogram"
                                    }]
                                }
                            }
                        }]
                    }]
                )
            ]
        ))
        
        return rules
    
    @staticmethod
    def create_lab_monitoring_rules() -> List[Rule]:
        """Create laboratory monitoring rules"""
        rules = []
        
        # Statin Therapy LFT Monitoring
        rules.append(Rule(
            id="lab_001",
            name="Statin LFT Monitoring",
            description="Monitor liver function in patients on statin therapy",
            category=RuleCategory.LAB_MONITORING,
            priority=RulePriority.MEDIUM,
            conditions=[
                RuleCondition(
                    field="activeMedications[].class",
                    operator="eq",
                    value="STATIN"
                ),
                RuleCondition(
                    field="labResults.alt.date",
                    operator="lt",
                    value=(datetime.now() - timedelta(days=180)).isoformat(),  # 6 months
                    data_type="date"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="Liver Function Monitoring Due",
                    detail="Patient on statin therapy needs liver function monitoring. Consider checking ALT/AST.",
                    indicator="info",
                    suggestions=[{
                        "label": "Order liver function panel",
                        "actions": [{
                            "type": "create",
                            "resource": {
                                "resourceType": "ServiceRequest",
                                "code": {
                                    "coding": [{
                                        "system": "http://loinc.org",
                                        "code": "24325-3",
                                        "display": "Hepatic function panel"
                                    }]
                                }
                            }
                        }]
                    }]
                )
            ]
        ))
        
        # Warfarin INR Monitoring
        rules.append(Rule(
            id="lab_002",
            name="Warfarin INR Monitoring",
            description="Monitor INR for patients on warfarin",
            category=RuleCategory.LAB_MONITORING,
            priority=RulePriority.HIGH,
            conditions=[
                RuleCondition(
                    field="activeMedications[].code",
                    operator="contains",
                    value="warfarin"
                ),
                RuleCondition(
                    field="labResults.inr.date",
                    operator="lt",
                    value=(datetime.now() - timedelta(days=30)).isoformat(),  # 1 month
                    data_type="date"
                )
            ],
            actions=[
                RuleAction(
                    type="card",
                    summary="INR Monitoring Due",
                    detail="Patient on warfarin needs INR monitoring. INR should be checked at least monthly.",
                    indicator="warning",
                    suggestions=[{
                        "label": "Order INR test",
                        "actions": [{
                            "type": "create",
                            "resource": {
                                "resourceType": "ServiceRequest",
                                "code": {
                                    "coding": [{
                                        "system": "http://loinc.org",
                                        "code": "6301-6",
                                        "display": "INR"
                                    }]
                                }
                            }
                        }]
                    }]
                )
            ]
        ))
        
        return rules
    
    @staticmethod
    def load_all_rules() -> Dict[str, RuleSet]:
        """Load all pre-defined rules into rule sets"""
        rule_sets = {}
        
        # Medication Safety Rules
        med_safety_set = RuleSet("medication_safety")
        for rule in ClinicalRulesLibrary.create_medication_safety_rules():
            med_safety_set.add_rule(rule)
        rule_sets["medication_safety"] = med_safety_set
        
        # Chronic Disease Management Rules
        chronic_disease_set = RuleSet("chronic_disease_management")
        for rule in ClinicalRulesLibrary.create_chronic_disease_rules():
            chronic_disease_set.add_rule(rule)
        rule_sets["chronic_disease_management"] = chronic_disease_set
        
        # Preventive Care Rules
        preventive_care_set = RuleSet("preventive_care")
        for rule in ClinicalRulesLibrary.create_preventive_care_rules():
            preventive_care_set.add_rule(rule)
        rule_sets["preventive_care"] = preventive_care_set
        
        # Lab Monitoring Rules
        lab_monitoring_set = RuleSet("lab_monitoring")
        for rule in ClinicalRulesLibrary.create_lab_monitoring_rules():
            lab_monitoring_set.add_rule(rule)
        rule_sets["lab_monitoring"] = lab_monitoring_set
        
        return rule_sets