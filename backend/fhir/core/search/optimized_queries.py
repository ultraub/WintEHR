"""
Optimized FHIR Query Functions
High-performance query functions for common EMR use cases
"""

from sqlalchemy import and_, or_, func, text
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from fhir.models.resource import FHIRResource
from datetime import datetime, timedelta
import json


class OptimizedFHIRQueries:
    """High-performance query functions for common FHIR patterns"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_patient_bundle_optimized(
        self, 
        patient_id: str, 
        resource_types: List[str] = None,
        limit_per_type: int = 100,
        include_counts: bool = False
    ) -> Dict[str, Any]:
        """
        Optimized patient bundle query that fetches multiple resource types efficiently
        Uses a single query with UNION ALL for better performance
        """
        
        if not resource_types:
            resource_types = [
                'Encounter', 'Condition', 'MedicationRequest', 'Observation',
                'AllergyIntolerance', 'Procedure', 'DiagnosticReport'
            ]
        
        patient_ref = f"Patient/{patient_id}"
        bundle = {}
        total_counts = {}
        
        for resource_type in resource_types:
            # Build optimized query for each resource type
            query = self.db.query(FHIRResource).filter(
                and_(
                    FHIRResource.resource_type == resource_type,
                    FHIRResource.deleted == False,
                    or_(
                        FHIRResource.resource['subject']['reference'].astext == patient_ref,
                        FHIRResource.resource['patient']['reference'].astext == patient_ref,
                        FHIRResource.resource['beneficiary']['reference'].astext == patient_ref
                    )
                )
            ).order_by(FHIRResource.last_updated.desc())
            
            if include_counts:
                total_counts[resource_type] = query.count()
            
            # Apply limit and get results
            resources = query.limit(limit_per_type).all()
            bundle[resource_type] = [r.resource for r in resources]
        
        result = {'bundle': bundle}
        if include_counts:
            result['counts'] = total_counts
            
        return result
    
    def get_recent_observations_by_category(
        self,
        patient_id: str,
        category: str,
        days: int = 90,
        limit: int = 50
    ) -> List[Dict]:
        """
        Optimized query for recent observations by category
        """
        patient_ref = f"Patient/{patient_id}"
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        query = self.db.query(FHIRResource).filter(
            and_(
                FHIRResource.resource_type == 'Observation',
                FHIRResource.deleted == False,
                or_(
                    FHIRResource.resource['subject']['reference'].astext == patient_ref,
                    FHIRResource.resource['patient']['reference'].astext == patient_ref
                ),
                FHIRResource.resource['category'][0]['coding'][0]['code'].astext == category,
                FHIRResource.last_updated >= cutoff_date
            )
        ).order_by(FHIRResource.last_updated.desc()).limit(limit)
        
        return [r.resource for r in query.all()]
    
    def get_active_conditions(self, patient_id: str) -> List[Dict]:
        """
        Optimized query for active conditions
        """
        patient_ref = f"Patient/{patient_id}"
        
        query = self.db.query(FHIRResource).filter(
            and_(
                FHIRResource.resource_type == 'Condition',
                FHIRResource.deleted == False,
                or_(
                    FHIRResource.resource['subject']['reference'].astext == patient_ref,
                    FHIRResource.resource['patient']['reference'].astext == patient_ref
                ),
                FHIRResource.resource['clinicalStatus']['coding'][0]['code'].astext == 'active'
            )
        ).order_by(FHIRResource.last_updated.desc())
        
        return [r.resource for r in query.all()]
    
    def get_active_medications(self, patient_id: str) -> List[Dict]:
        """
        Optimized query for active medications
        """
        patient_ref = f"Patient/{patient_id}"
        
        query = self.db.query(FHIRResource).filter(
            and_(
                FHIRResource.resource_type == 'MedicationRequest',
                FHIRResource.deleted == False,
                or_(
                    FHIRResource.resource['subject']['reference'].astext == patient_ref,
                    FHIRResource.resource['patient']['reference'].astext == patient_ref
                ),
                FHIRResource.resource['status'].astext == 'active'
            )
        ).order_by(FHIRResource.last_updated.desc())
        
        return [r.resource for r in query.all()]
    
    def get_timeline_events(
        self,
        patient_id: str,
        resource_types: List[str] = None,
        days: int = 365,
        limit: int = 100
    ) -> List[Dict]:
        """
        Optimized timeline query that gets events across multiple resource types
        """
        if not resource_types:
            resource_types = [
                'Encounter', 'Condition', 'MedicationRequest', 'Procedure',
                'Observation', 'DiagnosticReport', 'DocumentReference'
            ]
        
        patient_ref = f"Patient/{patient_id}"
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Use UNION ALL to efficiently combine queries
        union_queries = []
        
        for resource_type in resource_types:
            subquery = self.db.query(
                FHIRResource.id,
                FHIRResource.resource_type,
                FHIRResource.resource,
                FHIRResource.last_updated
            ).filter(
                and_(
                    FHIRResource.resource_type == resource_type,
                    FHIRResource.deleted == False,
                    or_(
                        FHIRResource.resource['subject']['reference'].astext == patient_ref,
                        FHIRResource.resource['patient']['reference'].astext == patient_ref,
                        FHIRResource.resource['beneficiary']['reference'].astext == patient_ref
                    ),
                    FHIRResource.last_updated >= cutoff_date
                )
            )
            union_queries.append(subquery)
        
        # Combine all queries with UNION ALL
        if len(union_queries) > 1:
            combined_query = union_queries[0]
            for query in union_queries[1:]:
                combined_query = combined_query.union_all(query)
        else:
            combined_query = union_queries[0]
        
        # Order by last_updated and apply limit
        final_query = combined_query.order_by(text('last_updated DESC')).limit(limit)
        
        results = final_query.all()
        return [r.resource for r in results]
    
    def search_by_text(
        self,
        patient_id: str,
        search_term: str,
        resource_types: List[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        Optimized text search across multiple resource types
        Uses PostgreSQL full-text search capabilities
        """
        if not resource_types:
            resource_types = ['Condition', 'MedicationRequest', 'Procedure', 'Observation']
        
        patient_ref = f"Patient/{patient_id}"
        search_term_lower = search_term.lower()
        
        # Use PostgreSQL's JSONB containment and text search
        query = self.db.query(FHIRResource).filter(
            and_(
                FHIRResource.resource_type.in_(resource_types),
                FHIRResource.deleted == False,
                or_(
                    FHIRResource.resource['subject']['reference'].astext == patient_ref,
                    FHIRResource.resource['patient']['reference'].astext == patient_ref
                ),
                or_(
                    func.lower(FHIRResource.resource['code']['text'].astext).contains(search_term_lower),
                    func.lower(FHIRResource.resource['code']['coding'][0]['display'].astext).contains(search_term_lower),
                    func.lower(FHIRResource.resource['description'].astext).contains(search_term_lower)
                )
            )
        ).order_by(FHIRResource.last_updated.desc()).limit(limit)
        
        return [r.resource for r in query.all()]
    
    def get_patient_summary_counts(self, patient_id: str) -> Dict[str, int]:
        """
        Optimized query to get counts for patient summary
        Uses a single query with conditional aggregation
        """
        patient_ref = f"Patient/{patient_id}"
        
        # Use SQL aggregation for better performance
        result = self.db.execute(text("""
            SELECT 
                resource_type,
                COUNT(*) as count,
                COUNT(CASE WHEN resource->>'status' = 'active' THEN 1 END) as active_count
            FROM fhir.resources 
            WHERE deleted = false 
            AND (
                resource->'subject'->>'reference' = :patient_ref
                OR resource->'patient'->>'reference' = :patient_ref
                OR resource->'beneficiary'->>'reference' = :patient_ref
            )
            GROUP BY resource_type
        """), {"patient_ref": patient_ref})
        
        counts = {}
        for row in result:
            counts[row.resource_type] = {
                'total': row.count,
                'active': row.active_count
            }
        
        return counts


def get_optimized_queries(db: Session) -> OptimizedFHIRQueries:
    """Factory function to create optimized query instance"""
    return OptimizedFHIRQueries(db)