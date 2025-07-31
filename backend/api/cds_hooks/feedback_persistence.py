"""
CDS Hooks Feedback Persistence
Handles storing and retrieving CDS feedback and analytics from the database
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, insert, update, delete, func
from sqlalchemy.dialects.postgresql import UUID
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
import logging
import uuid
from enum import Enum

logger = logging.getLogger(__name__)

class FeedbackOutcome(str, Enum):
    """CDS feedback outcome types"""
    ACCEPTED = "accepted"
    OVERRIDDEN = "overridden"
    IGNORED = "ignored"

class FeedbackPersistenceManager:
    """Manages CDS feedback storage and analytics"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def store_feedback(self, 
                           hook_instance_id: Optional[str],
                           service_id: str,
                           card_uuid: str,
                           outcome: FeedbackOutcome,
                           override_reason: Optional[Dict[str, Any]] = None,
                           accepted_suggestions: Optional[List[Dict[str, Any]]] = None,
                           user_id: Optional[str] = None,
                           patient_id: Optional[str] = None,
                           encounter_id: Optional[str] = None,
                           context: Optional[Dict[str, Any]] = None) -> str:
        """Store feedback for a CDS card"""
        try:
            feedback_id = str(uuid.uuid4())
            
            # Generate hook_instance_id if not provided
            if hook_instance_id is None:
                hook_instance_id = str(uuid.uuid4())
            
            insert_sql = text("""
                INSERT INTO cds_hooks.feedback (
                    feedback_id, hook_instance_id, service_id, card_uuid,
                    outcome, override_reason, accepted_suggestions,
                    user_id, patient_id, encounter_id, context
                ) VALUES (
                    :feedback_id, :hook_instance_id, :service_id, :card_uuid,
                    :outcome, :override_reason, :accepted_suggestions,
                    :user_id, :patient_id, :encounter_id, :context
                ) RETURNING id, feedback_id
            """)
            
            result = await self.db.execute(insert_sql, {
                'feedback_id': feedback_id,
                'hook_instance_id': hook_instance_id,
                'service_id': service_id,
                'card_uuid': card_uuid,
                'outcome': outcome.value,
                'override_reason': json.dumps(override_reason) if override_reason else None,
                'accepted_suggestions': json.dumps(accepted_suggestions) if accepted_suggestions else None,
                'user_id': user_id,
                'patient_id': patient_id,
                'encounter_id': encounter_id,
                'context': json.dumps(context) if context else None
            })
            
            await self.db.commit()
            
            row = result.first()
            logger.info(f"Stored feedback {feedback_id} for card {card_uuid} with outcome {outcome.value}")
            
            # Update analytics asynchronously
            await self._update_analytics(service_id, outcome, override_reason)
            
            return feedback_id
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error storing feedback: {e}")
            raise
    
    async def store_bulk_feedback(self, feedback_items: List[Dict[str, Any]]) -> List[str]:
        """Store multiple feedback items in one transaction"""
        try:
            feedback_ids = []
            
            for item in feedback_items:
                feedback_id = str(uuid.uuid4())
                feedback_ids.append(feedback_id)
                
                insert_sql = text("""
                    INSERT INTO cds_hooks.feedback (
                        feedback_id, hook_instance_id, service_id, card_uuid,
                        outcome, override_reason, accepted_suggestions,
                        user_id, patient_id, encounter_id, context
                    ) VALUES (
                        :feedback_id, :hook_instance_id, :service_id, :card_uuid,
                        :outcome, :override_reason, :accepted_suggestions,
                        :user_id, :patient_id, :encounter_id, :context
                    )
                """)
                
                await self.db.execute(insert_sql, {
                    'feedback_id': feedback_id,
                    'hook_instance_id': item['hook_instance_id'],
                    'service_id': item['service_id'],
                    'card_uuid': item['card_uuid'],
                    'outcome': item['outcome'],
                    'override_reason': json.dumps(item.get('override_reason')) if item.get('override_reason') else None,
                    'accepted_suggestions': json.dumps(item.get('accepted_suggestions')) if item.get('accepted_suggestions') else None,
                    'user_id': item.get('user_id'),
                    'patient_id': item.get('patient_id'),
                    'encounter_id': item.get('encounter_id'),
                    'context': json.dumps(item.get('context')) if item.get('context') else None
                })
            
            await self.db.commit()
            
            logger.info(f"Stored {len(feedback_ids)} feedback items in bulk")
            
            # Update analytics for all services
            service_outcomes = {}
            for item in feedback_items:
                service_id = item['service_id']
                outcome = FeedbackOutcome(item['outcome'])
                if service_id not in service_outcomes:
                    service_outcomes[service_id] = []
                service_outcomes[service_id].append((outcome, item.get('override_reason')))
            
            for service_id, outcomes in service_outcomes.items():
                for outcome, override_reason in outcomes:
                    await self._update_analytics(service_id, outcome, override_reason)
            
            return feedback_ids
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error storing bulk feedback: {e}")
            raise
    
    async def get_feedback_by_service(self, 
                                    service_id: str,
                                    start_date: Optional[datetime] = None,
                                    end_date: Optional[datetime] = None,
                                    limit: int = 100) -> List[Dict[str, Any]]:
        """Get feedback for a specific service"""
        try:
            where_clauses = ["service_id = :service_id"]
            params = {'service_id': service_id, 'limit': limit}
            
            if start_date:
                where_clauses.append("created_at >= :start_date")
                params['start_date'] = start_date
            
            if end_date:
                where_clauses.append("created_at <= :end_date")
                params['end_date'] = end_date
            
            where_clause = " AND ".join(where_clauses)
            
            query = text(f"""
                SELECT 
                    feedback_id, hook_instance_id, card_uuid, outcome,
                    override_reason, accepted_suggestions, user_id,
                    patient_id, encounter_id, context, created_at
                FROM cds_hooks.feedback
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT :limit
            """)
            
            result = await self.db.execute(query, params)
            rows = result.fetchall()
            
            return [self._row_to_feedback_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error retrieving feedback for service {service_id}: {e}")
            return []
    
    async def get_feedback_by_patient(self, 
                                    patient_id: str,
                                    limit: int = 50) -> List[Dict[str, Any]]:
        """Get all feedback for a specific patient"""
        try:
            query = text("""
                SELECT 
                    feedback_id, hook_instance_id, service_id, card_uuid, 
                    outcome, override_reason, accepted_suggestions, user_id,
                    encounter_id, context, created_at
                FROM cds_hooks.feedback
                WHERE patient_id = :patient_id
                ORDER BY created_at DESC
                LIMIT :limit
            """)
            
            result = await self.db.execute(query, {
                'patient_id': patient_id,
                'limit': limit
            })
            rows = result.fetchall()
            
            return [self._row_to_feedback_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error retrieving feedback for patient {patient_id}: {e}")
            return []
    
    async def get_feedback_by_user(self, 
                                 user_id: str,
                                 limit: int = 50) -> List[Dict[str, Any]]:
        """Get all feedback for a specific user"""
        try:
            query = text("""
                SELECT 
                    feedback_id, hook_instance_id, service_id, card_uuid, 
                    outcome, override_reason, accepted_suggestions,
                    patient_id, encounter_id, context, created_at
                FROM cds_hooks.feedback
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT :limit
            """)
            
            result = await self.db.execute(query, {
                'user_id': user_id,
                'limit': limit
            })
            rows = result.fetchall()
            
            return [self._row_to_feedback_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error retrieving feedback for user {user_id}: {e}")
            return []
    
    async def get_analytics_summary(self, 
                                  service_id: Optional[str] = None,
                                  period_days: int = 30) -> Dict[str, Any]:
        """Get analytics summary for services"""
        try:
            start_date = datetime.now() - timedelta(days=period_days)
            
            where_clauses = ["created_at >= :start_date"]
            params = {'start_date': start_date}
            
            if service_id:
                where_clauses.append("service_id = :service_id")
                params['service_id'] = service_id
            
            where_clause = " AND ".join(where_clauses)
            
            # Get feedback counts by outcome
            query = text(f"""
                SELECT 
                    service_id,
                    outcome,
                    COUNT(*) as count
                FROM cds_hooks.feedback
                WHERE {where_clause}
                GROUP BY service_id, outcome
            """)
            
            result = await self.db.execute(query, params)
            rows = result.fetchall()
            
            # Organize data by service
            service_stats = {}
            for row in rows:
                service = row.service_id
                if service not in service_stats:
                    service_stats[service] = {
                        'total': 0,
                        'accepted': 0,
                        'overridden': 0,
                        'ignored': 0,
                        'acceptance_rate': 0.0
                    }
                
                service_stats[service][row.outcome] = row.count
                service_stats[service]['total'] += row.count
            
            # Calculate acceptance rates
            for service, stats in service_stats.items():
                if stats['total'] > 0:
                    stats['acceptance_rate'] = round(
                        (stats['accepted'] / stats['total']) * 100, 2
                    )
            
            # Get common override reasons
            if service_id:
                override_query = text("""
                    SELECT 
                        override_reason,
                        COUNT(*) as count
                    FROM cds_hooks.feedback
                    WHERE service_id = :service_id
                    AND outcome = 'overridden'
                    AND override_reason IS NOT NULL
                    AND created_at >= :start_date
                    GROUP BY override_reason
                    ORDER BY count DESC
                    LIMIT 10
                """)
                
                override_result = await self.db.execute(override_query, params)
                override_rows = override_result.fetchall()
                
                common_overrides = []
                for row in override_rows:
                    reason_data = json.loads(row.override_reason) if row.override_reason else {}
                    common_overrides.append({
                        'reason': reason_data,
                        'count': row.count
                    })
                
                return {
                    'service_id': service_id,
                    'period_days': period_days,
                    'stats': service_stats.get(service_id, {}),
                    'common_override_reasons': common_overrides
                }
            else:
                return {
                    'period_days': period_days,
                    'services': service_stats
                }
            
        except Exception as e:
            logger.error(f"Error getting analytics summary: {e}")
            return {}
    
    async def _update_analytics(self, 
                              service_id: str, 
                              outcome: FeedbackOutcome,
                              override_reason: Optional[Dict[str, Any]] = None):
        """Update analytics table with new feedback"""
        try:
            # Get current hour period
            now = datetime.now()
            period_start = now.replace(minute=0, second=0, microsecond=0)
            period_end = period_start + timedelta(hours=1)
            
            # Try to update existing record
            update_sql = text("""
                UPDATE cds_hooks.feedback_analytics
                SET total_cards = total_cards + 1,
                    accepted_count = accepted_count + CASE WHEN :outcome = 'accepted' THEN 1 ELSE 0 END,
                    overridden_count = overridden_count + CASE WHEN :outcome = 'overridden' THEN 1 ELSE 0 END,
                    ignored_count = ignored_count + CASE WHEN :outcome = 'ignored' THEN 1 ELSE 0 END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE service_id = :service_id
                AND period_start = :period_start
                AND period_end = :period_end
                RETURNING id
            """)
            
            result = await self.db.execute(update_sql, {
                'service_id': service_id,
                'outcome': outcome.value,
                'period_start': period_start,
                'period_end': period_end
            })
            
            if result.rowcount == 0:
                # Insert new record
                insert_sql = text("""
                    INSERT INTO cds_hooks.feedback_analytics (
                        service_id, period_start, period_end,
                        total_cards, accepted_count, overridden_count, ignored_count
                    ) VALUES (
                        :service_id, :period_start, :period_end,
                        1,
                        CASE WHEN :outcome = 'accepted' THEN 1 ELSE 0 END,
                        CASE WHEN :outcome = 'overridden' THEN 1 ELSE 0 END,
                        CASE WHEN :outcome = 'ignored' THEN 1 ELSE 0 END
                    )
                """)
                
                await self.db.execute(insert_sql, {
                    'service_id': service_id,
                    'outcome': outcome.value,
                    'period_start': period_start,
                    'period_end': period_end
                })
            
            # Update acceptance rate
            await self._update_acceptance_rate(service_id, period_start, period_end)
            
            # Update override reasons if applicable
            if outcome == FeedbackOutcome.OVERRIDDEN and override_reason:
                await self._update_override_reasons(service_id, period_start, period_end, override_reason)
            
            await self.db.commit()
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating analytics: {e}")
    
    async def _update_acceptance_rate(self, service_id: str, period_start: datetime, period_end: datetime):
        """Update acceptance rate for a period"""
        try:
            update_sql = text("""
                UPDATE cds_hooks.feedback_analytics
                SET acceptance_rate = CASE 
                    WHEN total_cards > 0 
                    THEN ROUND((accepted_count::numeric / total_cards::numeric) * 100, 2)
                    ELSE 0
                END
                WHERE service_id = :service_id
                AND period_start = :period_start
                AND period_end = :period_end
            """)
            
            await self.db.execute(update_sql, {
                'service_id': service_id,
                'period_start': period_start,
                'period_end': period_end
            })
            
        except Exception as e:
            logger.error(f"Error updating acceptance rate: {e}")
    
    async def _update_override_reasons(self, 
                                     service_id: str, 
                                     period_start: datetime, 
                                     period_end: datetime,
                                     override_reason: Dict[str, Any]):
        """Update common override reasons tracking"""
        try:
            # Get current override reasons
            query = text("""
                SELECT common_override_reasons
                FROM cds_hooks.feedback_analytics
                WHERE service_id = :service_id
                AND period_start = :period_start
                AND period_end = :period_end
            """)
            
            result = await self.db.execute(query, {
                'service_id': service_id,
                'period_start': period_start,
                'period_end': period_end
            })
            
            row = result.first()
            current_reasons = {}
            
            if row and row.common_override_reasons:
                current_reasons = row.common_override_reasons if isinstance(row.common_override_reasons, dict) else json.loads(row.common_override_reasons or '{}')
            
            # Update count for this reason
            reason_key = json.dumps(override_reason, sort_keys=True)
            current_reasons[reason_key] = current_reasons.get(reason_key, 0) + 1
            
            # Keep only top 10 reasons
            sorted_reasons = sorted(current_reasons.items(), key=lambda x: x[1], reverse=True)[:10]
            top_reasons = dict(sorted_reasons)
            
            # Update database
            update_sql = text("""
                UPDATE cds_hooks.feedback_analytics
                SET common_override_reasons = :reasons
                WHERE service_id = :service_id
                AND period_start = :period_start
                AND period_end = :period_end
            """)
            
            await self.db.execute(update_sql, {
                'reasons': json.dumps(top_reasons),
                'service_id': service_id,
                'period_start': period_start,
                'period_end': period_end
            })
            
        except Exception as e:
            logger.error(f"Error updating override reasons: {e}")
    
    def _row_to_feedback_dict(self, row) -> Dict[str, Any]:
        """Convert database row to feedback dictionary"""
        return {
            'feedback_id': str(row.feedback_id),
            'hook_instance_id': row.hook_instance_id,
            'service_id': row.service_id if hasattr(row, 'service_id') else None,
            'card_uuid': row.card_uuid,
            'outcome': row.outcome,
            'override_reason': json.loads(row.override_reason) if row.override_reason else None,
            'accepted_suggestions': json.loads(row.accepted_suggestions) if row.accepted_suggestions else None,
            'user_id': row.user_id,
            'patient_id': row.patient_id,
            'encounter_id': row.encounter_id if hasattr(row, 'encounter_id') else None,
            'context': json.loads(row.context) if row.context else None,
            'created_at': row.created_at.isoformat() if row.created_at else None
        }

# Utility functions for integration
async def get_feedback_manager(db: AsyncSession) -> FeedbackPersistenceManager:
    """Get a feedback persistence manager instance"""
    return FeedbackPersistenceManager(db)

async def process_cds_feedback(db: AsyncSession, feedback_data: Dict[str, Any]) -> str:
    """Process CDS feedback from the API endpoint"""
    try:
        manager = await get_feedback_manager(db)
        
        # Extract feedback data
        outcome = FeedbackOutcome(feedback_data['outcome'])
        
        feedback_id = await manager.store_feedback(
            hook_instance_id=feedback_data['hookInstance'],
            service_id=feedback_data['service'],
            card_uuid=feedback_data['card'],
            outcome=outcome,
            override_reason=feedback_data.get('overrideReason'),
            accepted_suggestions=feedback_data.get('acceptedSuggestions'),
            user_id=feedback_data.get('userId'),
            patient_id=feedback_data.get('patientId'),
            encounter_id=feedback_data.get('encounterId'),
            context=feedback_data.get('context')
        )
        
        return feedback_id
        
    except Exception as e:
        logger.error(f"Error processing CDS feedback: {e}")
        raise

async def get_service_analytics(db: AsyncSession, service_id: str, days: int = 30) -> Dict[str, Any]:
    """Get analytics for a specific service"""
    try:
        manager = await get_feedback_manager(db)
        return await manager.get_analytics_summary(service_id=service_id, period_days=days)
    except Exception as e:
        logger.error(f"Error getting service analytics: {e}")
        return {}

async def log_hook_execution(db: AsyncSession,
                           service_id: str,
                           hook_type: str,
                           patient_id: Optional[str],
                           user_id: Optional[str],
                           context: Dict[str, Any],
                           request_data: Dict[str, Any],
                           response_data: Dict[str, Any],
                           cards_returned: int,
                           execution_time_ms: int,
                           success: bool = True,
                           error_message: Optional[str] = None) -> int:
    """Log CDS hook execution for monitoring and analytics"""
    try:
        insert_sql = text("""
            INSERT INTO cds_hooks.execution_log (
                service_id, hook_type, patient_id, user_id,
                context, request_data, response_data,
                cards_returned, execution_time_ms, success, error_message
            ) VALUES (
                :service_id, :hook_type, :patient_id, :user_id,
                :context, :request_data, :response_data,
                :cards_returned, :execution_time_ms, :success, :error_message
            ) RETURNING id
        """)
        
        result = await db.execute(insert_sql, {
            'service_id': service_id,
            'hook_type': hook_type,
            'patient_id': patient_id,
            'user_id': user_id,
            'context': json.dumps(context) if context else None,
            'request_data': json.dumps(request_data) if request_data else None,
            'response_data': json.dumps(response_data) if response_data else None,
            'cards_returned': cards_returned,
            'execution_time_ms': execution_time_ms,
            'success': success,
            'error_message': error_message
        })
        
        await db.commit()
        
        log_id = result.scalar()
        logger.debug(f"Logged hook execution {log_id} for service {service_id}")
        
        return log_id
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error logging hook execution: {e}")
        return 0