"""
Clinical Scenario Simulation Engine
Provides guided clinical workflows and educational scenarios
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from enum import Enum
import uuid
import random
from sqlalchemy.orm import Session

from models.models import Patient, Encounter, Observation, Condition, Medication
from database import get_db_session as get_db


class ScenarioType(str, Enum):
    DIABETES_MANAGEMENT = "diabetes_management"
    HYPERTENSION_CRISIS = "hypertension_crisis"
    ACUTE_MI = "acute_mi"
    SEPSIS_PROTOCOL = "sepsis_protocol"
    MEDICATION_RECONCILIATION = "med_reconciliation"
    QUALITY_MEASURES = "quality_measures"
    POPULATION_HEALTH = "population_health"


class ScenarioStep:
    def __init__(self, step_id: str, title: str, description: str, 
                 learning_objectives: List[str], actions: List[Dict[str, Any]],
                 expected_outcomes: List[str], hints: List[str] = None):
        self.step_id = step_id
        self.title = title
        self.description = description
        self.learning_objectives = learning_objectives
        self.actions = actions  # Actions student should take
        self.expected_outcomes = expected_outcomes
        self.hints = hints or []
        self.completed = False
        self.timestamp = None


class ClinicalScenario:
    def __init__(self, scenario_id: str, title: str, description: str,
                 scenario_type: ScenarioType, difficulty: str,
                 estimated_time: int, learning_objectives: List[str]):
        self.scenario_id = scenario_id
        self.title = title
        self.description = description
        self.scenario_type = scenario_type
        self.difficulty = difficulty  # beginner, intermediate, advanced
        self.estimated_time = estimated_time  # minutes
        self.learning_objectives = learning_objectives
        self.steps: List[ScenarioStep] = []
        self.current_step = 0
        self.started_at = None
        self.completed_at = None
        self.patient_id = None
        
    def add_step(self, step: ScenarioStep):
        self.steps.append(step)
    
    def get_current_step(self) -> Optional[ScenarioStep]:
        if self.current_step < len(self.steps):
            return self.steps[self.current_step]
        return None
    
    def advance_step(self):
        if self.current_step < len(self.steps):
            self.steps[self.current_step].completed = True
            self.steps[self.current_step].timestamp = datetime.now()
            self.current_step += 1
    
    def is_completed(self) -> bool:
        return self.current_step >= len(self.steps)


class ScenarioEngine:
    """Clinical scenario simulation engine for educational purposes"""
    
    def __init__(self):
        self.scenarios = {}
        self.active_sessions = {}
        self._initialize_scenarios()
    
    def _initialize_scenarios(self):
        """Initialize predefined clinical scenarios"""
        # Diabetes Management Scenario
        diabetes_scenario = ClinicalScenario(
            scenario_id="diabetes_mgmt_001",
            title="Diabetes Management: A1C Goal Achievement",
            description="Learn to manage a patient with poorly controlled Type 2 diabetes",
            scenario_type=ScenarioType.DIABETES_MANAGEMENT,
            difficulty="intermediate",
            estimated_time=45,
            learning_objectives=[
                "Interpret A1C results and diabetes control",
                "Apply ADA guidelines for medication management",
                "Understand diabetes complications screening",
                "Use clinical decision support tools"
            ]
        )
        
        # Step 1: Patient Assessment
        diabetes_scenario.add_step(ScenarioStep(
            step_id="assess_patient",
            title="Initial Patient Assessment",
            description="Review patient John Smith's clinical data and identify diabetes control issues",
            learning_objectives=[
                "Review patient demographics and medical history",
                "Analyze current diabetes medications",
                "Assess recent lab results and A1C trends"
            ],
            actions=[
                {"type": "navigate", "target": "patient_detail", "description": "Open patient chart"},
                {"type": "review", "target": "lab_results", "description": "Review recent A1C and glucose levels"},
                {"type": "review", "target": "medications", "description": "Check current diabetes medications"}
            ],
            expected_outcomes=[
                "Identify A1C > 9% indicating poor control",
                "Note patient on metformin monotherapy",
                "Recognize need for therapy intensification"
            ],
            hints=[
                "Look for the most recent A1C result in lab values",
                "Check if patient is on maximum metformin dose",
                "Consider ADA guidelines for A1C targets"
            ]
        ))
        
        # Step 2: Clinical Decision Support
        diabetes_scenario.add_step(ScenarioStep(
            step_id="use_cds",
            title="Apply Clinical Decision Support",
            description="Use the CDS Hooks system to get diabetes management recommendations",
            learning_objectives=[
                "Understand how CDS Hooks work in clinical practice",
                "Interpret clinical recommendations",
                "Apply evidence-based guidelines"
            ],
            actions=[
                {"type": "navigate", "target": "cds_demo", "description": "Go to CDS Demo page"},
                {"type": "select", "target": "patient", "description": "Select the diabetes patient"},
                {"type": "execute", "target": "diabetes_service", "description": "Run diabetes management CDS service"}
            ],
            expected_outcomes=[
                "CDS system recommends therapy intensification",
                "Suggestions include adding basal insulin",
                "Alerts about annual screening needs"
            ]
        ))
        
        # Step 3: Treatment Plan
        diabetes_scenario.add_step(ScenarioStep(
            step_id="treatment_plan",
            title="Develop Treatment Plan",
            description="Create a comprehensive treatment plan based on assessment and CDS recommendations",
            learning_objectives=[
                "Apply diabetes medication algorithms",
                "Consider patient-specific factors",
                "Plan appropriate monitoring"
            ],
            actions=[
                {"type": "prescribe", "target": "insulin", "description": "Add basal insulin to regimen"},
                {"type": "order", "target": "labs", "description": "Order follow-up A1C in 3 months"},
                {"type": "schedule", "target": "follow_up", "description": "Schedule diabetes follow-up visit"}
            ],
            expected_outcomes=[
                "Appropriate insulin dose selected",
                "Follow-up monitoring planned",
                "Patient education needs identified"
            ]
        ))
        
        self.scenarios[diabetes_scenario.scenario_id] = diabetes_scenario
        
        # Hypertensive Crisis Scenario
        htn_crisis = ClinicalScenario(
            scenario_id="htn_crisis_001",
            title="Hypertensive Crisis Management",
            description="Manage a patient presenting with severely elevated blood pressure",
            scenario_type=ScenarioType.HYPERTENSION_CRISIS,
            difficulty="advanced",
            estimated_time=30,
            learning_objectives=[
                "Distinguish hypertensive urgency from emergency",
                "Apply appropriate treatment protocols",
                "Understand target BP reduction rates",
                "Recognize end-organ damage"
            ]
        )
        
        htn_crisis.add_step(ScenarioStep(
            step_id="triage_assessment",
            title="Emergency Triage Assessment",
            description="Rapidly assess patient with BP 220/120 for end-organ damage",
            learning_objectives=[
                "Prioritize hypertensive crisis evaluation",
                "Assess for target organ damage",
                "Determine urgency vs emergency"
            ],
            actions=[
                {"type": "review", "target": "vital_signs", "description": "Check current vital signs"},
                {"type": "assess", "target": "symptoms", "description": "Evaluate neurological symptoms"},
                {"type": "order", "target": "urgent_labs", "description": "Order stat labs and ECG"}
            ],
            expected_outcomes=[
                "Identify severely elevated BP",
                "Rule out acute end-organ damage",
                "Classify as urgency vs emergency"
            ]
        ))
        
        self.scenarios[htn_crisis.scenario_id] = htn_crisis
        
        # Quality Measures Scenario
        quality_scenario = ClinicalScenario(
            scenario_id="quality_measures_001",
            title="Clinical Quality Measures Assessment",
            description="Learn to identify and improve clinical quality metrics",
            scenario_type=ScenarioType.QUALITY_MEASURES,
            difficulty="intermediate",
            estimated_time=60,
            learning_objectives=[
                "Understand HEDIS and CMS quality measures",
                "Identify care gaps in patient populations",
                "Use data analytics for quality improvement",
                "Implement systematic interventions"
            ]
        )
        
        quality_scenario.add_step(ScenarioStep(
            step_id="analyze_population",
            title="Population Health Analysis",
            description="Analyze diabetes care quality across the patient population",
            learning_objectives=[
                "Use population analytics tools",
                "Identify quality measure performance",
                "Find opportunities for improvement"
            ],
            actions=[
                {"type": "navigate", "target": "analytics", "description": "Access population health dashboard"},
                {"type": "filter", "target": "diabetes_patients", "description": "Filter for diabetes patients"},
                {"type": "analyze", "target": "quality_metrics", "description": "Review quality measure performance"}
            ],
            expected_outcomes=[
                "Identify diabetes A1C control rates",
                "Find patients overdue for screening",
                "Prioritize intervention opportunities"
            ]
        ))
        
        self.scenarios[quality_scenario.scenario_id] = quality_scenario
    
    def get_available_scenarios(self) -> List[Dict[str, Any]]:
        """Get list of available scenarios"""
        return [
            {
                "scenario_id": scenario.scenario_id,
                "title": scenario.title,
                "description": scenario.description,
                "difficulty": scenario.difficulty,
                "estimated_time": scenario.estimated_time,
                "learning_objectives": scenario.learning_objectives,
                "step_count": len(scenario.steps)
            }
            for scenario in self.scenarios.values()
        ]
    
    def start_scenario(self, scenario_id: str, user_id: str, db: Session) -> Dict[str, Any]:
        """Start a clinical scenario for a user"""
        if scenario_id not in self.scenarios:
            raise ValueError(f"Scenario {scenario_id} not found")
        
        scenario = self.scenarios[scenario_id]
        
        # Create a copy for this session
        session_scenario = ClinicalScenario(
            scenario.scenario_id,
            scenario.title,
            scenario.description,
            scenario.scenario_type,
            scenario.difficulty,
            scenario.estimated_time,
            scenario.learning_objectives.copy()
        )
        
        # Copy steps
        for step in scenario.steps:
            session_scenario.add_step(ScenarioStep(
                step.step_id,
                step.title,
                step.description,
                step.learning_objectives.copy(),
                step.actions.copy(),
                step.expected_outcomes.copy(),
                step.hints.copy()
            ))
        
        session_scenario.started_at = datetime.now()
        
        # Assign appropriate patient based on scenario type
        session_scenario.patient_id = self._assign_scenario_patient(scenario.scenario_type, db)
        
        # Store active session
        session_id = str(uuid.uuid4())
        self.active_sessions[session_id] = {
            "user_id": user_id,
            "scenario": session_scenario,
            "session_id": session_id
        }
        
        return {
            "session_id": session_id,
            "scenario": self._serialize_scenario(session_scenario),
            "current_step": session_scenario.get_current_step().__dict__ if session_scenario.get_current_step() else None
        }
    
    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Get current status of a scenario session"""
        if session_id not in self.active_sessions:
            raise ValueError(f"Session {session_id} not found")
        
        session = self.active_sessions[session_id]
        scenario = session["scenario"]
        
        return {
            "session_id": session_id,
            "scenario": self._serialize_scenario(scenario),
            "current_step": scenario.get_current_step().__dict__ if scenario.get_current_step() else None,
            "progress": {
                "current_step": scenario.current_step,
                "total_steps": len(scenario.steps),
                "completed_steps": scenario.current_step,
                "percent_complete": (scenario.current_step / len(scenario.steps)) * 100
            }
        }
    
    def complete_step(self, session_id: str, step_id: str, user_actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Mark a scenario step as completed"""
        if session_id not in self.active_sessions:
            raise ValueError(f"Session {session_id} not found")
        
        session = self.active_sessions[session_id]
        scenario = session["scenario"]
        current_step = scenario.get_current_step()
        
        if not current_step or current_step.step_id != step_id:
            raise ValueError(f"Step {step_id} is not the current step")
        
        # Validate user actions (simplified for demo)
        # In a real implementation, this would check if actions meet step requirements
        
        scenario.advance_step()
        
        if scenario.is_completed():
            scenario.completed_at = datetime.now()
        
        return self.get_session_status(session_id)
    
    def get_scenario_analytics(self, scenario_id: str) -> Dict[str, Any]:
        """Get analytics for a specific scenario"""
        # This would typically query a database of completed sessions
        # For demo, return mock analytics
        return {
            "scenario_id": scenario_id,
            "total_attempts": random.randint(50, 200),
            "completion_rate": random.uniform(0.7, 0.95),
            "average_time": random.randint(20, 90),
            "common_mistakes": [
                "Skipping initial assessment",
                "Not using CDS recommendations",
                "Incorrect medication dosing"
            ],
            "learning_outcomes": {
                "knowledge_retention": random.uniform(0.8, 0.95),
                "skill_application": random.uniform(0.75, 0.9),
                "confidence_improvement": random.uniform(0.6, 0.85)
            }
        }
    
    def _assign_scenario_patient(self, scenario_type: ScenarioType, db: Session) -> str:
        """Assign appropriate patient for scenario type"""
        # Find patients with relevant conditions
        if scenario_type == ScenarioType.DIABETES_MANAGEMENT:
            # Find patient with diabetes
            diabetes_condition = db.query(Condition).filter(
                Condition.icd10_code.like("E11%")
            ).first()
            if diabetes_condition:
                return diabetes_condition.patient_id
        
        elif scenario_type == ScenarioType.HYPERTENSION_CRISIS:
            # Find patient with hypertension
            htn_condition = db.query(Condition).filter(
                Condition.icd10_code == "I10"
            ).first()
            if htn_condition:
                return htn_condition.patient_id
        
        # Default to first patient
        first_patient = db.query(Patient).first()
        return first_patient.id if first_patient else None
    
    def _serialize_scenario(self, scenario: ClinicalScenario) -> Dict[str, Any]:
        """Serialize scenario for JSON response"""
        return {
            "scenario_id": scenario.scenario_id,
            "title": scenario.title,
            "description": scenario.description,
            "difficulty": scenario.difficulty,
            "estimated_time": scenario.estimated_time,
            "learning_objectives": scenario.learning_objectives,
            "current_step": scenario.current_step,
            "total_steps": len(scenario.steps),
            "started_at": scenario.started_at.isoformat() if scenario.started_at else None,
            "completed_at": scenario.completed_at.isoformat() if scenario.completed_at else None,
            "patient_id": scenario.patient_id,
            "is_completed": scenario.is_completed()
        }


# Global scenario engine instance
scenario_engine = ScenarioEngine()