"""
CDS Hooks Feedback Router
Implements CDS Hooks 2.0 feedback endpoint for tracking card outcomes
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, select, update
from datetime import datetime
import logging

from database import get_db_session
from .models import FeedbackRequest, FeedbackItem, FeedbackOutcome
from .database_models import CDSFeedback

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cds-services",
    tags=["CDS Hooks Feedback"]
)


@router.post("/{service_id}/feedback", status_code=status.HTTP_200_OK)
async def receive_feedback(
    service_id: str,
    feedback_request: FeedbackRequest,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """
    Receive feedback about card acceptance or override
    
    This endpoint allows CDS Clients to report when cards are accepted or overridden,
    including the reasons for overrides and which suggestions were accepted.
    """
    try:
        # Process each feedback item
        for feedback_item in feedback_request.feedback:
            # Create feedback record
            feedback_data = {
                "service_id": service_id,
                "card_uuid": feedback_item.card,
                "outcome": feedback_item.outcome.value,
                "outcome_timestamp": feedback_item.outcomeTimestamp,
                "created_at": datetime.utcnow()
            }
            
            # Add outcome-specific data
            if feedback_item.outcome == FeedbackOutcome.ACCEPTED:
                # Track accepted suggestions
                if feedback_item.acceptedSuggestions:
                    feedback_data["accepted_suggestions"] = [
                        suggestion.id for suggestion in feedback_item.acceptedSuggestions
                    ]
            elif feedback_item.outcome == FeedbackOutcome.OVERRIDDEN:
                # Track override reason
                if feedback_item.overrideReason:
                    feedback_data["override_reason_key"] = feedback_item.overrideReason.key
                    feedback_data["override_reason_comment"] = feedback_item.overrideReason.userComment
            
            # Store feedback in database
            stmt = insert(CDSFeedback).values(**feedback_data)
            await db.execute(stmt)
        
        # Commit all feedback items
        await db.commit()
        
        logger.info(f"Received {len(feedback_request.feedback)} feedback items for service {service_id}")
        
        return {"status": "success", "message": f"Feedback received for {len(feedback_request.feedback)} items"}
        
    except Exception as e:
        logger.error(f"Error processing feedback for service {service_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process feedback"
        )


@router.get("/{service_id}/feedback/analytics", response_model=dict)
async def get_feedback_analytics(
    service_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """
    Get analytics for a specific CDS service based on feedback
    
    Returns acceptance rates, common override reasons, and other metrics
    """
    try:
        # Build query
        query = select(CDSFeedback).where(CDSFeedback.service_id == service_id)
        
        if start_date:
            query = query.where(CDSFeedback.outcome_timestamp >= start_date)
        if end_date:
            query = query.where(CDSFeedback.outcome_timestamp <= end_date)
        
        result = await db.execute(query)
        feedback_items = result.scalars().all()
        
        # Calculate analytics
        total_cards = len(feedback_items)
        accepted_cards = len([f for f in feedback_items if f.outcome == "accepted"])
        overridden_cards = len([f for f in feedback_items if f.outcome == "overridden"])
        
        # Count override reasons
        override_reasons = {}
        for feedback in feedback_items:
            if feedback.outcome == "overridden" and feedback.override_reason_key:
                reason = feedback.override_reason_key
                override_reasons[reason] = override_reasons.get(reason, 0) + 1
        
        # Calculate acceptance rate
        acceptance_rate = (accepted_cards / total_cards * 100) if total_cards > 0 else 0
        
        return {
            "service_id": service_id,
            "total_cards": total_cards,
            "accepted_cards": accepted_cards,
            "overridden_cards": overridden_cards,
            "acceptance_rate": round(acceptance_rate, 2),
            "override_reasons": override_reasons,
            "date_range": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None
            }
        }
        
    except Exception as e:
        logger.error(f"Error retrieving analytics for service {service_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve analytics"
        )


@router.get("/{service_id}/feedback/suggestions", response_model=dict)
async def get_suggestion_analytics(
    service_id: str,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """
    Get analytics about which suggestions are most frequently accepted
    """
    try:
        # Query feedback with accepted suggestions
        query = select(CDSFeedback).where(
            CDSFeedback.service_id == service_id,
            CDSFeedback.outcome == "accepted",
            CDSFeedback.accepted_suggestions.isnot(None)
        )
        
        result = await db.execute(query)
        feedback_items = result.scalars().all()
        
        # Count suggestion acceptance
        suggestion_counts = {}
        for feedback in feedback_items:
            if feedback.accepted_suggestions:
                for suggestion_id in feedback.accepted_suggestions:
                    suggestion_counts[suggestion_id] = suggestion_counts.get(suggestion_id, 0) + 1
        
        # Sort by frequency
        sorted_suggestions = sorted(
            suggestion_counts.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        return {
            "service_id": service_id,
            "suggestion_acceptance": [
                {"suggestion_id": sid, "acceptance_count": count}
                for sid, count in sorted_suggestions
            ],
            "total_accepted_cards": len(feedback_items)
        }
        
    except Exception as e:
        logger.error(f"Error retrieving suggestion analytics for service {service_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve suggestion analytics"
        )