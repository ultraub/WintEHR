"""
CQL Translation Engine for EMR System
Translates CQL expressions to SQL queries compatible with the current database schema
"""

import re
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
from sqlalchemy import and_, or_, func, case, text
from sqlalchemy.orm import Session, Query

from models.patient import Patient
from models.condition import Condition
from models.observation import Observation
from models.medication_request import MedicationRequest
from models.encounter import Encounter
from models.practitioner import Practitioner


class CQLTranslationEngine:
    """Translates CQL expressions to SQLAlchemy queries"""
    
    def __init__(self, session: Session):
        self.session = session
        self.context = {}
        self.value_sets = self._load_value_sets()
        
    def _load_value_sets(self) -> Dict[str, List[str]]:
        """Load predefined value sets for common clinical concepts"""
        return {
            # Diabetes value sets
            "diabetes_conditions": ["E11", "E10", "E13", "E11.9", "E10.9"],
            "hba1c_codes": ["4548-4", "4549-2", "17856-6", "59261-8"],
            "glucose_codes": ["2339-0", "2345-7", "1558-6"],
            
            # Hypertension value sets
            "hypertension_conditions": ["I10", "I11", "I12", "I13", "I15"],
            "bp_systolic_codes": ["8480-6"],
            "bp_diastolic_codes": ["8462-4"],
            
            # Medications
            "diabetes_medications": ["metformin", "insulin", "glipizide", "glyburide"],
            "ace_inhibitors": ["lisinopril", "enalapril", "ramipril", "captopril"],
            "statins": ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin"],
            
            # Preventive care
            "mammography_codes": ["24606-6", "26349-0", "26287-2"],
            "colonoscopy_codes": ["34120-2", "19774-9"],
            "flu_vaccine_codes": ["88290-7", "82593-5"],
        }
    
    def parse_cql(self, cql_content: str) -> Dict[str, Any]:
        """Parse CQL content and extract key components"""
        parsed = {
            "library": None,
            "using": [],
            "includes": [],
            "value_sets": [],
            "parameters": [],
            "contexts": [],
            "definitions": []
        }
        
        # Extract library name
        library_match = re.search(r'library\s+(\w+)\s+version\s+[\'"]([^\'\"]+)[\'"]', cql_content)
        if library_match:
            parsed["library"] = {
                "name": library_match.group(1),
                "version": library_match.group(2)
            }
        
        # Extract using statements
        using_matches = re.findall(r'using\s+(\w+)\s+version\s+[\'"]([^\'\"]+)[\'"]', cql_content)
        parsed["using"] = [{"model": m[0], "version": m[1]} for m in using_matches]
        
        # Extract context
        context_match = re.search(r'context\s+(\w+)', cql_content)
        if context_match:
            parsed["contexts"].append(context_match.group(1))
        
        # Extract define statements
        define_pattern = r'define\s+"?(\w+)"?:\s*([^;]+);?'
        define_matches = re.findall(define_pattern, cql_content, re.MULTILINE | re.DOTALL)
        
        for name, expression in define_matches:
            parsed["definitions"].append({
                "name": name,
                "expression": expression.strip()
            })
        
        return parsed
    
    def translate_expression(self, expression: str, context: Dict[str, Any]) -> Query:
        """Translate a CQL expression to a SQLAlchemy query"""
        expression = expression.strip()
        
        # Handle patient context
        if expression.startswith("["):
            return self._translate_retrieve(expression, context)
        
        # Handle exists
        if expression.startswith("exists"):
            inner_expr = re.search(r'exists\s*\((.*)\)', expression, re.DOTALL)
            if inner_expr:
                subquery = self.translate_expression(inner_expr.group(1), context)
                return subquery.exists()
        
        # Handle where clause
        if " where " in expression:
            parts = expression.split(" where ", 1)
            base_query = self.translate_expression(parts[0], context)
            condition = self._translate_condition(parts[1], context)
            return base_query.filter(condition)
        
        # Handle simple references
        if expression in context:
            return context[expression]
        
        return None
    
    def _translate_retrieve(self, expression: str, context: Dict[str, Any]) -> Query:
        """Translate a CQL retrieve expression like [Condition: "Diabetes"]"""
        # Parse the retrieve expression
        match = re.match(r'\[(\w+)(?::\s*"([^"]+)")?\]', expression)
        if not match:
            return None
        
        resource_type = match.group(1)
        value_set = match.group(2)
        
        # Get the appropriate model and query
        if resource_type == "Condition":
            query = self.session.query(Condition)
            if context.get("patient_id"):
                query = query.filter(Condition.patient_id == context["patient_id"])
            if value_set and value_set.lower() in self.value_sets:
                codes = self.value_sets[value_set.lower() + "_conditions"]
                query = query.filter(
                    or_(*[Condition.code.like(f"{code}%") for code in codes])
                )
            return query
            
        elif resource_type == "Observation":
            query = self.session.query(Observation)
            if context.get("patient_id"):
                query = query.filter(Observation.patient_id == context["patient_id"])
            if value_set and value_set.lower() + "_codes" in self.value_sets:
                codes = self.value_sets[value_set.lower() + "_codes"]
                query = query.filter(Observation.code.in_(codes))
            return query
            
        elif resource_type == "MedicationRequest":
            query = self.session.query(MedicationRequest)
            if context.get("patient_id"):
                query = query.filter(MedicationRequest.patient_id == context["patient_id"])
            if value_set and value_set.lower() in self.value_sets:
                meds = self.value_sets[value_set.lower()]
                query = query.filter(
                    or_(*[MedicationRequest.medication_name.ilike(f"%{med}%") for med in meds])
                )
            return query
            
        elif resource_type == "Patient":
            query = self.session.query(Patient)
            if context.get("patient_id"):
                query = query.filter(Patient.id == context["patient_id"])
            return query
            
        return None
    
    def _translate_condition(self, condition: str, context: Dict[str, Any]):
        """Translate a CQL condition to SQLAlchemy filter"""
        # Handle date comparisons
        date_match = re.match(r'(\w+)\.(\w+)\s*(>=?|<=?|=)\s*(.+)', condition)
        if date_match:
            alias = date_match.group(1)
            field = date_match.group(2)
            operator = date_match.group(3)
            value = date_match.group(4)
            
            # Resolve the field reference
            if field == "onset" or field == "recordedDate":
                field_ref = Condition.onset_date
            elif field == "effectiveDateTime":
                field_ref = Observation.effective_date
            elif field == "authoredOn":
                field_ref = MedicationRequest.authored_on
            else:
                return None
            
            # Parse the date value
            if "Today()" in value:
                days_match = re.search(r'Today\(\)\s*-\s*(\d+)\s*days', value)
                if days_match:
                    days = int(days_match.group(1))
                    date_value = datetime.now() - timedelta(days=days)
                else:
                    date_value = datetime.now()
            else:
                # Try to parse as date string
                date_value = datetime.strptime(value.strip("'\""), "%Y-%m-%d")
            
            # Apply the operator
            if operator == ">=":
                return field_ref >= date_value
            elif operator == "<=":
                return field_ref <= date_value
            elif operator == ">":
                return field_ref > date_value
            elif operator == "<":
                return field_ref < date_value
            elif operator == "=":
                return field_ref == date_value
        
        return None
    
    def execute_measure(self, measure_cql: str, patient_id: Optional[int] = None) -> Dict[str, Any]:
        """Execute a CQL measure and return results"""
        parsed = self.parse_cql(measure_cql)
        results = {}
        context = {"patient_id": patient_id} if patient_id else {}
        
        # Execute each definition
        for definition in parsed["definitions"]:
            name = definition["name"]
            expression = definition["expression"]
            
            # Skip measure metadata definitions
            if name in ["Measure", "Patient"]:
                continue
            
            # Translate and execute the expression
            if name == "InitialPopulation":
                query = self.translate_expression(expression, context)
                if query:
                    if patient_id:
                        results[name] = query.count() > 0
                    else:
                        results[name] = [p.id for p in query.all()]
                        
            elif name == "Denominator":
                # Usually same as initial population
                if "InitialPopulation" in results:
                    results[name] = results["InitialPopulation"]
                    
            elif name == "Numerator":
                # Execute the numerator logic
                query = self.translate_expression(expression, context)
                if query:
                    if patient_id:
                        results[name] = query.count() > 0
                    else:
                        # Get list of qualifying patients
                        numerator_patients = []
                        if isinstance(results.get("InitialPopulation"), list):
                            for pid in results["InitialPopulation"]:
                                context["patient_id"] = pid
                                subquery = self.translate_expression(expression, context)
                                if subquery and subquery.count() > 0:
                                    numerator_patients.append(pid)
                        results[name] = numerator_patients
        
        # Calculate measure score if applicable
        if "Denominator" in results and "Numerator" in results:
            if isinstance(results["Denominator"], list):
                denom_count = len(results["Denominator"])
                num_count = len(results["Numerator"])
                results["MeasureScore"] = (num_count / denom_count * 100) if denom_count > 0 else 0
            else:
                results["MeasureScore"] = 100 if results["Numerator"] else 0
        
        return results
    
    def get_value_set(self, name: str) -> List[str]:
        """Get codes for a named value set"""
        return self.value_sets.get(name.lower(), [])
    
    def add_value_set(self, name: str, codes: List[str]):
        """Add or update a value set"""
        self.value_sets[name.lower()] = codes


class SimplifiedCQLExecutor:
    """
    Simplified CQL executor that works directly with the current schema
    Focuses on common quality measure patterns
    """
    
    def __init__(self, session: Session):
        self.session = session
        self.engine = CQLTranslationEngine(session)
    
    def execute_diabetes_control_measure(self) -> Dict[str, Any]:
        """Execute diabetes control measure"""
        # Initial Population: Patients with diabetes
        diabetes_patients = self.session.query(Patient).join(Condition).filter(
            or_(
                Condition.code.like('E11%'),
                Condition.code.like('E10%'),
                Condition.code.like('E13%')
            ),
            Condition.status == 'active'
        ).distinct().all()
        
        initial_pop = [p.id for p in diabetes_patients]
        
        # Numerator: Patients with HbA1c < 9% in last year
        numerator_patients = []
        for patient_id in initial_pop:
            latest_hba1c = self.session.query(Observation).filter(
                Observation.patient_id == patient_id,
                Observation.code.in_(['4548-4', '4549-2', '17856-6']),
                Observation.effective_date >= datetime.now() - timedelta(days=365)
            ).order_by(Observation.effective_date.desc()).first()
            
            if latest_hba1c and latest_hba1c.value_quantity < 9.0:
                numerator_patients.append(patient_id)
        
        return {
            "measureId": "DiabetesHbA1cControl",
            "initialPopulation": len(initial_pop),
            "denominator": len(initial_pop),
            "numerator": len(numerator_patients),
            "measureScore": (len(numerator_patients) / len(initial_pop) * 100) if initial_pop else 0,
            "patients": {
                "initialPopulation": initial_pop,
                "numerator": numerator_patients
            }
        }
    
    def execute_preventive_screening_measure(self, screening_type: str) -> Dict[str, Any]:
        """Execute preventive screening measures"""
        if screening_type == "mammography":
            # Women 50-74 years old
            min_birth = datetime.now() - timedelta(days=74*365)
            max_birth = datetime.now() - timedelta(days=50*365)
            
            eligible_patients = self.session.query(Patient).filter(
                Patient.gender == 'female',
                Patient.date_of_birth.between(min_birth, max_birth),
                Patient.is_active == True
            ).all()
            
            screening_codes = ['24606-6', '26349-0', '26287-2']
            lookback_days = 730  # 2 years
            
        elif screening_type == "colonoscopy":
            # Adults 50-75 years old
            min_birth = datetime.now() - timedelta(days=75*365)
            max_birth = datetime.now() - timedelta(days=50*365)
            
            eligible_patients = self.session.query(Patient).filter(
                Patient.date_of_birth.between(min_birth, max_birth),
                Patient.is_active == True
            ).all()
            
            screening_codes = ['34120-2', '19774-9']
            lookback_days = 3650  # 10 years
        
        else:
            return {"error": "Unknown screening type"}
        
        initial_pop = [p.id for p in eligible_patients]
        
        # Find patients with screening in lookback period
        screened_patients = []
        for patient_id in initial_pop:
            screening = self.session.query(Observation).filter(
                Observation.patient_id == patient_id,
                Observation.code.in_(screening_codes),
                Observation.effective_date >= datetime.now() - timedelta(days=lookback_days)
            ).first()
            
            if screening:
                screened_patients.append(patient_id)
        
        return {
            "measureId": f"PreventiveScreening_{screening_type}",
            "initialPopulation": len(initial_pop),
            "denominator": len(initial_pop),
            "numerator": len(screened_patients),
            "measureScore": (len(screened_patients) / len(initial_pop) * 100) if initial_pop else 0,
            "patients": {
                "initialPopulation": initial_pop,
                "numerator": screened_patients
            }
        }