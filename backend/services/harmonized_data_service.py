"""
Harmonized Data Service
Provides consistent data access patterns across the EMR system
Ensures all APIs use models consistently and completely
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import and_, or_, desc, asc, func
from sqlalchemy.exc import SQLAlchemyError

from models.models import (
    Patient, Provider, Organization, Encounter, Condition, 
    Medication, Observation, Procedure, Immunization, Allergy,
    CarePlan, Payer, Claim, Device, DiagnosticReport, ImagingStudy
)
from models.clinical.catalogs import MedicationCatalog, LabTestCatalog, ImagingStudyCatalog
from models.clinical.notes import ClinicalNote
from models.clinical.orders import Order
from models.clinical.tasks import ClinicalTask, InboxItem

class HarmonizedDataService:
    """Centralized service for consistent data access across EMR"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    # Patient Services
    def get_patient_comprehensive(self, patient_id: str) -> Optional[Patient]:
        """Get patient with all related data loaded efficiently"""
        return self.db.query(Patient).options(
            selectinload(Patient.encounters).selectinload(Encounter.provider),
            selectinload(Patient.conditions),
            selectinload(Patient.medications),
            selectinload(Patient.observations),
            selectinload(Patient.procedures),
            selectinload(Patient.immunizations),
            selectinload(Patient.allergies),
            selectinload(Patient.careplans)
        ).filter(Patient.id == patient_id).first()
    
    def search_patients(
        self, 
        search_term: str = None,
        provider_id: str = None,
        age_min: int = None,
        age_max: int = None,
        gender: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Patient]:
        """Comprehensive patient search with filtering"""
        query = self.db.query(Patient)
        
        if search_term:
            search_filter = or_(
                func.lower(Patient.first_name).contains(search_term.lower()),
                func.lower(Patient.last_name).contains(search_term.lower()),
                Patient.mrn.contains(search_term),
                Patient.ssn.contains(search_term)
            )
            query = query.filter(search_filter)
        
        if provider_id:
            # Join with patient-provider assignments
            from models.session import PatientProviderAssignment
            query = query.join(PatientProviderAssignment).filter(
                PatientProviderAssignment.provider_id == provider_id
            )
        
        if age_min or age_max:
            today = date.today()
            if age_min:
                max_birth_date = date(today.year - age_min, today.month, today.day)
                query = query.filter(Patient.date_of_birth <= max_birth_date)
            if age_max:
                min_birth_date = date(today.year - age_max, today.month, today.day)
                query = query.filter(Patient.date_of_birth >= min_birth_date)
        
        if gender:
            query = query.filter(Patient.gender == gender)
        
        return query.order_by(Patient.last_name, Patient.first_name)\
                   .offset(offset).limit(limit).all()
    
    def get_patient_summary(self, patient_id: str) -> Dict[str, Any]:
        """Get comprehensive patient summary for clinical use"""
        patient = self.get_patient_comprehensive(patient_id)
        if not patient:
            return {}
        
        # Calculate age
        today = date.today()
        age = today.year - patient.date_of_birth.year
        if today.month < patient.date_of_birth.month or \
           (today.month == patient.date_of_birth.month and today.day < patient.date_of_birth.day):
            age -= 1
        
        # Get latest vital signs
        latest_vitals = self.get_latest_vital_signs(patient_id)
        
        # Get active conditions
        active_conditions = self.db.query(Condition).filter(
            and_(
                Condition.patient_id == patient_id,
                Condition.clinical_status == "active"
            )
        ).all()
        
        # Get active medications
        active_medications = self.db.query(Medication).filter(
            and_(
                Medication.patient_id == patient_id,
                Medication.status == "active"
            )
        ).all()
        
        # Get allergies
        allergies = self.db.query(Allergy).filter(
            and_(
                Allergy.patient_id == patient_id,
                Allergy.clinical_status == "active"
            )
        ).all()
        
        return {
            "patient": {
                "id": patient.id,
                "name": f"{patient.first_name} {patient.last_name}",
                "mrn": patient.mrn,
                "dob": patient.date_of_birth.isoformat(),
                "age": age,
                "gender": patient.gender,
                "address": patient.address,
                "city": patient.city,
                "state": patient.state,
                "phone": patient.phone,
                "email": patient.email
            },
            "vitals": latest_vitals,
            "conditions": [
                {
                    "id": c.id,
                    "name": c.condition_name,
                    "code": c.snomed_code,
                    "onset": c.onset_date.isoformat() if c.onset_date else None,
                    "status": c.clinical_status
                } for c in active_conditions
            ],
            "medications": [
                {
                    "id": m.id,
                    "name": m.medication_name,
                    "dosage": m.dosage,
                    "status": m.status,
                    "start_date": m.start_date.isoformat() if m.start_date else None
                } for m in active_medications
            ],
            "allergies": [
                {
                    "id": a.id,
                    "description": a.description,
                    "type": a.allergy_type,
                    "severity": a.severity,
                    "reaction": a.reaction
                } for a in allergies
            ]
        }
    
    # Encounter Services
    def get_encounter_comprehensive(self, encounter_id: str) -> Optional[Encounter]:
        """Get encounter with all related clinical data"""
        return self.db.query(Encounter).options(
            joinedload(Encounter.patient),
            joinedload(Encounter.provider),
            joinedload(Encounter.organization),
            selectinload(Encounter.conditions),
            selectinload(Encounter.medications),
            selectinload(Encounter.observations),
            selectinload(Encounter.procedures)
        ).filter(Encounter.id == encounter_id).first()
    
    def get_patient_encounters(
        self, 
        patient_id: str, 
        limit: int = 20,
        encounter_class: str = None
    ) -> List[Encounter]:
        """Get patient encounters with filtering"""
        query = self.db.query(Encounter).filter(Encounter.patient_id == patient_id)
        
        if encounter_class:
            query = query.filter(Encounter.encounter_class == encounter_class)
        
        return query.options(
            joinedload(Encounter.provider),
            joinedload(Encounter.organization)
        ).order_by(desc(Encounter.start_time)).limit(limit).all()
    
    # Clinical Data Services
    def get_latest_vital_signs(self, patient_id: str) -> Dict[str, Any]:
        """Get latest vital signs for patient"""
        vital_codes = {
            '8480-6': 'systolic_bp',      # Systolic BP
            '8462-4': 'diastolic_bp',     # Diastolic BP
            '8310-5': 'body_temperature', # Body temperature
            '8867-4': 'heart_rate',       # Heart rate
            '9279-1': 'respiratory_rate', # Respiratory rate
            '2708-6': 'oxygen_saturation',# Oxygen saturation
            '29463-7': 'weight',          # Body weight
            '8302-2': 'height',           # Body height
            '39156-5': 'bmi'              # BMI
        }
        
        vitals = {}
        for loinc_code, vital_name in vital_codes.items():
            latest_obs = self.db.query(Observation).filter(
                and_(
                    Observation.patient_id == patient_id,
                    Observation.loinc_code == loinc_code,
                    Observation.status == 'final'
                )
            ).order_by(desc(Observation.effective_datetime)).first()
            
            if latest_obs:
                vitals[vital_name] = {
                    'value': latest_obs.value,
                    'unit': latest_obs.unit,
                    'date': latest_obs.effective_datetime.isoformat() if latest_obs.effective_datetime else None
                }
        
        return vitals
    
    def get_lab_results(
        self, 
        patient_id: str, 
        encounter_id: str = None,
        days_back: int = 30
    ) -> List[Dict[str, Any]]:
        """Get lab results with proper formatting"""
        cutoff_date = datetime.now().date()
        if days_back:
            from datetime import timedelta
            cutoff_date = cutoff_date - timedelta(days=days_back)
        
        query = self.db.query(Observation).filter(
            and_(
                Observation.patient_id == patient_id,
                Observation.category.contains('laboratory'),
                Observation.status == 'final',
                func.date(Observation.effective_datetime) >= cutoff_date
            )
        )
        
        if encounter_id:
            query = query.filter(Observation.encounter_id == encounter_id)
        
        observations = query.order_by(desc(Observation.effective_datetime)).all()
        
        return [
            {
                'id': obs.id,
                'name': obs.observation_name,
                'loinc_code': obs.loinc_code,
                'value': obs.value,
                'unit': obs.unit,
                'reference_range': obs.reference_range if hasattr(obs, 'reference_range') else None,
                'status': obs.status,
                'date': obs.effective_datetime.isoformat() if obs.effective_datetime else None,
                'encounter_id': obs.encounter_id
            } for obs in observations
        ]
    
    def get_medications_detailed(
        self, 
        patient_id: str, 
        active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Get detailed medication information"""
        query = self.db.query(Medication).filter(Medication.patient_id == patient_id)
        
        if active_only:
            query = query.filter(Medication.status == 'active')
        
        medications = query.order_by(desc(Medication.start_date)).all()
        
        result = []
        for med in medications:
            # Try to get additional info from catalog
            catalog_info = None
            if med.rxnorm_code:
                catalog_info = self.db.query(MedicationCatalog).filter(
                    MedicationCatalog.rxnorm_code == med.rxnorm_code
                ).first()
            
            med_dict = {
                'id': med.id,
                'name': med.medication_name,
                'rxnorm_code': med.rxnorm_code,
                'dosage': med.dosage,
                'route': med.route,
                'status': med.status,
                'start_date': med.start_date.isoformat() if med.start_date else None,
                'end_date': med.end_date.isoformat() if med.end_date else None,
                'prescriber_id': med.prescriber_id
            }
            
            if catalog_info:
                med_dict.update({
                    'generic_name': catalog_info.generic_name,
                    'drug_class': catalog_info.drug_class,
                    'therapeutic_class': catalog_info.therapeutic_class
                })
            
            result.append(med_dict)
        
        return result
    
    # Provider Services
    def get_provider_patients(
        self, 
        provider_id: str, 
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get patients assigned to a provider"""
        from models.session import PatientProviderAssignment
        
        assignments = self.db.query(PatientProviderAssignment)\
            .filter(PatientProviderAssignment.provider_id == provider_id)\
            .limit(limit).all()
        
        patient_ids = [a.patient_id for a in assignments]
        
        patients = self.db.query(Patient)\
            .filter(Patient.id.in_(patient_ids))\
            .order_by(Patient.last_name, Patient.first_name).all()
        
        return [
            {
                'id': p.id,
                'name': f"{p.first_name} {p.last_name}",
                'mrn': p.mrn,
                'dob': p.date_of_birth.isoformat(),
                'gender': p.gender,
                'last_visit': self._get_last_visit_date(p.id)
            } for p in patients
        ]
    
    def _get_last_visit_date(self, patient_id: str) -> Optional[str]:
        """Get last visit date for patient"""
        last_encounter = self.db.query(Encounter)\
            .filter(Encounter.patient_id == patient_id)\
            .order_by(desc(Encounter.start_time)).first()
        
        return last_encounter.start_time.isoformat() if last_encounter else None
    
    # Clinical Decision Support
    def get_patient_alerts(self, patient_id: str) -> List[Dict[str, Any]]:
        """Get clinical alerts for patient"""
        alerts = []
        
        # Check for drug allergies vs active medications
        allergies = self.db.query(Allergy).filter(
            and_(
                Allergy.patient_id == patient_id,
                Allergy.clinical_status == 'active',
                Allergy.allergy_type == 'medication'
            )
        ).all()
        
        active_meds = self.db.query(Medication).filter(
            and_(
                Medication.patient_id == patient_id,
                Medication.status == 'active'
            )
        ).all()
        
        for allergy in allergies:
            for med in active_meds:
                if allergy.description.lower() in med.medication_name.lower():
                    alerts.append({
                        'type': 'drug_allergy',
                        'severity': 'critical',
                        'message': f"Patient allergic to {allergy.description}, currently prescribed {med.medication_name}",
                        'allergy_id': allergy.id,
                        'medication_id': med.id
                    })
        
        # Check for critical lab values
        critical_obs = self.db.query(Observation).filter(
            and_(
                Observation.patient_id == patient_id,
                Observation.status == 'final',
                Observation.effective_datetime >= datetime.now().date()
            )
        ).all()
        
        for obs in critical_obs:
            if obs.loinc_code == '2951-2' and obs.value:  # Sodium
                try:
                    sodium_value = float(obs.value)
                    if sodium_value < 135 or sodium_value > 145:
                        alerts.append({
                            'type': 'critical_lab',
                            'severity': 'warning',
                            'message': f"Abnormal sodium level: {obs.value} {obs.unit}",
                            'observation_id': obs.id
                        })
                except ValueError:
                    pass
        
        return alerts
    
    # Utility Methods
    def get_statistics(self) -> Dict[str, int]:
        """Get system statistics"""
        return {
            'total_patients': self.db.query(Patient).count(),
            'total_providers': self.db.query(Provider).count(),
            'total_encounters': self.db.query(Encounter).count(),
            'total_observations': self.db.query(Observation).count(),
            'total_medications': self.db.query(Medication).count(),
            'total_conditions': self.db.query(Condition).count()
        }