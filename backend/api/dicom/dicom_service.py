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
from typing import List, Dict, Any, Optional
import pydicom
import json
import io
import os
from PIL import Image
import numpy as np

from database import get_db_session

router = APIRouter(prefix="/dicom", tags=["dicom"])

# DICOM data directory
DICOM_BASE_DIR = Path(__file__).parent.parent.parent / "data" / "generated_dicoms"

class DICOMService:
    """Service for DICOM file operations."""
    
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

@router.get("/studies")
async def list_dicom_studies():
    """List available DICOM studies."""
    try:
        studies = []
        
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
                            "studyDirectory": study_dir.name
                        }
                        
                        studies.append(study_info)
        
        return {"studies": studies}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list DICOM studies: {e}")

@router.get("/studies/{study_dir}/metadata")
async def get_study_metadata(study_dir: str):
    """Get metadata for all instances in a study."""
    try:
        study_path = DICOM_BASE_DIR / study_dir
        
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
        study_path = DICOM_BASE_DIR / study_dir
        
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
        
        study_path = DICOM_BASE_DIR / study_dir
        
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
        study_path = DICOM_BASE_DIR / study_dir
        
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