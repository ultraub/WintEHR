"""
FHIR DocumentReference converters for clinical notes.

Converts between API models and FHIR DocumentReference resources.
"""

from datetime import datetime
from typing import Optional, Dict, Any
import json
import base64


def convert_note_to_document_reference(
    note_data: Dict[str, Any],
    author_id: str
) -> Dict[str, Any]:
    """
    Convert API note data to FHIR DocumentReference resource.

    Args:
        note_data: Note data from API request
        author_id: Practitioner ID who authored the note

    Returns:
        FHIR DocumentReference resource
    """
    # Build SOAP note content if applicable
    soap_sections = []
    if note_data.get('subjective'):
        soap_sections.append(f"SUBJECTIVE:\n{note_data['subjective']}")
    if note_data.get('objective'):
        soap_sections.append(f"\nOBJECTIVE:\n{note_data['objective']}")
    if note_data.get('assessment'):
        soap_sections.append(f"\nASSESSMENT:\n{note_data['assessment']}")
    if note_data.get('plan'):
        soap_sections.append(f"\nPLAN:\n{note_data['plan']}")

    # Add HPI and other sections
    other_sections = []
    if note_data.get('chief_complaint'):
        other_sections.append(f"Chief Complaint: {note_data['chief_complaint']}")
    if note_data.get('history_present_illness'):
        other_sections.append(f"History of Present Illness: {note_data['history_present_illness']}")

    # Combine all sections
    full_content = "\n\n".join(other_sections + soap_sections)

    # Encode content as base64 for FHIR attachment
    content_b64 = base64.b64encode(full_content.encode()).decode()

    # Map note_type to LOINC codes (clinical note types)
    note_type_codes = {
        "progress_note": "11506-3",
        "admission_note": "34849-6",
        "discharge_note": "28655-9",
        "consultation_note": "34140-6",
        "procedure_note": "28570-0",
        "addendum": "81218-0",
        "history_physical": "34117-2"
    }

    loinc_code = note_type_codes.get(note_data.get('note_type', 'progress_note'), "11506-3")

    # Build DocumentReference
    doc_ref = {
        "resourceType": "DocumentReference",
        "status": "current",  # Will map to API status
        "docStatus": "preliminary",  # preliminary, final, amended, etc.
        "type": {
            "coding": [{
                "system": "http://loinc.org",
                "code": loinc_code,
                "display": note_data.get('note_type', 'Progress note').replace('_', ' ').title()
            }],
            "text": note_data.get('note_type', 'Progress note').replace('_', ' ').title()
        },
        "subject": {
            "reference": f"Patient/{note_data['patient_id']}"
        },
        "date": datetime.utcnow().isoformat(),
        "author": [{
            "reference": f"Practitioner/{author_id}"
        }],
        "content": [{
            "attachment": {
                "contentType": "text/plain",
                "data": content_b64,
                "title": f"{note_data.get('note_type', 'Clinical Note')} - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
            }
        }]
    }

    # Add context if encounter provided
    if note_data.get('encounter_id'):
        doc_ref["context"] = {
            "encounter": [{
                "reference": f"Encounter/{note_data['encounter_id']}"
            }]
        }

    # Store additional data in extensions
    extensions = []

    # Template reference
    if note_data.get('template_id'):
        extensions.append({
            "url": "http://wintehr.org/fhir/StructureDefinition/template-id",
            "valueString": note_data['template_id']
        })

    # Cosignature requirements
    if note_data.get('requires_cosignature'):
        extensions.append({
            "url": "http://wintehr.org/fhir/StructureDefinition/requires-cosignature",
            "valueBoolean": True
        })

    if note_data.get('cosigner_id'):
        extensions.append({
            "url": "http://wintehr.org/fhir/StructureDefinition/cosigner",
            "valueReference": {"reference": f"Practitioner/{note_data['cosigner_id']}"}
        })

    # Store structured data as extensions (ROS, physical exam)
    if note_data.get('review_of_systems'):
        extensions.append({
            "url": "http://wintehr.org/fhir/StructureDefinition/review-of-systems",
            "valueString": json.dumps(note_data['review_of_systems'])
        })

    if note_data.get('physical_exam'):
        extensions.append({
            "url": "http://wintehr.org/fhir/StructureDefinition/physical-exam",
            "valueString": json.dumps(note_data['physical_exam'])
        })

    # Parent note for addendums
    if note_data.get('parent_note_id'):
        doc_ref["relatesTo"] = [{
            "code": "appends",
            "target": {
                "reference": f"DocumentReference/{note_data['parent_note_id']}"
            }
        }]

    if extensions:
        doc_ref["extension"] = extensions

    return doc_ref


def convert_document_reference_to_note_response(
    doc_ref: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Convert FHIR DocumentReference to API note response.

    Args:
        doc_ref: FHIR DocumentReference resource

    Returns:
        API note response dictionary
    """
    # Decode content from base64
    content_b64 = doc_ref.get('content', [{}])[0].get('attachment', {}).get('data', '')
    full_content = ""
    if content_b64:
        try:
            full_content = base64.b64decode(content_b64).decode()
        except Exception:
            full_content = ""

    # Parse SOAP sections
    subjective = None
    objective = None
    assessment = None
    plan = None

    if "SUBJECTIVE:" in full_content:
        subjective = full_content.split("SUBJECTIVE:")[1].split("\n\nOBJECTIVE:")[0].strip() if "\n\nOBJECTIVE:" in full_content else full_content.split("SUBJECTIVE:")[1].split("\n\nASSESSMENT:")[0].strip()
    if "OBJECTIVE:" in full_content:
        objective = full_content.split("OBJECTIVE:")[1].split("\n\nASSESSMENT:")[0].strip() if "\n\nASSESSMENT:" in full_content else full_content.split("OBJECTIVE:")[1].split("\n\nPLAN:")[0].strip()
    if "ASSESSMENT:" in full_content:
        assessment = full_content.split("ASSESSMENT:")[1].split("\n\nPLAN:")[0].strip() if "\n\nPLAN:" in full_content else full_content.split("ASSESSMENT:")[1].strip()
    if "PLAN:" in full_content:
        plan = full_content.split("PLAN:")[1].strip()

    # Get extensions
    extensions = {ext['url']: ext for ext in doc_ref.get('extension', [])}

    # Extract values from extensions
    template_id = None
    requires_cosignature = False
    cosigner_id = None
    review_of_systems = None
    physical_exam = None

    if "http://wintehr.org/fhir/StructureDefinition/template-id" in extensions:
        template_id = extensions["http://wintehr.org/fhir/StructureDefinition/template-id"].get('valueString')

    if "http://wintehr.org/fhir/StructureDefinition/requires-cosignature" in extensions:
        requires_cosignature = extensions["http://wintehr.org/fhir/StructureDefinition/requires-cosignature"].get('valueBoolean', False)

    if "http://wintehr.org/fhir/StructureDefinition/cosigner" in extensions:
        cosigner_ref = extensions["http://wintehr.org/fhir/StructureDefinition/cosigner"].get('valueReference', {}).get('reference', '')
        if cosigner_ref:
            cosigner_id = cosigner_ref.split('/')[-1]

    if "http://wintehr.org/fhir/StructureDefinition/review-of-systems" in extensions:
        ros_str = extensions["http://wintehr.org/fhir/StructureDefinition/review-of-systems"].get('valueString')
        if ros_str:
            try:
                review_of_systems = json.loads(ros_str)
            except Exception:
                pass

    if "http://wintehr.org/fhir/StructureDefinition/physical-exam" in extensions:
        pe_str = extensions["http://wintehr.org/fhir/StructureDefinition/physical-exam"].get('valueString')
        if pe_str:
            try:
                physical_exam = json.loads(pe_str)
            except Exception:
                pass

    # Map docStatus to API status
    doc_status = doc_ref.get('docStatus', 'preliminary')
    status_map = {
        'preliminary': 'draft',
        'final': 'signed',
        'amended': 'amended',
        'entered-in-error': 'error'
    }
    status = status_map.get(doc_status, 'draft')

    # Get patient ID
    patient_ref = doc_ref.get('subject', {}).get('reference', '')
    patient_id = patient_ref.split('/')[-1] if patient_ref else None

    # Get encounter ID
    encounter_id = None
    context = doc_ref.get('context', {})
    encounters = context.get('encounter', [])
    if encounters:
        encounter_ref = encounters[0].get('reference', '')
        encounter_id = encounter_ref.split('/')[-1] if encounter_ref else None

    # Get author ID (required for clinical notes)
    authors = doc_ref.get('author', [])
    author_id = "unknown"  # Default for data integrity
    if authors:
        author_ref = authors[0].get('reference', '')
        if author_ref and '/' in author_ref:
            author_id = author_ref.split('/')[-1]

    # Log warning if author is missing (compliance concern)
    if author_id == "unknown":
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"DocumentReference {doc_ref.get('id')} has no author - using 'unknown'")

    # Get note type
    note_type_text = doc_ref.get('type', {}).get('text', 'progress_note')
    note_type = note_type_text.lower().replace(' ', '_')

    # Check for parent note (addendum)
    parent_note_id = None
    relates_to = doc_ref.get('relatesTo', [])
    for relation in relates_to:
        if relation.get('code') == 'appends':
            target_ref = relation.get('target', {}).get('reference', '')
            parent_note_id = target_ref.split('/')[-1] if target_ref else None

    # Parse datetime fields
    created_at = doc_ref.get('date')
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        except Exception:
            created_at = datetime.utcnow()
    elif not created_at:
        created_at = datetime.utcnow()

    updated_at = doc_ref.get('meta', {}).get('lastUpdated')
    if isinstance(updated_at, str):
        try:
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        except Exception:
            updated_at = created_at
    elif not updated_at:
        updated_at = created_at

    signed_at = None
    if status == 'signed':
        signed_at = doc_ref.get('date')
        if isinstance(signed_at, str):
            try:
                signed_at = datetime.fromisoformat(signed_at.replace('Z', '+00:00'))
            except Exception:
                signed_at = None

    # Build response
    return {
        "id": doc_ref.get('id'),
        "patient_id": patient_id,
        "encounter_id": encounter_id,
        "note_type": note_type,
        "template_id": template_id,
        "subjective": subjective,
        "objective": objective,
        "assessment": assessment,
        "plan": plan,
        "chief_complaint": None,  # Would need to parse from full_content
        "history_present_illness": None,  # Would need to parse from full_content
        "review_of_systems": review_of_systems,
        "physical_exam": physical_exam,
        "author_id": author_id,
        "created_at": created_at,
        "updated_at": updated_at,
        "signed_at": signed_at,
        "status": status,
        "version": int(doc_ref.get('meta', {}).get('versionId', 1)),
        "parent_note_id": parent_note_id,
        "requires_cosignature": requires_cosignature,
        "cosigner_id": cosigner_id,
        "cosigned_at": None  # Would need extension
    }


def update_document_reference_status(
    doc_ref: Dict[str, Any],
    new_status: str,
    signer_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update DocumentReference status (for signing operations).

    Args:
        doc_ref: Existing FHIR DocumentReference
        new_status: New status ('signed', 'pending_signature', etc.)
        signer_id: Practitioner ID who signed

    Returns:
        Updated DocumentReference
    """
    # Map API status to FHIR docStatus
    status_map = {
        'draft': 'preliminary',
        'signed': 'final',
        'pending_signature': 'preliminary',
        'amended': 'amended'
    }

    doc_ref['docStatus'] = status_map.get(new_status, 'preliminary')

    # Add signature extension if signed
    if new_status == 'signed' and signer_id:
        if 'extension' not in doc_ref:
            doc_ref['extension'] = []

        doc_ref['extension'].append({
            "url": "http://wintehr.org/fhir/StructureDefinition/signed-by",
            "valueReference": {"reference": f"Practitioner/{signer_id}"}
        })

        doc_ref['extension'].append({
            "url": "http://wintehr.org/fhir/StructureDefinition/signed-at",
            "valueDateTime": datetime.utcnow().isoformat()
        })

    return doc_ref
