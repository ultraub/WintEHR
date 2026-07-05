"""
Shared INSERT helper for registering an external CDS Hooks service.

The minimal two-row registration (external_services.services parent row +
external_services.cds_hooks child row) used to be duplicated in
cds_studio's visual_builder_router and CDSStudioService with drifting
column lists — one copy omitted `status`, silently leaving services in the
schema-default 'pending' state. This module is the single implementation.

The full-featured registry path (`ExternalServiceRegistry` in service.py —
encryption, tags, versions, health tracking) is a different flow and does
not use this helper.
"""

import json
import uuid
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def insert_cds_hook_service_records(
    db: AsyncSession,
    *,
    name: str,
    base_url: str,
    hook_type: str,
    hook_service_id: str,
    description: Optional[str] = None,
    prefetch_template: Optional[Dict[str, Any]] = None,
    has_credentials: bool = False,
    status: str = "active",
) -> Tuple[str, str]:
    """
    Insert the parent service row and its cds_hooks child row.

    Does NOT commit — the caller owns the transaction (some callers create
    a HAPI PlanDefinition between these inserts and the commit).

    Returns:
        (service_uuid, cds_hook_uuid)
    """
    service_uuid = str(uuid.uuid4())
    cds_hook_uuid = str(uuid.uuid4())

    await db.execute(text("""
        INSERT INTO external_services.services
        (id, name, service_type, base_url, discovery_endpoint, auth_type, status, created_at)
        VALUES (:id, :name, 'cds_hooks', :base_url, :discovery_endpoint, :auth_type, :status, NOW())
    """), {
        "id": service_uuid,
        "name": name,
        "base_url": base_url,
        "discovery_endpoint": f"{base_url}/cds-services",
        "auth_type": "bearer" if has_credentials else "none",
        "status": status,
    })

    await db.execute(text("""
        INSERT INTO external_services.cds_hooks
        (id, service_id, hook_type, hook_service_id, title, description, prefetch_template, created_at)
        VALUES (:id, :service_id, :hook_type, :hook_service_id, :title, :description, :prefetch_template, NOW())
    """), {
        "id": cds_hook_uuid,
        "service_id": service_uuid,
        "hook_type": hook_type,
        "hook_service_id": hook_service_id,
        "title": name,
        "description": description,
        "prefetch_template": json.dumps(prefetch_template) if prefetch_template else None,
    })

    return service_uuid, cds_hook_uuid
