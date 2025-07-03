"""
EMR UI State Management

Persists and manages UI state across sessions:
- User preferences
- View configurations
- Form states
- Layout preferences
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import json

from ..database import get_db_session
from .auth import require_auth

router = APIRouter()


@router.get("/state/{context}")
async def get_ui_state(
    context: str,
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """
    Get UI state for a specific context.
    
    Context examples:
    - patient-list: Patient list view configuration
    - patient-chart: Patient chart layout
    - clinical-canvas: Clinical Canvas settings
    - order-entry: Order entry preferences
    """
    query = text("""
        SELECT state, updated_at
        FROM emr.ui_states
        WHERE user_id = :user_id AND context = :context
    """)
    
    result = await db.execute(query, {
        "user_id": uuid.UUID(user["id"]),
        "context": context
    })
    
    row = result.first()
    
    if not row:
        # Return default state
        return {
            "context": context,
            "state": _get_default_state(context),
            "updatedAt": None
        }
    
    return {
        "context": context,
        "state": row.state,
        "updatedAt": row.updated_at.isoformat()
    }


@router.put("/state/{context}")
async def save_ui_state(
    context: str,
    state: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Save UI state for a specific context."""
    # Upsert state
    upsert_query = text("""
        INSERT INTO emr.ui_states (user_id, context, state, updated_at)
        VALUES (:user_id, :context, :state, :updated_at)
        ON CONFLICT (user_id, context)
        DO UPDATE SET state = :state, updated_at = :updated_at
    """)
    
    await db.execute(upsert_query, {
        "user_id": uuid.UUID(user["id"]),
        "context": context,
        "state": json.dumps(state),
        "updated_at": datetime.now(timezone.utc)
    })
    
    await db.commit()
    
    return {"message": "UI state saved successfully"}


@router.delete("/state/{context}")
async def reset_ui_state(
    context: str,
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Reset UI state to defaults for a specific context."""
    delete_query = text("""
        DELETE FROM emr.ui_states
        WHERE user_id = :user_id AND context = :context
    """)
    
    result = await db.execute(delete_query, {
        "user_id": uuid.UUID(user["id"]),
        "context": context
    })
    
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="UI state not found")
    
    return {
        "message": "UI state reset successfully",
        "defaultState": _get_default_state(context)
    }


@router.get("/states")
async def get_all_ui_states(
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Get all UI states for the current user."""
    query = text("""
        SELECT context, state, updated_at
        FROM emr.ui_states
        WHERE user_id = :user_id
        ORDER BY context
    """)
    
    result = await db.execute(query, {
        "user_id": uuid.UUID(user["id"])
    })
    
    states = []
    for row in result:
        states.append({
            "context": row.context,
            "state": row.state,
            "updatedAt": row.updated_at.isoformat()
        })
    
    return {"states": states}


@router.post("/states/bulk-update")
async def bulk_update_ui_states(
    updates: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Update multiple UI states at once."""
    updated_count = 0
    
    for update in updates:
        context = update.get("context")
        state = update.get("state")
        
        if not context or state is None:
            continue
        
        upsert_query = text("""
            INSERT INTO emr.ui_states (user_id, context, state, updated_at)
            VALUES (:user_id, :context, :state, :updated_at)
            ON CONFLICT (user_id, context)
            DO UPDATE SET state = :state, updated_at = :updated_at
        """)
        
        await db.execute(upsert_query, {
            "user_id": uuid.UUID(user["id"]),
            "context": context,
            "state": json.dumps(state),
            "updated_at": datetime.now(timezone.utc)
        })
        
        updated_count += 1
    
    await db.commit()
    
    return {
        "updatedCount": updated_count,
        "message": f"Updated {updated_count} UI states"
    }


@router.post("/states/export")
async def export_ui_states(
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Export all UI states for backup or transfer."""
    query = text("""
        SELECT context, state, updated_at
        FROM emr.ui_states
        WHERE user_id = :user_id
        ORDER BY context
    """)
    
    result = await db.execute(query, {
        "user_id": uuid.UUID(user["id"])
    })
    
    export_data = {
        "version": "1.0",
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "userId": user["id"],
        "username": user["username"],
        "states": []
    }
    
    for row in result:
        export_data["states"].append({
            "context": row.context,
            "state": row.state,
            "updatedAt": row.updated_at.isoformat()
        })
    
    return export_data


@router.post("/states/import")
async def import_ui_states(
    import_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth),
    overwrite: bool = False
):
    """Import UI states from backup."""
    if import_data.get("version") != "1.0":
        raise HTTPException(status_code=400, detail="Unsupported import version")
    
    imported_count = 0
    
    for state_data in import_data.get("states", []):
        context = state_data.get("context")
        state = state_data.get("state")
        
        if not context or state is None:
            continue
        
        # Check if exists
        if not overwrite:
            check_query = text("""
                SELECT 1 FROM emr.ui_states
                WHERE user_id = :user_id AND context = :context
            """)
            
            result = await db.execute(check_query, {
                "user_id": uuid.UUID(user["id"]),
                "context": context
            })
            
            if result.first():
                continue
        
        # Import state
        upsert_query = text("""
            INSERT INTO emr.ui_states (user_id, context, state, updated_at)
            VALUES (:user_id, :context, :state, :updated_at)
            ON CONFLICT (user_id, context)
            DO UPDATE SET state = :state, updated_at = :updated_at
        """)
        
        await db.execute(upsert_query, {
            "user_id": uuid.UUID(user["id"]),
            "context": context,
            "state": json.dumps(state),
            "updated_at": datetime.now(timezone.utc)
        })
        
        imported_count += 1
    
    await db.commit()
    
    return {
        "importedCount": imported_count,
        "message": f"Imported {imported_count} UI states"
    }


def _get_default_state(context: str) -> Dict[str, Any]:
    """Get default state for a context."""
    defaults = {
        "patient-list": {
            "columns": ["name", "mrn", "dob", "provider"],
            "sortBy": "name",
            "sortOrder": "asc",
            "pageSize": 20,
            "filters": {}
        },
        "patient-chart": {
            "layout": "tabbed",
            "activeTab": "summary",
            "sidebarCollapsed": False,
            "noteTemplates": True
        },
        "clinical-canvas": {
            "theme": "light",
            "aiAssistance": True,
            "autoSave": True,
            "componentLibrary": "expanded"
        },
        "order-entry": {
            "favorites": [],
            "recentOrders": [],
            "defaultPriority": "routine",
            "defaultDuration": "once"
        },
        "inbox": {
            "groupBy": "type",
            "showRead": False,
            "autoRefresh": True,
            "refreshInterval": 60
        },
        "task-list": {
            "view": "list",
            "groupBy": "priority",
            "showCompleted": False,
            "myTasksOnly": True
        }
    }
    
    return defaults.get(context, {})


@router.get("/themes")
async def get_available_themes():
    """Get available UI themes."""
    return {
        "themes": [
            {
                "id": "light",
                "name": "Light",
                "description": "Default light theme",
                "primary": "#1976d2",
                "secondary": "#dc004e"
            },
            {
                "id": "dark",
                "name": "Dark",
                "description": "Dark theme for reduced eye strain",
                "primary": "#90caf9",
                "secondary": "#f48fb1"
            },
            {
                "id": "high-contrast",
                "name": "High Contrast",
                "description": "High contrast for accessibility",
                "primary": "#000000",
                "secondary": "#ffffff"
            }
        ]
    }


@router.get("/layouts/{view}")
async def get_layout_options(view: str):
    """Get available layout options for a specific view."""
    layouts = {
        "patient-chart": [
            {
                "id": "tabbed",
                "name": "Tabbed View",
                "description": "Traditional tabbed interface"
            },
            {
                "id": "single-page",
                "name": "Single Page",
                "description": "All sections on one scrollable page"
            },
            {
                "id": "dashboard",
                "name": "Dashboard",
                "description": "Customizable widget-based layout"
            }
        ],
        "patient-list": [
            {
                "id": "table",
                "name": "Table View",
                "description": "Traditional table layout"
            },
            {
                "id": "cards",
                "name": "Card View",
                "description": "Card-based patient display"
            },
            {
                "id": "compact",
                "name": "Compact View",
                "description": "Condensed information display"
            }
        ]
    }
    
    return {
        "view": view,
        "layouts": layouts.get(view, [])
    }