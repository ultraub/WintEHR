"""
FHIR ServiceRequest Converter

Handles conversion between FHIR ServiceRequest resources and internal data models.
Used for laboratory and imaging orders.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from core.fhir.resources_r4b import (
    ServiceRequest, CodeableConcept, Coding, Reference,
    Identifier, Annotation
)


class ServiceRequestConverter:
    """Converter for FHIR ServiceRequest resources"""
    
    # Category codes for different order types
    CATEGORY_CODES = {
        'laboratory': {
            'system': 'http://snomed.info/sct',
            'code': '108252007',
            'display': 'Laboratory procedure'
        },
        'imaging': {
            'system': 'http://snomed.info/sct',
            'code': '363679005',
            'display': 'Imaging'
        },
        'procedure': {
            'system': 'http://snomed.info/sct',
            'code': '387713003',
            'display': 'Surgical procedure'
        },
        'consult': {
            'system': 'http://snomed.info/sct',
            'code': '386053000',
            'display': 'Consultation'
        }
    }
    
    # Common lab test codes (LOINC)
    LAB_CODES = {
        'cbc': {'code': '58410-2', 'display': 'Complete blood count (CBC) panel'},
        'cmp': {'code': '24323-8', 'display': 'Comprehensive metabolic panel'},
        'bmp': {'code': '24320-4', 'display': 'Basic metabolic panel'},
        'lipid': {'code': '57698-3', 'display': 'Lipid panel'},
        'hba1c': {'code': '4548-4', 'display': 'Hemoglobin A1c'},
        'tsh': {'code': '3016-3', 'display': 'Thyroid stimulating hormone'},
        'ua': {'code': '24356-8', 'display': 'Urinalysis complete'},
        'pt_inr': {'code': '5902-2', 'display': 'Prothrombin time (PT)'},
    }
    
    # Common imaging codes (LOINC/RadLex)
    IMAGING_CODES = {
        'cxr': {'code': '36643-5', 'display': 'Chest X-ray'},
        'ct_head': {'code': '30799-1', 'display': 'Head CT'},
        'ct_chest': {'code': '30746-2', 'display': 'Chest CT'},
        'ct_abdomen': {'code': '30630-8', 'display': 'Abdomen CT'},
        'mri_brain': {'code': '30621-7', 'display': 'Brain MRI'},
        'us_abdomen': {'code': '30704-1', 'display': 'Abdomen ultrasound'},
        'echo': {'code': '34552-0', 'display': 'Echocardiogram'},
        'ekg': {'code': '11524-6', 'display': 'EKG 12 lead'},
    }
    
    @staticmethod
    def to_fhir(data: Dict[str, Any]) -> ServiceRequest:
        """Convert internal order data to FHIR ServiceRequest"""
        
        service_req = ServiceRequest()
        
        # Required fields
        service_req.status = data.get('status', 'active')
        service_req.intent = data.get('intent', 'order')
        
        # Priority
        priority_map = {
            'stat': 'stat',
            'urgent': 'urgent',
            'asap': 'asap',
            'routine': 'routine'
        }
        service_req.priority = priority_map.get(data.get('priority', 'routine'), 'routine')
        
        # Category
        order_type = data.get('orderType', 'laboratory')
        category_info = ServiceRequestConverter.CATEGORY_CODES.get(order_type, ServiceRequestConverter.CATEGORY_CODES['laboratory'])
        
        service_req.category = [CodeableConcept()]
        service_req.category[0].coding = [Coding()]
        service_req.category[0].coding[0].system = category_info['system']
        service_req.category[0].coding[0].code = category_info['code']
        service_req.category[0].coding[0].display = category_info['display']
        
        # Code (what is being ordered)
        code_info = None
        if order_type == 'laboratory' and data.get('code') in ServiceRequestConverter.LAB_CODES:
            code_info = ServiceRequestConverter.LAB_CODES[data['code']]
        elif order_type == 'imaging' and data.get('code') in ServiceRequestConverter.IMAGING_CODES:
            code_info = ServiceRequestConverter.IMAGING_CODES[data['code']]
        
        service_req.code = CodeableConcept()
        service_req.code.coding = [Coding()]
        
        if code_info:
            service_req.code.coding[0].system = "http://loinc.org"
            service_req.code.coding[0].code = code_info['code']
            service_req.code.coding[0].display = code_info['display']
        else:
            # Custom code
            service_req.code.coding[0].system = data.get('codeSystem', 'http://medgenemr.com/orders')
            service_req.code.coding[0].code = data.get('code', 'unknown')
            service_req.code.coding[0].display = data.get('display', data.get('code', 'Unknown'))
        
        if data.get('display'):
            service_req.code.text = data['display']
        
        # Subject (Patient)
        if data.get('patientId'):
            service_req.subject = Reference()
            service_req.subject.reference = f"Patient/{data['patientId']}"
        
        # Encounter
        if data.get('encounterId'):
            service_req.encounter = Reference()
            service_req.encounter.reference = f"Encounter/{data['encounterId']}"
        
        # Requester
        if data.get('orderedBy'):
            service_req.requester = Reference()
            service_req.requester.reference = f"Practitioner/{data['orderedBy']}"
        
        # Authored on
        service_req.authoredOn = data.get('orderedAt', datetime.now().isoformat())
        
        # Occurrence timing
        if data.get('scheduledDate'):
            service_req.occurrenceDateTime = data['scheduledDate']
        
        # Instructions/notes
        if data.get('instructions'):
            service_req.note = [Annotation()]
            service_req.note[0].text = data['instructions']
            if data.get('orderedBy'):
                service_req.note[0].authorReference = Reference()
                service_req.note[0].authorReference.reference = f"Practitioner/{data['orderedBy']}"
        
        # Identifiers
        if data.get('id'):
            service_req.identifier = [Identifier()]
            service_req.identifier[0].system = "http://medgenemr.com/servicerequest"
            service_req.identifier[0].value = str(data['id'])
        
        # Reason
        if data.get('reasonCode'):
            service_req.reasonCode = [CodeableConcept()]
            service_req.reasonCode[0].text = data['reasonCode']
        
        # Location for performance
        if data.get('locationId'):
            service_req.locationReference = [Reference()]
            service_req.locationReference[0].reference = f"Location/{data['locationId']}"
        
        # Specimen (for lab orders)
        if data.get('specimenId'):
            service_req.specimen = [Reference()]
            service_req.specimen[0].reference = f"Specimen/{data['specimenId']}"
        
        return service_req
    
    @staticmethod
    def from_fhir(service_req: ServiceRequest) -> Dict[str, Any]:
        """Convert FHIR ServiceRequest to internal order format"""
        
        # Determine order type from category
        order_type = 'laboratory'  # default
        if service_req.category and service_req.category[0].coding:
            category_code = service_req.category[0].coding[0].code
            if category_code == '363679005':
                order_type = 'imaging'
            elif category_code == '387713003':
                order_type = 'procedure'
            elif category_code == '386053000':
                order_type = 'consult'
        
        # Extract code
        code = None
        display = None
        code_system = None
        
        if service_req.code and service_req.code.coding:
            code = service_req.code.coding[0].code
            display = service_req.code.coding[0].display
            code_system = service_req.code.coding[0].system
        
        if service_req.code and service_req.code.text:
            display = service_req.code.text
        
        # Build internal representation
        data = {
            'resourceType': 'ServiceRequest',
            'id': service_req.id,
            'orderType': order_type,
            'status': service_req.status,
            'intent': service_req.intent,
            'priority': service_req.priority,
            'code': code,
            'display': display,
            'codeSystem': code_system,
            'orderedAt': service_req.authoredOn,
        }
        
        # Extract references
        if service_req.subject and service_req.subject.reference:
            data['patientId'] = service_req.subject.reference.split('/')[-1]
        
        if service_req.encounter and service_req.encounter.reference:
            data['encounterId'] = service_req.encounter.reference.split('/')[-1]
        
        if service_req.requester and service_req.requester.reference:
            data['orderedBy'] = service_req.requester.reference.split('/')[-1]
        
        # Additional fields
        if service_req.occurrenceDateTime:
            data['scheduledDate'] = service_req.occurrenceDateTime
        
        if service_req.note and service_req.note[0].text:
            data['instructions'] = service_req.note[0].text
        
        if service_req.reasonCode and service_req.reasonCode[0].text:
            data['reasonCode'] = service_req.reasonCode[0].text
        
        if service_req.locationReference and service_req.locationReference[0].reference:
            data['locationId'] = service_req.locationReference[0].reference.split('/')[-1]
        
        if service_req.specimen and service_req.specimen[0].reference:
            data['specimenId'] = service_req.specimen[0].reference.split('/')[-1]
        
        # Extract identifiers
        if service_req.identifier:
            for identifier in service_req.identifier:
                if identifier.system == "http://medgenemr.com/servicerequest":
                    data['externalId'] = identifier.value
        
        return data
    
    @staticmethod
    def get_search_params() -> List[Dict[str, Any]]:
        """Get supported search parameters for ServiceRequest"""
        return [
            {
                'name': 'patient',
                'type': 'reference',
                'documentation': 'Search by patient'
            },
            {
                'name': 'encounter',
                'type': 'reference',
                'documentation': 'Search by encounter'
            },
            {
                'name': 'status',
                'type': 'token',
                'documentation': 'Search by status'
            },
            {
                'name': 'intent',
                'type': 'token',
                'documentation': 'Search by intent'
            },
            {
                'name': 'priority',
                'type': 'token',
                'documentation': 'Search by priority'
            },
            {
                'name': 'category',
                'type': 'token',
                'documentation': 'Search by category'
            },
            {
                'name': 'code',
                'type': 'token',
                'documentation': 'Search by code'
            },
            {
                'name': 'authored',
                'type': 'date',
                'documentation': 'Search by authored date'
            },
            {
                'name': 'requester',
                'type': 'reference',
                'documentation': 'Search by requester'
            },
            {
                'name': '_lastUpdated',
                'type': 'date',
                'documentation': 'When the resource version last changed'
            }
        ]