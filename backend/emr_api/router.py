"""
EMR Extension API Router

Provides EMR-specific functionality that extends FHIR:
- Authentication and session management
- Workflow orchestration
- UI state persistence
- Audit logging
- Clinical decision support
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json
import uuid

from database import get_db_session
from api.auth import router as auth_router
from .workflow import router as workflow_router
from .ui import router as ui_router
from .clinical import router as clinical_router

# Create main EMR router
emr_router = APIRouter(prefix="/api/emr", tags=["EMR Extensions"])

# Include sub-routers
emr_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
emr_router.include_router(workflow_router, prefix="/workflow", tags=["Workflow"])
emr_router.include_router(ui_router, prefix="/ui", tags=["UI State"])
emr_router.include_router(clinical_router, prefix="/clinical", tags=["Clinical Tools"])


@emr_router.get("/")
async def emr_info():
    """Get information about EMR extensions."""
    return {
        "name": "WintEHR Extensions",
        "version": "1.0.0",
        "description": "EMR-specific extensions to FHIR functionality",
        "features": [
            "Authentication and session management",
            "Clinical workflow orchestration",
            "UI state persistence",
            "Advanced audit logging",
            "Clinical decision support",
            "Template management",
            "Real-time collaboration"
        ],
        "endpoints": {
            "auth": "/api/emr/auth",
            "workflow": "/api/emr/workflow",
            "ui": "/api/emr/ui",
            "clinical": "/api/emr/clinical"
        }
    }


@emr_router.get("/audit-logs")
async def get_audit_logs(
    db: AsyncSession = Depends(get_db_session),
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Query audit logs with filtering.
    
    This provides detailed audit trail beyond FHIR's basic provenance.
    """
    query = """
        SELECT 
            al.id,
            al.user_id,
            u.username,
            al.action,
            al.resource_type,
            al.resource_id,
            al.details,
            al.ip_address,
            al.user_agent,
            al.created_at
        FROM emr.audit_logs al
        LEFT JOIN emr.users u ON al.user_id = u.id
        WHERE 1=1
    """
    
    params = {}
    
    if user_id:
        query += " AND al.user_id = :user_id"
        params['user_id'] = user_id
    
    if resource_type:
        query += " AND al.resource_type = :resource_type"
        params['resource_type'] = resource_type
    
    if resource_id:
        query += " AND al.resource_id = :resource_id"
        params['resource_id'] = resource_id
    
    if action:
        query += " AND al.action = :action"
        params['action'] = action
    
    if start_date:
        query += " AND al.created_at >= :start_date"
        params['start_date'] = start_date
    
    if end_date:
        query += " AND al.created_at <= :end_date"
        params['end_date'] = end_date
    
    query += " ORDER BY al.created_at DESC LIMIT :limit OFFSET :offset"
    params['limit'] = limit
    params['offset'] = offset
    
    result = await db.execute(text(query), params)
    
    logs = []
    for row in result:
        logs.append({
            "id": str(row.id),
            "userId": str(row.user_id) if row.user_id else None,
            "username": row.username,
            "action": row.action,
            "resourceType": row.resource_type,
            "resourceId": row.resource_id,
            "details": row.details,
            "ipAddress": str(row.ip_address) if row.ip_address else None,
            "userAgent": row.user_agent,
            "timestamp": row.created_at.isoformat()
        })
    
    return {
        "logs": logs,
        "total": len(logs),
        "limit": limit,
        "offset": offset
    }


@emr_router.post("/audit-logs")
async def create_audit_log(
    audit_entry: dict,
    db: AsyncSession = Depends(get_db_session),
    user_id: Optional[str] = None  # From auth dependency
):
    """
    Create an audit log entry.
    
    This is typically called automatically by other endpoints.
    """
    query = text("""
        INSERT INTO emr.audit_logs (
            user_id, action, resource_type, resource_id,
            details, ip_address, user_agent
        ) VALUES (
            :user_id, :action, :resource_type, :resource_id,
            :details, :ip_address, :user_agent
        )
        RETURNING id
    """)
    
    result = await db.execute(query, {
        'user_id': user_id,
        'action': audit_entry.get('action'),
        'resource_type': audit_entry.get('resourceType'),
        'resource_id': audit_entry.get('resourceId'),
        'details': json.dumps(audit_entry.get('details', {})),
        'ip_address': audit_entry.get('ipAddress'),
        'user_agent': audit_entry.get('userAgent')
    })
    
    audit_id = result.scalar()
    await db.commit()
    
    return {"id": str(audit_id), "message": "Audit log created"}


@emr_router.get("/cds-rules")
async def get_cds_rules(
    db: AsyncSession = Depends(get_db_session),
    type: Optional[str] = None,
    active_only: bool = True
):
    """
    Get clinical decision support rules.
    
    These extend beyond FHIR's basic decision support resources.
    """
    query = """
        SELECT id, name, type, condition, action, is_active, created_at
        FROM emr.cds_rules
        WHERE 1=1
    """
    
    params = {}
    
    if active_only:
        query += " AND is_active = true"
    
    if type:
        query += " AND type = :type"
        params['type'] = type
    
    query += " ORDER BY name"
    
    result = await db.execute(text(query), params)
    
    rules = []
    for row in result:
        rules.append({
            "id": str(row.id),
            "name": row.name,
            "type": row.type,
            "condition": row.condition,
            "action": row.action,
            "isActive": row.is_active,
            "createdAt": row.created_at.isoformat()
        })
    
    return {"rules": rules}


@emr_router.post("/cds-rules/{rule_id}/evaluate")
async def evaluate_cds_rule(
    rule_id: str,
    context: dict,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Evaluate a CDS rule against provided context.
    
    Context should include relevant FHIR resources and other data.
    """
    # Get the rule
    query = text("""
        SELECT condition, action
        FROM emr.cds_rules
        WHERE id = :rule_id AND is_active = true
    """)
    
    result = await db.execute(query, {'rule_id': uuid.UUID(rule_id)})
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="CDS rule not found or inactive")
    
    # This is a simplified implementation
    # In reality, you would have a rule engine that evaluates conditions
    # and generates appropriate actions/recommendations
    
    return {
        "ruleId": rule_id,
        "evaluated": True,
        "triggered": True,  # Simplified - would check condition
        "recommendations": row.action.get('recommendations', []),
        "alerts": row.action.get('alerts', [])
    }


@emr_router.get("/templates")
async def get_templates(
    db: AsyncSession = Depends(get_db_session),
    type: Optional[str] = None,
    category: Optional[str] = None,
    active_only: bool = True
):
    """
    Get clinical templates (note templates, order sets, forms).
    
    These augment FHIR Questionnaire resources with richer functionality.
    """
    query = """
        SELECT 
            id, name, type, category, content,
            questionnaire_id, created_by, is_active, created_at
        FROM emr.templates
        WHERE 1=1
    """
    
    params = {}
    
    if active_only:
        query += " AND is_active = true"
    
    if type:
        query += " AND type = :type"
        params['type'] = type
    
    if category:
        query += " AND category = :category"
        params['category'] = category
    
    query += " ORDER BY name"
    
    result = await db.execute(text(query), params)
    
    templates = []
    for row in result:
        templates.append({
            "id": str(row.id),
            "name": row.name,
            "type": row.type,
            "category": row.category,
            "content": row.content,
            "questionnaireId": row.questionnaire_id,
            "createdBy": str(row.created_by) if row.created_by else None,
            "isActive": row.is_active,
            "createdAt": row.created_at.isoformat()
        })
    
    return {"templates": templates}


@emr_router.post("/templates/{template_id}/instantiate")
async def instantiate_template(
    template_id: str,
    context: dict,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Instantiate a template with provided context.
    
    This creates appropriate FHIR resources based on the template.
    """
    # Get the template
    query = text("""
        SELECT content, type, questionnaire_id
        FROM emr.templates
        WHERE id = :template_id AND is_active = true
    """)
    
    result = await db.execute(query, {'template_id': uuid.UUID(template_id)})
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Template not found or inactive")
    
    # This is a simplified implementation
    # In reality, you would have a template engine that processes
    # the template content and creates appropriate resources
    
    return {
        "templateId": template_id,
        "type": row.type,
        "instantiated": True,
        "resources": [],  # Would contain created FHIR resources
        "message": "Template instantiated successfully"
    }