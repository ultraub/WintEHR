"""
Clinical Analytics Service
Demonstrates healthcare informatics concepts including population health analytics,
quality measures, and clinical decision support analytics
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from models.models import Patient, Encounter, Observation, Condition, Medication


class ClinicalAnalyticsService:
    """Service for clinical data analytics and population health insights"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_population_demographics(self) -> Dict[str, Any]:
        """Get population demographics summary"""
        total_patients = self.db.query(Patient).count()
        
        # Gender distribution
        gender_dist = self.db.query(
            Patient.gender,
            func.count(Patient.id).label('count')
        ).group_by(Patient.gender).all()
        
        # Age distribution
        current_date = date.today()
        age_groups = {
            'pediatric': (0, 17),
            'young_adult': (18, 39),
            'middle_aged': (40, 64),
            'elderly': (65, 120)
        }
        
        age_distribution = {}
        for group, (min_age, max_age) in age_groups.items():
            min_birth = current_date - timedelta(days=max_age*365)
            max_birth = current_date - timedelta(days=min_age*365)
            
            count = self.db.query(Patient).filter(
                Patient.date_of_birth.between(min_birth, max_birth)
            ).count()
            
            age_distribution[group] = {
                'count': count,
                'percentage': round((count / total_patients * 100) if total_patients > 0 else 0, 1)
            }
        
        # Race/ethnicity distribution
        race_dist = self.db.query(
            Patient.race,
            func.count(Patient.id).label('count')
        ).group_by(Patient.race).all()
        
        return {
            'total_patients': total_patients,
            'gender_distribution': [
                {'gender': g.gender, 'count': g.count, 
                 'percentage': round((g.count / total_patients * 100) if total_patients > 0 else 0, 1)}
                for g in gender_dist
            ],
            'age_distribution': age_distribution,
            'race_distribution': [
                {'race': r.race, 'count': r.count,
                 'percentage': round((r.count / total_patients * 100) if total_patients > 0 else 0, 1)}
                for r in race_dist if r.race
            ]
        }
    
    def get_disease_prevalence(self) -> Dict[str, Any]:
        """Calculate disease prevalence rates"""
        total_patients = self.db.query(Patient).count()
        
        # Common chronic conditions with SNOMED codes
        conditions_of_interest = {
            '44054006': 'Type 2 Diabetes',
            '38341003': 'Essential Hypertension', 
            '55822004': 'Hyperlipidemia',
            '370143000': 'Major depressive disorder',
            '13645005': 'Chronic obstructive pulmonary disease',
            '73211009': 'Chronic kidney disease',
            '414545008': 'Ischemic heart disease',
            '49601007': 'Disorder of cardiovascular system',
            '237602007': 'Metabolic syndrome X',
            '302870006': 'Hypertriglyceridemia'
        }
        
        prevalence_data = []
        for snomed_code, condition_name in conditions_of_interest.items():
            count = self.db.query(Condition).filter(
                Condition.snomed_code == snomed_code,
                Condition.clinical_status == 'active'
            ).count()
            
            prevalence_rate = (count / total_patients * 100) if total_patients > 0 else 0
            
            prevalence_data.append({
                'condition': condition_name,
                'snomed_code': snomed_code,
                'count': count,
                'prevalence_rate': round(prevalence_rate, 2)
            })
        
        return {
            'total_patients': total_patients,
            'conditions': sorted(prevalence_data, key=lambda x: x['prevalence_rate'], reverse=True)
        }
    
    def get_diabetes_quality_measures(self) -> Dict[str, Any]:
        """Calculate diabetes quality measures (HEDIS-like metrics)"""
        # Find patients with diabetes using SNOMED code
        diabetes_patients = self.db.query(Patient.id).join(Condition).filter(
            Condition.snomed_code == '44054006',  # Type 2 Diabetes SNOMED code
            Condition.clinical_status == 'active'
        ).subquery()
        
        total_diabetes_patients = self.db.query(diabetes_patients).count()
        
        if total_diabetes_patients == 0:
            return {'message': 'No diabetes patients found'}
        
        # A1C testing in past year
        one_year_ago = datetime.now() - timedelta(days=365)
        a1c_tested = self.db.query(func.count(func.distinct(Observation.patient_id))).filter(
            Observation.patient_id.in_(self.db.query(diabetes_patients.c.id)),
            Observation.code == '4548-4',  # A1C LOINC code
            Observation.observation_date >= one_year_ago
        ).scalar()
        
        # A1C control (< 7%)
        a1c_controlled = self.db.query(func.count(func.distinct(Observation.patient_id))).filter(
            Observation.patient_id.in_(self.db.query(diabetes_patients.c.id)),
            Observation.code == '4548-4',
            Observation.value < 7.0,
            Observation.observation_date >= one_year_ago
        ).scalar()
        
        # Poor A1C control (> 9%)
        a1c_poor = self.db.query(func.count(func.distinct(Observation.patient_id))).filter(
            Observation.patient_id.in_(self.db.query(diabetes_patients.c.id)),
            Observation.code == '4548-4',
            Observation.value > 9.0,
            Observation.observation_date >= one_year_ago
        ).scalar()
        
        # Patients on ACE/ARB (for cardiovascular protection)
        ace_arb_medications = ['lisinopril', 'losartan', 'enalapril', 'ramipril']
        on_ace_arb = self.db.query(func.count(func.distinct(Medication.patient_id))).filter(
            Medication.patient_id.in_(self.db.query(diabetes_patients.c.id)),
            Medication.status == 'active',
            or_(*[Medication.medication_name.ilike(f"%{med}%") for med in ace_arb_medications])
        ).scalar()
        
        return {
            'total_diabetes_patients': total_diabetes_patients,
            'measures': {
                'a1c_testing_rate': {
                    'numerator': a1c_tested,
                    'denominator': total_diabetes_patients,
                    'rate': round((a1c_tested / total_diabetes_patients * 100) if total_diabetes_patients > 0 else 0, 1)
                },
                'a1c_control_rate': {
                    'numerator': a1c_controlled,
                    'denominator': total_diabetes_patients,
                    'rate': round((a1c_controlled / total_diabetes_patients * 100) if total_diabetes_patients > 0 else 0, 1)
                },
                'a1c_poor_control_rate': {
                    'numerator': a1c_poor,
                    'denominator': total_diabetes_patients,
                    'rate': round((a1c_poor / total_diabetes_patients * 100) if total_diabetes_patients > 0 else 0, 1)
                },
                'ace_arb_prescribing_rate': {
                    'numerator': on_ace_arb,
                    'denominator': total_diabetes_patients,
                    'rate': round((on_ace_arb / total_diabetes_patients * 100) if total_diabetes_patients > 0 else 0, 1)
                }
            }
        }
    
    def get_medication_usage_patterns(self) -> Dict[str, Any]:
        """Analyze medication usage patterns"""
        # Most commonly prescribed medications
        top_medications = self.db.query(
            Medication.medication_name,
            func.count(Medication.id).label('prescription_count'),
            func.count(func.distinct(Medication.patient_id)).label('unique_patients')
        ).filter(
            Medication.status == 'active'
        ).group_by(
            Medication.medication_name
        ).order_by(
            func.count(Medication.id).desc()
        ).limit(10).all()
        
        # Polypharmacy analysis (patients on 5+ medications)
        polypharmacy_patients = self.db.query(
            Medication.patient_id,
            func.count(Medication.id).label('med_count')
        ).filter(
            Medication.status == 'active'
        ).group_by(
            Medication.patient_id
        ).having(
            func.count(Medication.id) >= 5
        ).all()
        
        total_patients_with_meds = self.db.query(
            func.count(func.distinct(Medication.patient_id))
        ).filter(Medication.status == 'active').scalar()
        
        return {
            'top_medications': [
                {
                    'medication': med.medication_name,
                    'prescription_count': med.prescription_count,
                    'unique_patients': med.unique_patients
                }
                for med in top_medications
            ],
            'polypharmacy': {
                'patients_with_5plus_meds': len(polypharmacy_patients),
                'total_patients_with_meds': total_patients_with_meds,
                'polypharmacy_rate': round(
                    (len(polypharmacy_patients) / total_patients_with_meds * 100)
                    if total_patients_with_meds > 0 else 0, 1
                )
            }
        }
    
    def get_encounter_utilization(self) -> Dict[str, Any]:
        """Analyze healthcare utilization patterns"""
        # Encounters by type
        encounter_types = self.db.query(
            Encounter.encounter_type,
            func.count(Encounter.id).label('count')
        ).group_by(Encounter.encounter_type).all()
        
        # Encounters by month (last 12 months)
        twelve_months_ago = datetime.now() - timedelta(days=365)
        monthly_encounters = self.db.query(
            func.strftime('%Y-%m', Encounter.encounter_date).label('month'),
            func.count(Encounter.id).label('count')
        ).filter(
            Encounter.encounter_date >= twelve_months_ago
        ).group_by(
            func.strftime('%Y-%m', Encounter.encounter_date)
        ).order_by('month').all()
        
        # High utilizers (patients with 10+ encounters in past year)
        high_utilizers = self.db.query(
            Encounter.patient_id,
            func.count(Encounter.id).label('encounter_count')
        ).filter(
            Encounter.encounter_date >= twelve_months_ago
        ).group_by(
            Encounter.patient_id
        ).having(
            func.count(Encounter.id) >= 10
        ).all()
        
        return {
            'encounter_types': [
                {'type': et.encounter_type, 'count': et.count}
                for et in encounter_types
            ],
            'monthly_trend': [
                {'month': me.month, 'count': me.count}
                for me in monthly_encounters
            ],
            'high_utilizers': {
                'count': len(high_utilizers),
                'patients': [
                    {'patient_id': hu.patient_id, 'encounter_count': hu.encounter_count}
                    for hu in high_utilizers
                ]
            }
        }
    
    def get_lab_value_distributions(self) -> Dict[str, Any]:
        """Analyze laboratory value distributions"""
        # Common lab tests and their distributions
        lab_tests = {
            '4548-4': 'Hemoglobin A1c',
            '2345-7': 'Glucose',
            '2093-3': 'Total Cholesterol',
            '2160-0': 'Creatinine',
            '718-7': 'Hemoglobin'
        }
        
        lab_distributions = {}
        for loinc_code, test_name in lab_tests.items():
            values = self.db.query(Observation.value).filter(
                Observation.code == loinc_code,
                Observation.value.isnot(None)
            ).all()
            
            if values:
                value_list = [v.value for v in values]
                lab_distributions[test_name] = {
                    'count': len(value_list),
                    'mean': round(sum(value_list) / len(value_list), 2),
                    'min': round(min(value_list), 2),
                    'max': round(max(value_list), 2)
                }
        
        # Abnormal lab rates
        abnormal_labs = self.db.query(
            Observation.display,
            func.count(Observation.id).label('total'),
            func.sum(func.case(
                (Observation.interpretation == 'High', 1),
                (Observation.interpretation == 'Low', 1),
                else_=0
            )).label('abnormal')
        ).filter(
            Observation.observation_type == 'laboratory'
        ).group_by(
            Observation.display
        ).having(
            func.count(Observation.id) >= 5  # Only include tests with 5+ results
        ).all()
        
        abnormal_rates = [
            {
                'test': lab.display,
                'total_results': lab.total,
                'abnormal_results': lab.abnormal,
                'abnormal_rate': round((lab.abnormal / lab.total * 100) if lab.total > 0 else 0, 1)
            }
            for lab in abnormal_labs
        ]
        
        return {
            'distributions': lab_distributions,
            'abnormal_rates': abnormal_rates
        }
    
    def get_comprehensive_analytics_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive analytics for dashboard display"""
        return {
            'demographics': self.get_population_demographics(),
            'disease_prevalence': self.get_disease_prevalence(),
            'diabetes_quality': self.get_diabetes_quality_measures(),
            'medication_patterns': self.get_medication_usage_patterns(),
            'utilization': self.get_encounter_utilization(),
            'lab_analytics': self.get_lab_value_distributions(),
            'generated_at': datetime.now().isoformat()
        }