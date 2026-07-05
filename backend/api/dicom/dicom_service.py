#!/usr/bin/env python3
"""
DICOM Service API
Provides endpoints for DICOM file access and metadata
"""

from fastapi import APIRouter, HTTPException, Depends, Response, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import pydicom
import json
import io
import os
import zipfile
from PIL import Image
import numpy as np
import requests
from urllib.parse import urljoin, unquote
from requests_toolbelt.multipart import decoder
import cgi
import logging

from database import get_db_session
from services.dicom_mapping_service import DICOMToImagingStudyMapper, DICOMImagingStudyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dicom", tags=["dicom"])

# DICOM data directory
DICOM_BASE_DIR = Path(__file__).parent.parent.parent / "data" / "generated_dicoms"

# QIDO-RS and WADO configuration
# Default values for localhost development
_DEFAULT_QIDO_URL = "http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/rs"
_DEFAULT_WADO_URL = "http://arc:8080/dcm4chee-arc/aets/DCM4CHEE/wado"

DICOM_QIDO_URL = os.getenv("DICOM_QIDO_URL", _DEFAULT_QIDO_URL)
DICOM_WADO_URL = os.getenv("DICOM_WADO_URL", _DEFAULT_WADO_URL)

# Check if DICOM server endpoints are explicitly configured
def _is_dicom_server_configured() -> bool:
    """
    Determine if DICOM server endpoints are available.
    Returns True when both QIDO and WADO URLs are non-empty.
    """
    return bool(DICOM_QIDO_URL and DICOM_WADO_URL)

def _get_qido_url() -> str:
    """
    Get QIDO-RS URL. Uses configured URL or localhost default.
    """
    return DICOM_QIDO_URL

def _get_wado_url() -> str:
    """
    Get WADO URL. Uses configured URL or localhost default.
    """
    return DICOM_WADO_URL

class DICOMService:
    """Service for DICOM file operations with local filesystem and DICOM server (QIDO/WADO) support."""
    
    # QIDO and WADO support for remote DICOM servers
    @staticmethod
    def query_qido_studies(
        qido_url: Optional[str] = None,
        patient_id: Optional[str] = None,
        study_instance_uid: Optional[str] = None,
        modality: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Query DICOM studies using QIDO-RS (Query Information Destructive Object Retrieve).
        
        Args:
            qido_url: QIDO-RS base URL (defaults to DICOM_QIDO_URL)
            patient_id: Filter by PatientID
            study_instance_uid: Filter by StudyInstanceUID
            modality: Filter by Modality
            limit: Maximum number of results
            
        Returns:
            List of study information from QIDO-RS
        """
        if qido_url is None:
            qido_url = _get_qido_url()
        
        try:
            # Build QIDO-RS query URL
            qido_studies_url = urljoin(qido_url, "studies")
            
            # Build query parameters
            params = {"limit": limit}
            if patient_id:
                params["PatientID"] = patient_id
            if study_instance_uid:
                params["StudyInstanceUID"] = study_instance_uid
            if modality:
                params["Modality"] = modality
            
            logger.info(f"Querying QIDO-RS: {qido_studies_url} with params: {params}")
            
            # Make request to QIDO-RS
            response = requests.get(
                qido_studies_url,
                params=params,
                headers={"Accept": "application/dicom+json"},
                verify=False,  # TODO: Use proper SSL verification in production
                timeout=30
            )
            response.raise_for_status()
            
            # Parse response
            studies = response.json() if response.content else []
            logger.info(f"Found {len(studies)} studies from QIDO-RS")
            return studies
            
        except requests.RequestException as e:
            logger.error(f"QIDO-RS query failed: {e}")
            raise HTTPException(status_code=503, detail=f"DICOM server unavailable: {e}")
        except Exception as e:
            logger.error(f"Error querying QIDO-RS: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to query DICOM server: {e}")
    
    @staticmethod
    def query_qido_series(
        study_instance_uid: str,
        qido_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Query DICOM series using QIDO-RS for a specific study.
        
        Args:
            study_instance_uid: StudyInstanceUID to query
            qido_url: QIDO-RS base URL (defaults to configured or localhost default)
            
        Returns:
            List of series information
        """
        if qido_url is None:
            qido_url = _get_qido_url()
        
        try:
            qido_series_url = urljoin(qido_url, f"studies/{study_instance_uid}/series")
            
            logger.info(f"Querying QIDO-RS for series: {qido_series_url}")
            
            response = requests.get(
                qido_series_url,
                headers={"Accept": "application/dicom+json"},
                verify=False,  # TODO: Use proper SSL verification in production
                timeout=30
            )
            response.raise_for_status()
            
            series_list = response.json() if response.content else []
            logger.info(f"Found {len(series_list)} series")
            return series_list
            
        except requests.RequestException as e:
            logger.error(f"QIDO-RS series query failed: {e}")
            raise HTTPException(status_code=503, detail=f"DICOM server unavailable: {e}")
        except Exception as e:
            logger.error(f"Error querying series from QIDO-RS: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to query series: {e}")
    
    @staticmethod
    def fetch_wado_instance(
        study_instance_uid: str,
        series_instance_uid: str,
        sop_instance_uid: str,
        wado_url: Optional[str] = None
    ) -> bytes:
        """
        Fetch DICOM instance using WADO (Web Access to DICOM Objects).
        
        Args:
            study_instance_uid: StudyInstanceUID
            series_instance_uid: SeriesInstanceUID
            sop_instance_uid: SOPInstanceUID
            wado_url: WADO base URL (defaults to DICOM_WADO_URL)
            
        Returns:
            DICOM file bytes
        """
        if wado_url is None:
            wado_url = _get_wado_url()
        
        try:
            # Build WADO URL according to standard
            wado_instance_url = urljoin(
                wado_url,
                f"studies/{study_instance_uid}/series/{series_instance_uid}/instances/{sop_instance_uid}"
            )
            
            logger.info(f"Fetching DICOM instance via WADO: {wado_instance_url[:80]}...")
            
            response = requests.get(
                wado_instance_url,
                verify=False,  # TODO: Use proper SSL verification in production
                timeout=60
            )
            response.raise_for_status()
            
            response_content = []
            multipart_data = decoder.MultipartDecoder.from_response(response)

            for part in multipart_data.parts:
                response_content.append(part.content)
            response_content = b"".join(response_content)

            logger.info(f"Successfully fetched {len(response_content)} bytes via WADO")
            return response_content
            
        except requests.RequestException as e:
            logger.error(f"WADO fetch failed: {e}")
            raise HTTPException(status_code=503, detail=f"Failed to fetch from DICOM server: {e}")
        except Exception as e:
            logger.error(f"Error fetching DICOM instance: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch instance: {e}")
    
    @staticmethod
    def fetch_wado_metadata(
        study_instance_uid: str,
        series_instance_uid: str,
        sop_instance_uid: str,
        wado_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch DICOM metadata using WADO-RS.
        
        Args:
            study_instance_uid: StudyInstanceUID
            series_instance_uid: SeriesInstanceUID
            sop_instance_uid: SOPInstanceUID
            wado_url: WADO-RS base URL (defaults to DICOM_WADO_URL)
            
        Returns:
            DICOM metadata as dictionary
        """
        if wado_url is None:
            wado_url = _get_wado_url()
        
        try:
            # Build WADO-RS URL for metadata
            wado_metadata_url = urljoin(
                wado_url,
                f"studies/{study_instance_uid}/series/{series_instance_uid}/instances/{sop_instance_uid}/metadata"
            )
            
            logger.info(f"Fetching DICOM metadata via WADO-RS: {wado_metadata_url[:80]}...")
            
            response = requests.get(
                wado_metadata_url,
                headers={"Accept": "application/dicom+json"},
                verify=False,  # TODO: Use proper SSL verification in production
                timeout=30
            )
            response.raise_for_status()
            
            metadata = response.json() if response.content else {}
            logger.info(f"Successfully fetched metadata")
            return metadata
            
        except requests.RequestException as e:
            logger.error(f"WADO-RS metadata fetch failed: {e}")
            raise HTTPException(status_code=503, detail=f"Failed to fetch metadata from DICOM server: {e}")
        except Exception as e:
            logger.error(f"Error fetching metadata: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch metadata: {e}")
    
    @staticmethod
    def _get_dicom_json_value(
        dicom_json_obj: Dict[str, Any],
        hex_tag: str,
        fallback_key: str = "",
        default: str = ""
    ) -> str:
        """
        Extract value from DICOM JSON object by tag hex code or fallback key.
        
        DICOM JSON format stores values like:
        {"00200010": {"Value": ["1.2.3.4"]}} or {"StudyInstanceUID": "1.2.3.4"}
        
        Args:
            dicom_json_obj: DICOM JSON object
            hex_tag: DICOM tag hex code (e.g., "00200010")
            fallback_key: Fallback keyword to check
            default: Default value if not found
            
        Returns:
            Extracted value as string
        """
        try:
            # Try hex tag format first
            if hex_tag in dicom_json_obj:
                value_obj = dicom_json_obj[hex_tag]
                if isinstance(value_obj, dict) and "Value" in value_obj:
                    values = value_obj.get("Value", [])
                    if values:
                        # Handle different value types
                        if isinstance(values[0], dict):
                            # Complex value (e.g., PersonName)
                            return values[0].get("Alphabetic", "")
                        return str(values[0])
            
            # Try fallback keyword format
            if fallback_key and fallback_key in dicom_json_obj:
                return str(dicom_json_obj[fallback_key])
            
            return default
        except Exception as e:
            logger.warning(f"Error extracting DICOM JSON value for {hex_tag}: {e}")
            return default

    @staticmethod
    def find_dicom_files(study_dir: Path) -> List[Path]:
        """Find all DICOM files in a study directory."""
        dicom_files = []
        if study_dir.exists():
            for file_path in study_dir.rglob("*.dcm"):
                dicom_files.append(file_path)
        return sorted(dicom_files)
    
    @staticmethod
    def read_dicom_metadata(file_path: Path) -> Dict[str, Any]:
        """Read DICOM metadata without pixel data."""
        try:
            ds = pydicom.dcmread(str(file_path), stop_before_pixels=True, force=True)
            
            metadata = {
                "studyInstanceUID": str(ds.get("StudyInstanceUID", "")),
                "seriesInstanceUID": str(ds.get("SeriesInstanceUID", "")),
                "sopInstanceUID": str(ds.get("SOPInstanceUID", "")),
                "instanceNumber": int(ds.get("InstanceNumber", 0)),
                "seriesNumber": int(ds.get("SeriesNumber", 0)),
                "modality": str(ds.get("Modality", "")),
                "studyDate": str(ds.get("StudyDate", "")),
                "studyTime": str(ds.get("StudyTime", "")),
                "studyDescription": str(ds.get("StudyDescription", "")),
                "seriesDescription": str(ds.get("SeriesDescription", "")),
                "patientName": str(ds.get("PatientName", "")),
                "patientID": str(ds.get("PatientID", "")),
                "rows": int(ds.get("Rows", 0)),
                "columns": int(ds.get("Columns", 0)),
                "pixelSpacing": list(ds.get("PixelSpacing", [1.0, 1.0])) if hasattr(ds.get("PixelSpacing", [1.0, 1.0]), '__iter__') else [1.0, 1.0],
                "sliceThickness": float(ds.get("SliceThickness", 1.0)),
                "windowCenter": float(ds.get("WindowCenter", 128)) if ds.get("WindowCenter") is not None else 128,
                "windowWidth": float(ds.get("WindowWidth", 256)) if ds.get("WindowWidth") is not None else 256,
                "rescaleIntercept": float(ds.get("RescaleIntercept", 0)),
                "rescaleSlope": float(ds.get("RescaleSlope", 1)),
                "photometricInterpretation": str(ds.get("PhotometricInterpretation", "")),
                "bitsAllocated": int(ds.get("BitsAllocated", 16)),
                "bitsStored": int(ds.get("BitsStored", 12)),
                "filePath": str(file_path),
                "fileSize": file_path.stat().st_size
            }
            
            return metadata
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read DICOM metadata: {e}")
    
    @staticmethod
    def extract_pixel_data(file_path: Path) -> np.ndarray:
        """Extract pixel data from DICOM file."""
        try:
            ds = pydicom.dcmread(str(file_path), force=True)
            
            if not hasattr(ds, 'pixel_array'):
                raise ValueError("DICOM file has no pixel data")
            
            pixel_array = ds.pixel_array
            
            # Apply rescaling if needed
            if hasattr(ds, 'RescaleSlope') and hasattr(ds, 'RescaleIntercept'):
                pixel_array = pixel_array * float(ds.RescaleSlope) + float(ds.RescaleIntercept)
            
            return pixel_array
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to extract pixel data: {e}")

    @staticmethod
    def fetch_wado_rendered(
        study_instance_uid: str,
        series_instance_uid: str,
        sop_instance_uid: str,
        frame: int = 1,
        qido_url: Optional[str] = None,
    ) -> dict:
        """Fetch a PACS-rendered frame for an instance via WADO-RS `rendered`.

        dcm4chee decodes the pixel data server-side — including JPEG, color
        (YBR/RGB), and multi-frame — and returns a browser-displayable still.
        Used as a fallback when local grayscale windowing can't handle the
        instance (e.g. color/multi-frame ultrasound). We render a single frame
        (default frame 1) rather than the whole multi-frame object: the
        instance-level `rendered` returns the full cine as one large animated
        GIF (seconds, multi-MB), whereas a single frame is a fast ~50 KB JPEG.
        Returns {"content": bytes, "content_type": str}.
        """
        if qido_url is None:
            qido_url = _get_qido_url()
        rendered_url = urljoin(
            qido_url.rstrip("/") + "/",
            f"studies/{study_instance_uid}/series/{series_instance_uid}"
            f"/instances/{sop_instance_uid}/frames/{frame}/rendered",
        )
        resp = requests.get(
            rendered_url,
            headers={"Accept": "image/*"},
            verify=False,
            timeout=120,
        )
        resp.raise_for_status()
        return {
            "content": resp.content,
            "content_type": resp.headers.get("Content-Type", "image/jpeg"),
        }

    @staticmethod
    def convert_to_png(pixel_array: np.ndarray, window_center: int = 128, window_width: int = 256) -> bytes:
        """Convert DICOM pixel array to PNG image."""
        try:
            # Apply windowing
            lower = window_center - window_width // 2
            upper = window_center + window_width // 2
            
            windowed = np.clip(pixel_array, lower, upper)
            
            # Normalize to 0-255
            normalized = ((windowed - lower) / (upper - lower) * 255).astype(np.uint8)
            
            # Convert to PIL Image
            image = Image.fromarray(normalized, mode='L')
            
            # Convert to PNG bytes
            png_buffer = io.BytesIO()
            image.save(png_buffer, format='PNG')
            png_buffer.seek(0)
            
            return png_buffer.getvalue()
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to convert to PNG: {e}")
    
    @staticmethod
    def dicom_file_to_imaging_study(
        file_path: Path,
        patient_id: str,
        imaging_study_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Convert a DICOM file to a FHIR ImagingStudy resource.
        
        Args:
            file_path: Path to DICOM file
            patient_id: FHIR Patient ID
            imaging_study_id: Optional FHIR ImagingStudy ID
            
        Returns:
            FHIR ImagingStudy resource as dictionary
        """
        return DICOMToImagingStudyMapper.map_dicom_file_to_imaging_study(
            str(file_path), patient_id, imaging_study_id
        )
    
    @staticmethod
    def dicom_metadata_to_imaging_study(
        metadata: Dict[str, Any],
        patient_id: str,
        imaging_study_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Convert DICOM metadata to a FHIR ImagingStudy resource.
        
        Args:
            metadata: DICOM metadata dictionary
            patient_id: FHIR Patient ID
            imaging_study_id: Optional FHIR ImagingStudy ID
            
        Returns:
            FHIR ImagingStudy resource as dictionary
        """
        return DICOMToImagingStudyMapper.map_dicom_metadata_to_imaging_study(
            metadata, patient_id, imaging_study_id
        )
    
    @staticmethod
    def extract_dicom_metadata_extended(file_path: Path) -> Dict[str, Any]:
        """
        Extract comprehensive DICOM metadata including FHIR-relevant fields.
        
        Args:
            file_path: Path to DICOM file
            
        Returns:
            Comprehensive metadata dictionary
        """
        return DICOMToImagingStudyMapper.extract_dicom_metadata(str(file_path))
    
    @staticmethod
    def get_dicom_series_info(file_path: Path) -> Dict[str, Any]:
        """
        Extract FHIR series-level information from DICOM file.
        
        Args:
            file_path: Path to DICOM file
            
        Returns:
            Series information dictionary
        """
        metadata = DICOMToImagingStudyMapper.extract_dicom_metadata(str(file_path))
        return DICOMToImagingStudyMapper.extract_series_from_dicom_metadata(metadata)
    
    @staticmethod
    def get_dicom_instance_info(file_path: Path) -> Dict[str, Any]:
        """
        Extract FHIR instance-level information from DICOM file.
        
        Args:
            file_path: Path to DICOM file
            
        Returns:
            Instance information dictionary
        """
        metadata = DICOMToImagingStudyMapper.extract_dicom_metadata(str(file_path))
        return DICOMToImagingStudyMapper.extract_instance_from_dicom_metadata(metadata)
    
    @staticmethod
    def validate_dicom_for_fhir(file_path: Path) -> Dict[str, Any]:
        """
        Validate that DICOM file can be mapped to FHIR ImagingStudy.
        
        Args:
            file_path: Path to DICOM file
            
        Returns:
            Validation result with status, errors, warnings, and metadata
        """
        service = DICOMImagingStudyService()
        return service.validate_dicom_to_imaging_study_mapping(str(file_path))

@router.get("/studies")
async def list_dicom_studies(
    patient_id: Optional[str] = Query(None, description="Filter by PatientID"),
    study_uid: Optional[str] = Query(None, description="Filter by StudyInstanceUID"),
    modality: Optional[str] = Query(None, description="Filter by Modality"),
    limit: int = Query(100, description="Maximum number of results")
):
    """
    List available DICOM studies from DICOM server via QIDO-RS.
    
    Requires DICOM_QIDO_URL and DICOM_WADO_URL to be configured.
    
    Query Parameters:
        patient_id: Filter by PatientID
        study_uid: Filter by StudyInstanceUID
        modality: Filter by Modality
        limit: Maximum number of results
    """
    try:
        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured. Set DICOM_QIDO_URL and DICOM_WADO_URL environment variables."
            )
        
        logger.info(f"Querying QIDO-RS for studies (patient_id={patient_id}, modality={modality})")
        qido_studies = DICOMService.query_qido_studies(
            patient_id=patient_id,
            study_instance_uid=study_uid,
            modality=modality,
            limit=limit
        )
        
        studies = []
        # Parse QIDO-RS response (DICOM JSON format)
        for study in qido_studies:
            # DICOM JSON format uses tag hex keys, extract values carefully
            study_info = {
                "studyInstanceUID": DICOMService._get_dicom_json_value(study, "00200010", "StudyInstanceUID", ""),
                "studyDescription": DICOMService._get_dicom_json_value(study, "00081030", "StudyDescription", ""),
                "modality": DICOMService._get_dicom_json_value(study, "00080061", "Modality", ""),
                "patientName": DICOMService._get_dicom_json_value(study, "00100010", "PatientName", ""),
                "patientID": DICOMService._get_dicom_json_value(study, "00100020", "PatientID", ""),
                "studyDate": DICOMService._get_dicom_json_value(study, "00080020", "StudyDate", ""),
                "source": "dicom-server"
            }
            studies.append(study_info)
        
        logger.info(f"Found {len(studies)} studies from QIDO-RS")
        return {"studies": studies, "source": "dicom-server"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list DICOM studies: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to query DICOM server: {e}")

def validate_uid(uid: str, uid_type: str = "study") -> str:
    """
    Validate DICOM UID format.
    
    Args:
        uid: DICOM UID to validate
        uid_type: Type of UID (study, series, instance)
    
    Returns:
        Validated UID
    """

    if not uid or len(uid.strip()) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {uid_type} UID: empty or missing"
        )
    
    uid = unquote(uid).strip()

    # Basic UID format validation (should be numeric with dots)
    if not all(c.isdigit() or c == '.' or c == ":" or c.isalpha() for c in uid):
        raise HTTPException(
            status_code=400,
            detail=f"{uid} -- Invalid {uid_type} UID format: contains non-numeric characters"
        )
    
    return uid


@router.get("/studies/{study_uid}/metadata")
async def get_study_metadata(
    study_uid: str,
    series_uid: Optional[str] = Query(None, description="Filter by SeriesInstanceUID")
):
    """
    Get metadata for instances in a study via WADO-RS.
    Optionally filter by series.
    """
    try:
        study_uid = validate_uid(study_uid, "study")
        
        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )
        
        logger.info(f"Fetching metadata for study {study_uid}")
        
        # Query WADO for studies to list series
        wado_studies_url = urljoin(_get_wado_url(), f"studies/{study_uid}/instances")

        response = requests.get(
            wado_studies_url,
            headers={"Accept": "application/dicom+json"},
            verify=False,
            timeout=30
        )
        response.raise_for_status()
        study_data = response.json() if response.content else {}
        
        instances = []
        
        for instance in study_data:
            series_uid_value = DICOMService._get_dicom_json_value(instance, "0020000E", "SeriesInstanceUID", "")
            
            # Skip if filtering by series UID and this isn't it
            if series_uid and series_uid_value != series_uid:
                continue
            try:
                number_of_frames = int(
                    DICOMService._get_dicom_json_value(instance, "00280008", "NumberOfFrames", 1) or 1
                )
            except (TypeError, ValueError):
                number_of_frames = 1
            metadata = {
                "studyInstanceUID": study_uid,
                "seriesInstanceUID": series_uid_value,
                "sopInstanceUID": DICOMService._get_dicom_json_value(instance, "00080018", "SOPInstanceUID", ""),
                "instanceNumber": DICOMService._get_dicom_json_value(instance, "00200013", "InstanceNumber", "1"),
                "modality": DICOMService._get_dicom_json_value(instance, "00080060", "Modality", ""),
                # Number of frames in this instance (e.g. ultrasound/echo cine
                # loops have many); 1 for single-frame. Drives frame playback.
                "numberOfFrames": number_of_frames,
            }
            instances.append(metadata)
    
        logger.info(f"Found {len(instances)} instances for study {study_uid}")
        return {"instances": instances, "studyInstanceUID": study_uid}
        
    except HTTPException:
        raise
    except requests.RequestException as e:
        logger.error(f"Failed to fetch metadata from DICOM server: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch metadata from DICOM server: {e}")
    except Exception as e:
        logger.error(f"Failed to get study metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get study metadata: {e}")

## 
@router.get("/studies/{study_uid}/series/{series_uid}/instances/{sop_instance_uid}/image")
async def get_instance_image(
    study_uid: str,
    series_uid: str,
    sop_instance_uid: str,
    window_center: int = Query(128, description="Window center for display"),
    window_width: int = Query(256, description="Window width for display"),
    frame: int = Query(1, ge=1, description="1-based frame number for multi-frame instances")
):
    """
    Get image data for a specific DICOM instance via WADO.
    Returns PNG image with applied windowing (grayscale single-frame), or a
    PACS-rendered JPEG of the requested frame (color / multi-frame, e.g. echo).
    """
    try:
        study_uid = validate_uid(study_uid, "study")
        series_uid = validate_uid(series_uid, "series")
        sop_instance_uid = validate_uid(sop_instance_uid, "instance")
        
        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )
        
        logger.info(f"Fetching instance {sop_instance_uid} via WADO")
        
        # Fetch DICOM instance from WADO
        dicom_data = DICOMService.fetch_wado_instance(
            study_uid, series_uid, sop_instance_uid
        )
        
        # Parse DICOM data
        ds = pydicom.dcmread(io.BytesIO(dicom_data), force=True)

        samples = int(getattr(ds, "SamplesPerPixel", 1) or 1)
        frames = int(getattr(ds, "NumberOfFrames", 1) or 1)

        # Grayscale single-frame (e.g. CT): window/level locally so the viewer's
        # window_center/width controls stay interactive. Color or multi-frame
        # instances (e.g. ultrasound/echo cine loops) can't be windowed as
        # grayscale — defer to the PACS renderer below, which decodes JPEG/color
        # and returns an animated GIF for cine.
        if samples == 1 and frames == 1 and hasattr(ds, "pixel_array"):
            try:
                pixel_array = ds.pixel_array
                if hasattr(ds, 'RescaleSlope') and hasattr(ds, 'RescaleIntercept'):
                    pixel_array = pixel_array * float(ds.RescaleSlope) + float(ds.RescaleIntercept)
                image_data = DICOMService.convert_to_png(pixel_array, window_center, window_width)
                logger.info(f"Successfully retrieved image for instance {sop_instance_uid}")
                return Response(content=image_data, media_type="image/png")
            except Exception as conv_err:
                logger.info(
                    f"Local windowing unavailable for {sop_instance_uid} ({conv_err}); "
                    f"falling back to WADO-RS rendered"
                )

        rendered = DICOMService.fetch_wado_rendered(study_uid, series_uid, sop_instance_uid, frame=frame)
        logger.info(f"Returned PACS-rendered image for instance {sop_instance_uid} frame {frame}")
        return Response(content=rendered["content"], media_type=rendered["content_type"])
        
    except HTTPException:
        raise
    except requests.RequestException as e:
        logger.error(f"Failed to fetch instance from DICOM server: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch instance from DICOM server: {e}")
    except Exception as e:
        logger.error(f"Failed to get instance image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get instance image: {e}")

@router.get("/studies/{study_uid}/series/{series_uid}/download")
async def download_series(study_uid: str, series_uid: str):
    """
    Download DICOM series via WADO.
    Note: Returns series instances; full bulk ZIP download may require
    multiple requests depending on DICOMweb server capabilities.
    """
    try:
        study_uid = validate_uid(study_uid, "study")
        series_uid = validate_uid(series_uid, "series")
        
        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )
        
        logger.info(f"Preparing series {series_uid} for download from study {study_uid}")
        
        # Build WADO URL for series
        wado_series_url = urljoin(
            _get_wado_url(),
            f"studies/{study_uid}/series/{series_uid}"
        )
        
        response = requests.get(
            wado_series_url,
            headers={"Accept": "application/dicom"},
            verify=False,
            timeout=60
        )
        response.raise_for_status()
        
        logger.info(f"Successfully retrieved series {series_uid}")
        return StreamingResponse(
            iter([response.content]),
            media_type="application/dicom",
            headers={"Content-Disposition": f"attachment; filename=series_{series_uid}.dcm"}
        )
        
    except HTTPException:
        raise
    except requests.RequestException as e:
        logger.error(f"Failed to fetch series from DICOM server: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch series from DICOM server: {e}")
    except Exception as e:
        logger.error(f"Failed to download series: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download series: {e}")

@router.get("/studies/{study_uid}/download")
async def download_study(study_uid: str):
    """
    Download DICOM study via WADO.
    Note: Returns study instances; full bulk ZIP download may require
    multiple requests depending on DICOMweb server capabilities.
    """
    try:
        study_uid = validate_uid(study_uid, "study")
        
        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )
        
        logger.info(f"Preparing for download of study {study_uid}")
        
        # Build WADO URL for study
        wado_study_url = urljoin(
            _get_wado_url(),
            f"studies/{study_uid}"
        )
        
        response = requests.get(
            wado_study_url,
            verify=False,
            timeout=60
        )
        response.raise_for_status()

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            multipart_data = decoder.MultipartDecoder.from_response(response)
            part_index = 1

            # Need to check for files as well as parts
            if multipart_data.parts:
                for part in multipart_data.parts:
                    filename = None
                    content_disposition = part.headers.get(b"Content-Disposition", b"").decode("utf-8", errors="ignore")
                    if content_disposition:
                        _, params = cgi.parse_header(content_disposition)
                        filename = params.get("filename") or params.get("name")

                    if not filename:
                        filename = f"{part_index}.dcm"

                    archive.writestr(filename, part.content)
                    part_index += 1
            else:
                archive.writestr(f"study_{study_uid}.dcm", response.content)

        zip_buffer.seek(0)
        response_content = zip_buffer.getvalue()

        logger.info(f"Successfully retrieved study {study_uid}")
        return StreamingResponse(
            iter([response_content]),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=study_{study_uid}.zip"}
        )
        
    except HTTPException:
        raise
    except requests.RequestException as e:
        logger.error(f"Failed to fetch study from DICOM server: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch study from DICOM server: {e}")
    except Exception as e:
        logger.error(f"Failed to download study: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download study: {e}")

@router.get("/studies/{study_uid}/viewer-config")
async def get_viewer_config(
    study_uid: str,
    series_uid: Optional[str] = Query(None, description="Filter by SeriesInstanceUID")
):
    """
    Get configuration for DICOM viewer (Cornerstone 3D compatible).
    Fetches instance list via WADO and generates viewer URLs.
    """
    try:
        study_uid = validate_uid(study_uid, "study")
        
        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )
        
        logger.info(f"Generating viewer config for study {study_uid}")
        
        # Get metadata which includes instance UIDs
        metadata_response = await get_study_metadata(study_uid, series_uid)
        instances = metadata_response.get("instances", [])
        
        if not instances:
            raise HTTPException(
                status_code=404,
                detail="No instances found for this study"
            )
        
        # Generate Cornerstone viewer configuration
        viewer_instances = []
        for instance in instances:
            instance_url = f"/api/dicom/studies/{study_uid}/series/{instance['seriesInstanceUID']}/instances/{instance['sopInstanceUID']}/image"
            viewer_instances.append({
                "studyInstanceUID": study_uid,
                "seriesInstanceUID": instance['seriesInstanceUID'],
                "sopInstanceUID": instance['sopInstanceUID'],
                "imageUrl": instance_url,
                "instanceNumber": instance.get('instanceNumber', '1')
            })
        
        config = {
            "studyInstanceUID": study_uid,
            "modality": instances[0].get("modality", ""),
            "instances": viewer_instances,
            "viewerSettings": {
                "enableStackScrolling": True,
                "enableWindowLevel": True,
                "enableZoom": True,
                "enablePan": True,
                "enableRotation": True
            }
        }
        
        return config
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get viewer config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get viewer config: {e}")


# FHIR ImagingStudy Mapping Endpoints

@router.get("/studies/{study_uid}/fhir-imaging-study")
async def get_study_as_fhir_imaging_study(
    study_uid: str,
    patient_id: str = Query(..., description="FHIR Patient ID"),
    imaging_study_id: Optional[str] = Query(None, description="Optional FHIR ImagingStudy ID")
):
    """
    Convert DICOM study to FHIR ImagingStudy resource via WADO metadata.
    
    Args:
        study_uid: DICOM StudyInstanceUID
        patient_id: FHIR Patient ID
        imaging_study_id: Optional FHIR ImagingStudy ID
        
    Returns:
        FHIR ImagingStudy resource
    """
    try:
        study_uid = validate_uid(study_uid, "study")
        
        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )
        
        logger.info(f"Converting study {study_uid} to FHIR ImagingStudy for patient {patient_id}")
        
        # Fetch metadata for the study
        metadata_response = await get_study_metadata(study_uid)
        instances = metadata_response.get("instances", [])
        
        if not instances:
            raise HTTPException(
                status_code=404,
                detail="No instances found in study"
            )
        
        # Build basic FHIR ImagingStudy from metadata
        imaging_study = {
            "resourceType": "ImagingStudy",
            "id": imaging_study_id or study_uid.replace(".", "-"),
            "status": "available",
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "studyInstanceUID": study_uid,
            "series": []
        }
        
        # Group instances by series
        series_map = {}
        for instance in instances:
            series_uid = instance.get("seriesInstanceUID", "")
            if series_uid not in series_map:
                series_map[series_uid] = {
                    "uid": series_uid,
                    "modality": instance.get("modality", ""),
                    "instances": []
                }
            series_map[series_uid]["instances"].append(instance)
        
        # Convert series to FHIR format
        for series_uid, series_data in series_map.items():
            series_fhir = {
                "uid": series_uid,
                "modality": {"system": "http://dicom.nema.org/resources/ontology/DCM", "code": series_data["modality"]},
                "instance": [
                    {
                        "uid": inst.get("sopInstanceUID", ""),
                        "number": inst.get("instanceNumber", 1)
                    }
                    for inst in series_data["instances"]
                ]
            }
            imaging_study["series"].append(series_fhir)
        
        logger.info(f"Successfully converted study to FHIR ImagingStudy with {len(imaging_study['series'])} series")
        return imaging_study
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to convert to FHIR ImagingStudy: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to convert to FHIR ImagingStudy: {e}")


@router.get("/studies/{study_uid}/validate-fhir")
async def validate_study_for_fhir(study_uid: str):
    """
    Validate that DICOM study can be mapped to FHIR ImagingStudy resources via WADO.
    
    Args:
        study_uid: DICOM StudyInstanceUID
        
    Returns:
        Validation results indicating FHIR compatibility
    """
    try:
        study_uid = validate_uid(study_uid, "study")
        
        if not _is_dicom_server_configured():
            raise HTTPException(
                status_code=503,
                detail="DICOM server not configured"
            )
        
        logger.info(f"Validating study {study_uid} for FHIR compatibility")
        
        # Fetch metadata for all instances
        metadata_response = await get_study_metadata(study_uid)
        instances = metadata_response.get("instances", [])
        
        if not instances:
            raise HTTPException(
                status_code=404,
                detail="No instances found in study"
            )
        
        # Check for required FHIR fields
        required_fields = ["studyInstanceUID", "seriesInstanceUID", "sopInstanceUID", "modality"]
        validation_results = []
        
        for instance in instances:
            missing_fields = [f for f in required_fields if not instance.get(f)]
            result = {
                "sopInstanceUID": instance.get("sopInstanceUID", ""),
                "valid": len(missing_fields) == 0,
                "missingFields": missing_fields
            }
            validation_results.append(result)
        
        # Summary
        valid_count = sum(1 for r in validation_results if r.get("valid"))
        total_count = len(validation_results)
        
        return {
            "valid": valid_count == total_count,
            "summary": {
                "totalInstances": total_count,
                "validInstances": valid_count,
                "invalidInstances": total_count - valid_count
            },
            "results": validation_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to validate DICOM for FHIR: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to validate DICOM for FHIR: {e}")