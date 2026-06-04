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
from PIL import Image
import numpy as np
import requests
from urllib.parse import urljoin
import logging

from database import get_db_session
from services.dicom_mapping_service import DICOMToImagingStudyMapper, DICOMImagingStudyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dicom", tags=["dicom"])

# DICOM data directory
DICOM_BASE_DIR = Path(__file__).parent.parent.parent / "data" / "generated_dicoms"

# QIDO-RS and WADO configuration
# Default values for localhost development
_DEFAULT_QIDO_URL = "https://localhost:8443/dcm4chee-arc/aets/DCM4CHEE/rs"
_DEFAULT_WADO_URL = "https://localhost:8443/dcm4chee-arc/aets/DCM4CHEE/wado"

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
                f"?requestType=WADO&studyUID={study_instance_uid}&seriesUID={series_instance_uid}&objectUID={sop_instance_uid}"
            )
            
            logger.info(f"Fetching DICOM instance via WADO: {wado_instance_url[:80]}...")
            
            response = requests.get(
                wado_instance_url,
                verify=False,  # TODO: Use proper SSL verification in production
                timeout=60
            )
            response.raise_for_status()
            
            logger.info(f"Successfully fetched {len(response.content)} bytes via WADO")
            return response.content
            
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
    patient_id: Optional[str] = Query(None, description="Filter by PatientID (QIDO-RS only, if configured)"),
    study_uid: Optional[str] = Query(None, description="Filter by StudyInstanceUID (QIDO-RS only, if configured)"),
    modality: Optional[str] = Query(None, description="Filter by Modality (QIDO-RS only, if configured)"),
    limit: int = Query(100, description="Maximum number of results")
):
    """
    List available DICOM studies from local filesystem or configured DICOM server.
    
    Automatically uses DICOM server (QIDO-RS) when QIDO/WADO URLs are available.
    Falls back to local filesystem if those values are empty.
    
    Query Parameters:
        patient_id: Filter by PatientID (QIDO-RS only, if server configured)
        study_uid: Filter by StudyInstanceUID (QIDO-RS only, if server configured)
        modality: Filter by Modality (QIDO-RS only, if server configured)
        limit: Maximum number of results
    """
    try:
        studies = []
        use_server = _is_dicom_server_configured()
        
        # Query QIDO-RS if endpoints are configured
        if use_server:
            logger.info(f"Querying QIDO-RS for studies (patient_id={patient_id}, modality={modality})")
            qido_studies = DICOMService.query_qido_studies(
                patient_id=patient_id,
                study_instance_uid=study_uid,
                modality=modality,
                limit=limit
            )
            
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
        
        else:
            # Use local filesystem
            if DICOM_BASE_DIR.exists():
                for study_dir in DICOM_BASE_DIR.iterdir():
                    if study_dir.is_dir():
                        dicom_files = DICOMService.find_dicom_files(study_dir)
                        
                        if dicom_files:
                            # Read metadata from first file to get study info
                            first_file_metadata = DICOMService.read_dicom_metadata(dicom_files[0])
                            
                            study_info = {
                                "studyInstanceUID": first_file_metadata["studyInstanceUID"],
                                "studyDescription": first_file_metadata["studyDescription"],
                                "modality": first_file_metadata["modality"],
                                "patientName": first_file_metadata["patientName"],
                                "patientID": first_file_metadata["patientID"],
                                "studyDate": first_file_metadata["studyDate"],
                                "numberOfInstances": len(dicom_files),
                                "studyDirectory": study_dir.name,
                                "source": "local-filesystem"
                            }
                            
                            studies.append(study_info)
                            
                            if len(studies) >= limit:
                                break
            
            logger.info(f"Found {len(studies)} studies from local filesystem")
        
        return {"studies": studies, "source": "dicom-server" if use_server else "local-filesystem", "endpoints_configured": use_server}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list DICOM studies: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list DICOM studies: {e}")

def validate_study_dir(study_dir: str) -> Path:
    """
    Validate and sanitize study directory to prevent path traversal attacks.
    
    Security: Ensures the study_dir doesn't contain path traversal sequences
    and resolves to a path within DICOM_BASE_DIR.
    """
    # Reject obvious path traversal attempts
    if '..' in study_dir or study_dir.startswith('/') or study_dir.startswith('\\'):
        raise HTTPException(
            status_code=400, 
            detail="Invalid study directory: path traversal not allowed"
        )
    
    # Resolve the full path and verify it's within DICOM_BASE_DIR
    study_path = (DICOM_BASE_DIR / study_dir).resolve()
    
    # Ensure the resolved path is still within DICOM_BASE_DIR
    try:
        study_path.relative_to(DICOM_BASE_DIR.resolve())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid study directory: path outside allowed directory"
        )
    
    return study_path


@router.get("/studies/{study_dir}/metadata")
async def get_study_metadata(study_dir: str):
    """Get metadata for all instances in a study."""
    try:
        study_path = validate_study_dir(study_dir)
        
        if not study_path.exists():
            raise HTTPException(status_code=404, detail="Study directory not found")
        
        dicom_files = DICOMService.find_dicom_files(study_path)
        
        if not dicom_files:
            raise HTTPException(status_code=404, detail="No DICOM files found in study")
        
        instances = []
        for file_path in dicom_files:
            metadata = DICOMService.read_dicom_metadata(file_path)
            instances.append(metadata)
        
        # Sort by instance number
        instances.sort(key=lambda x: x.get("instanceNumber", 0))
        
        return {"instances": instances}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get study metadata: {e}")

@router.get("/studies/{study_dir}/instances/{instance_number}/image")
async def get_instance_image(
    study_dir: str, 
    instance_number: int,
    window_center: int = Query(128, description="Window center for display"),
    window_width: int = Query(256, description="Window width for display"),
    format: str = Query("png", description="Output format (png, jpeg)")
):
    """Get image data for a specific DICOM instance."""
    try:
        study_path = validate_study_dir(study_dir)
        
        if not study_path.exists():
            raise HTTPException(status_code=404, detail="Study directory not found")
        
        dicom_files = DICOMService.find_dicom_files(study_path)
        
        # Find the file with matching instance number
        target_file = None
        for file_path in dicom_files:
            metadata = DICOMService.read_dicom_metadata(file_path)
            if metadata.get("instanceNumber") == instance_number:
                target_file = file_path
                break
        
        if not target_file:
            raise HTTPException(status_code=404, detail=f"Instance {instance_number} not found")
        
        # Extract pixel data
        pixel_array = DICOMService.extract_pixel_data(target_file)
        
        # Convert to image
        if format.lower() == "png":
            image_data = DICOMService.convert_to_png(pixel_array, window_center, window_width)
            media_type = "image/png"
        else:
            raise HTTPException(status_code=400, detail="Only PNG format is currently supported")
        
        return Response(content=image_data, media_type=media_type)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get instance image: {e}")

@router.get("/studies/{study_dir}/download")
async def download_study(study_dir: str):
    """Download entire DICOM study as ZIP archive."""
    try:
        import zipfile
        import tempfile
        
        study_path = validate_study_dir(study_dir)
        
        if not study_path.exists():
            raise HTTPException(status_code=404, detail="Study directory not found")
        
        dicom_files = DICOMService.find_dicom_files(study_path)
        
        if not dicom_files:
            raise HTTPException(status_code=404, detail="No DICOM files found in study")
        
        # Create temporary ZIP file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        
        with zipfile.ZipFile(temp_file.name, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for dicom_file in dicom_files:
                # Add file to ZIP with relative path
                arcname = dicom_file.relative_to(study_path)
                zip_file.write(str(dicom_file), str(arcname))
        
        temp_file.close()
        
        # Return ZIP file
        return FileResponse(
            path=temp_file.name,
            filename=f"{study_dir}.zip",
            media_type="application/zip"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download study: {e}")

@router.get("/studies/{study_dir}/viewer-config")
async def get_viewer_config(study_dir: str):
    """Get configuration for DICOM viewer (Cornerstone 3D compatible)."""
    try:
        study_path = validate_study_dir(study_dir)
        
        if not study_path.exists():
            raise HTTPException(status_code=404, detail="Study directory not found")
        
        dicom_files = DICOMService.find_dicom_files(study_path)
        
        if not dicom_files:
            raise HTTPException(status_code=404, detail="No DICOM files found in study")
        
        # Get metadata for all instances
        instances = []
        for file_path in dicom_files:
            metadata = DICOMService.read_dicom_metadata(file_path)
            
            # Create image ID for Cornerstone
            image_id = f"dicom://api/dicom/studies/{study_dir}/instances/{metadata['instanceNumber']}/image"
            
            instance_info = {
                "imageId": image_id,
                "instanceNumber": metadata["instanceNumber"],
                "sopInstanceUID": metadata["sopInstanceUID"],
                "rows": metadata["rows"],
                "columns": metadata["columns"],
                "pixelSpacing": metadata["pixelSpacing"],
                "sliceThickness": metadata["sliceThickness"],
                "windowCenter": metadata["windowCenter"],
                "windowWidth": metadata["windowWidth"]
            }
            
            instances.append(instance_info)
        
        # Sort by instance number
        instances.sort(key=lambda x: x["instanceNumber"])
        
        # Create viewer configuration
        config = {
            "studyInstanceUID": instances[0]["sopInstanceUID"].split('.')[:-1],  # Approximate
            "seriesInstanceUID": f"series-{study_dir}",
            "modality": DICOMService.read_dicom_metadata(dicom_files[0])["modality"],
            "instances": instances,
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
        raise HTTPException(status_code=500, detail=f"Failed to get viewer config: {e}")


# FHIR ImagingStudy Mapping Endpoints

@router.get("/studies/{study_dir}/fhir-imaging-study")
async def get_study_as_fhir_imaging_study(
    study_dir: str,
    patient_id: str = Query(..., description="FHIR Patient ID"),
    imaging_study_id: Optional[str] = Query(None, description="Optional FHIR ImagingStudy ID")
):
    """
    Convert DICOM study to FHIR ImagingStudy resource.
    
    Args:
        study_dir: DICOM study directory
        patient_id: FHIR Patient ID
        imaging_study_id: Optional FHIR ImagingStudy ID
        
    Returns:
        FHIR ImagingStudy resource
    """
    try:
        study_path = validate_study_dir(study_dir)
        
        if not study_path.exists():
            raise HTTPException(status_code=404, detail="Study directory not found")
        
        dicom_files = DICOMService.find_dicom_files(study_path)
        
        if not dicom_files:
            raise HTTPException(status_code=404, detail="No DICOM files found in study")
        
        # Use first DICOM file to create ImagingStudy
        first_file = dicom_files[0]
        imaging_study = DICOMService.dicom_file_to_imaging_study(
            first_file, patient_id, imaging_study_id
        )
        
        return imaging_study
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to convert to FHIR ImagingStudy: {e}")


@router.get("/studies/{study_dir}/instances/{instance_number}/metadata/extended")
async def get_instance_extended_metadata(study_dir: str, instance_number: int):
    """
    Get comprehensive DICOM metadata for an instance (FHIR-relevant fields).
    
    Args:
        study_dir: DICOM study directory
        instance_number: DICOM instance number
        
    Returns:
        Extended metadata dictionary with FHIR-relevant fields
    """
    try:
        study_path = validate_study_dir(study_dir)
        
        if not study_path.exists():
            raise HTTPException(status_code=404, detail="Study directory not found")
        
        dicom_files = DICOMService.find_dicom_files(study_path)
        
        # Find file with matching instance number
        target_file = None
        for file_path in dicom_files:
            metadata = DICOMService.read_dicom_metadata(file_path)
            if metadata.get("instanceNumber") == instance_number:
                target_file = file_path
                break
        
        if not target_file:
            raise HTTPException(status_code=404, detail=f"Instance {instance_number} not found")
        
        # Extract extended metadata
        extended_metadata = DICOMService.extract_dicom_metadata_extended(target_file)
        
        return extended_metadata
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get extended metadata: {e}")


@router.get("/studies/{study_dir}/instances/{instance_number}/fhir-info")
async def get_instance_fhir_info(study_dir: str, instance_number: int):
    """
    Get FHIR-specific information for a DICOM instance (series and instance level data).
    
    Args:
        study_dir: DICOM study directory
        instance_number: DICOM instance number
        
    Returns:
        Dictionary with series and instance FHIR information
    """
    try:
        study_path = validate_study_dir(study_dir)
        
        if not study_path.exists():
            raise HTTPException(status_code=404, detail="Study directory not found")
        
        dicom_files = DICOMService.find_dicom_files(study_path)
        
        # Find file with matching instance number
        target_file = None
        for file_path in dicom_files:
            metadata = DICOMService.read_dicom_metadata(file_path)
            if metadata.get("instanceNumber") == instance_number:
                target_file = file_path
                break
        
        if not target_file:
            raise HTTPException(status_code=404, detail=f"Instance {instance_number} not found")
        
        # Extract FHIR info
        series_info = DICOMService.get_dicom_series_info(target_file)
        instance_info = DICOMService.get_dicom_instance_info(target_file)
        
        return {
            "series": series_info,
            "instance": instance_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get FHIR info: {e}")


@router.get("/studies/{study_dir}/validate-fhir")
async def validate_study_for_fhir(study_dir: str):
    """
    Validate that DICOM study can be mapped to FHIR ImagingStudy resources.
    
    Args:
        study_dir: DICOM study directory
        
    Returns:
        Validation results for each file in the study
    """
    try:
        study_path = validate_study_dir(study_dir)
        
        if not study_path.exists():
            raise HTTPException(status_code=404, detail="Study directory not found")
        
        dicom_files = DICOMService.find_dicom_files(study_path)
        
        if not dicom_files:
            raise HTTPException(status_code=404, detail="No DICOM files found in study")
        
        # Validate each file
        validation_results = []
        for file_path in dicom_files:
            result = DICOMService.validate_dicom_for_fhir(file_path)
            result["filePath"] = str(file_path.relative_to(study_path))
            validation_results.append(result)
        
        # Summary
        valid_count = sum(1 for r in validation_results if r.get("valid"))
        total_count = len(validation_results)
        
        return {
            "valid": valid_count == total_count,
            "summary": {
                "totalFiles": total_count,
                "validFiles": valid_count,
                "invalidFiles": total_count - valid_count
            },
            "results": validation_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate DICOM for FHIR: {e}")