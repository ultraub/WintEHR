"""Allergy management routes"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database.database import get_db
from models.models import Allergy
from ..schemas import AllergyCreate, AllergyResponse

router = APIRouter(prefix="/allergies", tags=["allergies"])

@router.get("/", response_model=List[AllergyResponse])
def get_allergies(patient_id: str = None, db: Session = Depends(get_db)):
    """Get allergies, optionally filtered by patient"""
    query = db.query(Allergy)
    if patient_id:
        query = query.filter(Allergy.patient_id == patient_id)
    return query.all()

@router.post("/", response_model=AllergyResponse)
def create_allergy(allergy: AllergyCreate, db: Session = Depends(get_db)):
    """Create a new allergy record"""
    db_allergy = Allergy(**allergy.dict())
    db.add(db_allergy)
    db.commit()
    db.refresh(db_allergy)
    return db_allergy

@router.get("/{allergy_id}", response_model=AllergyResponse)
def get_allergy(allergy_id: str, db: Session = Depends(get_db)):
    """Get a specific allergy by ID"""
    allergy = db.query(Allergy).filter(Allergy.id == allergy_id).first()
    if not allergy:
        raise HTTPException(status_code=404, detail="Allergy not found")
    return allergy

@router.put("/{allergy_id}", response_model=AllergyResponse)
def update_allergy(allergy_id: str, allergy_update: AllergyCreate, db: Session = Depends(get_db)):
    """Update an allergy record"""
    allergy = db.query(Allergy).filter(Allergy.id == allergy_id).first()
    if not allergy:
        raise HTTPException(status_code=404, detail="Allergy not found")
    
    for field, value in allergy_update.dict(exclude_unset=True).items():
        setattr(allergy, field, value)
    
    db.commit()
    db.refresh(allergy)
    return allergy

@router.delete("/{allergy_id}")
def delete_allergy(allergy_id: str, db: Session = Depends(get_db)):
    """Delete an allergy record"""
    allergy = db.query(Allergy).filter(Allergy.id == allergy_id).first()
    if not allergy:
        raise HTTPException(status_code=404, detail="Allergy not found")
    
    db.delete(allergy)
    db.commit()
    return {"message": "Allergy deleted successfully"}