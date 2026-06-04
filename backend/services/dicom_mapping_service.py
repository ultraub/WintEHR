#!/usr/bin/env python3
"""
DICOM to FHIR ImagingStudy Mapping Service

Provides comprehensive mapping from DICOM objects and metadata to FHIR ImagingStudy resources.
Supports both database model conversions and raw DICOM file processing.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import pydicom
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class DICOMToImagingStudyMapper:
    """Maps DICOM data to FHIR ImagingStudy resources."""

    # DICOM Modality to display name mapping
    MODALITY_DISPLAY_MAP = {
        "CT": "Computed Tomography",
        "MR": "Magnetic Resonance",
        "MRI": "Magnetic Resonance Imaging",
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
        "REG": "Registration",
        "ECHO": "Echocardiography",
        "ES": "Endoscopy",
        "OP": "Ophthalmic Photography",
        "OPT": "Ophthalmic Tomography",
        "IVUS": "Intravascular Ultrasound",
        "EPS": "Cardiac Electrophysiology",
    }

    # Body part to body site coding mapping
    BODY_PART_CODING_MAP = {
        "HEAD": ("http://snomed.info/sct", "69536005", "Head structure"),
        "CHEST": ("http://snomed.info/sct", "51185008", "Thoracic structure"),
        "ABDOMEN": ("http://snomed.info/sct", "52790841", "Abdominal structure"),
        "PELVIS": ("http://snomed.info/sct", "12921003", "Pelvis structure"),
        "EXTREMITY": ("http://snomed.info/sct", "66019005", "Limb structure"),
        "SPINE": ("http://snomed.info/sct", "29627003", "Spinal column"),
    }

    @staticmethod
    def get_modality_display(modality_code: str) -> str:
        """Get display name for DICOM modality code."""
        return DICOMToImagingStudyMapper.MODALITY_DISPLAY_MAP.get(
            modality_code.upper(), modality_code
        )

    @staticmethod
    def parse_dicom_datetime(date_str: str, time_str: str = "") -> Optional[str]:
        """Parse DICOM date and time strings to ISO format."""
        try:
            if not date_str:
                return None

            # DICOM format: YYYYMMDD for date, HHMMSS.FFFFFF for time
            date_obj = datetime.strptime(date_str, "%Y%m%d")

            if time_str:
                time_obj = datetime.strptime(time_str[:6], "%H%M%S")
                combined = datetime.combine(date_obj.date(), time_obj.time())
                return combined.isoformat()

            return date_obj.isoformat()
        except (ValueError, AttributeError) as e:
            logger.warning(f"Failed to parse DICOM datetime: {date_str} {time_str}: {e}")
            return None

    @staticmethod
    def extract_dicom_metadata(dcm_file_path: str) -> Dict[str, Any]:
        """
        Extract comprehensive metadata from a DICOM file.

        Args:
            dcm_file_path: Path to DICOM file

        Returns:
            Dictionary of extracted metadata
        """
        try:
            ds = pydicom.dcmread(dcm_file_path, stop_before_pixels=True, force=True)

            metadata = {
                # Study-level UIDs
                "study_instance_uid": str(ds.get("StudyInstanceUID", "")).strip(),
                "accession_number": str(ds.get("AccessionNumber", "")).strip(),
                "study_description": str(ds.get("StudyDescription", "")).strip(),
                # Study timing
                "study_date": str(ds.get("StudyDate", "")).strip(),
                "study_time": str(ds.get("StudyTime", "")).strip(),
                # Patient information
                "patient_id": str(ds.get("PatientID", "")).strip(),
                "patient_name": str(ds.get("PatientName", "")).strip(),
                "patient_birth_date": str(ds.get("PatientBirthDate", "")).strip(),
                "patient_sex": str(ds.get("PatientSex", "")).strip(),
                # Series-level data
                "series_instance_uid": str(ds.get("SeriesInstanceUID", "")).strip(),
                "series_number": int(ds.get("SeriesNumber", 0)),
                "series_date": str(ds.get("SeriesDate", "")).strip(),
                "series_time": str(ds.get("SeriesTime", "")).strip(),
                "series_description": str(ds.get("SeriesDescription", "")).strip(),
                "modality": str(ds.get("Modality", "")).strip().upper(),
                "body_part_examined": str(ds.get("BodyPartExamined", "")).strip(),
                "protocol_name": str(ds.get("ProtocolName", "")).strip(),
                # Instance-level data
                "sop_instance_uid": str(ds.get("SOPInstanceUID", "")).strip(),
                "sop_class_uid": str(ds.get("SOPClassUID", "")).strip(),
                "instance_number": int(ds.get("InstanceNumber", 0)),
                # Image geometry
                "rows": int(ds.get("Rows", 0)),
                "columns": int(ds.get("Columns", 0)),
                "pixel_spacing": DICOMToImagingStudyMapper._parse_pixel_spacing(
                    ds.get("PixelSpacing", [1.0, 1.0])
                ),
                "slice_thickness": float(ds.get("SliceThickness", 1.0)),
                "slice_location": float(ds.get("SliceLocation", 0.0)),
                # Window/Level
                "window_center": float(ds.get("WindowCenter", 128))
                if ds.get("WindowCenter") is not None
                else 128,
                "window_width": float(ds.get("WindowWidth", 256))
                if ds.get("WindowWidth") is not None
                else 256,
                # Image characterization
                "photometric_interpretation": str(
                    ds.get("PhotometricInterpretation", "")
                ).strip(),
                "bits_allocated": int(ds.get("BitsAllocated", 16)),
                "bits_stored": int(ds.get("BitsStored", 12)),
                "rescale_intercept": float(ds.get("RescaleIntercept", 0)),
                "rescale_slope": float(ds.get("RescaleSlope", 1)),
                # Position and orientation
                "image_position_patient": DICOMToImagingStudyMapper._parse_coords(
                    ds.get("ImagePositionPatient", [0, 0, 0])
                ),
                "image_orientation_patient": DICOMToImagingStudyMapper._parse_coords(
                    ds.get("ImageOrientationPatient", [1, 0, 0, 0, 1, 0])
                ),
                # Referrer/Physician
                "referring_physician": str(ds.get("ReferringPhysicianName", "")).strip(),
                "performing_physician": str(
                    ds.get("PerformingPhysicianName", "")
                ).strip(),
            }

            return metadata

        except Exception as e:
            logger.error(f"Error extracting DICOM metadata from {dcm_file_path}: {e}")
            raise

    @staticmethod
    def _parse_pixel_spacing(pixel_spacing) -> List[float]:
        """Parse DICOM pixel spacing to list of floats."""
        try:
            if hasattr(pixel_spacing, "__iter__"):
                return [float(p) for p in pixel_spacing]
            return [1.0, 1.0]
        except (TypeError, ValueError):
            return [1.0, 1.0]

    @staticmethod
    def _parse_coords(coords) -> List[float]:
        """Parse DICOM coordinate arrays to list of floats."""
        try:
            if hasattr(coords, "__iter__"):
                return [float(c) for c in coords]
            return []
        except (TypeError, ValueError):
            return []

    @staticmethod
    def map_dicom_metadata_to_imaging_study(
        metadata: Dict[str, Any],
        patient_id: str,
        imaging_study_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Map extracted DICOM metadata to FHIR ImagingStudy resource.

        Args:
            metadata: Dictionary of DICOM metadata (from extract_dicom_metadata)
            patient_id: FHIR Patient ID
            imaging_study_id: Optional FHIR ImagingStudy ID

        Returns:
            FHIR ImagingStudy resource as dictionary
        """
        # Parse study datetime
        study_started = DICOMToImagingStudyMapper.parse_dicom_datetime(
            metadata.get("study_date", ""), metadata.get("study_time", "")
        )

        # Build imaging study resource
        imaging_study = {
            "resourceType": "ImagingStudy",
            "id": imaging_study_id or f"imaging-{metadata.get('study_instance_uid', 'unknown')}",
            "identifier": [
                {
                    "system": "urn:dicom:uid",
                    "value": f"urn:oid:{metadata.get('study_instance_uid')}",
                },
            ],
            "status": "available",
            "subject": {
                "reference": f"Patient/{patient_id}",
            },
        }

        # Add modality
        modality_code = metadata.get("modality", "OT")
        imaging_study["modality"] = [
            {
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": modality_code,
                "display": DICOMToImagingStudyMapper.get_modality_display(modality_code),
            }
        ]

        # Add timing
        if study_started:
            imaging_study["started"] = study_started

        # Add description
        if metadata.get("study_description"):
            imaging_study["description"] = metadata.get("study_description")

        # Add accession number
        if metadata.get("accession_number"):
            imaging_study["identifier"].append(
                {
                    "type": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                "code": "ACSN",
                                "display": "Accession ID",
                            }
                        ]
                    },
                    "value": metadata.get("accession_number"),
                }
            )

        # Add referring physician
        if metadata.get("referring_physician"):
            imaging_study["referrer"] = {
                "display": metadata.get("referring_physician"),
            }

        # Build series information
        series_data = {
            "uid": metadata.get("series_instance_uid", ""),
            "number": metadata.get("series_number", 0),
            "modality": {
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": modality_code,
                "display": DICOMToImagingStudyMapper.get_modality_display(modality_code),
            },
        }

        # Add series description
        if metadata.get("series_description"):
            series_data["description"] = metadata.get("series_description")

        # Add body site if available
        body_part = metadata.get("body_part_examined", "").upper()
        if body_part:
            body_site_coding = DICOMToImagingStudyMapper.BODY_PART_CODING_MAP.get(
                body_part,
                ("http://terminology.hl7.org/CodeSystem/DICOM-au-bodySite", body_part, body_part),
            )
            series_data["bodySite"] = {
                "coding": [
                    {
                        "system": body_site_coding[0],
                        "code": body_site_coding[1],
                        "display": body_site_coding[2],
                    }
                ]
            }

        # Add instance
        instance_data = {
            "uid": metadata.get("sop_instance_uid", ""),
            "sopClass": {
                "system": "urn:ietf:rfc:3986",
                "code": f"urn:oid:{metadata.get('sop_class_uid', '1.2.840.10008.5.1.4.1.1.2')}",
            },
        }

        if metadata.get("instance_number"):
            instance_data["number"] = metadata.get("instance_number")

        series_data["instance"] = [instance_data]
        imaging_study["series"] = [series_data]

        # Add counts
        imaging_study["numberOfSeries"] = 1
        imaging_study["numberOfInstances"] = 1

        return imaging_study

    @staticmethod
    def map_dicom_file_to_imaging_study(
        dcm_file_path: str,
        patient_id: str,
        imaging_study_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Map DICOM file directly to FHIR ImagingStudy resource.

        Args:
            dcm_file_path: Path to DICOM file
            patient_id: FHIR Patient ID
            imaging_study_id: Optional FHIR ImagingStudy ID

        Returns:
            FHIR ImagingStudy resource as dictionary
        """
        # Extract metadata from DICOM file
        metadata = DICOMToImagingStudyMapper.extract_dicom_metadata(dcm_file_path)

        # Map to ImagingStudy resource
        return DICOMToImagingStudyMapper.map_dicom_metadata_to_imaging_study(
            metadata, patient_id, imaging_study_id
        )

    @staticmethod
    def extract_series_from_dicom_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract series-level information from DICOM metadata.

        Args:
            metadata: Dictionary of DICOM metadata

        Returns:
            Series information as dictionary
        """
        series_datetime = DICOMToImagingStudyMapper.parse_dicom_datetime(
            metadata.get("series_date", ""), metadata.get("series_time", "")
        )

        return {
            "series_instance_uid": metadata.get("series_instance_uid"),
            "series_number": metadata.get("series_number"),
            "series_description": metadata.get("series_description"),
            "modality": metadata.get("modality"),
            "body_part_examined": metadata.get("body_part_examined"),
            "protocol_name": metadata.get("protocol_name"),
            "started": series_datetime,
            "slice_thickness": metadata.get("slice_thickness"),
            "pixel_spacing": metadata.get("pixel_spacing"),
        }

    @staticmethod
    def extract_instance_from_dicom_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract instance-level information from DICOM metadata.

        Args:
            metadata: Dictionary of DICOM metadata

        Returns:
            Instance information as dictionary
        """
        return {
            "sop_instance_uid": metadata.get("sop_instance_uid"),
            "sop_class_uid": metadata.get("sop_class_uid"),
            "instance_number": metadata.get("instance_number"),
            "rows": metadata.get("rows"),
            "columns": metadata.get("columns"),
            "window_center": metadata.get("window_center"),
            "window_width": metadata.get("window_width"),
            "image_position": metadata.get("image_position_patient"),
            "image_orientation": metadata.get("image_orientation_patient"),
        }

    @staticmethod
    def compare_dicom_objects(metadata1: Dict[str, Any], metadata2: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare two DICOM metadata objects and return differences.

        Args:
            metadata1: First DICOM metadata dictionary
            metadata2: Second DICOM metadata dictionary

        Returns:
            Dictionary of differences
        """
        differences = {}

        # Study-level comparison
        study_fields = ["study_instance_uid", "accession_number", "study_description"]
        instance_fields = ["sop_instance_uid", "instance_number"]

        for field in study_fields + instance_fields:
            val1 = metadata1.get(field)
            val2 = metadata2.get(field)
            if val1 != val2:
                differences[field] = {"metadata1": val1, "metadata2": val2}

        return differences


class DICOMImagingStudyService:
    """Service for DICOM to ImagingStudy operations."""

    def __init__(self):
        self.mapper = DICOMToImagingStudyMapper()

    def process_dicom_file(
        self,
        dcm_file_path: str,
        patient_id: str,
        imaging_study_id: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Process a DICOM file and return both metadata and FHIR resource.

        Args:
            dcm_file_path: Path to DICOM file
            patient_id: FHIR Patient ID
            imaging_study_id: Optional FHIR ImagingStudy ID

        Returns:
            Tuple of (metadata_dict, fhir_imaging_study_dict)
        """
        metadata = self.mapper.extract_dicom_metadata(dcm_file_path)
        imaging_study = self.mapper.map_dicom_metadata_to_imaging_study(
            metadata, patient_id, imaging_study_id
        )

        return metadata, imaging_study

    def process_dicom_directory(
        self,
        directory_path: str,
        patient_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Process all DICOM files in a directory.

        Args:
            directory_path: Path to directory containing DICOM files
            patient_id: FHIR Patient ID

        Returns:
            List of FHIR ImagingStudy resources
        """
        imaging_studies = []
        directory = Path(directory_path)

        if not directory.exists():
            logger.warning(f"Directory not found: {directory_path}")
            return []

        for dcm_file in directory.glob("**/*.dcm"):
            try:
                _, imaging_study = self.process_dicom_file(
                    str(dcm_file), patient_id
                )
                imaging_studies.append(imaging_study)
            except Exception as e:
                logger.error(f"Error processing {dcm_file}: {e}")
                continue

        return imaging_studies

    def validate_dicom_to_imaging_study_mapping(
        self,
        dcm_file_path: str,
    ) -> Dict[str, Any]:
        """
        Validate that DICOM file can be successfully mapped to ImagingStudy.

        Args:
            dcm_file_path: Path to DICOM file

        Returns:
            Validation result dictionary with status and any errors
        """
        result = {
            "valid": False,
            "errors": [],
            "warnings": [],
            "metadata": {},
        }

        try:
            metadata = self.mapper.extract_dicom_metadata(dcm_file_path)
            result["metadata"] = metadata

            # Validate required fields
            required_fields = [
                "study_instance_uid",
                "series_instance_uid",
                "sop_instance_uid",
            ]

            for field in required_fields:
                if not metadata.get(field):
                    result["errors"].append(f"Missing required field: {field}")

            # Check for optional but recommended fields
            recommended_fields = ["study_date", "patient_id", "modality"]

            for field in recommended_fields:
                if not metadata.get(field):
                    result["warnings"].append(f"Missing recommended field: {field}")

            if not result["errors"]:
                result["valid"] = True

        except Exception as e:
            result["errors"].append(f"Failed to read DICOM file: {str(e)}")

        return result
