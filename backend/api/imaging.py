from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
from datetime import datetime
import pydicom
from pydicom.errors import InvalidDicomError
import uuid
import json

from database import get_db_session as get_db
from models.dicom_models import DICOMStudy, DICOMSeries, DICOMInstance, ImagingResult
from models.synthea_models import Patient, ImagingStudy
# from api.auth import get_current_user  # Disabled for teaching purposes
from pydantic import BaseModel
from typing import Any, Optional, Dict
from shared.fhir_resources.imaging_converter import dicom_study_to_fhir_imaging_study, create_wado_endpoint
import logging


router = APIRouter()

class StandardResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None

# Configure upload directory
UPLOAD_DIR = os.getenv("DICOM_UPLOAD_DIR", "./data/dicom_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=StandardResponse)
async def upload_dicom_files(
    patient_id: str = Form(...),
    imaging_study_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Disabled for teaching purposes
):
    """Upload DICOM files for a patient"""
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Create upload session directory
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    processed_studies = {}
    errors = []
    
    try:
        for file in files:
            if not file.filename.endswith(('.dcm', '.DCM')):
                errors.append(f"{file.filename}: Not a DICOM file")
                continue
                
            # Save uploaded file
            file_path = os.path.join(session_dir, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            try:
                # Parse DICOM file
                ds = pydicom.dcmread(file_path)
                
                # Extract study information
                study_uid = str(ds.StudyInstanceUID)
                series_uid = str(ds.SeriesInstanceUID)
                instance_uid = str(ds.SOPInstanceUID)
                
                # Create or update study
                if study_uid not in processed_studies:
                    study = db.query(DICOMStudy).filter(
                        DICOMStudy.study_instance_uid == study_uid
                    ).first()
                    
                    if not study:
                        study = DICOMStudy(
                            study_instance_uid=study_uid,
                            patient_id=patient.id,
                            imaging_study_id=imaging_study_id,
                            study_date=datetime.strptime(str(ds.StudyDate), "%Y%m%d") if hasattr(ds, 'StudyDate') else None,
                            study_time=str(ds.StudyTime) if hasattr(ds, 'StudyTime') else None,
                            accession_number=str(ds.AccessionNumber) if hasattr(ds, 'AccessionNumber') else None,
                            study_description=str(ds.StudyDescription) if hasattr(ds, 'StudyDescription') else None,
                            modality=str(ds.Modality) if hasattr(ds, 'Modality') else None,
                            referring_physician=str(ds.ReferringPhysicianName) if hasattr(ds, 'ReferringPhysicianName') else None,
                            patient_name=str(ds.PatientName) if hasattr(ds, 'PatientName') else None,
                            patient_birth_date=datetime.strptime(str(ds.PatientBirthDate), "%Y%m%d") if hasattr(ds, 'PatientBirthDate') else None,
                            patient_sex=str(ds.PatientSex) if hasattr(ds, 'PatientSex') else None,
                            storage_path=os.path.join(UPLOAD_DIR, study_uid),
                            upload_status='processing'
                        )
                        db.add(study)
                        db.flush()
                    
                    processed_studies[study_uid] = study
                    
                    # Create study directory
                    study_dir = os.path.join(UPLOAD_DIR, study_uid)
                    os.makedirs(study_dir, exist_ok=True)
                else:
                    study = processed_studies[study_uid]
                
                # Create or update series
                series = db.query(DICOMSeries).filter(
                    DICOMSeries.series_instance_uid == series_uid
                ).first()
                
                if not series:
                    series = DICOMSeries(
                        series_instance_uid=series_uid,
                        study_id=study.id,
                        series_number=int(ds.SeriesNumber) if hasattr(ds, 'SeriesNumber') else None,
                        series_date=datetime.strptime(str(ds.SeriesDate), "%Y%m%d") if hasattr(ds, 'SeriesDate') else None,
                        series_time=str(ds.SeriesTime) if hasattr(ds, 'SeriesTime') else None,
                        series_description=str(ds.SeriesDescription) if hasattr(ds, 'SeriesDescription') else None,
                        modality=str(ds.Modality) if hasattr(ds, 'Modality') else None,
                        body_part_examined=str(ds.BodyPartExamined) if hasattr(ds, 'BodyPartExamined') else None,
                        protocol_name=str(ds.ProtocolName) if hasattr(ds, 'ProtocolName') else None,
                        slice_thickness=float(ds.SliceThickness) if hasattr(ds, 'SliceThickness') else None,
                        pixel_spacing=str(ds.PixelSpacing) if hasattr(ds, 'PixelSpacing') else None,
                        rows=int(ds.Rows) if hasattr(ds, 'Rows') else None,
                        columns=int(ds.Columns) if hasattr(ds, 'Columns') else None,
                        storage_path=os.path.join(UPLOAD_DIR, study_uid, series_uid)
                    )
                    db.add(series)
                    db.flush()
                    
                    # Create series directory
                    series_dir = os.path.join(UPLOAD_DIR, study_uid, series_uid)
                    os.makedirs(series_dir, exist_ok=True)
                
                # Check if instance already exists
                instance = db.query(DICOMInstance).filter(
                    DICOMInstance.sop_instance_uid == instance_uid
                ).first()
                
                if instance:
                    # Update existing instance
                    instance.series_id = series.id
                    instance.instance_number = int(ds.InstanceNumber) if hasattr(ds, 'InstanceNumber') else None
                    instance.sop_class_uid = str(ds.SOPClassUID) if hasattr(ds, 'SOPClassUID') else None
                    instance.rows = int(ds.Rows) if hasattr(ds, 'Rows') else None
                    instance.columns = int(ds.Columns) if hasattr(ds, 'Columns') else None
                    instance.bits_allocated = int(ds.BitsAllocated) if hasattr(ds, 'BitsAllocated') else None
                    instance.bits_stored = int(ds.BitsStored) if hasattr(ds, 'BitsStored') else None
                    instance.photometric_interpretation = str(ds.PhotometricInterpretation) if hasattr(ds, 'PhotometricInterpretation') else None
                    instance.image_position_patient = str(ds.ImagePositionPatient) if hasattr(ds, 'ImagePositionPatient') else None
                    instance.image_orientation_patient = str(ds.ImageOrientationPatient) if hasattr(ds, 'ImageOrientationPatient') else None
                    instance.slice_location = float(ds.SliceLocation) if hasattr(ds, 'SliceLocation') else None
                    instance.window_center = str(ds.WindowCenter) if hasattr(ds, 'WindowCenter') else None
                    instance.window_width = str(ds.WindowWidth) if hasattr(ds, 'WindowWidth') else None
                    instance.file_size_kb = os.path.getsize(file_path) / 1024
                    instance.transfer_syntax_uid = str(ds.file_meta.TransferSyntaxUID)
                    instance.has_pixel_data = hasattr(ds, 'PixelData')
                    
                    # Replace existing file
                    permanent_path = os.path.join(UPLOAD_DIR, study_uid, series_uid, f"{instance_uid}.dcm")
                    if os.path.exists(instance.file_path):
                        os.remove(instance.file_path)
                    shutil.move(file_path, permanent_path)
                    instance.file_path = permanent_path
                else:
                    # Create new instance
                    instance = DICOMInstance(
                        sop_instance_uid=instance_uid,
                        series_id=series.id,
                        instance_number=int(ds.InstanceNumber) if hasattr(ds, 'InstanceNumber') else None,
                        sop_class_uid=str(ds.SOPClassUID) if hasattr(ds, 'SOPClassUID') else None,
                        rows=int(ds.Rows) if hasattr(ds, 'Rows') else None,
                        columns=int(ds.Columns) if hasattr(ds, 'Columns') else None,
                        bits_allocated=int(ds.BitsAllocated) if hasattr(ds, 'BitsAllocated') else None,
                        bits_stored=int(ds.BitsStored) if hasattr(ds, 'BitsStored') else None,
                        photometric_interpretation=str(ds.PhotometricInterpretation) if hasattr(ds, 'PhotometricInterpretation') else None,
                        image_position_patient=str(ds.ImagePositionPatient) if hasattr(ds, 'ImagePositionPatient') else None,
                        image_orientation_patient=str(ds.ImageOrientationPatient) if hasattr(ds, 'ImageOrientationPatient') else None,
                        slice_location=float(ds.SliceLocation) if hasattr(ds, 'SliceLocation') else None,
                        window_center=str(ds.WindowCenter) if hasattr(ds, 'WindowCenter') else None,
                        window_width=str(ds.WindowWidth) if hasattr(ds, 'WindowWidth') else None,
                        file_size_kb=os.path.getsize(file_path) / 1024,
                        transfer_syntax_uid=str(ds.file_meta.TransferSyntaxUID),
                        has_pixel_data=hasattr(ds, 'PixelData')
                    )
                    
                    # Move file to permanent location
                    permanent_path = os.path.join(UPLOAD_DIR, study_uid, series_uid, f"{instance_uid}.dcm")
                    shutil.move(file_path, permanent_path)
                    instance.file_path = permanent_path
                    
                    db.add(instance)
                
                # Update counters
                series.number_of_instances = db.query(DICOMInstance).filter(
                    DICOMInstance.series_id == series.id
                ).count()
                study.number_of_series = db.query(DICOMSeries).filter(
                    DICOMSeries.study_id == study.id
                ).count()
                study.number_of_instances = db.query(DICOMInstance).join(DICOMSeries).filter(
                    DICOMSeries.study_id == study.id
                ).count()
                
            except InvalidDicomError:
                errors.append(f"{file.filename}: Invalid DICOM file")
            except Exception as e:
                errors.append(f"{file.filename}: {str(e)}")
        
        # Update study statuses
        for study in processed_studies.values():
            study.upload_status = 'complete'
            
            # Link to imaging study if provided
            if imaging_study_id and not study.imaging_study_id:
                study.imaging_study_id = imaging_study_id
                
                # Create imaging result if it doesn't exist
                result = db.query(ImagingResult).filter(
                    ImagingResult.imaging_study_id == imaging_study_id
                ).first()
                
                if not result:
                    result = ImagingResult(
                        imaging_study_id=imaging_study_id,
                        dicom_study_id=study.id,
                        status='preliminary'
                    )
                    db.add(result)
        
        db.commit()
        
        return StandardResponse(
            success=True,
            message=f"Uploaded {len(files) - len(errors)} files successfully",
            data={
                "studies": [study.to_dict() for study in processed_studies.values()],
                "errors": errors
            }
        )
        
    except Exception as e:
        db.rollback()
        # Cleanup session directory
        shutil.rmtree(session_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup empty session directory
        if os.path.exists(session_dir) and not os.listdir(session_dir):
            os.rmdir(session_dir)


@router.get("/studies/{patient_id}", response_model=StandardResponse)
async def get_patient_studies(
    patient_id: str,
    db: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Disabled for teaching purposes
):
    """Get all DICOM studies for a patient"""
    studies = db.query(DICOMStudy).filter(
        DICOMStudy.patient_id == patient_id
    ).order_by(DICOMStudy.study_date.desc()).all()
    
    return StandardResponse(
        success=True,
        message=f"Found {len(studies)} studies",
        data=[study.to_dict() for study in studies]
    )


@router.get("/fhir/imaging-study/{patient_id}")
async def get_fhir_imaging_studies(
    patient_id: str,
    db: Session = Depends(get_db),
):
    """Get FHIR ImagingStudy resources for a patient"""
    studies = db.query(DICOMStudy).filter(
        DICOMStudy.patient_id == patient_id
    ).order_by(DICOMStudy.study_date.desc()).all()
    
    # Convert to FHIR ImagingStudy resources
    fhir_studies = []
    for study in studies:
        fhir_study = dicom_study_to_fhir_imaging_study(study)
        fhir_studies.append(fhir_study)
    
    # Return as FHIR Bundle
    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(fhir_studies),
        "entry": [
            {
                "fullUrl": f"ImagingStudy/{study['id']}",
                "resource": study
            }
            for study in fhir_studies
        ]
    }


@router.get("/study/{study_id}", response_model=StandardResponse)
async def get_study_details(
    study_id: int,
    db: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Disabled for teaching purposes
):
    """Get detailed information about a DICOM study"""
    study = db.query(DICOMStudy).filter(DICOMStudy.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")
    
    return StandardResponse(
        success=True,
        message="Study details retrieved",
        data=study.to_dict()
    )


@router.get("/instance/{instance_id}/metadata", response_model=StandardResponse)
async def get_instance_metadata(
    instance_id: int,
    db: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Disabled for teaching purposes
):
    """Get DICOM metadata for an instance"""
    instance = db.query(DICOMInstance).filter(DICOMInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        ds = pydicom.dcmread(instance.file_path, stop_before_pixels=True)
        
        # Extract key metadata
        metadata = {
            "patientName": str(ds.PatientName) if hasattr(ds, 'PatientName') else None,
            "patientID": str(ds.PatientID) if hasattr(ds, 'PatientID') else None,
            "studyDescription": str(ds.StudyDescription) if hasattr(ds, 'StudyDescription') else None,
            "seriesDescription": str(ds.SeriesDescription) if hasattr(ds, 'SeriesDescription') else None,
            "modality": str(ds.Modality) if hasattr(ds, 'Modality') else None,
            "instanceNumber": int(ds.InstanceNumber) if hasattr(ds, 'InstanceNumber') else None,
            "rows": int(ds.Rows) if hasattr(ds, 'Rows') else None,
            "columns": int(ds.Columns) if hasattr(ds, 'Columns') else None,
            "pixelSpacing": list(map(float, ds.PixelSpacing)) if hasattr(ds, 'PixelSpacing') else None,
            "sliceThickness": float(ds.SliceThickness) if hasattr(ds, 'SliceThickness') else None,
            "sliceLocation": float(ds.SliceLocation) if hasattr(ds, 'SliceLocation') else None,
            "windowCenter": float(ds.WindowCenter) if hasattr(ds, 'WindowCenter') else None,
            "windowWidth": float(ds.WindowWidth) if hasattr(ds, 'WindowWidth') else None,
            "rescaleIntercept": float(ds.RescaleIntercept) if hasattr(ds, 'RescaleIntercept') else 0,
            "rescaleSlope": float(ds.RescaleSlope) if hasattr(ds, 'RescaleSlope') else 1
        }
        
        return StandardResponse(
            success=True,
            message="Metadata retrieved",
            data=metadata
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading DICOM file: {str(e)}")


@router.get("/results/{imaging_study_id}", response_model=StandardResponse)
async def get_imaging_results(
    imaging_study_id: str,
    db: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Disabled for teaching purposes
):
    """Get imaging results including DICOM studies and reports"""
    result = db.query(ImagingResult).filter(
        ImagingResult.imaging_study_id == imaging_study_id
    ).first()
    
    if not result:
        return StandardResponse(
            success=True,
            message="No results available",
            data=None
        )
    
    data = result.to_dict()
    
    # Include DICOM study details if available
    if result.dicom_study:
        data['dicom_study'] = result.dicom_study.to_dict()
    
    return StandardResponse(
        success=True,
        message="Results retrieved",
        data=data
    )


@router.post("/results/{imaging_study_id}/report", response_model=StandardResponse)
async def update_imaging_report(
    imaging_study_id: str,
    findings: str = Form(...),
    impression: str = Form(...),
    recommendations: Optional[str] = Form(None),
    status: str = Form("final"),
    db: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Disabled for teaching purposes
):
    """Update or create an imaging report"""
    # Get or create result
    result = db.query(ImagingResult).filter(
        ImagingResult.imaging_study_id == imaging_study_id
    ).first()
    
    if not result:
        # Check if imaging study exists
        imaging_study = db.query(ImagingStudy).filter(
            ImagingStudy.id == imaging_study_id
        ).first()
        
        if not imaging_study:
            raise HTTPException(status_code=404, detail="Imaging study not found")
        
        result = ImagingResult(
            imaging_study_id=imaging_study_id
        )
        db.add(result)
    
    # Update report
    result.findings = findings
    result.impression = impression
    result.recommendations = recommendations
    result.status = status
    result.reported_by = "Demo User"  # Simplified for teaching purposes
    result.reported_at = datetime.utcnow()
    
    db.commit()
    
    return StandardResponse(
        success=True,
        message="Report updated successfully",
        data=result.to_dict()
    )


@router.get("/wado/instances/{instance_id}")
async def get_dicom_file(
    instance_id: int,
    db: Session = Depends(get_db),
    # current_user: dict = Depends(get_current_user)  # Disabled for teaching purposes
):
    """
    Serve DICOM file for viewing (WADO-like endpoint)
    Returns the DICOM file with appropriate headers
    """
    instance = db.query(DICOMInstance).filter(DICOMInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    if not os.path.exists(instance.file_path):
        raise HTTPException(status_code=404, detail="DICOM file not found on disk")
    
    # Return the DICOM file
    return FileResponse(
        instance.file_path,
        media_type="application/dicom",
        headers={
            "Content-Disposition": f"inline; filename={instance.sop_instance_uid}.dcm"
        }
    )


@router.get("/wado/studies/{study_id}/series")
async def get_study_series(
    study_id: int,
    db: Session = Depends(get_db),
):
    """Get all series for a study with instance information"""
    try:
        # Verify study exists
        study = db.query(DICOMStudy).filter(DICOMStudy.id == study_id).first()
        if not study:
            raise HTTPException(status_code=404, detail="Study not found")
        
        series_list = db.query(DICOMSeries).filter(
            DICOMSeries.study_id == study_id
        ).all()
        
        result = []
        for series in series_list:
            # Manually build series data to avoid recursion issues
            instances = db.query(DICOMInstance).filter(
                DICOMInstance.series_id == series.id
            ).order_by(DICOMInstance.instance_number).all()
            
            series_data = {
                'id': series.id,
                'series_instance_uid': series.series_instance_uid,
                'series_number': series.series_number,
                'series_description': series.series_description,
                'modality': series.modality,
                'body_part_examined': series.body_part_examined,
                'number_of_instances': len(instances),
                'instances': [
                    {
                        'id': inst.id,
                        'sop_instance_uid': inst.sop_instance_uid,
                        'instance_number': inst.instance_number,
                        'rows': inst.rows,
                        'columns': inst.columns,
                        'slice_location': inst.slice_location,
                        'window_center': inst.window_center,
                        'window_width': inst.window_width,
                        'file_size_kb': inst.file_size_kb,
                        'wado_url': f"/api/imaging/wado/instances/{inst.id}"
                    }
                    for inst in instances
                ]
            }
            result.append(series_data)
        
        return StandardResponse(
            success=True,
            message=f"Found {len(result)} series",
            data=result
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in get_study_series: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving series: {str(e)}")


@router.get("/wado/series/{series_id}/instances")
async def get_series_instances(
    series_id: int,
    db: Session = Depends(get_db),
):
    """Get all instances for a series"""
    instances = db.query(DICOMInstance).filter(
        DICOMInstance.series_id == series_id
    ).order_by(DICOMInstance.instance_number).all()
    
    return StandardResponse(
        success=True,
        message=f"Found {len(instances)} instances",
        data=[
            {
                'id': inst.id,
                'sop_instance_uid': inst.sop_instance_uid,
                'instance_number': inst.instance_number,
                'rows': inst.rows,
                'columns': inst.columns,
                'file_size': inst.file_size,
                'wado_url': f"/api/imaging/wado/instances/{inst.id}"
            }
            for inst in instances
        ]
    )