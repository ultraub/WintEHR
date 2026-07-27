"""
CPOE orders business logic, extracted from the 1,567-line orders_router
(docs/ARCHITECTURE_DEBT.md F4, opportunity #5 — same recipe as pharmacy).

One injected HAPI client replaces ten per-handler constructions. Methods
raise fastapi.HTTPException directly — the same documented fidelity
compromise as pharmacy/service.py: bodies moved verbatim so behavior
(including drug-safety alert checks on medication orders) is unchanged.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from api.auth.models import User
from api.cds_hooks.constants import ExtensionURLs
from services.hapi_fhir_client import HAPIFHIRClient

from .models import (
    ImagingDetails,
    ImagingOrderCreate,
    LaboratoryDetails,
    LaboratoryOrderCreate,
    MedicationDetails,
    MedicationOrderCreate,
    OrderCreate,
    OrderResponse,
    OrderResultSummary,
    OrderSetCreate,
    OrderSetCreateRequest,
    OrderSetItem,
    OrderSetResponse,
    OrderSetSummary,
)

logger = logging.getLogger(__name__)


async def check_medication_alerts_fhir(
    patient_id: str,
    medication: MedicationDetails,
    hapi_client: HAPIFHIRClient
) -> List[Dict[str, Any]]:
    """
    Check for medication alerts using FHIR data.

    This queries HAPI FHIR for:
    - Patient allergies (AllergyIntolerance)
    - Current medications (MedicationRequest with status=active)
    - Drug interaction checking
    """
    alerts = []

    try:
        # Get patient allergies from FHIR
        allergy_bundle = await hapi_client.search("AllergyIntolerance", {
            "patient": f"Patient/{patient_id}",
            "clinical-status": "active"
        })

        allergies = allergy_bundle.get("entry", [])

        # Check for allergy matches
        for entry in allergies:
            allergy = entry.get("resource", {})
            allergen = allergy.get("code", {}).get("text", "")

            if medication.medication_name.lower() in allergen.lower():
                alerts.append({
                    "severity": "high",
                    "type": "allergy",
                    "message": f"Patient has documented allergy to {allergen}"
                })

        # Get current active medications
        med_bundle = await hapi_client.search("MedicationRequest", {
            "patient": f"Patient/{patient_id}",
            "status": "active"
        })

        current_meds = med_bundle.get("entry", [])

        # Simplified interaction checking - in production, use comprehensive drug database
        interaction_pairs = {
            ("warfarin", "aspirin"): "Increased bleeding risk - monitor INR closely",
            ("warfarin", "nsaid"): "Significantly increased bleeding risk",
            ("metformin", "contrast"): "Risk of lactic acidosis - hold metformin 48 hours",
            ("ace inhibitor", "potassium"): "Risk of hyperkalemia",
            ("ssri", "nsaid"): "Increased GI bleeding risk",
        }

        for entry in current_meds:
            current_med = entry.get("resource", {})
            current_med_name = current_med.get("medicationCodeableConcept", {}).get("text", "")

            if not current_med_name:
                continue

            # Check interaction pairs
            for (drug1, drug2), message in interaction_pairs.items():
                new_med_lower = medication.medication_name.lower()
                current_med_lower = current_med_name.lower()

                if ((drug1 in new_med_lower and drug2 in current_med_lower) or
                    (drug2 in new_med_lower and drug1 in current_med_lower)):
                    alerts.append({
                        "severity": "medium",
                        "type": "drug_interaction",
                        "message": f"Interaction with {current_med_name}: {message}"
                    })

    except Exception as e:
        logger.error(f"Error checking medication alerts: {e}", exc_info=True)
        # Return warning card if check fails (fail-safe)
        alerts.append({
            "severity": "warning",
            "type": "system_error",
            "message": "Unable to complete medication safety check - manual review required"
        })

    return alerts


def _determine_order_type(action: Dict[str, Any]) -> str:
    """Determine the order type from a PlanDefinition action."""
    # Check extension first
    for ext in action.get("extension", []):
        if "order-type" in ext.get("url", ""):
            return ext.get("valueString", "medication")
    
    # Try to infer from code system
    code_info = action.get("code", [{}])[0] if action.get("code") else {}
    coding = code_info.get("coding", [{}])[0] if code_info.get("coding") else {}
    system = coding.get("system", "")
    
    if "rxnorm" in system.lower():
        return "medication"
    elif "loinc" in system.lower():
        return "laboratory"
    elif "snomed" in system.lower():
        # Could be imaging or procedure
        return "imaging"
    
    return "medication"  # default


class OrdersService:
    """CPOE order operations over HAPI FHIR (one injected client)."""

    def __init__(self, hapi_client: Optional[HAPIFHIRClient] = None):
        self.hapi = hapi_client or HAPIFHIRClient()

    async def create_medication_order(self, *, order: MedicationOrderCreate, current_user: User):
        """Create a new medication order using FHIR MedicationRequest. (moved verbatim from the router)."""
        hapi_client = self.hapi

        try:
            # Run CDS checks using FHIR data
            alerts = await check_medication_alerts_fhir(
                patient_id=order.patient_id,
                medication=order.medication_details,
                hapi_client=hapi_client
            )

            # Block order if critical alerts and not overriding
            critical_alerts = [a for a in alerts if a["severity"] == "high"]
            if critical_alerts and not order.override_alerts:
                return {
                    "alerts": alerts,
                    "order_saved": False,
                    "message": "Critical safety alerts prevent ordering. Override required."
                }

            # Build FHIR MedicationRequest resource
            medication_request = {
                "resourceType": "MedicationRequest",
                "status": "active",
                "intent": "order",
                "priority": order.priority,  # routine, urgent, stat
                "subject": {
                    "reference": f"Patient/{order.patient_id}"
                },
                "medicationCodeableConcept": {
                    "coding": [{
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": order.medication_details.medication_code or "unknown",
                        "display": order.medication_details.medication_name
                    }],
                    "text": order.medication_details.medication_name
                },
                "authoredOn": datetime.utcnow().isoformat(),
                "requester": {
                    "reference": f"Practitioner/{current_user.id}",
                    "display": f"{current_user.username}"
                },
                "dosageInstruction": [{
                    "text": f"{order.medication_details.dose} {order.medication_details.dose_unit} {order.medication_details.route} {order.medication_details.frequency}",
                    "timing": {
                        "code": {
                            "text": order.medication_details.frequency
                        }
                    },
                    "asNeededBoolean": order.medication_details.prn,
                    "route": {
                        "coding": [{
                            "system": "http://snomed.info/sct",
                            "display": order.medication_details.route
                        }],
                        "text": order.medication_details.route
                    },
                    "doseAndRate": [{
                        "type": {
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/dose-rate-type",
                                "code": "ordered",
                                "display": "Ordered"
                            }]
                        },
                        "doseQuantity": {
                            "value": order.medication_details.dose,
                            "unit": order.medication_details.dose_unit,
                            "system": "http://unitsofmeasure.org",
                            "code": order.medication_details.dose_unit
                        }
                    }]
                }],
                # FHIR R4: dispenseRequest is required for pharmacy workflows
                "dispenseRequest": {
                    "numberOfRepeatsAllowed": order.medication_details.refills,
                    "quantity": {
                        "value": order.medication_details.dispense_quantity or 30,
                        "unit": order.medication_details.dispense_unit or "units",
                        "system": "http://unitsofmeasure.org",
                        "code": order.medication_details.dispense_unit or "{Unit}"
                    },
                    "expectedSupplyDuration": {
                        "value": 30,
                        "unit": "days",
                        "system": "http://unitsofmeasure.org",
                        "code": "d"
                    }
                }
            }

            # Add PRN reason if specified
            if order.medication_details.prn and order.medication_details.prn_reason:
                medication_request["dosageInstruction"][0]["asNeededCodeableConcept"] = {
                    "text": order.medication_details.prn_reason
                }

            # Add pharmacy notes to dispenseRequest if specified
            if order.medication_details.pharmacy_notes:
                medication_request["dispenseRequest"]["performer"] = {
                    "display": order.medication_details.pharmacy_notes
                }

            # Add substitution (generic allowed)
            medication_request["substitution"] = {
                "allowedBoolean": order.medication_details.generic_allowed
            }

            # Add encounter context if provided
            if order.encounter_id:
                medication_request["encounter"] = {
                    "reference": f"Encounter/{order.encounter_id}"
                }

            # Add indication and clinical info via extensions
            extensions = []

            if order.indication:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/order-indication",
                    "valueString": order.indication
                })

            if order.clinical_information:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/clinical-information",
                    "valueString": order.clinical_information
                })

            # If alerts were overridden, document that
            if alerts and order.override_alerts:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/alerts-overridden",
                    "valueBoolean": True
                })
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/overridden-alerts",
                    "valueString": str(alerts)
                })

            if extensions:
                medication_request["extension"] = extensions

            # Create resource in HAPI FHIR
            created_resource = await hapi_client.create("MedicationRequest", medication_request)

            logger.info(f"Created MedicationRequest {created_resource.get('id')} for patient {order.patient_id}")

            # Build response
            return {
                "order": {
                    "id": created_resource.get("id"),
                    "patient_id": order.patient_id,
                    "encounter_id": order.encounter_id,
                    "ordering_provider_id": current_user.id,
                    "order_type": "medication",
                    "order_date": created_resource.get("authoredOn"),
                    "priority": order.priority,
                    "status": created_resource.get("status"),
                    "indication": order.indication,
                    "clinical_information": order.clinical_information,
                    "created_at": created_resource.get("meta", {}).get("lastUpdated"),
                    "updated_at": created_resource.get("meta", {}).get("lastUpdated")
                },
                "alerts": alerts,
                "order_saved": True,
                "fhir_resource_id": created_resource.get("id")
            }

        except Exception as e:
            logger.error(f"Error creating medication order: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create medication order: {str(e)}"
            )

    async def create_laboratory_order(self, *, order: LaboratoryOrderCreate, current_user: User):
        """Create a new laboratory order using FHIR ServiceRequest. (moved verbatim from the router)."""
        hapi_client = self.hapi

        try:
            # Build FHIR ServiceRequest for laboratory
            service_request = {
                "resourceType": "ServiceRequest",
                "status": "active",
                "intent": "order",
                "priority": order.priority,
                "category": [{
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "108252007",
                        "display": "Laboratory procedure"
                    }],
                    "text": "Laboratory"
                }],
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": order.laboratory_details.test_code or "unknown",
                        "display": order.laboratory_details.test_name
                    }],
                    "text": order.laboratory_details.test_name
                },
                "subject": {
                    "reference": f"Patient/{order.patient_id}"
                },
                "authoredOn": datetime.utcnow().isoformat(),
                "requester": {
                    "reference": f"Practitioner/{current_user.id}",
                    "display": f"{current_user.username}"
                }
            }

            # Add encounter context
            if order.encounter_id:
                service_request["encounter"] = {
                    "reference": f"Encounter/{order.encounter_id}"
                }

            # Add lab-specific details via extensions
            extensions = []

            if order.laboratory_details.specimen_type:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/specimen-type",
                    "valueString": order.laboratory_details.specimen_type
                })

            if order.laboratory_details.specimen_source:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/specimen-source",
                    "valueString": order.laboratory_details.specimen_source
                })

            if order.laboratory_details.fasting_required:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/fasting-required",
                    "valueBoolean": True
                })

            if order.laboratory_details.special_instructions:
                service_request["note"] = [{
                    "text": order.laboratory_details.special_instructions
                }]

            if order.indication:
                service_request["reasonCode"] = [{
                    "text": order.indication
                }]

            if order.clinical_information:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/clinical-information",
                    "valueString": order.clinical_information
                })

            # Add collection datetime if specified
            if order.laboratory_details.collection_datetime:
                service_request["occurrenceDateTime"] = order.laboratory_details.collection_datetime.isoformat()

            if extensions:
                service_request["extension"] = extensions

            # Create resource in HAPI FHIR
            created_resource = await hapi_client.create("ServiceRequest", service_request)

            logger.info(f"Created ServiceRequest (lab) {created_resource.get('id')} for patient {order.patient_id}")

            # Build response
            return OrderResponse(
                id=created_resource.get("id"),
                patient_id=order.patient_id,
                encounter_id=order.encounter_id,
                ordering_provider_id=current_user.id,
                order_type="laboratory",
                order_date=created_resource.get("authoredOn"),
                priority=order.priority,
                status=created_resource.get("status"),
                indication=order.indication,
                clinical_information=order.clinical_information,
                created_at=created_resource.get("meta", {}).get("lastUpdated"),
                updated_at=created_resource.get("meta", {}).get("lastUpdated")
            )

        except Exception as e:
            logger.error(f"Error creating laboratory order: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create laboratory order: {str(e)}"
            )

    async def create_imaging_order(self, *, order: ImagingOrderCreate, current_user: User):
        """Create a new imaging order using FHIR ServiceRequest. (moved verbatim from the router)."""
        hapi_client = self.hapi

        try:
            # Build FHIR ServiceRequest for imaging
            service_request = {
                "resourceType": "ServiceRequest",
                "status": "active",
                "intent": "order",
                "priority": order.priority,
                "category": [{
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "363679005",
                        "display": "Imaging"
                    }],
                    "text": "Imaging"
                }],
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": f"IMAGING-{order.imaging_details.modality}",
                        "display": f"{order.imaging_details.modality} imaging"
                    }],
                    "text": f"{order.imaging_details.modality} imaging"
                },
                "subject": {
                    "reference": f"Patient/{order.patient_id}"
                },
                "authoredOn": datetime.utcnow().isoformat(),
                "requester": {
                    "reference": f"Practitioner/{current_user.id}",
                    "display": f"{current_user.username}"
                }
            }

            # Add encounter context
            if order.encounter_id:
                service_request["encounter"] = {
                    "reference": f"Encounter/{order.encounter_id}"
                }

            # Add body site if specified
            if order.imaging_details.body_site:
                service_request["bodySite"] = [{
                    "text": order.imaging_details.body_site
                }]

                # Add laterality if specified
                if order.imaging_details.laterality:
                    service_request["bodySite"][0]["coding"] = [{
                        "system": "http://snomed.info/sct",
                        "display": f"{order.imaging_details.body_site} ({order.imaging_details.laterality})"
                    }]

            # Add imaging-specific details via extensions
            extensions = []

            extensions.append({
                "url": f"{ExtensionURLs.BASE_URL}/imaging-modality",
                "valueString": order.imaging_details.modality
            })

            if order.imaging_details.contrast:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/contrast-required",
                    "valueBoolean": True
                })

            if order.imaging_details.transport_mode:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/transport-mode",
                    "valueString": order.imaging_details.transport_mode
                })

            # Add reason for exam
            if order.imaging_details.reason_for_exam:
                service_request["reasonCode"] = [{
                    "text": order.imaging_details.reason_for_exam
                }]

            if order.indication:
                if "reasonCode" not in service_request:
                    service_request["reasonCode"] = []
                service_request["reasonCode"].append({"text": order.indication})

            if order.clinical_information:
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/clinical-information",
                    "valueString": order.clinical_information
                })

            # Add preferred datetime if specified
            if order.imaging_details.preferred_datetime:
                service_request["occurrenceDateTime"] = order.imaging_details.preferred_datetime.isoformat()

            if extensions:
                service_request["extension"] = extensions

            # Create resource in HAPI FHIR
            created_resource = await hapi_client.create("ServiceRequest", service_request)

            logger.info(f"Created ServiceRequest (imaging) {created_resource.get('id')} for patient {order.patient_id}")

            # Build response
            return OrderResponse(
                id=created_resource.get("id"),
                patient_id=order.patient_id,
                encounter_id=order.encounter_id,
                ordering_provider_id=current_user.id,
                order_type="imaging",
                order_date=created_resource.get("authoredOn"),
                priority=order.priority,
                status=created_resource.get("status"),
                indication=order.indication,
                clinical_information=order.clinical_information,
                created_at=created_resource.get("meta", {}).get("lastUpdated"),
                updated_at=created_resource.get("meta", {}).get("lastUpdated")
            )

        except Exception as e:
            logger.error(f"Error creating imaging order: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create imaging order: {str(e)}"
            )

    async def get_orders(self, *, patient_id: Optional[str] = None, encounter_id: Optional[str] = None, order_type: Optional[str] = None, status: Optional[str] = None, priority: Optional[str] = None, skip: int = 0, limit: int = 100, current_user: User):
        """Get orders using FHIR search. (moved verbatim from the router)."""
        hapi_client = self.hapi
        all_orders = []

        try:
            # Determine which resource types to query based on order_type
            resource_types = []

            if not order_type or order_type == "medication":
                resource_types.append("MedicationRequest")

            if not order_type or order_type in ["laboratory", "imaging"]:
                resource_types.append("ServiceRequest")

            # Build search parameters
            search_params = {}

            if patient_id:
                search_params["patient"] = f"Patient/{patient_id}"

            if encounter_id:
                search_params["encounter"] = f"Encounter/{encounter_id}"

            if status:
                search_params["status"] = status

            if priority:
                search_params["priority"] = priority

            search_params["_sort"] = "-authored"  # Most recent first
            search_params["_count"] = limit

            # Query each resource type
            for resource_type in resource_types:
                bundle = await hapi_client.search(resource_type, search_params)

                entries = bundle.get("entry", [])

                for entry in entries:
                    resource = entry.get("resource", {})

                    # Determine order type from resource
                    if resource_type == "MedicationRequest":
                        resource_order_type = "medication"
                    else:
                        # ServiceRequest - check category
                        categories = resource.get("category", [])
                        if categories:
                            category_text = categories[0].get("text", "").lower()
                            if "lab" in category_text:
                                resource_order_type = "laboratory"
                            elif "imaging" in category_text:
                                resource_order_type = "imaging"
                            else:
                                resource_order_type = "unknown"
                        else:
                            resource_order_type = "unknown"

                    # Skip if order_type filter doesn't match
                    if order_type and resource_order_type != order_type:
                        continue

                    # Extract requester ID
                    requester = resource.get("requester", {})
                    requester_ref = requester.get("reference", "")
                    ordering_provider_id = requester_ref.split("/")[-1] if "/" in requester_ref else "unknown"

                    # Extract patient ID
                    subject = resource.get("subject", {})
                    subject_ref = subject.get("reference", "")
                    resource_patient_id = subject_ref.split("/")[-1] if "/" in subject_ref else "unknown"

                    # Extract encounter ID
                    encounter = resource.get("encounter", {})
                    encounter_ref = encounter.get("reference", "")
                    resource_encounter_id = encounter_ref.split("/")[-1] if "/" in encounter_ref else None

                    # Extract indication
                    reason_codes = resource.get("reasonCode", [])
                    resource_indication = reason_codes[0].get("text") if reason_codes else None

                    # Extract clinical information from extensions
                    extensions = resource.get("extension", [])
                    clinical_info = None
                    for ext in extensions:
                        if ext.get("url") == f"{ExtensionURLs.BASE_URL}/clinical-information":
                            clinical_info = ext.get("valueString")
                            break

                    order_response = OrderResponse(
                        id=resource.get("id"),
                        patient_id=resource_patient_id,
                        encounter_id=resource_encounter_id,
                        ordering_provider_id=ordering_provider_id,
                        order_type=resource_order_type,
                        order_date=resource.get("authoredOn"),
                        priority=resource.get("priority", "routine"),
                        status=resource.get("status"),
                        indication=resource_indication,
                        clinical_information=clinical_info,
                        created_at=resource.get("meta", {}).get("lastUpdated"),
                        updated_at=resource.get("meta", {}).get("lastUpdated")
                    )

                    all_orders.append(order_response)

            # Apply skip/limit to combined results
            return all_orders[skip:skip+limit]

        except Exception as e:
            logger.error(f"Error querying orders: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to query orders: {str(e)}"
            )

    async def get_active_orders(self, *, patient_id: Optional[str] = None, order_type: Optional[str] = None, current_user: User):
        """Get active orders (status=active) (moved verbatim from the router)."""
        return await get_orders(
            patient_id=patient_id,
            order_type=order_type,
            status="active",
            current_user=current_user
        )

    async def get_order_results(self, *, order_id: str, resource_type: str = "ServiceRequest", current_user: User):
        """Get results linked to an order via FHIR basedOn reference. (moved verbatim from the router)."""
        hapi_client = self.hapi

        try:
            # First verify the order exists
            order = await hapi_client.read(resource_type, order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            # Determine order type from resource
            if resource_type == "MedicationRequest":
                order_type = "medication"
            else:
                categories = order.get("category", [])
                if categories:
                    category_text = categories[0].get("text", "").lower()
                    if "lab" in category_text:
                        order_type = "laboratory"
                    elif "imaging" in category_text:
                        order_type = "imaging"
                    else:
                        order_type = "procedure"
                else:
                    order_type = "procedure"

            # Build reference string for basedOn search
            based_on_ref = f"{resource_type}/{order_id}"

            # Query DiagnosticReports with basedOn reference
            diagnostic_reports = []
            try:
                dr_bundle = await hapi_client.search("DiagnosticReport", {
                    "based-on": based_on_ref,
                    "_sort": "-issued",
                    "_count": 50
                })

                for entry in dr_bundle.get("entry", []):
                    dr = entry.get("resource", {})
                    diagnostic_reports.append({
                        "id": dr.get("id"),
                        "status": dr.get("status"),
                        "code": dr.get("code", {}).get("text") or
                                (dr.get("code", {}).get("coding", [{}])[0].get("display") if dr.get("code", {}).get("coding") else "Unknown"),
                        "issued": dr.get("issued"),
                        "conclusion": dr.get("conclusion"),
                        "category": dr.get("category", [{}])[0].get("text") if dr.get("category") else None,
                        "result_count": len(dr.get("result", []))
                    })
            except Exception as e:
                logger.warning(f"DiagnosticReport search failed for {based_on_ref}: {e}")

            # Query Observations with basedOn reference
            observations = []
            try:
                obs_bundle = await hapi_client.search("Observation", {
                    "based-on": based_on_ref,
                    "_sort": "-date",
                    "_count": 100
                })

                for entry in obs_bundle.get("entry", []):
                    obs = entry.get("resource", {})

                    # Extract value based on type
                    value = None
                    if "valueQuantity" in obs:
                        vq = obs["valueQuantity"]
                        value = f"{vq.get('value', '')} {vq.get('unit', '')}"
                    elif "valueString" in obs:
                        value = obs["valueString"]
                    elif "valueCodeableConcept" in obs:
                        value = obs["valueCodeableConcept"].get("text")

                    # Check for abnormal interpretation
                    interpretation = None
                    if obs.get("interpretation"):
                        interp_coding = obs["interpretation"][0].get("coding", [{}])[0]
                        interpretation = interp_coding.get("code")

                    observations.append({
                        "id": obs.get("id"),
                        "status": obs.get("status"),
                        "code": obs.get("code", {}).get("text") or
                                (obs.get("code", {}).get("coding", [{}])[0].get("display") if obs.get("code", {}).get("coding") else "Unknown"),
                        "value": value,
                        "effectiveDateTime": obs.get("effectiveDateTime"),
                        "interpretation": interpretation,
                        "referenceRange": obs.get("referenceRange", [{}])[0].get("text") if obs.get("referenceRange") else None
                    })
            except Exception as e:
                logger.warning(f"Observation search failed for {based_on_ref}: {e}")

            # Determine overall result status
            total_results = len(diagnostic_reports) + len(observations)
            if total_results == 0:
                result_status = "pending"
            else:
                # Check if any results are still pending/preliminary
                all_final = all(
                    dr.get("status") in ["final", "amended", "corrected"]
                    for dr in diagnostic_reports
                ) and all(
                    obs.get("status") in ["final", "amended", "corrected"]
                    for obs in observations
                )
                result_status = "complete" if all_final else "partial"

            logger.info(f"Retrieved {total_results} results for {resource_type}/{order_id}")

            return OrderResultSummary(
                order_id=order_id,
                order_type=order_type,
                has_results=total_results > 0,
                diagnostic_reports=diagnostic_reports,
                observations=observations,
                total_results=total_results,
                result_status=result_status
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving results for order {order_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve order results: {str(e)}"
            )

    async def discontinue_order(self, *, order_id: str, resource_type: str, reason: str, current_user: User):
        """Discontinue an order by updating the FHIR resource status. (moved verbatim from the router)."""
        hapi_client = self.hapi

        try:
            # Read current resource
            resource = await hapi_client.read(resource_type, order_id)

            if not resource:
                raise HTTPException(status_code=404, detail="Order not found")

            # Check if can be discontinued
            current_status = resource.get("status")
            if current_status not in ["active", "draft"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Order with status '{current_status}' cannot be discontinued"
                )

            # Per-resource terminal status: R4 MedicationRequest discontinues to
            # 'stopped' and carries statusReason; R4 ServiceRequest has neither —
            # its cancellation status is 'revoked' and the reason goes in a note.
            if resource_type == "MedicationRequest":
                resource["status"] = "stopped"
                resource["statusReason"] = {"text": reason}
            else:
                resource["status"] = "revoked"
                resource.setdefault("note", []).append({
                    "text": f"Discontinued: {reason}",
                    "time": datetime.utcnow().isoformat(),
                })

            # Add extension for discontinuation details
            if "extension" not in resource:
                resource["extension"] = []

            resource["extension"].append({
                "url": f"{ExtensionURLs.BASE_URL}/discontinued-by",
                "valueReference": {
                    "reference": f"Practitioner/{current_user.id}",
                    "display": current_user.username
                }
            })

            resource["extension"].append({
                "url": f"{ExtensionURLs.BASE_URL}/discontinued-at",
                "valueDateTime": datetime.utcnow().isoformat()
            })

            # Update resource in HAPI FHIR
            updated_resource = await hapi_client.update(resource_type, order_id, resource)

            logger.info(f"Discontinued {resource_type}/{order_id} by {current_user.id}")

            return {
                "message": "Order discontinued successfully",
                "order_id": order_id,
                "new_status": "stopped",
                "reason": reason
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error discontinuing order: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to discontinue order: {str(e)}"
            )

    async def get_order_sets(self, *, category: Optional[str] = None, specialty: Optional[str] = None, status: str = "active", current_user: User):
        """Get available order sets using FHIR PlanDefinition resources. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            # Build search parameters
            search_params = {
                "type": "order-set",  # FHIR PlanDefinition type for order sets
                "status": status,
                "_sort": "-date",
                "_count": 100
            }
        
            # Query HAPI FHIR for PlanDefinitions
            bundle = await hapi_client.search("PlanDefinition", search_params)
        
            order_sets = []
            for entry in bundle.get("entry", []):
                plan_def = entry.get("resource", {})
            
                # Filter by category if specified
                if category:
                    plan_category = None
                    for use_context in plan_def.get("useContext", []):
                        if use_context.get("code", {}).get("code") == "focus":
                            plan_category = use_context.get("valueCodeableConcept", {}).get("text")
                            break
                    if plan_category != category:
                        continue
            
                # Filter by specialty if specified
                if specialty:
                    plan_specialty = None
                    for use_context in plan_def.get("useContext", []):
                        if use_context.get("code", {}).get("code") == "user":
                            plan_specialty = use_context.get("valueCodeableConcept", {}).get("text")
                            break
                    if plan_specialty != specialty:
                        continue
            
                # Extract category and specialty from useContext
                extracted_category = None
                extracted_specialty = None
                for use_context in plan_def.get("useContext", []):
                    code = use_context.get("code", {}).get("code")
                    if code == "focus":
                        extracted_category = use_context.get("valueCodeableConcept", {}).get("text")
                    elif code == "user":
                        extracted_specialty = use_context.get("valueCodeableConcept", {}).get("text")
            
                # Count actions (order items)
                item_count = len(plan_def.get("action", []))
            
                # Parse last updated
                last_updated = None
                if plan_def.get("meta", {}).get("lastUpdated"):
                    try:
                        last_updated = datetime.fromisoformat(
                            plan_def["meta"]["lastUpdated"].replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass

                order_sets.append(OrderSetSummary(
                    id=plan_def.get("id"),
                    name=plan_def.get("title") or plan_def.get("name", "Unnamed Order Set"),
                    description=plan_def.get("description"),
                    category=extracted_category,
                    specialty=extracted_specialty,
                    item_count=item_count,
                    status=plan_def.get("status", "unknown"),
                    last_updated=last_updated
                ))
        
            return order_sets
        
        except Exception as e:
            logger.error(f"Failed to get order sets: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get order sets: {str(e)}"
            )

    async def get_order_set_detail(self, *, set_id: str, current_user: User):
        """Get detailed information about an order set including all items. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            plan_def = await hapi_client.read("PlanDefinition", set_id)
            if not plan_def:
                raise HTTPException(status_code=404, detail="Order set not found")
        
            # Parse actions into order items
            items = []
            for action in plan_def.get("action", []):
                item = {
                    "id": action.get("id"),
                    "title": action.get("title"),
                    "description": action.get("description"),
                    "order_type": _determine_order_type(action),
                    "code": action.get("code", [{}])[0].get("coding", [{}])[0].get("code") if action.get("code") else None,
                    "code_display": action.get("code", [{}])[0].get("coding", [{}])[0].get("display") if action.get("code") else None,
                    "priority": action.get("priority", "routine")
                }
            
                # Extract medication-specific details from extensions
                for ext in action.get("extension", []):
                    if "dose" in ext.get("url", ""):
                        item["dose"] = ext.get("valueQuantity", {}).get("value")
                        item["dose_unit"] = ext.get("valueQuantity", {}).get("unit")
                    elif "route" in ext.get("url", ""):
                        item["route"] = ext.get("valueString")
                    elif "frequency" in ext.get("url", ""):
                        item["frequency"] = ext.get("valueString")
            
                items.append(item)
        
            return {
                "id": plan_def.get("id"),
                "name": plan_def.get("title") or plan_def.get("name"),
                "description": plan_def.get("description"),
                "status": plan_def.get("status"),
                "items": items,
                "fhir_resource": plan_def  # Include full FHIR resource for reference
            }
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to get order set detail: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get order set detail: {str(e)}"
            )

    async def create_order_set(self, *, order_set: OrderSetCreateRequest, current_user: User):
        """Create a new order set using FHIR PlanDefinition. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
            current_time = datetime.utcnow()
        
            # Build FHIR PlanDefinition resource
            plan_definition = {
                "resourceType": "PlanDefinition",
                "status": "active",
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/plan-definition-type",
                        "code": "order-set",
                        "display": "Order Set"
                    }]
                },
                "title": order_set.name,
                "name": order_set.name.replace(" ", "_").lower(),
                "description": order_set.description,
                "date": current_time.isoformat(),
                "publisher": current_user.username,
                "action": []
            }
        
            # Add useContext for category and specialty
            use_contexts = []
            if order_set.category:
                use_contexts.append({
                    "code": {
                        "system": "http://terminology.hl7.org/CodeSystem/usage-context-type",
                        "code": "focus"
                    },
                    "valueCodeableConcept": {
                        "text": order_set.category
                    }
                })
            if order_set.specialty:
                use_contexts.append({
                    "code": {
                        "system": "http://terminology.hl7.org/CodeSystem/usage-context-type",
                        "code": "user"
                    },
                    "valueCodeableConcept": {
                        "text": order_set.specialty
                    }
                })
            if use_contexts:
                plan_definition["useContext"] = use_contexts
        
            # Convert order items to actions
            for idx, item in enumerate(order_set.items):
                action = {
                    "id": f"action-{idx + 1}",
                    "title": item.display,
                    "description": item.instructions or item.reason,
                    "priority": item.priority
                }
            
                # Add code if provided
                if item.code:
                    code_system = item.code_system or (
                        "http://www.nlm.nih.gov/research/umls/rxnorm" if item.order_type == "medication"
                        else "http://loinc.org"
                    )
                    action["code"] = [{
                        "coding": [{
                            "system": code_system,
                            "code": item.code,
                            "display": item.display
                        }]
                    }]
            
                # Add extensions for medication details
                extensions = []
                extensions.append({
                    "url": f"{ExtensionURLs.BASE_URL}/order-type",
                    "valueString": item.order_type
                })
            
                if item.dose:
                    extensions.append({
                        "url": f"{ExtensionURLs.BASE_URL}/dose",
                        "valueQuantity": {
                            "value": item.dose,
                            "unit": item.dose_unit or "unit"
                        }
                    })
                if item.route:
                    extensions.append({
                        "url": f"{ExtensionURLs.BASE_URL}/route",
                        "valueString": item.route
                    })
                if item.frequency:
                    extensions.append({
                        "url": f"{ExtensionURLs.BASE_URL}/frequency",
                        "valueString": item.frequency
                    })
                if item.duration:
                    extensions.append({
                        "url": f"{ExtensionURLs.BASE_URL}/duration",
                        "valueString": item.duration
                    })
            
                if extensions:
                    action["extension"] = extensions
            
                plan_definition["action"].append(action)
        
            # Create in HAPI FHIR
            created_resource = await hapi_client.create("PlanDefinition", plan_definition)
        
            logger.info(f"Created order set PlanDefinition/{created_resource.get('id')}")
        
            return {
                "id": created_resource.get("id"),
                "name": order_set.name,
                "item_count": len(order_set.items),
                "status": "active",
                "message": "Order set created successfully"
            }
        
        except Exception as e:
            logger.error(f"Failed to create order set: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create order set: {str(e)}"
            )

    async def apply_order_set(self, *, set_id: str, patient_id: str, encounter_id: Optional[str] = None, current_user: User):
        """Apply an order set to a patient, creating individual orders. (moved verbatim from the router)."""
        try:
            hapi_client = self.hapi
        
            # Get the order set
            plan_def = await hapi_client.read("PlanDefinition", set_id)
            if not plan_def:
                raise HTTPException(status_code=404, detail="Order set not found")
        
            current_time = datetime.utcnow()
            created_orders = []
            errors = []
        
            # Process each action in the order set
            for action in plan_def.get("action", []):
                try:
                    # Determine order type from extension
                    order_type = "medication"  # default
                    for ext in action.get("extension", []):
                        if "order-type" in ext.get("url", ""):
                            order_type = ext.get("valueString", "medication")
                            break
                
                    # Extract details from action
                    title = action.get("title", "Unknown Order")
                    code_info = action.get("code", [{}])[0] if action.get("code") else {}
                    priority = action.get("priority", "routine")
                
                    if order_type == "medication":
                        # Create MedicationRequest
                        med_request = {
                            "resourceType": "MedicationRequest",
                            "status": "draft",
                            "intent": "order",
                            "priority": priority,
                            "medicationCodeableConcept": code_info if code_info else {"text": title},
                            "subject": {"reference": f"Patient/{patient_id}"},
                            "authoredOn": current_time.isoformat(),
                            "requester": {
                                "reference": f"Practitioner/{current_user.id}",
                                "display": current_user.username
                            },
                            "instantiatesCanonical": [f"PlanDefinition/{set_id}"],
                            "extension": [{
                                "url": f"{ExtensionURLs.BASE_URL}/from-order-set",
                                "valueReference": {"reference": f"PlanDefinition/{set_id}"}
                            }]
                        }
                    
                        if encounter_id:
                            med_request["encounter"] = {"reference": f"Encounter/{encounter_id}"}
                    
                        # Add dosage from extensions
                        dosage_text_parts = []
                        for ext in action.get("extension", []):
                            if "dose" in ext.get("url", ""):
                                qty = ext.get("valueQuantity", {})
                                dosage_text_parts.append(f"{qty.get('value')} {qty.get('unit', '')}")
                            elif "route" in ext.get("url", ""):
                                dosage_text_parts.append(ext.get("valueString", ""))
                            elif "frequency" in ext.get("url", ""):
                                dosage_text_parts.append(ext.get("valueString", ""))
                    
                        if dosage_text_parts:
                            med_request["dosageInstruction"] = [{"text": " ".join(dosage_text_parts)}]
                    
                        created = await hapi_client.create("MedicationRequest", med_request)
                        created_orders.append({
                            "type": "MedicationRequest",
                            "id": created.get("id"),
                            "display": title
                        })
                    
                    else:
                        # Create ServiceRequest for lab/imaging
                        service_request = {
                            "resourceType": "ServiceRequest",
                            "status": "draft",
                            "intent": "order",
                            "priority": priority,
                            "code": code_info if code_info else {"text": title},
                            "subject": {"reference": f"Patient/{patient_id}"},
                            "authoredOn": current_time.isoformat(),
                            "requester": {
                                "reference": f"Practitioner/{current_user.id}",
                                "display": current_user.username
                            },
                            "instantiatesCanonical": [f"PlanDefinition/{set_id}"],
                            "category": [{
                                "coding": [{
                                    "system": "http://snomed.info/sct",
                                    "code": "108252007" if order_type == "laboratory" else "363679005",
                                    "display": "Laboratory procedure" if order_type == "laboratory" else "Imaging"
                                }]
                            }],
                            "extension": [{
                                "url": f"{ExtensionURLs.BASE_URL}/from-order-set",
                                "valueReference": {"reference": f"PlanDefinition/{set_id}"}
                            }]
                        }
                    
                        if encounter_id:
                            service_request["encounter"] = {"reference": f"Encounter/{encounter_id}"}
                    
                        created = await hapi_client.create("ServiceRequest", service_request)
                        created_orders.append({
                            "type": "ServiceRequest",
                            "id": created.get("id"),
                            "display": title
                        })
                    
                except Exception as action_error:
                    errors.append({
                        "action": action.get("title", "Unknown"),
                        "error": str(action_error)
                    })
        
            logger.info(f"Applied order set {set_id} to patient {patient_id}: {len(created_orders)} orders created")
        
            return {
                "order_set_id": set_id,
                "patient_id": patient_id,
                "orders_created": len(created_orders),
                "created_orders": created_orders,
                "errors": errors if errors else None,
                "message": f"Order set applied: {len(created_orders)} orders created" + 
                          (f", {len(errors)} errors" if errors else "")
            }
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to apply order set: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to apply order set: {str(e)}"
            )


def get_orders_service() -> OrdersService:
    """FastAPI dependency — one service per request."""
    return OrdersService()
