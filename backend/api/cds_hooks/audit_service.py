"""
CDS Hooks Audit Service
Enhanced audit trail service with detailed tracking and analysis
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import logging
import json
from sqlalchemy.ext.asyncio import AsyncSession

from fhir.core.storage import FHIRStorageEngine
from .audit_models import (
    AuditEventDetail, AuditHistoryResponse, AuditAnalytics, 
    DetailedAuditQuery, AuditEventEnriched, AuditTrailSummary,
    AuditOutcome, ActionType
)

logger = logging.getLogger(__name__)

class AuditService:
    """Enhanced audit service for CDS action tracking"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage = FHIRStorageEngine(db)
    
    async def get_detailed_audit_history(self, query: DetailedAuditQuery) -> AuditHistoryResponse:
        """Get detailed audit history with advanced filtering and enrichment"""
        try:
            # Build search parameters
            search_params = {
                "type": "110100",  # Application Activity
                "_sort": "-recorded",
                "_count": str(query.limit),
                "_offset": str(query.offset)
            }
            
            # Add date filters
            if query.date_from:
                search_params["date"] = f"ge{query.date_from}"
            if query.date_to:
                existing_date = search_params.get("date", "")
                if existing_date:
                    search_params["date"] = f"{existing_date}&date=le{query.date_to}"
                else:
                    search_params["date"] = f"le{query.date_to}"
            
            # Add patient filter
            if query.patient_id:
                search_params["patient"] = f"Patient/{query.patient_id}"
                
            # Get audit events
            audit_events, total = await self.storage.search_resources("AuditEvent", search_params)
            
            # Filter and enrich CDS-related events
            enriched_events = []
            for event in audit_events:
                if await self._is_cds_action_event(event):
                    # Apply additional filters
                    if query.service_id and not await self._matches_service(event, query.service_id):
                        continue
                    if query.action_type and not await self._matches_action_type(event, query.action_type):
                        continue
                    if query.outcome and event.get("outcome") != query.outcome.value:
                        continue
                    if query.user_id and not await self._matches_user(event, query.user_id):
                        continue
                    
                    # Convert to detailed audit event
                    detailed_event = await self._convert_to_detailed_event(
                        event, 
                        query.include_system_info,
                        query.include_clinical_context
                    )
                    if detailed_event:
                        enriched_events.append(detailed_event)
            
            # Generate summary statistics
            summary = await self._generate_summary(enriched_events, query)
            
            return AuditHistoryResponse(
                patient_id=query.patient_id or "all",
                total_events=len(enriched_events),
                events=enriched_events,
                pagination={
                    "limit": query.limit,
                    "offset": query.offset,
                    "has_more": len(audit_events) == query.limit,
                    "total_available": total
                },
                summary=summary
            )
            
        except Exception as e:
            logger.error(f"Error retrieving detailed audit history: {str(e)}")
            raise Exception(f"Failed to retrieve audit history: {str(e)}")
    
    async def get_audit_analytics(self, days: int = 30, patient_id: Optional[str] = None) -> AuditAnalytics:
        """Get comprehensive audit analytics"""
        try:
            cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
            
            search_params = {
                "type": "110100",
                "date": f"ge{cutoff_date}",
                "_count": "1000"
            }
            
            if patient_id:
                search_params["patient"] = f"Patient/{patient_id}"
            
            audit_events, _ = await self.storage.search_resources("AuditEvent", search_params)
            
            # Filter CDS events
            cds_events = []
            for event in audit_events:
                if await self._is_cds_action_event(event):
                    cds_events.append(event)
            
            # Calculate analytics
            analytics = await self._calculate_analytics(cds_events, days)
            return analytics
            
        except Exception as e:
            logger.error(f"Error generating audit analytics: {str(e)}")
            raise Exception(f"Failed to generate analytics: {str(e)}")
    
    async def get_enriched_audit_event(self, audit_event_id: str) -> Optional[AuditEventEnriched]:
        """Get a single audit event with full enrichment"""
        try:
            event = await self.storage.read_resource("AuditEvent", audit_event_id)
            if not event or not await self._is_cds_action_event(event):
                return None
            
            # Convert to detailed event
            detailed_event = await self._convert_to_detailed_event(event, True, True)
            if not detailed_event:
                return None
            
            # Get enrichment data
            patient_info = await self._get_patient_info(detailed_event.patient_id)
            user_info = await self._get_user_info(detailed_event.user_id)
            service_info = await self._get_service_info(detailed_event.service_id)
            resource_details = await self._get_resource_details(detailed_event)
            related_events = await self._get_related_events(detailed_event)
            clinical_impact = await self._calculate_clinical_impact(detailed_event)
            
            return AuditEventEnriched(
                base_event=detailed_event,
                patient_info=patient_info,
                user_info=user_info,
                service_info=service_info,
                resource_details=resource_details,
                related_events=related_events,
                clinical_impact_score=clinical_impact
            )
            
        except Exception as e:
            logger.error(f"Error enriching audit event {audit_event_id}: {str(e)}")
            return None
    
    async def get_audit_trail_summary(self, context_type: str, context_id: str) -> AuditTrailSummary:
        """Get summary of audit trail for a specific context"""
        try:
            # Build search based on context type
            search_params = {
                "type": "110100",
                "_count": "1000",
                "_sort": "-recorded"
            }
            
            if context_type == "patient":
                search_params["patient"] = f"Patient/{context_id}"
            elif context_type == "user":
                search_params["agent"] = f"Practitioner/{context_id}"
            
            audit_events, _ = await self.storage.search_resources("AuditEvent", search_params)
            
            # Filter CDS events
            cds_events = [event for event in audit_events if await self._is_cds_action_event(event)]
            
            if not cds_events:
                return AuditTrailSummary(
                    context_type=context_type,
                    context_id=context_id,
                    total_events=0,
                    date_range={"start": "", "end": ""},
                    outcome_summary={},
                    action_summary={},
                    most_active_periods=[],
                    risk_indicators=[]
                )
            
            # Calculate summary
            summary = await self._calculate_trail_summary(cds_events, context_type, context_id)
            return summary
            
        except Exception as e:
            logger.error(f"Error generating audit trail summary: {str(e)}")
            raise Exception(f"Failed to generate summary: {str(e)}")
    
    # Private helper methods
    
    async def _is_cds_action_event(self, event: Dict[str, Any]) -> bool:
        """Check if audit event is a CDS action execution"""
        subtype = event.get("subtype", [])
        return any(st.get("display") == "CDS Action Execution" for st in subtype)
    
    async def _matches_service(self, event: Dict[str, Any], service_id: str) -> bool:
        """Check if event matches service ID"""
        # Look for service ID in event details
        for entity in event.get("entity", []):
            for detail in entity.get("detail", []):
                if detail.get("type") == "service_id" and detail.get("valueString") == service_id:
                    return True
        return False
    
    async def _matches_action_type(self, event: Dict[str, Any], action_type: ActionType) -> bool:
        """Check if event matches action type"""
        for entity in event.get("entity", []):
            for detail in entity.get("detail", []):
                if detail.get("type") == "action_type" and detail.get("valueString") == action_type.value:
                    return True
        return False
    
    async def _matches_user(self, event: Dict[str, Any], user_id: str) -> bool:
        """Check if event matches user ID"""
        for agent in event.get("agent", []):
            who = agent.get("who", {}).get("reference", "")
            if who.endswith(f"/{user_id}"):
                return True
        return False
    
    async def _convert_to_detailed_event(
        self, 
        event: Dict[str, Any], 
        include_system_info: bool = False,
        include_clinical_context: bool = False
    ) -> Optional[AuditEventDetail]:
        """Convert FHIR AuditEvent to detailed audit event model"""
        try:
            # Extract basic information
            execution_id = event.get("id", "")
            recorded = event.get("recorded", "")
            outcome = event.get("outcome", "0")
            
            # Extract details from entity data
            details = {}
            for entity in event.get("entity", []):
                for detail in entity.get("detail", []):
                    detail_type = detail.get("type", "")
                    detail_value = detail.get("valueString", "")
                    details[detail_type] = detail_value
            
            # Parse execution result if available
            execution_result = details.get("execution_result", "")
            message = "Action executed"
            errors = []
            warnings = []
            execution_time_ms = 0
            
            if execution_result:
                try:
                    if "Success: True" in execution_result:
                        parts = execution_result.split(", Message: ")
                        if len(parts) > 1:
                            message = parts[1]
                except:
                    pass
            
            # Extract error information
            error_detail = details.get("error", "")
            if error_detail:
                errors.append(error_detail)
                message = f"Action failed: {error_detail}"
            
            # Get agent information
            agent = event.get("agent", [{}])[0]
            user_ref = agent.get("who", {}).get("reference", "")
            user_id = user_ref.split("/")[-1] if "/" in user_ref else "unknown"
            
            # Get patient information
            patient_ref = ""
            for entity in event.get("entity", []):
                what = entity.get("what", {})
                if what.get("reference", "").startswith("Patient/"):
                    patient_ref = what.get("reference", "")
                    break
            
            patient_id = patient_ref.split("/")[-1] if "/" in patient_ref else "unknown"
            
            # Build detailed event
            detailed_event = AuditEventDetail(
                execution_id=execution_id,
                action_type=ActionType(details.get("action_type", "create")),
                service_id=details.get("service_id", "unknown"),
                card_uuid=details.get("card_uuid", ""),
                suggestion_uuid=details.get("suggestion_uuid", ""),
                action_uuid=details.get("action_uuid", ""),
                patient_id=patient_id,
                user_id=user_id,
                encounter_id=details.get("encounter_id"),
                recorded=recorded,
                outcome=AuditOutcome(outcome),
                execution_time_ms=execution_time_ms,
                message=message,
                errors=errors,
                warnings=warnings,
                created_resources=[],
                updated_resources=[],
                deleted_resources=[]
            )
            
            # Add system info if requested
            if include_system_info:
                detailed_event.system_info = {
                    "source": event.get("source", {}),
                    "type": event.get("type", {}),
                    "subtype": event.get("subtype", [])
                }
            
            # Add clinical context if requested
            if include_clinical_context:
                detailed_event.clinical_context = await self._extract_clinical_context(event, patient_id)
            
            return detailed_event
            
        except Exception as e:
            logger.error(f"Error converting audit event to detailed format: {str(e)}")
            return None
    
    async def _generate_summary(self, events: List[AuditEventDetail], query: DetailedAuditQuery) -> Dict[str, Any]:
        """Generate summary statistics for audit events"""
        if not events:
            return {}
        
        successful = len([e for e in events if e.outcome == AuditOutcome.SUCCESS])
        failed = len(events) - successful
        
        action_counts = {}
        service_counts = {}
        
        for event in events:
            action_counts[event.action_type.value] = action_counts.get(event.action_type.value, 0) + 1
            service_counts[event.service_id] = service_counts.get(event.service_id, 0) + 1
        
        return {
            "total_events": len(events),
            "successful_events": successful,
            "failed_events": failed,
            "success_rate": (successful / len(events) * 100) if events else 0,
            "action_type_breakdown": action_counts,
            "service_breakdown": service_counts,
            "date_range": {
                "start": min(e.recorded for e in events),
                "end": max(e.recorded for e in events)
            }
        }
    
    async def _calculate_analytics(self, events: List[Dict[str, Any]], days: int) -> AuditAnalytics:
        """Calculate comprehensive analytics from audit events"""
        if not events:
            return AuditAnalytics(
                period_days=days,
                total_executions=0,
                successful_executions=0,
                failed_executions=0,
                success_rate=0.0,
                daily_average=0.0
            )
        
        successful = len([e for e in events if e.get("outcome") == "0"])
        failed = len(events) - successful
        
        return AuditAnalytics(
            period_days=days,
            total_executions=len(events),
            successful_executions=successful,
            failed_executions=failed,
            success_rate=(successful / len(events) * 100) if events else 0,
            daily_average=len(events) / days if days > 0 else 0,
            action_type_breakdown={},
            service_breakdown={},
            avg_execution_time_ms=0.0,
            max_execution_time_ms=0,
            min_execution_time_ms=0,
            most_common_errors=[],
            hourly_distribution=[0] * 24,
            daily_distribution=[0] * 7
        )
    
    async def _get_patient_info(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Get basic patient information for enrichment"""
        try:
            patient = await self.storage.read_resource("Patient", patient_id)
            if not patient:
                return None
            
            name = patient.get("name", [{}])[0]
            return {
                "id": patient_id,
                "name": name.get("text", "Unknown"),
                "birthDate": patient.get("birthDate"),
                "gender": patient.get("gender")
            }
        except:
            return None
    
    async def _get_user_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get basic user information for enrichment"""
        try:
            practitioner = await self.storage.read_resource("Practitioner", user_id)
            if not practitioner:
                return {"id": user_id, "name": "Unknown User"}
            
            name = practitioner.get("name", [{}])[0]
            return {
                "id": user_id,
                "name": name.get("text", "Unknown"),
                "qualification": practitioner.get("qualification", [])
            }
        except:
            return {"id": user_id, "name": "Unknown User"}
    
    async def _get_service_info(self, service_id: str) -> Optional[Dict[str, Any]]:
        """Get CDS service information"""
        # This would typically come from a service registry
        # For now, return basic info
        return {
            "id": service_id,
            "title": service_id.replace("-", " ").title(),
            "type": "CDS Hook Service"
        }
    
    async def _get_resource_details(self, event: AuditEventDetail) -> List[Dict[str, Any]]:
        """Get details about resources created/updated/deleted"""
        details = []
        
        # Add created resources
        for resource in event.created_resources:
            try:
                resource_data = await self.storage.read_resource(
                    resource["resourceType"], 
                    resource["id"]
                )
                if resource_data:
                    details.append({
                        "action": "created",
                        "type": resource["resourceType"],
                        "id": resource["id"],
                        "summary": self._get_resource_summary(resource_data)
                    })
            except:
                details.append({
                    "action": "created",
                    "type": resource["resourceType"],
                    "id": resource["id"],
                    "summary": "Resource details unavailable"
                })
        
        return details
    
    def _get_resource_summary(self, resource: Dict[str, Any]) -> str:
        """Get a human-readable summary of a FHIR resource"""
        resource_type = resource.get("resourceType", "Unknown")
        
        if resource_type == "MedicationRequest":
            med = resource.get("medicationCodeableConcept", {})
            coding = med.get("coding", [{}])[0]
            return f"Medication: {coding.get('display', 'Unknown medication')}"
        elif resource_type == "ServiceRequest":
            code = resource.get("code", {})
            coding = code.get("coding", [{}])[0]
            return f"Service: {coding.get('display', 'Unknown service')}"
        elif resource_type == "Appointment":
            return f"Appointment: {resource.get('start', 'Unknown time')}"
        else:
            return f"{resource_type} resource"
    
    async def _get_related_events(self, event: AuditEventDetail) -> List[str]:
        """Find related audit events"""
        # This could find events for the same patient, same session, etc.
        return []
    
    async def _calculate_clinical_impact(self, event: AuditEventDetail) -> Optional[float]:
        """Calculate estimated clinical impact score"""
        # This would use clinical rules to assess impact
        # For now, return a basic score based on action type
        impact_scores = {
            ActionType.CREATE: 0.7,
            ActionType.UPDATE: 0.5,
            ActionType.DELETE: 0.9,
            ActionType.ORDER: 0.8,
            ActionType.PRESCRIBE: 0.9,
            ActionType.SCHEDULE: 0.6
        }
        return impact_scores.get(event.action_type, 0.5)
    
    async def _extract_clinical_context(self, event: Dict[str, Any], patient_id: str) -> Dict[str, Any]:
        """Extract clinical context from audit event"""
        return {
            "patient_id": patient_id,
            "timestamp": event.get("recorded"),
            "clinical_setting": "outpatient"  # This would be determined from context
        }
    
    async def _calculate_trail_summary(
        self, 
        events: List[Dict[str, Any]], 
        context_type: str, 
        context_id: str
    ) -> AuditTrailSummary:
        """Calculate comprehensive trail summary"""
        if not events:
            return AuditTrailSummary(
                context_type=context_type,
                context_id=context_id,
                total_events=0,
                date_range={"start": "", "end": ""},
                outcome_summary={},
                action_summary={},
                most_active_periods=[],
                risk_indicators=[]
            )
        
        # Calculate outcome summary
        outcome_summary = {}
        for event in events:
            outcome = event.get("outcome", "0")
            outcome_summary[outcome] = outcome_summary.get(outcome, 0) + 1
        
        # Get date range
        dates = [event.get("recorded", "") for event in events if event.get("recorded")]
        date_range = {
            "start": min(dates) if dates else "",
            "end": max(dates) if dates else ""
        }
        
        return AuditTrailSummary(
            context_type=context_type,
            context_id=context_id,
            total_events=len(events),
            date_range=date_range,
            outcome_summary=outcome_summary,
            action_summary={},
            most_active_periods=[],
            risk_indicators=[]
        )