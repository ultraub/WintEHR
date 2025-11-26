"""
FHIR Authentication Helpers

Provides FastAPI dependencies for FHIR-based authentication context.
Maps authenticated users to Provider models for FHIR operations.

Educational Notes:
- This module bridges the auth system with FHIR context
- In production, would use proper user-to-practitioner mapping
- Currently uses demo mode with first available provider
"""

from __future__ import annotations

from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from database import get_db_session
from models.synthea_models import Provider
from api.auth.service import get_current_user
from api.auth.models import User

logger = logging.getLogger(__name__)


async def get_current_fhir_provider(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Provider:
    """
    Get Provider model for current authenticated user.

    Maps the authenticated user to a Provider record for FHIR operations.

    Educational Notes:
    - In production, would have user_id -> provider_id mapping table
    - Currently returns first active provider for demo purposes
    - Provider model will be migrated to FHIR Practitioner in Phase 5

    Args:
        current_user: Authenticated user from auth system
        db: Database session

    Returns:
        Provider model instance

    Raises:
        HTTPException 404: If no provider found
    """
    try:
        # In demo/training mode, get the first available provider
        # In production, this would look up provider by user mapping
        result = await db.execute(
            select(Provider)
            .where(Provider.id.isnot(None))
            .limit(1)
        )
        provider = result.scalar_one_or_none()

        if not provider:
            logger.warning(f"No provider found for user {current_user.username}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No provider found for current user"
            )

        logger.debug(f"Mapped user {current_user.username} to provider {provider.id}")
        return provider

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting provider for user {current_user.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get provider context"
        )


async def get_optional_fhir_provider(
    db: AsyncSession = Depends(get_db_session)
) -> Optional[Provider]:
    """
    Get Provider without requiring authentication.

    Used for endpoints that can work with or without auth context.
    Returns None if no provider available.
    """
    try:
        result = await db.execute(
            select(Provider)
            .where(Provider.id.isnot(None))
            .limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        logger.warning(f"Could not get optional provider: {e}")
        return None
