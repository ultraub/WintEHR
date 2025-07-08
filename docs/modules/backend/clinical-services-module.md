# Clinical Services Module

## Overview
The Clinical Services Module provides specialized healthcare workflows and domain-specific functionality beyond basic FHIR operations. This module implements pharmacy, laboratory, imaging, and other clinical service integrations.

## Architecture
```
Clinical Services Module
├── Pharmacy Services/
│   ├── prescription_router.py
│   ├── dispensing_service.py
│   └── medication_resolver.py
├── Laboratory Services/
│   ├── lab_router.py
│   ├── result_processor.py
│   └── reference_ranges.py
├── Imaging Services/
│   ├── dicom_router.py
│   ├── dicom_service.py
│   └── study_generator.py
├── Clinical Search/
│   ├── catalog_search.py
│   ├── terminology_service.py
│   └── code_systems.py
└── Order Management/
    ├── order_router.py
    ├── order_service.py
    └── order_sets.py
```

## Pharmacy Services

### Prescription Management
**Purpose**: Handle medication ordering and prescription workflows

**Endpoints**:
```python
# Prescription queue
GET /api/pharmacy/prescriptions/pending
GET /api/pharmacy/prescriptions/{rx_id}

# Dispensing workflow
POST /api/pharmacy/dispense
PUT /api/pharmacy/dispense/{dispense_id}/verify
PUT /api/pharmacy/dispense/{dispense_id}/complete

# Medication information
GET /api/pharmacy/medications/search
GET /api/pharmacy/medications/{med_id}/interactions
```

**Prescription Processing**:
```python
class PrescriptionService:
    async def get_pending_prescriptions(self, pharmacy_id: str = None):
        # Query active MedicationRequests
        query = """
            SELECT * FROM fhir_resources
            WHERE resource_type = 'MedicationRequest'
            AND data->>'status' IN ('active', 'draft')
            AND data->'dispenseRequest'->>'performer' = %s
            AND NOT EXISTS (
                SELECT 1 FROM fhir_resources disp
                WHERE disp.resource_type = 'MedicationDispense'
                AND disp.data->>'status' = 'completed'
                AND disp.data->'authorizingPrescription'->0->>'reference' = 
                    'MedicationRequest/' || fhir_resources.resource_id
            )
        """
        return await self.db.fetch(query, pharmacy_id)
```

### Dispensing Service
**Purpose**: Create MedicationDispense resources and track dispensing

**Dispensing Workflow**:
```python
async def dispense_medication(
    prescription_id: str,
    dispense_data: DispenseRequest
) -> MedicationDispense:
    # Validate prescription
    prescription = await get_medication_request(prescription_id)
    if not prescription:
        raise ValueError("Prescription not found")
    
    # Check insurance/authorization
    auth_result = await check_authorization(
        patient_id=prescription["subject"]["reference"],
        medication=prescription["medicationReference"]
    )
    
    # Create MedicationDispense
    dispense = {
        "resourceType": "MedicationDispense",
        "status": "in-progress",
        "medicationReference": prescription["medicationReference"],
        "subject": prescription["subject"],
        "authorizingPrescription": [{
            "reference": f"MedicationRequest/{prescription_id}"
        }],
        "quantity": dispense_data.quantity,
        "daysSupply": dispense_data.days_supply,
        "whenPrepared": datetime.utcnow().isoformat(),
        "dosageInstruction": prescription.get("dosageInstruction", [])
    }
    
    # Store and return
    return await create_fhir_resource("MedicationDispense", dispense)
```

### Medication Resolution
**Purpose**: Resolve medication references and provide drug information

```python
class MedicationResolver:
    async def resolve_medication_display(self, medication_ref: dict) -> str:
        if "reference" in medication_ref:
            # Fetch Medication resource
            med = await get_medication(medication_ref["reference"])
            return self.format_medication_name(med)
        elif "concept" in medication_ref:
            # Use CodeableConcept
            return medication_ref["concept"]["text"] or \
                   medication_ref["concept"]["coding"][0]["display"]
```

## Laboratory Services

### Lab Result Processing
**Purpose**: Process and enhance laboratory observations

**Result Enhancement**:
```python
class LabResultProcessor:
    async def process_observation(self, observation: dict) -> dict:
        # Add reference ranges
        if "valueQuantity" in observation:
            reference_range = await self.get_reference_range(
                loinc_code=observation["code"]["coding"][0]["code"],
                patient_age=await self.get_patient_age(observation["subject"]),
                patient_gender=await self.get_patient_gender(observation["subject"])
            )
            
            observation["referenceRange"] = [reference_range]
            
            # Flag abnormal values
            observation["interpretation"] = self.calculate_interpretation(
                value=observation["valueQuantity"]["value"],
                reference_range=reference_range
            )
        
        return observation
```

### Reference Range Management
```python
class ReferenceRangeService:
    def get_reference_range(
        self,
        loinc_code: str,
        age: int,
        gender: str
    ) -> dict:
        # Lookup age/gender specific ranges
        range_data = self.reference_db.get(loinc_code, {})
        
        if gender in range_data:
            gender_ranges = range_data[gender]
            for age_range in gender_ranges:
                if age >= age_range["min_age"] and age <= age_range["max_age"]:
                    return {
                        "low": {
                            "value": age_range["low"],
                            "unit": age_range["unit"]
                        },
                        "high": {
                            "value": age_range["high"],
                            "unit": age_range["unit"]
                        },
                        "text": age_range.get("text")
                    }
        
        # Return default range
        return self.get_default_range(loinc_code)
```

### Lab Result Trending
```python
async def get_lab_trends(
    patient_id: str,
    loinc_codes: List[str],
    date_range: DateRange
) -> TrendData:
    observations = await self.get_observations(
        patient_id=patient_id,
        codes=loinc_codes,
        date_range=date_range
    )
    
    # Group by code and sort by date
    trends = defaultdict(list)
    for obs in observations:
        code = obs["code"]["coding"][0]["code"]
        trends[code].append({
            "date": obs["effectiveDateTime"],
            "value": obs["valueQuantity"]["value"],
            "unit": obs["valueQuantity"]["unit"],
            "interpretation": obs.get("interpretation", [])
        })
    
    # Calculate statistics
    for code, values in trends.items():
        trends[code] = {
            "values": sorted(values, key=lambda x: x["date"]),
            "min": min(v["value"] for v in values),
            "max": max(v["value"] for v in values),
            "average": statistics.mean(v["value"] for v in values),
            "trend": self.calculate_trend(values)
        }
    
    return trends
```

## Imaging Services

### DICOM Service
**Purpose**: Medical imaging data management and DICOM file handling

**Study Management**:
```python
class DICOMService:
    async def create_imaging_study(
        self,
        patient_id: str,
        study_data: StudyData
    ) -> ImagingStudy:
        # Generate study UID
        study_uid = generate_dicom_uid()
        
        # Create ImagingStudy resource
        imaging_study = {
            "resourceType": "ImagingStudy",
            "status": "available",
            "subject": {"reference": f"Patient/{patient_id}"},
            "started": study_data.study_date,
            "identifier": [{
                "system": "urn:dicom:uid",
                "value": f"urn:oid:{study_uid}"
            }],
            "numberOfSeries": len(study_data.series),
            "numberOfInstances": sum(len(s.instances) for s in study_data.series),
            "series": []
        }
        
        # Add series information
        for series in study_data.series:
            imaging_study["series"].append(
                self.create_series_element(series)
            )
        
        return await create_fhir_resource("ImagingStudy", imaging_study)
```

### DICOM File Generation
```python
class StudyGenerator:
    async def generate_study_files(
        self,
        study_type: str,
        patient_info: PatientInfo
    ) -> List[DICOMFile]:
        # Get template for study type
        template = self.get_study_template(study_type)
        
        files = []
        for series_template in template.series:
            for instance_num in range(series_template.num_instances):
                # Generate DICOM file
                dcm_file = self.create_dicom_file(
                    patient_info=patient_info,
                    series_info=series_template,
                    instance_number=instance_num
                )
                
                # Add pixel data
                dcm_file.PixelData = self.generate_pixel_data(
                    study_type=study_type,
                    series_type=series_template.type,
                    instance=instance_num
                )
                
                files.append(dcm_file)
        
        return files
```

### Image Retrieval
```python
@router.get("/wado-rs/studies/{study_uid}/series/{series_uid}/instances/{instance_uid}")
async def retrieve_instance(
    study_uid: str,
    series_uid: str,
    instance_uid: str,
    accept: str = Header(default="application/dicom")
):
    # Retrieve DICOM file
    file_path = await get_dicom_file_path(study_uid, series_uid, instance_uid)
    
    if accept == "application/dicom":
        # Return DICOM file
        return FileResponse(
            file_path,
            media_type="application/dicom",
            headers={
                "Content-Disposition": f"attachment; filename={instance_uid}.dcm"
            }
        )
    elif accept == "image/jpeg":
        # Convert to JPEG
        jpeg_data = await convert_dicom_to_jpeg(file_path)
        return Response(
            content=jpeg_data,
            media_type="image/jpeg"
        )
```

## Clinical Search Services

### Catalog Search
**Purpose**: Search clinical terminologies and code systems

**Multi-Source Search**:
```python
class CatalogSearchService:
    async def search_conditions(self, query: str, limit: int = 20):
        results = []
        
        # Search SNOMED CT
        snomed_results = await self.search_snomed(
            query=query,
            semantic_tag="disorder",
            limit=limit
        )
        results.extend(self.format_snomed_results(snomed_results))
        
        # Search ICD-10
        icd10_results = await self.search_icd10(query, limit)
        results.extend(self.format_icd10_results(icd10_results))
        
        # Rank and deduplicate
        return self.rank_results(results, query)[:limit]
```

### Terminology Service
```python
class TerminologyService:
    async def expand_value_set(self, value_set_url: str, filter: str = None):
        # Load value set definition
        value_set = await self.get_value_set(value_set_url)
        
        # Expand includes
        concepts = []
        for include in value_set.get("compose", {}).get("include", []):
            system_concepts = await self.get_system_concepts(
                system=include["system"],
                filters=include.get("filter", [])
            )
            
            if filter:
                system_concepts = [
                    c for c in system_concepts
                    if filter.lower() in c["display"].lower()
                ]
            
            concepts.extend(system_concepts)
        
        return {
            "resourceType": "ValueSet",
            "expansion": {
                "timestamp": datetime.utcnow().isoformat(),
                "contains": concepts
            }
        }
```

## Order Management

### Order Service
**Purpose**: Clinical order entry and management

**Order Creation**:
```python
class OrderService:
    async def create_order(
        self,
        order_type: str,
        order_data: dict,
        practitioner_id: str
    ) -> ServiceRequest:
        # Create ServiceRequest
        service_request = {
            "resourceType": "ServiceRequest",
            "status": "active",
            "intent": "order",
            "priority": order_data.get("priority", "routine"),
            "code": order_data["code"],
            "subject": order_data["subject"],
            "requester": {"reference": f"Practitioner/{practitioner_id}"},
            "authoredOn": datetime.utcnow().isoformat()
        }
        
        # Add type-specific fields
        if order_type == "lab":
            service_request["category"] = [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "108252007",
                    "display": "Laboratory procedure"
                }]
            }]
        elif order_type == "imaging":
            service_request["category"] = [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "363679005",
                    "display": "Imaging"
                }]
            }]
        
        return await create_fhir_resource("ServiceRequest", service_request)
```

### Order Sets
```python
class OrderSetService:
    async def get_recommended_orders(
        self,
        condition_code: str,
        patient_context: PatientContext
    ) -> List[OrderSetRecommendation]:
        # Find matching order sets
        order_sets = await self.find_order_sets_for_condition(condition_code)
        
        recommendations = []
        for order_set in order_sets:
            # Check applicability
            if self.is_applicable(order_set, patient_context):
                recommendations.append({
                    "orderSetId": order_set["id"],
                    "name": order_set["name"],
                    "priority": self.calculate_priority(order_set, patient_context),
                    "orders": order_set["orders"],
                    "rationale": order_set.get("rationale")
                })
        
        return sorted(recommendations, key=lambda x: x["priority"], reverse=True)
```

## Integration Points

### FHIR API Integration
- Creates/updates FHIR resources
- Maintains referential integrity
- Follows FHIR workflow patterns
- Generates proper references

### External Systems
- Laboratory information systems (LIS)
- Radiology information systems (RIS)
- Pharmacy systems
- Terminology servers

### Clinical Decision Support
- Order set recommendations
- Drug interaction checking
- Dosage calculations
- Clinical pathways

## Key Features

### Workflow Automation
- Prescription to dispense flow
- Order to result lifecycle
- Study creation and retrieval
- Result interpretation

### Clinical Safety
- Reference range checking
- Abnormal value flagging
- Drug interaction alerts
- Allergy checking

### Interoperability
- Standard code systems
- DICOM compliance
- HL7 message support
- API standardization

## Educational Value

### Healthcare Workflows
- Pharmacy dispensing process
- Laboratory result lifecycle
- Imaging study management
- Order entry patterns

### Medical Informatics
- Terminology services
- Code system mapping
- Clinical decision support
- Reference data management

### System Integration
- Service orchestration
- Event-driven workflows
- Data transformation
- Error handling

## Missing Features & Improvements

### Planned Enhancements
- E-prescribing integration
- Real-time lab interfaces
- PACS integration
- Clinical pathways engine
- Inventory management

### Technical Improvements
- Microservice architecture
- Event sourcing
- CQRS implementation
- GraphQL API
- Real-time subscriptions

### Clinical Features
- Drug-drug interaction API
- Clinical calculators
- Protocol management
- Quality measures
- Population health

## Best Practices

### Service Design
- Domain-driven design
- Bounded contexts
- Event-driven architecture
- Service composition
- API versioning

### Clinical Safety
- Fail-safe defaults
- Human verification steps
- Audit all actions
- Clear error messages
- Rollback capabilities

### Performance
- Async processing
- Caching strategies
- Batch operations
- Query optimization
- Resource pooling

## Module Dependencies
```
Clinical Services Module
├── FHIR API Module
├── Auth Module
├── Database Module
└── External Services
    ├── Terminology Server
    ├── Drug Database
    ├── Lab Interface
    └── PACS System
```

## Testing Strategy
- Unit tests for business logic
- Integration tests with FHIR API
- Workflow scenario tests
- Performance testing
- Clinical accuracy validation