"""FHIR ImagingStudy converter for DICOM studies"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fhir.resources.imagingstudy import ImagingStudy
from fhir.resources.imagingstudy import ImagingStudySeries, ImagingStudySeriesInstance
from fhir.resources.reference import Reference
from fhir.resources.identifier import Identifier
from fhir.resources.coding import Coding
from fhir.resources.codeableconcept import CodeableConcept
from models.dicom_models import DICOMStudy, DICOMSeries, DICOMInstance


def dicom_study_to_fhir_imaging_study(dicom_study: DICOMStudy) -> Dict[str, Any]:
    """Convert a DICOM study to FHIR ImagingStudy resource"""
    
    # Build the basic structure
    imaging_study_dict = {
        "resourceType": "ImagingStudy",
        "id": f"imaging-study-{dicom_study.id}",
        "identifier": [
            {
                "system": "urn:dicom:uid",
                "value": f"urn:oid:{dicom_study.study_instance_uid}"
            }
        ],
        "status": "available" if dicom_study.upload_status == "complete" else "unknown",
        "subject": {
            "reference": f"Patient/{dicom_study.patient_id}",
            "display": dicom_study.patient_name
        }
    }
    
    # Add modality
    if dicom_study.modality:
        imaging_study_dict["modality"] = [
            {
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": dicom_study.modality,
                "display": get_modality_display(dicom_study.modality)
            }
        ]
    
    # Add study date/time
    if dicom_study.study_date:
        imaging_study_dict["started"] = dicom_study.study_date.isoformat()
    
    # Add description
    if dicom_study.study_description:
        imaging_study_dict["description"] = dicom_study.study_description
    
    # Add accession number
    if dicom_study.accession_number:
        imaging_study_dict["identifier"].append({
            "type": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": "ACSN",
                        "display": "Accession ID"
                    }
                ]
            },
            "value": dicom_study.accession_number
        })
    
    # Add referring physician
    if dicom_study.referring_physician:
        imaging_study_dict["referrer"] = {
            "display": dicom_study.referring_physician
        }
    
    # Add series
    if dicom_study.series:
        imaging_study_dict["series"] = []
        for series in dicom_study.series:
            series_dict = {
                "uid": series.series_instance_uid,
                "number": series.series_number,
                "modality": {
                    "system": "http://dicom.nema.org/resources/ontology/DCM",
                    "code": series.modality or dicom_study.modality,
                    "display": get_modality_display(series.modality or dicom_study.modality)
                },
                "numberOfInstances": series.number_of_instances
            }
            
            if series.series_description:
                series_dict["description"] = series.series_description
            
            if series.body_part_examined:
                series_dict["bodySite"] = {
                    "display": series.body_part_examined
                }
            
            # Add instances
            if series.instances:
                series_dict["instance"] = []
                for instance in series.instances:
                    instance_dict = {
                        "uid": instance.sop_instance_uid,
                        "sopClass": {
                            "system": "urn:ietf:rfc:3986",
                            "code": f"urn:oid:{instance.sop_class_uid}" if instance.sop_class_uid else "urn:oid:1.2.840.10008.5.1.4.1.1.2"
                        }
                    }
                    
                    if instance.instance_number:
                        instance_dict["number"] = instance.instance_number
                    
                    if instance.instance_title:
                        instance_dict["title"] = instance.instance_title
                    
                    series_dict["instance"].append(instance_dict)
            
            imaging_study_dict["series"].append(series_dict)
    
    # Add counts
    imaging_study_dict["numberOfSeries"] = dicom_study.number_of_series or len(dicom_study.series)
    imaging_study_dict["numberOfInstances"] = dicom_study.number_of_instances
    
    # Add endpoint for WADO access
    imaging_study_dict["endpoint"] = [
        {
            "reference": f"Endpoint/wado-rs-{dicom_study.id}",
            "display": "WADO-RS endpoint"
        }
    ]
    
    # Add procedure reference if available
    if dicom_study.imaging_study_id:
        imaging_study_dict["procedureReference"] = [
            {
                "reference": f"Procedure/{dicom_study.imaging_study_id}"
            }
        ]
    
    return imaging_study_dict


def get_modality_display(modality_code: str) -> str:
    """Get display name for DICOM modality codes"""
    modality_map = {
        "CT": "Computed Tomography",
        "MR": "Magnetic Resonance",
        "US": "Ultrasound",
        "XR": "Digital Radiography",
        "CR": "Computed Radiography",
        "DX": "Digital Radiography",
        "MG": "Mammography",
        "NM": "Nuclear Medicine",
        "PT": "Positron Emission Tomography",
        "OT": "Other",
        "SC": "Secondary Capture",
        "XA": "X-Ray Angiography",
        "RF": "Radiofluoroscopy",
        "RTIMAGE": "RT Image",
        "RTDOSE": "RT Dose",
        "RTSTRUCT": "RT Structure Set",
        "RTPLAN": "RT Plan",
        "PR": "Presentation State",
        "KO": "Key Object Selection",
        "SEG": "Segmentation",
        "REG": "Registration"
    }
    return modality_map.get(modality_code, modality_code)


def create_wado_endpoint(dicom_study: DICOMStudy, base_url: str) -> Dict[str, Any]:
    """Create a FHIR Endpoint resource for WADO-RS access"""
    return {
        "resourceType": "Endpoint",
        "id": f"wado-rs-{dicom_study.id}",
        "status": "active",
        "connectionType": {
            "system": "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
            "code": "dicom-wado-rs",
            "display": "DICOM WADO-RS"
        },
        "name": f"WADO-RS endpoint for study {dicom_study.study_instance_uid}",
        "address": f"{base_url}/api/imaging/wado/studies/{dicom_study.id}",
        "payloadType": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/endpoint-payload-type",
                        "code": "any",
                        "display": "Any"
                    }
                ]
            }
        ]
    }