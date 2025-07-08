"""
FHIR Bulk Export Implementation
Implements the FHIR Bulk Data Access (Flat FHIR) specification
"""

import asyncio
import json
import uuid
import gzip
import os
import aiofiles
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pathlib import Path
import ndjson

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models.synthea_models import Patient, Encounter, Observation, Provider, Organization, Location
from models.fhir_resource import FHIRResource, Condition
from models.clinical.orders import MedicationOrder as Medication
import logging


# Export status storage (in production, use Redis or database)
EXPORT_JOBS = {}

# Export directory
EXPORT_DIR = Path("exports")
EXPORT_DIR.mkdir(exist_ok=True)

class BulkExportJob:
    """Represents a bulk export job"""
    
    def __init__(self, job_id: str, export_type: str, resource_types: List[str], 
                 since: Optional[datetime] = None, patient_ids: Optional[List[str]] = None):
        self.job_id = job_id
        self.export_type = export_type  # system, patient, group
        self.resource_types = resource_types
        self.since = since
        self.patient_ids = patient_ids
        self.status = "accepted"
        self.transaction_time = datetime.utcnow()
        self.request_time = datetime.utcnow()
        self.output = []
        self.error = []
        self.progress = 0
        self.total = 0
        
    def to_status_response(self) -> Dict[str, Any]:
        """Convert to FHIR bulk export status response"""
        response = {
            "transactionTime": self.transaction_time.isoformat() + "Z",
            "request": f"/$export?_type={','.join(self.resource_types)}",
            "requiresAccessToken": False
        }
        
        if self.status == "completed":
            response["output"] = self.output
            if self.error:
                response["error"] = self.error
        elif self.status == "error":
            response["error"] = self.error
        else:
            # In progress
            if self.total > 0:
                response["progress"] = {
                    "percentage": int((self.progress / self.total) * 100),
                    "exported": self.progress,
                    "total": self.total
                }
        
        return response


class BulkExportService:
    """Service for handling bulk FHIR exports"""
    
    def __init__(self, db: Session):
        self.db = db
        
    async def create_export_job(self, export_type: str, resource_types: List[str], 
                               since: Optional[datetime] = None, 
                               patient_ids: Optional[List[str]] = None) -> str:
        """Create a new export job and start processing"""
        job_id = str(uuid.uuid4())
        job = BulkExportJob(job_id, export_type, resource_types, since, patient_ids)
        
        EXPORT_JOBS[job_id] = job
        
        # Start export in background
        asyncio.create_task(self._process_export(job))
        
        return job_id
    
    def get_export_status(self, job_id: str) -> Optional[BulkExportJob]:
        """Get the status of an export job"""
        return EXPORT_JOBS.get(job_id)
    
    def cancel_export(self, job_id: str) -> bool:
        """Cancel an export job"""
        job = EXPORT_JOBS.get(job_id)
        if job and job.status in ["accepted", "in-progress"]:
            job.status = "cancelled"
            return True
        return False
    
    async def _process_export(self, job: BulkExportJob):
        """Process the export job asynchronously"""
        try:
            job.status = "in-progress"
            
            # Create export directory for this job
            job_dir = EXPORT_DIR / job.job_id
            job_dir.mkdir(exist_ok=True)
            
            # Export each resource type
            for resource_type in job.resource_types:
                if job.status == "cancelled":
                    break
                    
                await self._export_resource_type(job, resource_type, job_dir)
            
            if job.status != "cancelled":
                job.status = "completed"
                
        except Exception as e:
            job.status = "error"
            job.error.append({
                "type": "exception",
                "diagnostics": str(e)
            })
    
    async def _export_resource_type(self, job: BulkExportJob, resource_type: str, job_dir: Path):
        """Export a specific resource type"""
        # Import converters dynamically to avoid circular imports
        from .fhir_router import (
            patient_to_fhir, encounter_to_fhir, observation_to_fhir, 
            condition_to_fhir, medication_request_to_fhir, practitioner_to_fhir,
            organization_to_fhir, location_to_fhir
        )
        
        # Map resource types to models and converters
        resource_config = {
            "Patient": {
                "model": Patient,
                "converter": patient_to_fhir,
                "relationships": ["encounters", "observations", "conditions", "medications"]
            },
            "Encounter": {
                "model": Encounter,
                "converter": encounter_to_fhir,
                "patient_field": "patient_id"
            },
            "Observation": {
                "model": Observation,
                "converter": observation_to_fhir,
                "patient_field": "patient_id"
            },
            "Condition": {
                "model": Condition,
                "converter": condition_to_fhir,
                "patient_field": "patient_id"
            },
            "MedicationRequest": {
                "model": Medication,
                "converter": medication_request_to_fhir,
                "patient_field": "patient_id"
            },
            "Practitioner": {
                "model": Provider,
                "converter": practitioner_to_fhir
            },
            "Organization": {
                "model": Organization,
                "converter": organization_to_fhir
            },
            "Location": {
                "model": Location,
                "converter": location_to_fhir
            }
        }
        
        if resource_type not in resource_config:
            return
        
        config = resource_config[resource_type]
        model = config["model"]
        converter = config["converter"]
        
        # Build query
        query = self.db.query(model)
        
        # Apply filters based on export type
        if job.export_type == "patient" and job.patient_ids:
            # Patient-specific export
            if resource_type == "Patient":
                query = query.filter(model.id.in_(job.patient_ids))
            elif "patient_field" in config:
                patient_field = getattr(model, config["patient_field"])
                query = query.filter(patient_field.in_(job.patient_ids))
            else:
                # Skip resources without patient association
                return
        
        # Apply since filter
        if job.since and hasattr(model, "updated_at"):
            query = query.filter(model.updated_at >= job.since)
        
        # Count total for progress
        total = query.count()
        if total == 0:
            return
            
        job.total += total
        
        # Export in batches
        batch_size = 1000
        file_number = 1
        current_file_resources = []
        max_file_size = 50 * 1024 * 1024  # 50MB per file
        
        for offset in range(0, total, batch_size):
            if job.status == "cancelled":
                break
                
            # Fetch batch
            batch = query.offset(offset).limit(batch_size).all()
            
            for resource in batch:
                if job.status == "cancelled":
                    break
                    
                # Convert to FHIR
                try:
                    fhir_resource = converter(resource)
                    current_file_resources.append(fhir_resource)
                    job.progress += 1
                    
                    # Check if we should start a new file
                    estimated_size = len(json.dumps(current_file_resources).encode())
                    if estimated_size >= max_file_size:
                        await self._write_ndjson_file(
                            job_dir, resource_type, file_number, 
                            current_file_resources, job
                        )
                        current_file_resources = []
                        file_number += 1
                        
                except Exception as e:
                    job.error.append({
                        "type": "processing",
                        "diagnostics": f"Error processing {resource_type}/{resource.id}: {str(e)}"
                    })
            
            # Allow other tasks to run
            await asyncio.sleep(0)
        
        # Write remaining resources
        if current_file_resources and job.status != "cancelled":
            await self._write_ndjson_file(
                job_dir, resource_type, file_number, 
                current_file_resources, job
            )
    
    async def _write_ndjson_file(self, job_dir: Path, resource_type: str, 
                                 file_number: int, resources: List[Dict], 
                                 job: BulkExportJob):
        """Write resources to NDJSON file"""
        filename = f"{resource_type}-{file_number}.ndjson"
        filepath = job_dir / filename
        
        # Write NDJSON file
        with open(filepath, 'w') as f:
            writer = ndjson.writer(f)
            for resource in resources:
                writer.writerow(resource)
        
        # Compress with gzip
        compressed_filename = f"{filename}.gz"
        compressed_filepath = job_dir / compressed_filename
        
        with open(filepath, 'rb') as f_in:
            with gzip.open(compressed_filepath, 'wb') as f_out:
                f_out.writelines(f_in)
        
        # Remove uncompressed file
        filepath.unlink()
        
        # Add to output
        file_size = compressed_filepath.stat().st_size
        job.output.append({
            "type": resource_type,
            "url": f"/exports/{job.job_id}/{compressed_filename}",
            "count": len(resources),
            "size": file_size
        })


class BulkExportRouter:
    """Router endpoints for bulk export"""
    
    @staticmethod
    async def initiate_export(export_type: str, db: Session, 
                             type_filter: Optional[str] = None,
                             since: Optional[str] = None,
                             patient_ids: Optional[List[str]] = None):
        """Initiate a bulk export operation"""
        # Parse resource types
        resource_types = ["Patient", "Encounter", "Observation", "Condition", 
                         "MedicationRequest", "Practitioner", "Organization", "Location"]
        
        if type_filter:
            requested_types = [t.strip() for t in type_filter.split(",")]
            resource_types = [t for t in requested_types if t in resource_types]
        
        # Parse since parameter
        since_datetime = None
        if since:
            try:
                since_datetime = datetime.fromisoformat(since.replace("Z", "+00:00"))
            except:
                pass
        
        # Create export job
        service = BulkExportService(db)
        job_id = await service.create_export_job(
            export_type, resource_types, since_datetime, patient_ids
        )
        
        return job_id
    
    @staticmethod
    def get_export_status(job_id: str, db: Session):
        """Get the status of an export job"""
        service = BulkExportService(db)
        job = service.get_export_status(job_id)
        
        if not job:
            return None
            
        if job.status == "completed":
            return 200, job.to_status_response()
        elif job.status == "error":
            return 500, job.to_status_response()
        else:
            return 202, {"message": "Export in progress"}
    
    @staticmethod
    def cancel_export(job_id: str, db: Session):
        """Cancel an export job"""
        service = BulkExportService(db)
        if service.cancel_export(job_id):
            return {"message": "Export cancelled"}
        return None
    
    @staticmethod
    async def get_export_file(job_id: str, filename: str):
        """Stream an export file"""
        filepath = EXPORT_DIR / job_id / filename
        
        if not filepath.exists():
            return None
            
        async def iterfile():
            async with aiofiles.open(filepath, 'rb') as f:
                while chunk := await f.read(65536):  # 64KB chunks
                    yield chunk
        
        return iterfile()


# Clean up old exports periodically
async def cleanup_old_exports():
    """Remove export files older than 24 hours"""
    while True:
        try:
            cutoff_time = datetime.now() - timedelta(hours=24)
            
            for job_id in list(EXPORT_JOBS.keys()):
                job = EXPORT_JOBS[job_id]
                if job.request_time < cutoff_time:
                    # Remove files
                    job_dir = EXPORT_DIR / job_id
                    if job_dir.exists():
                        for file in job_dir.iterdir():
                            file.unlink()
                        job_dir.rmdir()
                    
                    # Remove from memory
                    del EXPORT_JOBS[job_id]
            
        except Exception as e:
            logging.error(f"Error cleaning up exports: {e}")
        # Run every hour
        await asyncio.sleep(3600)


# Cleanup task will be started by the application when needed
# To avoid RuntimeWarning about unawaited coroutine during imports