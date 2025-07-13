"""
Extended FHIR Resource Converters
Converts between extended database models and FHIR resources
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from models.fhir_extended_models import (
    Medication, MedicationAdministration, CareTeam, PractitionerRole,
    Claim, ExplanationOfBenefit, SupplyDelivery, Provenance
)
from models.synthea_models import DocumentReference, Coverage
from .helpers import create_reference, create_codeable_concept


def document_reference_to_fhir(doc_ref: DocumentReference) -> Dict[str, Any]:
    """Convert DocumentReference model to FHIR format using standardized converter"""
    # Use the new DocumentReferenceConverter for proper FHIR compliance
    from .document_reference import DocumentReferenceConverter
    
    if doc_ref.fhir_json:
        # If we have stored FHIR JSON, validate it has proper structure
        fhir_data = doc_ref.fhir_json.copy()
        
        # Ensure it has the proper resource type and ID
        fhir_data["resourceType"] = "DocumentReference"
        fhir_data["id"] = doc_ref.synthea_id or doc_ref.id
        
        return fhir_data
    
    # Convert model fields to internal format for the new converter
    internal_data = {
        "id": doc_ref.synthea_id or doc_ref.id,
        "status": doc_ref.status or "current",
        "docStatus": doc_ref.doc_status or "preliminary",
        "type": "progress",  # Default, will be extracted from type field if available
        "patientId": doc_ref.patient_id,
        "encounterId": doc_ref.encounter_id,
        "authorId": doc_ref.authenticator_id,
        "createdAt": doc_ref.date.isoformat() if doc_ref.date else None,
        "description": doc_ref.description,
        "contentType": "text",  # Default
        "content": ""
    }
    
    # Extract type from FHIR type structure if available
    if doc_ref.type and isinstance(doc_ref.type, dict):
        if doc_ref.type.get("coding") and len(doc_ref.type["coding"]) > 0:
            loinc_code = doc_ref.type["coding"][0].get("code")
            # Map LOINC code back to note type
            for note_type, type_info in DocumentReferenceConverter.NOTE_TYPE_CODES.items():
                if type_info["code"] == loinc_code:
                    internal_data["type"] = note_type
                    break
    
    # Extract content from various possible formats
    if doc_ref.content:
        if isinstance(doc_ref.content, list) and len(doc_ref.content) > 0:
            content_item = doc_ref.content[0]
            if isinstance(content_item, dict):
                # Check for attachment with data (proper FHIR format)
                attachment = content_item.get("attachment", {})
                if attachment.get("data"):
                    # Content is already in proper FHIR format, return it directly
                    fhir_data = {
                        "resourceType": "DocumentReference",
                        "id": internal_data["id"],
                        "status": internal_data["status"],
                        "docStatus": internal_data["docStatus"],
                        "content": doc_ref.content,
                        "type": doc_ref.type,
                        "category": doc_ref.category if isinstance(doc_ref.category, list) else [doc_ref.category] if doc_ref.category else [],
                        "subject": {"reference": f"Patient/{doc_ref.patient_id}"} if doc_ref.patient_id else None,
                        "date": internal_data["createdAt"],
                        "description": internal_data["description"]
                    }
                    
                    # Add context for encounter
                    if doc_ref.encounter_id:
                        fhir_data["context"] = [{"reference": f"Encounter/{doc_ref.encounter_id}"}]
                    
                    # Add author
                    if doc_ref.authenticator_id:
                        fhir_data["author"] = [{"reference": f"Practitioner/{doc_ref.authenticator_id}"}]
                    
                    # Remove None values
                    return {k: v for k, v in fhir_data.items() if v is not None}
                else:
                    # Content might be stored as plain text/JSON
                    internal_data["content"] = str(content_item)
            else:
                internal_data["content"] = str(doc_ref.content[0])
        else:
            internal_data["content"] = str(doc_ref.content)
    
    # Use the new converter to create proper FHIR structure
    try:
        return DocumentReferenceConverter.to_fhir(internal_data).dict()
    except Exception as e:
        # Fallback to basic structure if conversion fails
        return {
            "resourceType": "DocumentReference", 
            "id": internal_data["id"],
            "status": internal_data["status"],
            "subject": {"reference": f"Patient/{doc_ref.patient_id}"} if doc_ref.patient_id else None,
            "content": [{
                "attachment": {
                    "contentType": "text/plain",
                    "data": "",
                    "title": "Document"
                }
            }],
            "type": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "11506-3",
                    "display": "Progress note"
                }]
            }
        }


def medication_to_fhir(medication: Medication) -> Dict[str, Any]:
    """Convert Medication model to FHIR format"""
    if medication.fhir_json:
        return medication.fhir_json
    
    fhir_med = {
        "resourceType": "Medication",
        "id": medication.synthea_id or medication.id,
        "status": medication.status or "active"
    }
    
    # Add identifiers
    if medication.identifier:
        fhir_med["identifier"] = medication.identifier
    
    # Add code (required)
    if medication.code:
        fhir_med["code"] = medication.code
    
    # Add manufacturer
    if medication.manufacturer_id:
        fhir_med["manufacturer"] = create_reference("Organization", medication.manufacturer_id)
    
    # Add form
    if medication.form:
        fhir_med["form"] = medication.form
    
    # Add amount
    if medication.amount:
        fhir_med["amount"] = medication.amount
    
    # Add ingredients
    if medication.ingredient:
        fhir_med["ingredient"] = medication.ingredient
    
    # Add batch information
    if medication.batch:
        fhir_med["batch"] = medication.batch
    
    return fhir_med


def medication_administration_to_fhir(med_admin: MedicationAdministration) -> Dict[str, Any]:
    """Convert MedicationAdministration model to FHIR format"""
    if med_admin.fhir_json:
        return med_admin.fhir_json
    
    fhir_admin = {
        "resourceType": "MedicationAdministration",
        "id": med_admin.synthea_id or med_admin.id,
        "status": med_admin.status
    }
    
    # Add identifiers
    if med_admin.identifier:
        fhir_admin["identifier"] = med_admin.identifier
    
    # Add subject (required)
    if med_admin.patient_id:
        fhir_admin["subject"] = create_reference("Patient", med_admin.patient_id)
    
    # Add context/encounter
    if med_admin.encounter_id:
        fhir_admin["context"] = create_reference("Encounter", med_admin.encounter_id)
    
    # Add medication
    if med_admin.medication_codeable_concept:
        fhir_admin["medicationCodeableConcept"] = med_admin.medication_codeable_concept
    elif med_admin.medication_reference_id:
        fhir_admin["medicationReference"] = create_reference("Medication", med_admin.medication_reference_id)
    
    # Add effective time
    if med_admin.effective_datetime:
        fhir_admin["effectiveDateTime"] = med_admin.effective_datetime.isoformat()
    elif med_admin.effective_period:
        fhir_admin["effectivePeriod"] = med_admin.effective_period
    
    # Add request reference
    if med_admin.medication_request_id:
        fhir_admin["request"] = create_reference("MedicationRequest", med_admin.medication_request_id)
    
    # Add performer
    if med_admin.performer:
        fhir_admin["performer"] = med_admin.performer
    
    # Add dosage
    if med_admin.dosage:
        fhir_admin["dosage"] = med_admin.dosage
    
    # Add reason
    if med_admin.reason_code:
        fhir_admin["reasonCode"] = med_admin.reason_code
    if med_admin.reason_reference:
        fhir_admin["reasonReference"] = med_admin.reason_reference
    
    # Add note
    if med_admin.note:
        fhir_admin["note"] = med_admin.note
    
    return fhir_admin


def care_team_to_fhir(care_team: CareTeam) -> Dict[str, Any]:
    """Convert CareTeam model to FHIR format"""
    if care_team.fhir_json:
        return care_team.fhir_json
    
    fhir_team = {
        "resourceType": "CareTeam",
        "id": care_team.synthea_id or care_team.id,
        "status": care_team.status or "active"
    }
    
    # Add identifiers
    if care_team.identifier:
        fhir_team["identifier"] = care_team.identifier
    
    # Add name
    if care_team.name:
        fhir_team["name"] = care_team.name
    
    # Add subject (required)
    if care_team.subject_id:
        fhir_team["subject"] = create_reference("Patient", care_team.subject_id)
    
    # Add encounter
    if care_team.encounter_id:
        fhir_team["encounter"] = create_reference("Encounter", care_team.encounter_id)
    
    # Add period
    if care_team.period:
        fhir_team["period"] = care_team.period
    
    # Add participants
    if care_team.participant:
        fhir_team["participant"] = care_team.participant
    
    # Add reason
    if care_team.reason_code:
        fhir_team["reasonCode"] = care_team.reason_code
    if care_team.reason_reference:
        fhir_team["reasonReference"] = care_team.reason_reference
    
    # Add managing organization
    if care_team.managing_organization:
        fhir_team["managingOrganization"] = care_team.managing_organization
    
    # Add telecom
    if care_team.telecom:
        fhir_team["telecom"] = care_team.telecom
    
    # Add note
    if care_team.note:
        fhir_team["note"] = care_team.note
    
    return fhir_team


def practitioner_role_to_fhir(role: PractitionerRole) -> Dict[str, Any]:
    """Convert PractitionerRole model to FHIR format"""
    if role.fhir_json:
        return role.fhir_json
    
    fhir_role = {
        "resourceType": "PractitionerRole",
        "id": role.synthea_id or role.id,
        "active": role.active
    }
    
    # Add identifiers
    if role.identifier:
        fhir_role["identifier"] = role.identifier
    
    # Add practitioner
    if role.practitioner_id:
        fhir_role["practitioner"] = create_reference("Practitioner", role.practitioner_id)
    
    # Add organization
    if role.organization_id:
        fhir_role["organization"] = create_reference("Organization", role.organization_id)
    
    # Add period
    if role.period:
        fhir_role["period"] = role.period
    
    # Add code (roles)
    if role.code:
        fhir_role["code"] = role.code
    
    # Add specialty
    if role.specialty:
        fhir_role["specialty"] = role.specialty
    
    # Add location
    if role.location:
        fhir_role["location"] = role.location
    
    # Add healthcare service
    if role.healthcare_service:
        fhir_role["healthcareService"] = role.healthcare_service
    
    # Add telecom
    if role.telecom:
        fhir_role["telecom"] = role.telecom
    
    # Add availability
    if role.available_time:
        fhir_role["availableTime"] = role.available_time
    if role.not_available:
        fhir_role["notAvailable"] = role.not_available
    if role.availability_exceptions:
        fhir_role["availabilityExceptions"] = role.availability_exceptions
    
    return fhir_role


def coverage_to_fhir(coverage: Coverage) -> Dict[str, Any]:
    """Convert Coverage model to FHIR format"""
    if coverage.fhir_json:
        return coverage.fhir_json
    
    fhir_coverage = {
        "resourceType": "Coverage",
        "id": coverage.synthea_id or coverage.id,
        "status": coverage.status or "active"
    }
    
    # Add identifiers
    if coverage.identifier:
        fhir_coverage["identifier"] = coverage.identifier
    
    # Add type
    if coverage.type:
        fhir_coverage["type"] = coverage.type
    
    # Add policyholder
    if coverage.policy_holder_id:
        fhir_coverage["policyHolder"] = create_reference("Patient", coverage.policy_holder_id)
    
    # Add subscriber
    if coverage.subscriber_id:
        fhir_coverage["subscriber"] = create_reference("Patient", coverage.subscriber_id)
    
    # Add beneficiary (required)
    if coverage.beneficiary_id:
        fhir_coverage["beneficiary"] = create_reference("Patient", coverage.beneficiary_id)
    
    # Add dependent
    if coverage.dependent:
        fhir_coverage["dependent"] = coverage.dependent
    
    # Add relationship
    if coverage.relationship:
        fhir_coverage["relationship"] = coverage.relationship
    
    # Add period
    if coverage.period:
        fhir_coverage["period"] = coverage.period
    
    # Add payor
    if coverage.payor_id:
        fhir_coverage["payor"] = [create_reference("Organization", coverage.payor_id)]
    
    # Add class
    if coverage.class_:
        fhir_coverage["class"] = coverage.class_
    
    # Add order
    if coverage.order:
        fhir_coverage["order"] = coverage.order
    
    # Add network
    if coverage.network:
        fhir_coverage["network"] = coverage.network
    
    # Add cost to beneficiary
    if coverage.cost_to_beneficiary:
        fhir_coverage["costToBeneficiary"] = coverage.cost_to_beneficiary
    
    # Add subrogation
    if coverage.subrogation is not None:
        fhir_coverage["subrogation"] = coverage.subrogation
    
    # Add contract
    if coverage.contract:
        fhir_coverage["contract"] = coverage.contract
    
    return fhir_coverage


def claim_to_fhir(claim: Claim) -> Dict[str, Any]:
    """Convert Claim model to FHIR format"""
    if claim.fhir_json:
        return claim.fhir_json
    
    fhir_claim = {
        "resourceType": "Claim",
        "id": claim.synthea_id or claim.id,
        "status": claim.status,
        "use": claim.use or "claim"
    }
    
    # Add identifiers
    if claim.identifier:
        fhir_claim["identifier"] = claim.identifier
    
    # Add type
    if claim.type:
        fhir_claim["type"] = claim.type
    
    # Add subtype
    if claim.subtype:
        fhir_claim["subType"] = claim.subtype
    
    # Add patient (required)
    if claim.patient_id:
        fhir_claim["patient"] = create_reference("Patient", claim.patient_id)
    
    # Add created (required)
    if claim.created:
        fhir_claim["created"] = claim.created.isoformat()
    
    # Add provider (required)
    if claim.provider_id:
        fhir_claim["provider"] = create_reference("Organization", claim.provider_id)
    
    # Add insurer
    if claim.insurer_id:
        fhir_claim["insurer"] = create_reference("Organization", claim.insurer_id)
    
    # Add priority
    if claim.priority:
        fhir_claim["priority"] = claim.priority
    
    # Add billable period
    if claim.billable_period:
        fhir_claim["billablePeriod"] = claim.billable_period
    
    # Add insurance
    if claim.insurance:
        fhir_claim["insurance"] = claim.insurance
    
    # Add items
    if claim.item:
        fhir_claim["item"] = claim.item
    
    # Add total
    if claim.total:
        fhir_claim["total"] = claim.total
    
    # Add supporting info
    if claim.supporting_info:
        fhir_claim["supportingInfo"] = claim.supporting_info
    
    # Add diagnosis
    if claim.diagnosis:
        fhir_claim["diagnosis"] = claim.diagnosis
    
    # Add procedure
    if claim.procedure:
        fhir_claim["procedure"] = claim.procedure
    
    # Add accident
    if claim.accident:
        fhir_claim["accident"] = claim.accident
    
    # Add payee
    if claim.payee:
        fhir_claim["payee"] = claim.payee
    
    # Add prescription
    if claim.prescription:
        fhir_claim["prescription"] = claim.prescription
    
    return fhir_claim


def explanation_of_benefit_to_fhir(eob: ExplanationOfBenefit) -> Dict[str, Any]:
    """Convert ExplanationOfBenefit model to FHIR format"""
    if eob.fhir_json:
        return eob.fhir_json
    
    fhir_eob = {
        "resourceType": "ExplanationOfBenefit",
        "id": eob.synthea_id or eob.id,
        "status": eob.status,
        "use": eob.use or "claim"
    }
    
    # Add identifiers
    if eob.identifier:
        fhir_eob["identifier"] = eob.identifier
    
    # Add type
    if eob.type:
        fhir_eob["type"] = eob.type
    
    # Add subtype
    if eob.subtype:
        fhir_eob["subType"] = eob.subtype
    
    # Add patient (required)
    if eob.patient_id:
        fhir_eob["patient"] = create_reference("Patient", eob.patient_id)
    
    # Add created (required)
    if eob.created:
        fhir_eob["created"] = eob.created.isoformat()
    
    # Add insurer (required)
    if eob.insurer_id:
        fhir_eob["insurer"] = create_reference("Organization", eob.insurer_id)
    
    # Add provider
    if eob.provider_id:
        fhir_eob["provider"] = create_reference("Organization", eob.provider_id)
    
    # Add claim
    if eob.claim_id:
        fhir_eob["claim"] = create_reference("Claim", eob.claim_id)
    
    # Add outcome (required)
    if eob.outcome:
        fhir_eob["outcome"] = eob.outcome
    
    # Add disposition
    if eob.disposition:
        fhir_eob["disposition"] = eob.disposition
    
    # Add billable period
    if eob.billable_period:
        fhir_eob["billablePeriod"] = eob.billable_period
    
    # Add insurance
    if eob.insurance:
        fhir_eob["insurance"] = eob.insurance
    
    # Add items
    if eob.item:
        fhir_eob["item"] = eob.item
    
    # Add adjudication
    if eob.adjudication:
        fhir_eob["adjudication"] = eob.adjudication
    
    # Add total
    if eob.total:
        fhir_eob["total"] = eob.total
    
    # Add payment
    if eob.payment:
        fhir_eob["payment"] = eob.payment
    
    # Add benefit balance
    if eob.benefit_balance:
        fhir_eob["benefitBalance"] = eob.benefit_balance
    
    # Add benefit period
    if eob.benefit_period:
        fhir_eob["benefitPeriod"] = eob.benefit_period
    
    return fhir_eob


def supply_delivery_to_fhir(delivery: SupplyDelivery) -> Dict[str, Any]:
    """Convert SupplyDelivery model to FHIR format"""
    if delivery.fhir_json:
        return delivery.fhir_json
    
    fhir_delivery = {
        "resourceType": "SupplyDelivery",
        "id": delivery.synthea_id or delivery.id
    }
    
    # Add identifiers
    if delivery.identifier:
        fhir_delivery["identifier"] = delivery.identifier
    
    # Add status
    if delivery.status:
        fhir_delivery["status"] = delivery.status
    
    # Add patient
    if delivery.patient_id:
        fhir_delivery["patient"] = create_reference("Patient", delivery.patient_id)
    
    # Add type
    if delivery.type:
        fhir_delivery["type"] = delivery.type
    
    # Add supplied item
    if delivery.supplied_item:
        fhir_delivery["suppliedItem"] = delivery.supplied_item
    
    # Add occurrence
    if delivery.occurrence_datetime:
        fhir_delivery["occurrenceDateTime"] = delivery.occurrence_datetime.isoformat()
    elif delivery.occurrence_period:
        fhir_delivery["occurrencePeriod"] = delivery.occurrence_period
    elif delivery.occurrence_timing:
        fhir_delivery["occurrenceTiming"] = delivery.occurrence_timing
    
    # Add supplier
    if delivery.supplier_id:
        fhir_delivery["supplier"] = create_reference("Organization", delivery.supplier_id)
    
    # Add destination
    if delivery.destination_id:
        fhir_delivery["destination"] = create_reference("Location", delivery.destination_id)
    
    # Add receiver
    if delivery.receiver:
        fhir_delivery["receiver"] = delivery.receiver
    
    # Add based on
    if delivery.based_on:
        fhir_delivery["basedOn"] = delivery.based_on
    
    # Add part of
    if delivery.part_of:
        fhir_delivery["partOf"] = delivery.part_of
    
    return fhir_delivery


def provenance_to_fhir(provenance: Provenance) -> Dict[str, Any]:
    """Convert Provenance model to FHIR format"""
    if provenance.fhir_json:
        return provenance.fhir_json
    
    fhir_prov = {
        "resourceType": "Provenance",
        "id": provenance.synthea_id or provenance.id,
        "target": provenance.target,
        "recorded": provenance.recorded.isoformat()
    }
    
    # Add occurred
    if provenance.occurred_datetime:
        fhir_prov["occurredDateTime"] = provenance.occurred_datetime.isoformat()
    elif provenance.occurred_period:
        fhir_prov["occurredPeriod"] = provenance.occurred_period
    
    # Add policy
    if provenance.policy:
        fhir_prov["policy"] = provenance.policy
    
    # Add location
    if provenance.location_id:
        fhir_prov["location"] = create_reference("Location", provenance.location_id)
    
    # Add reason
    if provenance.reason:
        fhir_prov["reason"] = provenance.reason
    
    # Add activity
    if provenance.activity:
        fhir_prov["activity"] = provenance.activity
    
    # Add agent (required)
    if provenance.agent:
        fhir_prov["agent"] = provenance.agent
    
    # Add entity
    if provenance.entity:
        fhir_prov["entity"] = provenance.entity
    
    # Add signature
    if provenance.signature:
        fhir_prov["signature"] = provenance.signature
    
    return fhir_prov