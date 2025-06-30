"""Clinical tasks and care team API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel

from database.database import get_db
from models.clinical.tasks import ClinicalTask, CareTeamMember, PatientList
from models.models import Provider, Patient

router = APIRouter(prefix="/clinical/tasks", tags=["clinical-tasks"])


# Pydantic schemas
class TaskCreate(BaseModel):
    patient_id: Optional[str] = None
    task_type: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"  # low, medium, high, urgent
    assigned_to_id: Optional[str] = None
    due_date: Optional[date] = None
    care_team_id: Optional[str] = None
    related_order_id: Optional[str] = None
    related_note_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    completion_notes: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    patient_id: Optional[str]
    task_type: str
    title: str
    description: Optional[str]
    priority: str
    status: str
    assigned_to_id: Optional[str]
    assigned_by_id: str
    assigned_at: datetime
    due_date: Optional[date]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    completed_by_id: Optional[str]
    completion_notes: Optional[str]
    care_team_id: Optional[str]
    related_order_id: Optional[str]
    related_note_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    # Include related info
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_by_name: Optional[str] = None

    class Config:
        orm_mode = True


class CareTeamMember(BaseModel):
    provider_id: str
    role: str
    is_primary: bool = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class CareTeamCreate(BaseModel):
    patient_id: str
    name: str
    description: Optional[str] = None
    members: List[CareTeamMember]


class CareTeamResponse(BaseModel):
    id: str
    patient_id: str
    name: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    members: List[Dict[str, Any]]

    class Config:
        orm_mode = True


class PatientListCreate(BaseModel):
    name: str
    description: Optional[str] = None
    list_type: str  # personal, service, unit, custom
    query_criteria: Optional[Dict[str, Any]] = None
    patient_ids: Optional[List[str]] = None


class PatientListResponse(BaseModel):
    id: str
    provider_id: str
    name: str
    description: Optional[str]
    list_type: str
    query_criteria: Optional[Dict[str, Any]]
    patient_ids: Optional[List[str]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


def get_current_user(db: Session = Depends(get_db)) -> Provider:
    """Mock function to get current user - replace with real auth"""
    provider = db.query(Provider).first()
    if not provider:
        raise HTTPException(status_code=404, detail="No provider found")
    return provider


# Task Management Endpoints
@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a new clinical task"""
    db_task = ClinicalTask(
        **task.dict(),
        assigned_by_id=current_user.id,
        assigned_at=datetime.utcnow(),
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Enrich response
    result = TaskResponse.from_orm(db_task)
    
    if db_task.patient_id:
        patient = db.query(Patient).filter(Patient.id == db_task.patient_id).first()
        if patient:
            result.patient_name = f"{patient.first_name} {patient.last_name}"
            result.patient_mrn = patient.mrn
    
    if db_task.assigned_to_id:
        assigned_to = db.query(Provider).filter(Provider.id == db_task.assigned_to_id).first()
        if assigned_to:
            result.assigned_to_name = f"{assigned_to.first_name} {assigned_to.last_name}"
    
    assigned_by = db.query(Provider).filter(Provider.id == db_task.assigned_by_id).first()
    if assigned_by:
        result.assigned_by_name = f"{assigned_by.first_name} {assigned_by.last_name}"
    
    return result


@router.get("/", response_model=List[TaskResponse])
async def get_tasks(
    assigned_to_me: bool = Query(False),
    assigned_by_me: bool = Query(False),
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    task_type: Optional[str] = Query(None),
    due_before: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Get tasks with filters"""
    query = db.query(ClinicalTask)
    
    if assigned_to_me:
        query = query.filter(ClinicalTask.assigned_to_id == current_user.id)
    if assigned_by_me:
        query = query.filter(ClinicalTask.assigned_by_id == current_user.id)
    if patient_id:
        query = query.filter(ClinicalTask.patient_id == patient_id)
    if status:
        query = query.filter(ClinicalTask.status == status)
    if priority:
        query = query.filter(ClinicalTask.priority == priority)
    if task_type:
        query = query.filter(ClinicalTask.task_type == task_type)
    if due_before:
        query = query.filter(ClinicalTask.due_date <= due_before)
    
    tasks = query.order_by(
        ClinicalTask.priority.desc(),
        ClinicalTask.due_date.asc()
    ).offset(skip).limit(limit).all()
    
    # Enrich results
    results = []
    for task in tasks:
        result = TaskResponse.from_orm(task)
        
        if task.patient_id:
            patient = db.query(Patient).filter(Patient.id == task.patient_id).first()
            if patient:
                result.patient_name = f"{patient.first_name} {patient.last_name}"
                result.patient_mrn = patient.mrn
        
        if task.assigned_to_id:
            assigned_to = db.query(Provider).filter(Provider.id == task.assigned_to_id).first()
            if assigned_to:
                result.assigned_to_name = f"{assigned_to.first_name} {assigned_to.last_name}"
        
        assigned_by = db.query(Provider).filter(Provider.id == task.assigned_by_id).first()
        if assigned_by:
            result.assigned_by_name = f"{assigned_by.first_name} {assigned_by.last_name}"
        
        results.append(result)
    
    return results


@router.get("/stats")
async def get_task_stats(
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Get task statistics for current user"""
    base_query = db.query(ClinicalTask).filter(
        ClinicalTask.assigned_to_id == current_user.id
    )
    
    stats = {
        "total_active": base_query.filter(
            ClinicalTask.status.in_(["pending", "in_progress"])
        ).count(),
        "pending": base_query.filter(ClinicalTask.status == "pending").count(),
        "in_progress": base_query.filter(ClinicalTask.status == "in_progress").count(),
        "overdue": base_query.filter(
            ClinicalTask.status.in_(["pending", "in_progress"]),
            ClinicalTask.due_date < date.today()
        ).count(),
        "due_today": base_query.filter(
            ClinicalTask.status.in_(["pending", "in_progress"]),
            ClinicalTask.due_date == date.today()
        ).count(),
        "by_priority": {
            "urgent": base_query.filter(
                ClinicalTask.priority == "urgent",
                ClinicalTask.status.in_(["pending", "in_progress"])
            ).count(),
            "high": base_query.filter(
                ClinicalTask.priority == "high",
                ClinicalTask.status.in_(["pending", "in_progress"])
            ).count(),
            "medium": base_query.filter(
                ClinicalTask.priority == "medium",
                ClinicalTask.status.in_(["pending", "in_progress"])
            ).count(),
            "low": base_query.filter(
                ClinicalTask.priority == "low",
                ClinicalTask.status.in_(["pending", "in_progress"])
            ).count()
        }
    }
    
    return stats


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Update a task"""
    task = db.query(ClinicalTask).filter(ClinicalTask.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update fields
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
    
    # Handle status changes
    if "status" in update_data:
        if update_data["status"] == "in_progress" and not task.started_at:
            task.started_at = datetime.utcnow()
        elif update_data["status"] == "completed":
            task.completed_at = datetime.utcnow()
            task.completed_by_id = current_user.id
    
    task.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    # Enrich response
    result = TaskResponse.from_orm(task)
    
    if task.patient_id:
        patient = db.query(Patient).filter(Patient.id == task.patient_id).first()
        if patient:
            result.patient_name = f"{patient.first_name} {patient.last_name}"
            result.patient_mrn = patient.mrn
    
    return result


@router.post("/{task_id}/complete")
async def complete_task(
    task_id: str,
    completion_notes: Optional[str] = Body(None),
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Mark a task as completed"""
    task = db.query(ClinicalTask).filter(ClinicalTask.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status == "completed":
        raise HTTPException(status_code=400, detail="Task already completed")
    
    task.status = "completed"
    task.completed_at = datetime.utcnow()
    task.completed_by_id = current_user.id
    task.completion_notes = completion_notes
    task.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Task completed successfully"}


# Care Team Endpoints
@router.post("/care-teams/", response_model=CareTeamResponse)
async def create_care_team(
    care_team: CareTeamCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a new care team"""
    db_care_team = CareTeam(
        patient_id=care_team.patient_id,
        name=care_team.name,
        description=care_team.description,
        members=care_team.members,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(db_care_team)
    db.commit()
    db.refresh(db_care_team)
    
    return db_care_team


@router.get("/care-teams/patient/{patient_id}", response_model=List[CareTeamResponse])
async def get_patient_care_teams(
    patient_id: str,
    active_only: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Get care teams for a patient"""
    query = db.query(CareTeam).filter(CareTeam.patient_id == patient_id)
    
    if active_only:
        query = query.filter(CareTeam.is_active == True)
    
    return query.all()


@router.put("/care-teams/{team_id}/members")
async def update_care_team_members(
    team_id: str,
    members: List[CareTeamMember],
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Update care team members"""
    care_team = db.query(CareTeam).filter(CareTeam.id == team_id).first()
    
    if not care_team:
        raise HTTPException(status_code=404, detail="Care team not found")
    
    care_team.members = [member.dict() for member in members]
    care_team.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Care team updated successfully"}


# Patient List Endpoints
@router.post("/patient-lists/", response_model=PatientListResponse)
async def create_patient_list(
    patient_list: PatientListCreate,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Create a new patient list"""
    db_patient_list = PatientList(
        provider_id=current_user.id,
        **patient_list.dict(),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(db_patient_list)
    db.commit()
    db.refresh(db_patient_list)
    
    return db_patient_list


@router.get("/patient-lists/", response_model=List[PatientListResponse])
async def get_patient_lists(
    list_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Get patient lists for current user"""
    query = db.query(PatientList).filter(
        PatientList.provider_id == current_user.id,
        PatientList.is_active == True
    )
    
    if list_type:
        query = query.filter(PatientList.list_type == list_type)
    
    return query.all()


@router.get("/patient-lists/{list_id}/patients")
async def get_patient_list_patients(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Get patients in a list"""
    patient_list = db.query(PatientList).filter(
        PatientList.id == list_id,
        PatientList.provider_id == current_user.id
    ).first()
    
    if not patient_list:
        raise HTTPException(status_code=404, detail="Patient list not found")
    
    # If list has specific patient IDs
    if patient_list.patient_ids:
        patients = db.query(Patient).filter(
            Patient.id.in_(patient_list.patient_ids)
        ).all()
    # If list has query criteria (dynamic list)
    elif patient_list.query_criteria:
        # Implement dynamic query based on criteria
        # This is a simplified example
        query = db.query(Patient)
        
        if "unit" in patient_list.query_criteria:
            # Add unit filter
            pass
        if "attending_id" in patient_list.query_criteria:
            # Add attending filter
            pass
        
        patients = query.all()
    else:
        patients = []
    
    # Format response
    return {
        "list_name": patient_list.name,
        "patient_count": len(patients),
        "patients": [
            {
                "id": p.id,
                "mrn": p.mrn,
                "name": f"{p.first_name} {p.last_name}",
                "date_of_birth": p.date_of_birth,
                "room": getattr(p, "room", None),
                "attending": getattr(p, "attending", None)
            }
            for p in patients
        ]
    }


@router.put("/patient-lists/{list_id}/add-patient/{patient_id}")
async def add_patient_to_list(
    list_id: str,
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Add a patient to a list"""
    patient_list = db.query(PatientList).filter(
        PatientList.id == list_id,
        PatientList.provider_id == current_user.id
    ).first()
    
    if not patient_list:
        raise HTTPException(status_code=404, detail="Patient list not found")
    
    if patient_list.list_type != "custom":
        raise HTTPException(status_code=400, detail="Can only add patients to custom lists")
    
    if not patient_list.patient_ids:
        patient_list.patient_ids = []
    
    if patient_id not in patient_list.patient_ids:
        patient_list.patient_ids.append(patient_id)
        patient_list.updated_at = datetime.utcnow()
        db.commit()
    
    return {"message": "Patient added to list"}


@router.delete("/patient-lists/{list_id}/remove-patient/{patient_id}")
async def remove_patient_from_list(
    list_id: str,
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: Provider = Depends(get_current_user)
):
    """Remove a patient from a list"""
    patient_list = db.query(PatientList).filter(
        PatientList.id == list_id,
        PatientList.provider_id == current_user.id
    ).first()
    
    if not patient_list:
        raise HTTPException(status_code=404, detail="Patient list not found")
    
    if patient_list.patient_ids and patient_id in patient_list.patient_ids:
        patient_list.patient_ids.remove(patient_id)
        patient_list.updated_at = datetime.utcnow()
        db.commit()
    
    return {"message": "Patient removed from list"}