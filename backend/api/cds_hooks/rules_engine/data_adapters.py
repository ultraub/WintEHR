"""
Data Adapters for CDS Rules Engine

Converts between FHIR resources and the rules engine's internal data format.
"""

import logging
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, date
import re

logger = logging.getLogger(__name__)


class FHIRDataAdapter:
    """Adapts FHIR resources to rules engine format"""
    
    def __init__(self):
        self.medication_class_mappings = {
            # ACE Inhibitors
            "lisinopril": "ACE_INHIBITOR",
            "enalapril": "ACE_INHIBITOR",
            "ramipril": "ACE_INHIBITOR",
            "captopril": "ACE_INHIBITOR",
            
            # ARBs
            "losartan": "ARB",
            "valsartan": "ARB",
            "irbesartan": "ARB",
            
            # Statins
            "atorvastatin": "STATIN",
            "simvastatin": "STATIN",
            "rosuvastatin": "STATIN",
            "pravastatin": "STATIN",
            
            # NSAIDs
            "ibuprofen": "NSAID",
            "naproxen": "NSAID",
            "diclofenac": "NSAID",
            "celecoxib": "NSAID",
            
            # Anticoagulants
            "warfarin": "ANTICOAGULANT",
            "apixaban": "ANTICOAGULANT",
            "rivaroxaban": "ANTICOAGULANT",
            
            # Diabetes medications
            "metformin": "BIGUANIDE",
            "glipizide": "SULFONYLUREA",
            "insulin": "INSULIN"
        }
    
    async def adapt_cds_context(
        self,
        context: Dict[str, Any],
        prefetch: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Convert CDS Hook context and prefetch data to rules engine format
        
        Args:
            context: CDS Hook context
            prefetch: Prefetched FHIR resources
            
        Returns:
            Adapted data for rules engine evaluation
        """
        adapted = {
            "patient": {},
            "conditions": [],
            "activeMedications": [],
            "newMedication": {},
            "vitalSigns": {},
            "labResults": {},
            "procedures": {},
            "immunizations": {},
            "currentMonth": datetime.now().month
        }
        
        # Extract patient data
        if prefetch and "patient" in prefetch:
            adapted["patient"] = self._adapt_patient(prefetch["patient"])
        elif context.get("patient"):
            adapted["patient"]["id"] = context["patient"]
        
        # Extract conditions
        if prefetch and "conditions" in prefetch:
            adapted["conditions"] = self._adapt_conditions(prefetch["conditions"])
        
        # Extract medications
        if prefetch and "medications" in prefetch:
            adapted["activeMedications"] = self._adapt_medications(prefetch["medications"])
        
        # Extract new medication being prescribed
        if context.get("medications", {}).get("new"):
            new_meds = context["medications"]["new"]
            if new_meds and isinstance(new_meds, list) and len(new_meds) > 0:
                adapted["newMedication"] = self._adapt_medication_context(new_meds[0])
        
        # Extract vital signs
        if prefetch:
            adapted["vitalSigns"] = self._adapt_vital_signs(prefetch)
        
        # Extract lab results
        if prefetch:
            adapted["labResults"] = self._adapt_lab_results(prefetch)
        
        # Extract procedures
        if prefetch and "procedures" in prefetch:
            adapted["procedures"] = self._adapt_procedures(prefetch["procedures"])
        
        # Extract immunizations
        if prefetch and "immunizations" in prefetch:
            adapted["immunizations"] = self._adapt_immunizations(prefetch["immunizations"])
        
        return adapted
    
    def _adapt_patient(self, patient: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """Adapt patient resource"""
        if hasattr(patient, "__dict__"):
            # Handle object-like patient data
            return {
                "id": getattr(patient, "id", None),
                "gender": getattr(patient, "gender", None),
                "birthDate": getattr(patient, "birthDate", None),
                "age": self._calculate_age(getattr(patient, "birthDate", None))
            }
        
        # Handle dict patient data
        return {
            "id": patient.get("id"),
            "gender": patient.get("gender"),
            "birthDate": patient.get("birthDate"),
            "age": self._calculate_age(patient.get("birthDate"))
        }
    
    def _calculate_age(self, birth_date: Optional[str]) -> Optional[int]:
        """Calculate age from birth date"""
        if not birth_date:
            return None
        
        try:
            if isinstance(birth_date, str):
                birth = date.fromisoformat(birth_date)
            else:
                birth = birth_date
            
            today = date.today()
            age = today.year - birth.year
            
            # Adjust if birthday hasn't occurred this year
            if (today.month, today.day) < (birth.month, birth.day):
                age -= 1
            
            return age
        except Exception:
            return None
    
    def _adapt_conditions(self, conditions: List[Any]) -> List[Dict[str, Any]]:
        """Adapt condition resources"""
        adapted = []
        
        for condition in conditions:
            if hasattr(condition, "__dict__"):
                # Handle object-like condition
                code = None
                if hasattr(condition, "code") and hasattr(condition.code, "coding"):
                    for coding in condition.code.coding:
                        if hasattr(coding, "system") and "icd" in coding.system.lower():
                            code = getattr(coding, "code", None)
                            break
                
                adapted.append({
                    "code": code,
                    "display": getattr(condition.code, "text", None) if hasattr(condition, "code") else None,
                    "status": getattr(condition, "clinicalStatus", None)
                })
            else:
                # Handle dict condition
                code = None
                code_obj = condition.get("code", {})
                if "coding" in code_obj:
                    for coding in code_obj["coding"]:
                        if coding.get("system", "").lower().find("icd") != -1:
                            code = coding.get("code")
                            break
                
                adapted.append({
                    "code": code,
                    "display": code_obj.get("text"),
                    "status": condition.get("clinicalStatus")
                })
        
        return adapted
    
    def _adapt_medications(self, medications: List[Any]) -> List[Dict[str, Any]]:
        """Adapt medication resources"""
        adapted = []
        
        for med in medications:
            if hasattr(med, "__dict__"):
                # Handle object-like medication
                med_name = getattr(med, "medication_name", "")
                adapted.append({
                    "code": med_name.lower(),
                    "display": med_name,
                    "class": self._get_medication_class(med_name),
                    "status": getattr(med, "status", "active")
                })
            else:
                # Handle dict medication
                med_code = med.get("medicationCodeableConcept", {})
                med_name = med_code.get("text", "")
                
                # Try to extract from coding if text not available
                if not med_name and "coding" in med_code:
                    for coding in med_code["coding"]:
                        if coding.get("display"):
                            med_name = coding["display"]
                            break
                
                adapted.append({
                    "code": med_name.lower(),
                    "display": med_name,
                    "class": self._get_medication_class(med_name),
                    "status": med.get("status", "active")
                })
        
        return adapted
    
    def _adapt_medication_context(self, med_context: Dict[str, Any]) -> Dict[str, Any]:
        """Adapt medication from CDS context"""
        display = med_context.get("display", "")
        return {
            "code": display.lower(),
            "display": display,
            "class": self._get_medication_class(display)
        }
    
    def _get_medication_class(self, medication_name: str) -> Optional[str]:
        """Get medication class from name"""
        med_lower = medication_name.lower()
        
        for med_key, med_class in self.medication_class_mappings.items():
            if med_key in med_lower:
                return med_class
        
        return None
    
    def _adapt_vital_signs(self, prefetch: Dict[str, Any]) -> Dict[str, Any]:
        """Extract and adapt vital signs from prefetch"""
        vitals = {}
        
        # Blood pressure
        if "bp" in prefetch:
            bp_obs = prefetch["bp"]
            if isinstance(bp_obs, list) and bp_obs:
                # Find latest systolic and diastolic
                for obs in bp_obs:
                    if hasattr(obs, "code") and hasattr(obs, "value"):
                        if obs.code == "8480-6":  # Systolic
                            vitals["systolicBP"] = {
                                "value": obs.value,
                                "date": getattr(obs, "effectiveDateTime", None)
                            }
                        elif obs.code == "8462-4":  # Diastolic
                            vitals["diastolicBP"] = {
                                "value": obs.value,
                                "date": getattr(obs, "effectiveDateTime", None)
                            }
        
        return vitals
    
    def _adapt_lab_results(self, prefetch: Dict[str, Any]) -> Dict[str, Any]:
        """Extract and adapt lab results from prefetch"""
        labs = {}
        
        # A1C
        if "a1c" in prefetch and hasattr(prefetch["a1c"], "value"):
            labs["a1c"] = {
                "value": prefetch["a1c"].value,
                "date": getattr(prefetch["a1c"], "effectiveDateTime", None)
            }
        
        # Creatinine
        if "creatinine" in prefetch:
            cr = prefetch["creatinine"]
            if hasattr(cr, "value"):
                labs["creatinine"] = {
                    "value": cr.value,
                    "date": getattr(cr, "effectiveDateTime", None)
                }
        
        # INR
        if "inr" in prefetch:
            inr = prefetch["inr"]
            if hasattr(inr, "value"):
                labs["inr"] = {
                    "value": inr.value,
                    "date": getattr(inr, "effectiveDateTime", None)
                }
        
        # ALT
        if "alt" in prefetch:
            alt = prefetch["alt"]
            if hasattr(alt, "value"):
                labs["alt"] = {
                    "value": alt.value,
                    "date": getattr(alt, "effectiveDateTime", None)
                }
        
        return labs
    
    def _adapt_procedures(self, procedures: List[Any]) -> Dict[str, Any]:
        """Adapt procedure resources"""
        proc_dict = {}
        
        for proc in procedures:
            if hasattr(proc, "__dict__"):
                # Handle object-like procedure
                code = getattr(proc, "code", None)
                if code and hasattr(code, "text"):
                    proc_type = self._classify_procedure(code.text)
                    if proc_type:
                        proc_dict[proc_type] = {
                            "date": getattr(proc, "performedDateTime", None),
                            "display": code.text
                        }
            else:
                # Handle dict procedure
                code = proc.get("code", {})
                text = code.get("text", "")
                if text:
                    proc_type = self._classify_procedure(text)
                    if proc_type:
                        proc_dict[proc_type] = {
                            "date": proc.get("performedDateTime"),
                            "display": text
                        }
        
        return proc_dict
    
    def _classify_procedure(self, procedure_text: str) -> Optional[str]:
        """Classify procedure type from text"""
        text_lower = procedure_text.lower()
        
        if "eye" in text_lower or "ophthalm" in text_lower or "retina" in text_lower:
            return "eyeExam"
        elif "mammogram" in text_lower or "breast" in text_lower:
            return "mammogram"
        elif "colonoscopy" in text_lower or "colorectal" in text_lower:
            return "colonoscopy"
        
        return None
    
    def _adapt_immunizations(self, immunizations: List[Any]) -> Dict[str, Any]:
        """Adapt immunization resources"""
        imm_dict = {}
        
        for imm in immunizations:
            if hasattr(imm, "__dict__"):
                # Handle object-like immunization
                vaccine_code = getattr(imm, "vaccineCode", None)
                if vaccine_code:
                    imm_type = self._classify_immunization(vaccine_code)
                    if imm_type:
                        imm_dict[imm_type] = {
                            "date": getattr(imm, "occurrenceDateTime", None)
                        }
            else:
                # Handle dict immunization
                vaccine_code = imm.get("vaccineCode", {})
                imm_type = self._classify_immunization(vaccine_code)
                if imm_type:
                    imm_dict[imm_type] = {
                        "date": imm.get("occurrenceDateTime")
                    }
        
        return imm_dict
    
    def _classify_immunization(self, vaccine_code: Any) -> Optional[str]:
        """Classify immunization type from vaccine code"""
        # Check coding
        if hasattr(vaccine_code, "coding"):
            for coding in vaccine_code.coding:
                if hasattr(coding, "code"):
                    if coding.code in ["140", "141", "168"]:  # Flu vaccine codes
                        return "influenza"
                    elif coding.code in ["33", "133"]:  # Pneumococcal
                        return "pneumococcal"
        elif isinstance(vaccine_code, dict) and "coding" in vaccine_code:
            for coding in vaccine_code["coding"]:
                code = coding.get("code")
                if code in ["140", "141", "168"]:
                    return "influenza"
                elif code in ["33", "133"]:
                    return "pneumococcal"
        
        # Check text
        text = ""
        if hasattr(vaccine_code, "text"):
            text = vaccine_code.text
        elif isinstance(vaccine_code, dict):
            text = vaccine_code.get("text", "")
        
        text_lower = text.lower()
        if "flu" in text_lower or "influenza" in text_lower:
            return "influenza"
        elif "pneumo" in text_lower:
            return "pneumococcal"
        
        return None