from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from database import get_db_session as get_db

router = APIRouter()

@router.get("/studies/{study_uid}/series/{series_uid}/instances/{instance_uid}")
async def get_dicom_instance(
    study_uid: str,
    series_uid: str,
    instance_uid: str,
    db: Session = Depends(get_db)
):
    """WADO-RS endpoint to retrieve DICOM instance"""
    # Return a simple response for now
    return Response(
        content=b"Mock DICOM data",
        media_type="application/dicom"
    )