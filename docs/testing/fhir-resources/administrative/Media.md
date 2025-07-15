# FHIR Resource Testing: Media

**FHIR R4 Specification**: https://hl7.org/fhir/R4/media.html  
**Test Status**: ❌ Not Started  
**Coverage**: 0% (0/16 test cases passing)

## Resource Overview

### Current Implementation Status
- ❌ **Storage**: No specific storage implementation found
- ❌ **Search Parameters**: Not implemented
- ❌ **Frontend Integration**: No media management features
- ❌ **CRUD Operations**: Not implemented
- ❌ **Validation**: No FHIR R4 compliance

### Supported Search Parameters
| Parameter | Type | Status | R4 Required | Notes |
|-----------|------|--------|-------------|-------|
| _id | token | ❌ | Required | Basic resource ID search |
| _lastUpdated | date | ❌ | Optional | When resource was last updated |
| patient | reference | ❌ | Optional | Patient subject of media |
| subject | reference | ❌ | Optional | Subject of the media |
| encounter | reference | ❌ | Optional | Encounter associated with media |
| based-on | reference | ❌ | Optional | Procedure/ServiceRequest that media documents |
| type | token | ❌ | Optional | Media type (image, video, audio) |
| modality | token | ❌ | Optional | Imaging modality |
| view | token | ❌ | Optional | Imaging view |
| status | token | ❌ | Required | Media status |
| created | date | ❌ | Optional | When media was created |
| operator | reference | ❌ | Optional | Who captured the media |

## Test Cases

### 1. CRUD Operations

#### 1.1 Create Media
**Test ID**: `test_create_media`
**Description**: Create valid Media resource for patient documentation
**Expected Result**: 201 Created with valid FHIR media

```python
def test_create_media():
    media_data = {
        "resourceType": "Media",
        "identifier": [{
            "use": "official",
            "system": "http://www.acme.org/identifiers/media",
            "value": "MEDIA-001"
        }],
        "status": "completed",
        "type": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/media-type",
                "code": "image",
                "display": "Image"
            }]
        },
        "modality": {
            "coding": [{
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": "DX",
                "display": "Digital Radiography"
            }]
        },
        "view": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "399067008",
                "display": "Lateral view"
            }]
        },
        "subject": {
            "reference": "Patient/example",
            "display": "Peter James Chalmers"
        },
        "encounter": {
            "reference": "Encounter/example"
        },
        "createdDateTime": "2024-07-15T10:30:00Z",
        "issued": "2024-07-15T10:35:00Z",
        "operator": {
            "reference": "Practitioner/example",
            "display": "Dr. Operator"
        },
        "reasonCode": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "162673000",
                "display": "General examination of patient"
            }]
        }],
        "bodySite": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "51185008",
                "display": "Thoracic structure"
            }]
        },
        "deviceName": "Acme Imaging System",
        "device": {
            "reference": "Device/example-xray"
        },
        "height": 480,
        "width": 640,
        "frames": 1,
        "duration": 0,
        "content": {
            "contentType": "image/jpeg",
            "language": "en",
            "data": "/9j/4AAQSkZJRgABAQEAlgCWAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYI...",
            "url": "http://example.org/media/chest-xray-001.jpg",
            "size": 12345,
            "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "title": "Chest X-ray - Lateral View",
            "creation": "2024-07-15T10:30:00Z"
        },
        "note": [{
            "text": "Image quality is excellent, no motion artifacts noted"
        }]
    }
    response = client.post("/fhir/Media", json=media_data)
    assert response.status_code == 201
    assert response.json()["resourceType"] == "Media"
    assert response.json()["status"] == "completed"
```

**SQL Validation**:
```sql
SELECT COUNT(*) FROM fhir.resources 
WHERE resource_type = 'Media' 
AND deleted = false;
```

**Status**: ❌ Not Implemented

#### 1.2 Read Media
**Test ID**: `test_read_media`
**Status**: ❌ Not Implemented

#### 1.3 Update Media
**Test ID**: `test_update_media`
**Status**: ❌ Not Implemented

#### 1.4 Delete Media
**Test ID**: `test_delete_media`
**Status**: ❌ Not Implemented

### 2. Search Parameter Tests

#### 2.1 Standard Parameters

##### 2.1.1 Search by _id
**Test ID**: `test_search_media_by_id`
**Status**: ❌ Not Implemented

##### 2.1.2 Search by _lastUpdated
**Test ID**: `test_search_media_by_lastUpdated`
**Status**: ❌ Not Implemented

#### 2.2 Resource-Specific Parameters

##### 2.2.1 Search by Patient
**Test ID**: `test_search_media_by_patient`
**Parameter Type**: reference
**R4 Requirement**: Optional
**Description**: Search media by patient subject

```python
def test_search_media_by_patient():
    response = client.get("/fhir/Media?patient=Patient/123")
    assert response.status_code == 200
    
    # Verify all returned media are for the correct patient
    bundle = response.json()
    for entry in bundle.get("entry", []):
        assert entry["resource"]["subject"]["reference"] == "Patient/123"
```

**Status**: ❌ Not Implemented

##### 2.2.2 Search by Type
**Test ID**: `test_search_media_by_type`
**Parameter Type**: token
**R4 Requirement**: Optional
**Description**: Search media by type (image, video, audio)

```python
def test_search_media_by_type():
    # Search for images
    response = client.get("/fhir/Media?type=image")
    assert response.status_code == 200
    
    # Search for videos
    response = client.get("/fhir/Media?type=video")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

##### 2.2.3 Search by Modality
**Test ID**: `test_search_media_by_modality`
**Parameter Type**: token
**R4 Requirement**: Optional
**Description**: Search media by imaging modality

```python
def test_search_media_by_modality():
    # Search for X-ray images
    response = client.get("/fhir/Media?modality=DX")
    assert response.status_code == 200
    
    # Search for CT images
    response = client.get("/fhir/Media?modality=CT")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

##### 2.2.4 Search by Status
**Test ID**: `test_search_media_by_status`
**Parameter Type**: token
**R4 Requirement**: Required
**Description**: Search media by status

**Status**: ❌ Not Implemented

### 3. Media Management Workflow Tests

#### 3.1 Image Capture Workflow
**Test ID**: `test_image_capture_workflow`
**Description**: Test complete image capture and documentation process

```python
def test_image_capture_workflow():
    # 1. Capture image during encounter
    encounter_id = "Encounter/12345"
    image_data = capture_patient_image(
        patient_id="Patient/123",
        encounter_id=encounter_id,
        device_id="Device/camera-001",
        image_type="wound_photo"
    )
    
    # 2. Create Media resource
    media = create_media_from_image(image_data)
    assert media["status"] == "completed"
    assert media["type"]["coding"][0]["code"] == "image"
    
    # 3. Link to clinical documentation
    observation = create_wound_assessment_with_image(
        patient_id="Patient/123",
        media_id=media["id"]
    )
    assert observation["component"][0]["valueAttachment"]["url"].endswith(media["id"])
    
    # 4. Archive media with retention policy
    archived_media = archive_media(media["id"])
    assert archived_media["status"] == "completed"
```

**Status**: ❌ Not Implemented

#### 3.2 Video Documentation Workflow
**Test ID**: `test_video_documentation_workflow`
**Description**: Test video capture and documentation process

```python
def test_video_documentation_workflow():
    # 1. Record patient video (e.g., gait analysis)
    video_data = record_patient_video(
        patient_id="Patient/123",
        procedure_code="gait_analysis",
        duration_seconds=120
    )
    
    # 2. Create Media resource for video
    media = create_video_media(video_data)
    assert media["type"]["coding"][0]["code"] == "video"
    assert media["duration"] == 120
    
    # 3. Link to procedure documentation
    procedure = create_procedure_with_video(
        patient_id="Patient/123",
        media_id=media["id"],
        procedure_code="gait_analysis"
    )
    assert media["id"] in procedure["supportingInfo"][0]["reference"]
```

**Status**: ❌ Not Implemented

### 4. Integration Tests

#### 4.1 ImagingStudy Integration
**Test ID**: `test_media_imagingstudy_integration`
**Description**: Test integration with ImagingStudy resources

```python
def test_media_imagingstudy_integration():
    # Create imaging study with associated media
    imaging_study = get_imaging_study("ImagingStudy/chest-ct-001")
    
    # Create media for study images
    media_list = create_media_for_imaging_study(imaging_study["id"])
    
    # Verify media references imaging study
    for media in media_list:
        assert media["partOf"][0]["reference"].endswith(imaging_study["id"])
        assert media["modality"]["coding"][0]["code"] == "CT"
```

**Status**: ❌ Not Implemented

#### 4.2 DiagnosticReport Integration
**Test ID**: `test_media_diagnosticreport_integration`
**Description**: Test integration with DiagnosticReport resources

```python
def test_media_diagnosticreport_integration():
    # Create diagnostic report with media attachments
    report_data = create_pathology_report_with_images([
        {"type": "gross_image", "url": "image1.jpg"},
        {"type": "microscopic_image", "url": "image2.jpg"}
    ])
    
    diagnostic_report = create_diagnostic_report(report_data)
    
    # Verify media is properly linked
    assert len(diagnostic_report["media"]) == 2
    for media_ref in diagnostic_report["media"]:
        media = get_resource_by_reference(media_ref["link"]["reference"])
        assert media["resourceType"] == "Media"
```

**Status**: ❌ Not Implemented

### 5. Media Storage and Security Tests

#### 5.1 Media Storage and Retrieval
**Test ID**: `test_media_storage_retrieval`
**Description**: Test secure media storage and retrieval

```python
def test_media_storage_retrieval():
    # Upload media file
    media_file = upload_media_file("patient_photo.jpg", patient_id="Patient/123")
    assert media_file["content"]["contentType"] == "image/jpeg"
    assert "hash" in media_file["content"]
    
    # Retrieve media content
    content = get_media_content(media_file["id"])
    assert len(content) > 0
    
    # Verify integrity
    calculated_hash = calculate_hash(content)
    assert calculated_hash == media_file["content"]["hash"]
```

**Status**: ❌ Not Implemented

#### 5.2 Access Control and Privacy
**Test ID**: `test_media_access_control`
**Description**: Test media access control and patient privacy

```python
def test_media_access_control():
    # Create media with restricted access
    sensitive_media = create_media_with_access_control(
        patient_id="Patient/123",
        access_level="restricted",
        authorized_roles=["physician", "nurse"]
    )
    
    # Test authorized access
    authorized_user = login_as_role("physician")
    media_content = get_media_content(sensitive_media["id"], authorized_user)
    assert media_content is not None
    
    # Test unauthorized access
    unauthorized_user = login_as_role("clerk")
    with pytest.raises(UnauthorizedError):
        get_media_content(sensitive_media["id"], unauthorized_user)
```

**Status**: ❌ Not Implemented

### 6. Error Handling Tests

#### 6.1 Invalid Media Data
**Test ID**: `test_invalid_media_validation`
**Description**: Test validation of malformed media data

```python
def test_invalid_media_validation():
    # Missing required status
    invalid_data = {
        "resourceType": "Media",
        "subject": {"reference": "Patient/123"}
    }
    response = client.post("/fhir/Media", json=invalid_data)
    assert response.status_code == 400
    
    # Invalid content type
    invalid_content = {
        "resourceType": "Media",
        "status": "completed",
        "content": {
            "contentType": "invalid/type"
        }
    }
    response = client.post("/fhir/Media", json=invalid_content)
    assert response.status_code == 400
```

**Status**: ❌ Not Implemented

#### 6.2 Large File Handling
**Test ID**: `test_large_file_handling`
**Description**: Test handling of large media files

**Status**: ❌ Not Implemented

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | No Media resource implementation | Cannot store clinical media | Implement Media CRUD operations |
| CRIT-002 | No media storage system | Cannot manage patient images/videos | Build secure media storage |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | No integration with imaging systems | Fragmented image management | Integrate with DICOM/imaging |
| HIGH-002 | No access control for media | Privacy and security risks | Implement access controls |

### Medium Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| MED-001 | No media compression/optimization | Large storage requirements | Implement media optimization |
| MED-002 | Limited metadata support | Poor media organization | Enhance metadata handling |

## Recommendations

### Immediate Actions Required
1. Implement Media resource CRUD operations and storage
2. Build secure media storage system with access controls
3. Add media search parameters to storage engine
4. Create basic media management interface

### Future Enhancements
1. Implement integration with DICOM imaging systems
2. Add media compression and optimization
3. Build media analytics and reporting
4. Integrate with mobile devices for media capture

## Test Results Summary

**Total Test Cases**: 16  
**Passing**: 0 (0%)  
**Failing**: 0 (0%)  
**Not Implemented**: 16 (100%)

**Coverage by Category**:
- CRUD Operations: 0/4 (0%)
- Search Parameters: 0/8 (0%)
- Media Workflows: 0/2 (0%)
- Integration Tests: 0/2 (0%)
- Storage/Security: 0/2 (0%)
- Error Handling: 0/2 (0%)

## Notes

- Media resources are essential for documenting clinical findings with images/videos
- Integration with existing imaging systems and DICOM infrastructure is critical
- Patient privacy and access control are paramount for clinical media
- Mobile device integration would enhance clinical documentation workflow
- Should integrate with existing ImagingStudy and DiagnosticReport resources

---

**Next Steps**:
1. Implement Media resource in FHIR storage engine
2. Build secure media storage and access control system
3. Create media capture and management interfaces
4. Develop integration with imaging and documentation workflows