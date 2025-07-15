#!/usr/bin/env python3
"""
SQL and Database Validation Framework

This framework validates SQL search parameter extraction accuracy, database query
performance analysis, and search index validation for FHIR implementations.

Key validation areas:
- Search parameter extraction accuracy validation
- Database query performance analysis
- Search index validation and query optimization
- SQL injection prevention validation
- Database schema integrity checks
- Search result consistency validation
"""

import asyncio
import sys
import os
import time
import logging
import statistics
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

# Add parent directories to path for imports
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.fhir.storage import FHIRStorageEngine
from database import get_session_maker


@dataclass
class SQLValidationResult:
    """Result of SQL/database validation"""
    validation_category: str
    test_name: str
    status: str  # PASS, FAIL, SKIP
    message: str
    details: Dict[str, Any] = None
    duration: float = 0.0
    performance_metrics: Dict[str, float] = None
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}
        if self.performance_metrics is None:
            self.performance_metrics = {}


class SQLDatabaseValidationFramework:
    """Comprehensive SQL and database validation framework"""
    
    def __init__(self):
        self.session_maker = get_session_maker()
        self.logger = logging.getLogger(__name__)
        
        # Performance thresholds (in seconds)
        self.performance_thresholds = {
            'simple_search': 0.200,  # 200ms
            'complex_search': 0.500,  # 500ms
            'index_scan': 0.100,      # 100ms
            'join_query': 0.300,      # 300ms
            'aggregation': 0.400      # 400ms
        }
        
        # Core resource types for testing
        self.test_resource_types = [
            'Patient', 'Observation', 'Condition', 'MedicationRequest',
            'Procedure', 'DiagnosticReport', 'Encounter', 'AllergyIntolerance'
        ]
        
        # Critical search parameters for testing
        self.critical_search_params = {
            'Patient': ['identifier', 'name', 'family', 'birthdate'],
            'Observation': ['code', 'value-quantity', 'date', 'patient'],
            'Condition': ['code', 'onset-date', 'patient', 'clinical-status'],
            'MedicationRequest': ['code', 'patient', 'status', 'intent']
        }
    
    async def run_comprehensive_validation(self) -> List[SQLValidationResult]:
        """Run comprehensive SQL and database validation"""
        results = []
        
        async with self.session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            # Validate database schema integrity
            schema_validation = await self._validate_database_schema_integrity(session)
            results.extend(schema_validation)
            
            # Validate search parameter extraction accuracy
            extraction_validation = await self._validate_search_parameter_extraction_accuracy(session)
            results.extend(extraction_validation)
            
            # Validate database query performance
            performance_validation = await self._validate_database_query_performance(session, storage_engine)
            results.extend(performance_validation)
            
            # Validate search index effectiveness
            index_validation = await self._validate_search_index_effectiveness(session)
            results.extend(index_validation)
            
            # Validate search result consistency
            consistency_validation = await self._validate_search_result_consistency(session, storage_engine)
            results.extend(consistency_validation)
            
            # Validate SQL injection prevention
            security_validation = await self._validate_sql_injection_prevention(session, storage_engine)
            results.extend(security_validation)
            
            # Validate concurrent access patterns
            concurrency_validation = await self._validate_concurrent_access_patterns(session)
            results.extend(concurrency_validation)
        
        return results
    
    async def _validate_database_schema_integrity(self, session: AsyncSession) -> List[SQLValidationResult]:
        """Validate database schema integrity and required tables/indexes"""
        results = []
        
        # Check required tables exist
        tables_result = await self._check_required_tables(session)
        results.extend(tables_result)
        
        # Check required indexes exist
        indexes_result = await self._check_required_indexes(session)
        results.extend(indexes_result)
        
        # Check foreign key constraints
        constraints_result = await self._check_foreign_key_constraints(session)
        results.extend(constraints_result)
        
        return results
    
    async def _check_required_tables(self, session: AsyncSession) -> List[SQLValidationResult]:
        """Check that all required tables exist"""
        results = []
        start_time = time.time()
        
        try:
            required_tables = [
                'fhir.resources',
                'fhir.search_parameters', 
                'fhir.references',
                'fhir.resource_history'
            ]
            
            tables_query = text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'fhir'
                AND table_name = ANY(:table_names)
            """)
            result = await session.execute(tables_query, {'table_names': [t.split('.')[1] for t in required_tables]})
            existing_tables = [f"fhir.{row[0]}" for row in result.fetchall()]
            
            missing_tables = set(required_tables) - set(existing_tables)
            
            if not missing_tables:
                results.append(SQLValidationResult(
                    validation_category="schema_integrity",
                    test_name="required_tables",
                    status="PASS",
                    message="All required tables exist",
                    details={"existing_tables": existing_tables},
                    duration=time.time() - start_time
                ))
            else:
                results.append(SQLValidationResult(
                    validation_category="schema_integrity",
                    test_name="required_tables",
                    status="FAIL",
                    message=f"Missing required tables: {missing_tables}",
                    details={"missing_tables": list(missing_tables), "existing_tables": existing_tables},
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="schema_integrity",
                test_name="required_tables",
                status="FAIL",
                message=f"Error checking required tables: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _check_required_indexes(self, session: AsyncSession) -> List[SQLValidationResult]:
        """Check that required indexes exist for performance"""
        results = []
        start_time = time.time()
        
        try:
            # Check for critical indexes
            index_query = text("""
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    indexdef
                FROM pg_indexes 
                WHERE schemaname = 'fhir'
                AND tablename IN ('resources', 'search_parameters', 'references')
                ORDER BY tablename, indexname
            """)
            result = await session.execute(index_query)
            indexes = result.fetchall()
            
            # Critical indexes that should exist
            critical_indexes = [
                'resources_resource_type_deleted_idx',
                'resources_fhir_id_idx',
                'search_parameters_resource_id_idx',
                'search_parameters_param_name_idx',
                'references_source_id_idx',
                'references_target_id_idx'
            ]
            
            existing_index_names = [idx.indexname for idx in indexes]
            missing_critical = [idx for idx in critical_indexes if idx not in existing_index_names]
            
            if not missing_critical:
                results.append(SQLValidationResult(
                    validation_category="schema_integrity",
                    test_name="critical_indexes",
                    status="PASS",
                    message=f"All critical indexes exist ({len(existing_index_names)} total indexes)",
                    details={"total_indexes": len(existing_index_names), "index_names": existing_index_names},
                    duration=time.time() - start_time
                ))
            else:
                results.append(SQLValidationResult(
                    validation_category="schema_integrity",
                    test_name="critical_indexes",
                    status="FAIL",
                    message=f"Missing critical indexes: {missing_critical}",
                    details={"missing_indexes": missing_critical, "existing_indexes": existing_index_names},
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="schema_integrity",
                test_name="critical_indexes",
                status="FAIL",
                message=f"Error checking indexes: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _check_foreign_key_constraints(self, session: AsyncSession) -> List[SQLValidationResult]:
        """Check foreign key constraints integrity"""
        results = []
        start_time = time.time()
        
        try:
            fk_query = text("""
                SELECT 
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'fhir'
            """)
            result = await session.execute(fk_query)
            foreign_keys = result.fetchall()
            
            results.append(SQLValidationResult(
                validation_category="schema_integrity",
                test_name="foreign_key_constraints",
                status="PASS",
                message=f"Found {len(foreign_keys)} foreign key constraints",
                details={"foreign_key_count": len(foreign_keys)},
                duration=time.time() - start_time
            ))
            
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="schema_integrity",
                test_name="foreign_key_constraints",
                status="FAIL",
                message=f"Error checking foreign key constraints: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_search_parameter_extraction_accuracy(self, session: AsyncSession) -> List[SQLValidationResult]:
        """Validate search parameter extraction accuracy"""
        results = []
        
        for resource_type in self.test_resource_types:
            if resource_type in self.critical_search_params:
                extraction_result = await self._test_resource_extraction_accuracy(session, resource_type)
                results.extend(extraction_result)
        
        return results
    
    async def _test_resource_extraction_accuracy(self, session: AsyncSession, resource_type: str) -> List[SQLValidationResult]:
        """Test search parameter extraction accuracy for a specific resource type"""
        results = []
        start_time = time.time()
        
        try:
            # Get sample resource and check extraction
            sample_query = text("""
                SELECT 
                    r.id,
                    r.resource,
                    COUNT(sp.id) as extracted_params
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id
                WHERE r.resource_type = :resource_type
                AND r.deleted = false
                GROUP BY r.id, r.resource
                HAVING COUNT(sp.id) > 0
                ORDER BY r.id
                LIMIT 5
            """)
            result = await session.execute(sample_query, {'resource_type': resource_type})
            samples = result.fetchall()
            
            if not samples:
                results.append(SQLValidationResult(
                    validation_category="extraction_accuracy",
                    test_name=f"{resource_type.lower()}_extraction",
                    status="SKIP",
                    message=f"No {resource_type} resources with extracted parameters found",
                    duration=time.time() - start_time
                ))
                return results
            
            total_accuracy_score = 0
            for sample in samples:
                resource_data = sample.resource
                extracted_count = sample.extracted_params
                
                # Estimate expected parameters based on resource structure
                expected_params = self._estimate_expected_parameters(resource_data, resource_type)
                
                if expected_params > 0:
                    accuracy_ratio = extracted_count / expected_params
                    total_accuracy_score += min(accuracy_ratio, 1.0)  # Cap at 100%
            
            avg_accuracy = total_accuracy_score / len(samples)
            
            if avg_accuracy >= 0.8:  # 80% accuracy threshold
                results.append(SQLValidationResult(
                    validation_category="extraction_accuracy",
                    test_name=f"{resource_type.lower()}_extraction",
                    status="PASS",
                    message=f"{resource_type} parameter extraction accuracy: {avg_accuracy:.1%}",
                    details={
                        "accuracy_score": avg_accuracy,
                        "samples_tested": len(samples),
                        "avg_extracted_params": sum(s.extracted_params for s in samples) / len(samples)
                    },
                    duration=time.time() - start_time
                ))
            else:
                results.append(SQLValidationResult(
                    validation_category="extraction_accuracy",
                    test_name=f"{resource_type.lower()}_extraction",
                    status="FAIL",
                    message=f"{resource_type} parameter extraction accuracy too low: {avg_accuracy:.1%}",
                    details={
                        "accuracy_score": avg_accuracy,
                        "samples_tested": len(samples),
                        "threshold": 0.8
                    },
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="extraction_accuracy",
                test_name=f"{resource_type.lower()}_extraction",
                status="FAIL",
                message=f"Error testing {resource_type} extraction accuracy: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    def _estimate_expected_parameters(self, resource_data: dict, resource_type: str) -> int:
        """Estimate expected number of search parameters based on resource structure"""
        expected_count = 0
        
        # Basic parameters that should always exist
        if 'id' in resource_data:
            expected_count += 1
        
        # Resource-specific parameter estimation
        if resource_type == 'Patient':
            if 'identifier' in resource_data:
                expected_count += len(resource_data['identifier'])
            if 'name' in resource_data:
                expected_count += len(resource_data['name']) * 2  # family and given
            if 'birthDate' in resource_data:
                expected_count += 1
        elif resource_type == 'Observation':
            if 'code' in resource_data:
                expected_count += 1
            if 'valueQuantity' in resource_data:
                expected_count += 1
            if 'effectiveDateTime' in resource_data:
                expected_count += 1
            if 'subject' in resource_data:
                expected_count += 1
        elif resource_type in ['Condition', 'MedicationRequest']:
            if 'code' in resource_data:
                expected_count += 1
            if 'subject' in resource_data:
                expected_count += 1
            if 'status' in resource_data:
                expected_count += 1
        
        return max(expected_count, 2)  # Minimum expectation
    
    async def _validate_database_query_performance(self, session: AsyncSession, storage_engine: FHIRStorageEngine) -> List[SQLValidationResult]:
        """Validate database query performance meets benchmarks"""
        results = []
        
        # Test simple search performance
        simple_result = await self._test_simple_search_performance(session, storage_engine)
        results.extend(simple_result)
        
        # Test complex search performance
        complex_result = await self._test_complex_search_performance(session, storage_engine)
        results.extend(complex_result)
        
        # Test join query performance
        join_result = await self._test_join_query_performance(session)
        results.extend(join_result)
        
        # Test aggregation performance
        aggregation_result = await self._test_aggregation_performance(session)
        results.extend(aggregation_result)
        
        return results
    
    async def _test_simple_search_performance(self, session: AsyncSession, storage_engine: FHIRStorageEngine) -> List[SQLValidationResult]:
        """Test simple search query performance"""
        results = []
        
        for resource_type in ['Patient', 'Observation', 'Condition']:
            start_time = time.time()
            
            try:
                # Test simple resource type search
                search_result = await storage_engine.search_resources(
                    resource_type, 
                    {}, 
                    {'_count': ['10']}
                )
                
                duration = time.time() - start_time
                threshold = self.performance_thresholds['simple_search']
                
                if duration <= threshold:
                    results.append(SQLValidationResult(
                        validation_category="query_performance",
                        test_name=f"simple_search_{resource_type.lower()}",
                        status="PASS",
                        message=f"Simple {resource_type} search within threshold: {duration:.3f}s",
                        details={"results_count": search_result.get('total', 0)},
                        duration=duration,
                        performance_metrics={"query_time": duration, "threshold": threshold}
                    ))
                else:
                    results.append(SQLValidationResult(
                        validation_category="query_performance",
                        test_name=f"simple_search_{resource_type.lower()}",
                        status="FAIL",
                        message=f"Simple {resource_type} search too slow: {duration:.3f}s > {threshold}s",
                        details={"results_count": search_result.get('total', 0)},
                        duration=duration,
                        performance_metrics={"query_time": duration, "threshold": threshold}
                    ))
                    
            except Exception as e:
                results.append(SQLValidationResult(
                    validation_category="query_performance",
                    test_name=f"simple_search_{resource_type.lower()}",
                    status="FAIL",
                    message=f"Error testing simple {resource_type} search: {e}",
                    details={"error": str(e)},
                    duration=time.time() - start_time
                ))
        
        return results
    
    async def _test_complex_search_performance(self, session: AsyncSession, storage_engine: FHIRStorageEngine) -> List[SQLValidationResult]:
        """Test complex search query performance"""
        results = []
        start_time = time.time()
        
        try:
            # Test complex search with multiple parameters
            complex_search = await storage_engine.search_resources(
                'Observation',
                {
                    'code': ['http://loinc.org|8302-2'],
                    'date': ['ge2020-01-01']
                },
                {'_count': ['20']}
            )
            
            duration = time.time() - start_time
            threshold = self.performance_thresholds['complex_search']
            
            if duration <= threshold:
                results.append(SQLValidationResult(
                    validation_category="query_performance",
                    test_name="complex_search_multi_param",
                    status="PASS",
                    message=f"Complex multi-parameter search within threshold: {duration:.3f}s",
                    details={"results_count": complex_search.get('total', 0)},
                    duration=duration,
                    performance_metrics={"query_time": duration, "threshold": threshold}
                ))
            else:
                results.append(SQLValidationResult(
                    validation_category="query_performance",
                    test_name="complex_search_multi_param",
                    status="FAIL",
                    message=f"Complex multi-parameter search too slow: {duration:.3f}s > {threshold}s",
                    details={"results_count": complex_search.get('total', 0)},
                    duration=duration,
                    performance_metrics={"query_time": duration, "threshold": threshold}
                ))
                
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="query_performance",
                test_name="complex_search_multi_param",
                status="FAIL",
                message=f"Error testing complex search: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _test_join_query_performance(self, session: AsyncSession) -> List[SQLValidationResult]:
        """Test join query performance"""
        results = []
        start_time = time.time()
        
        try:
            # Test join between resources and search_parameters
            join_query = text("""
                SELECT 
                    r.resource_type,
                    COUNT(DISTINCT r.id) as resource_count,
                    COUNT(sp.id) as param_count
                FROM fhir.resources r
                JOIN fhir.search_parameters sp ON r.id = sp.resource_id
                WHERE r.resource_type = 'Patient'
                AND r.deleted = false
                AND sp.param_name = 'identifier'
                GROUP BY r.resource_type
            """)
            result = await session.execute(join_query)
            join_results = result.fetchall()
            
            duration = time.time() - start_time
            threshold = self.performance_thresholds['join_query']
            
            if duration <= threshold:
                results.append(SQLValidationResult(
                    validation_category="query_performance",
                    test_name="join_query_resources_params",
                    status="PASS",
                    message=f"Join query within threshold: {duration:.3f}s",
                    details={"join_results_count": len(join_results)},
                    duration=duration,
                    performance_metrics={"query_time": duration, "threshold": threshold}
                ))
            else:
                results.append(SQLValidationResult(
                    validation_category="query_performance",
                    test_name="join_query_resources_params",
                    status="FAIL",
                    message=f"Join query too slow: {duration:.3f}s > {threshold}s",
                    details={"join_results_count": len(join_results)},
                    duration=duration,
                    performance_metrics={"query_time": duration, "threshold": threshold}
                ))
                
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="query_performance",
                test_name="join_query_resources_params",
                status="FAIL",
                message=f"Error testing join query: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _test_aggregation_performance(self, session: AsyncSession) -> List[SQLValidationResult]:
        """Test aggregation query performance"""
        results = []
        start_time = time.time()
        
        try:
            # Test aggregation query
            aggregation_query = text("""
                SELECT 
                    r.resource_type,
                    COUNT(*) as total_resources,
                    COUNT(DISTINCT sp.param_name) as unique_params,
                    AVG(CASE WHEN sp.id IS NOT NULL THEN 1 ELSE 0 END) as param_ratio
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id
                WHERE r.deleted = false
                GROUP BY r.resource_type
                HAVING COUNT(*) > 10
                ORDER BY total_resources DESC
            """)
            result = await session.execute(aggregation_query)
            aggregation_results = result.fetchall()
            
            duration = time.time() - start_time
            threshold = self.performance_thresholds['aggregation']
            
            if duration <= threshold:
                results.append(SQLValidationResult(
                    validation_category="query_performance",
                    test_name="aggregation_resource_stats",
                    status="PASS",
                    message=f"Aggregation query within threshold: {duration:.3f}s",
                    details={"aggregation_results_count": len(aggregation_results)},
                    duration=duration,
                    performance_metrics={"query_time": duration, "threshold": threshold}
                ))
            else:
                results.append(SQLValidationResult(
                    validation_category="query_performance",
                    test_name="aggregation_resource_stats",
                    status="FAIL",
                    message=f"Aggregation query too slow: {duration:.3f}s > {threshold}s",
                    details={"aggregation_results_count": len(aggregation_results)},
                    duration=duration,
                    performance_metrics={"query_time": duration, "threshold": threshold}
                ))
                
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="query_performance",
                test_name="aggregation_resource_stats",
                status="FAIL",
                message=f"Error testing aggregation query: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_search_index_effectiveness(self, session: AsyncSession) -> List[SQLValidationResult]:
        """Validate search index effectiveness"""
        results = []
        start_time = time.time()
        
        try:
            # Check index usage statistics
            index_stats_query = text("""
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan,
                    idx_tup_read,
                    idx_tup_fetch
                FROM pg_stat_user_indexes
                WHERE schemaname = 'fhir'
                ORDER BY idx_scan DESC
            """)
            result = await session.execute(index_stats_query)
            index_stats = result.fetchall()
            
            if index_stats:
                # Check if indexes are being used
                used_indexes = [idx for idx in index_stats if idx.idx_scan > 0]
                unused_indexes = [idx for idx in index_stats if idx.idx_scan == 0]
                
                usage_ratio = len(used_indexes) / len(index_stats) if index_stats else 0
                
                if usage_ratio >= 0.7:  # 70% of indexes should be used
                    results.append(SQLValidationResult(
                        validation_category="index_effectiveness",
                        test_name="index_usage_analysis",
                        status="PASS",
                        message=f"Good index usage: {len(used_indexes)}/{len(index_stats)} indexes used ({usage_ratio:.1%})",
                        details={
                            "total_indexes": len(index_stats),
                            "used_indexes": len(used_indexes),
                            "unused_indexes": len(unused_indexes),
                            "usage_ratio": usage_ratio
                        },
                        duration=time.time() - start_time
                    ))
                else:
                    results.append(SQLValidationResult(
                        validation_category="index_effectiveness",
                        test_name="index_usage_analysis",
                        status="FAIL",
                        message=f"Low index usage: {len(used_indexes)}/{len(index_stats)} indexes used ({usage_ratio:.1%})",
                        details={
                            "total_indexes": len(index_stats),
                            "used_indexes": len(used_indexes),
                            "unused_indexes": len(unused_indexes),
                            "usage_ratio": usage_ratio,
                            "unused_index_names": [idx.indexname for idx in unused_indexes]
                        },
                        duration=time.time() - start_time
                    ))
            else:
                results.append(SQLValidationResult(
                    validation_category="index_effectiveness",
                    test_name="index_usage_analysis",
                    status="SKIP",
                    message="No index statistics available",
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="index_effectiveness",
                test_name="index_usage_analysis",
                status="FAIL",
                message=f"Error analyzing index effectiveness: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_search_result_consistency(self, session: AsyncSession, storage_engine: FHIRStorageEngine) -> List[SQLValidationResult]:
        """Validate search result consistency"""
        results = []
        start_time = time.time()
        
        try:
            # Test that same search returns consistent results
            search_params = {'_count': ['5']}
            
            # Run same search multiple times
            search_results = []
            for i in range(3):
                result = await storage_engine.search_resources('Patient', {}, search_params)
                search_results.append(result.get('total', 0))
            
            # Check consistency
            if len(set(search_results)) == 1:
                results.append(SQLValidationResult(
                    validation_category="result_consistency",
                    test_name="search_result_consistency",
                    status="PASS",
                    message=f"Search results consistent across multiple runs: {search_results[0]} results",
                    details={"search_results": search_results},
                    duration=time.time() - start_time
                ))
            else:
                results.append(SQLValidationResult(
                    validation_category="result_consistency",
                    test_name="search_result_consistency",
                    status="FAIL",
                    message=f"Search results inconsistent: {search_results}",
                    details={"search_results": search_results},
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="result_consistency",
                test_name="search_result_consistency",
                status="FAIL",
                message=f"Error testing search result consistency: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_sql_injection_prevention(self, session: AsyncSession, storage_engine: FHIRStorageEngine) -> List[SQLValidationResult]:
        """Validate SQL injection prevention"""
        results = []
        start_time = time.time()
        
        try:
            # Test potentially dangerous search values
            dangerous_values = [
                "'; DROP TABLE fhir.resources; --",
                "1' OR '1'='1",
                "1; DELETE FROM fhir.resources; --"
            ]
            
            injection_prevented = True
            for dangerous_value in dangerous_values:
                try:
                    # This should be safely handled by parameterized queries
                    search_result = await storage_engine.search_resources(
                        'Patient',
                        {'name': [dangerous_value]},
                        {'_count': ['1']}
                    )
                    # If we get here without exception, the query was safely handled
                except Exception as e:
                    # If there's an exception, it might be due to validation, which is good
                    # But if it's a SQL error, that's concerning
                    if "syntax error" in str(e).lower() or "sql" in str(e).lower():
                        injection_prevented = False
                        break
            
            if injection_prevented:
                results.append(SQLValidationResult(
                    validation_category="security",
                    test_name="sql_injection_prevention",
                    status="PASS",
                    message="SQL injection attempts safely handled",
                    details={"tested_payloads": len(dangerous_values)},
                    duration=time.time() - start_time
                ))
            else:
                results.append(SQLValidationResult(
                    validation_category="security",
                    test_name="sql_injection_prevention",
                    status="FAIL",
                    message="Potential SQL injection vulnerability detected",
                    details={"tested_payloads": len(dangerous_values)},
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="security",
                test_name="sql_injection_prevention",
                status="FAIL",
                message=f"Error testing SQL injection prevention: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_concurrent_access_patterns(self, session: AsyncSession) -> List[SQLValidationResult]:
        """Validate concurrent access patterns and locking"""
        results = []
        start_time = time.time()
        
        try:
            # Check for active connections and locks
            connections_query = text("""
                SELECT 
                    COUNT(*) as total_connections,
                    COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
                    COUNT(CASE WHEN wait_event_type = 'Lock' THEN 1 END) as waiting_on_locks
                FROM pg_stat_activity
                WHERE datname = current_database()
            """)
            result = await session.execute(connections_query)
            conn_stats = result.fetchone()
            
            results.append(SQLValidationResult(
                validation_category="concurrency",
                test_name="connection_analysis",
                status="PASS",
                message=f"Connection analysis: {conn_stats.total_connections} total, {conn_stats.active_connections} active, {conn_stats.waiting_on_locks} waiting on locks",
                details={
                    "total_connections": conn_stats.total_connections,
                    "active_connections": conn_stats.active_connections,
                    "waiting_on_locks": conn_stats.waiting_on_locks
                },
                duration=time.time() - start_time
            ))
            
        except Exception as e:
            results.append(SQLValidationResult(
                validation_category="concurrency",
                test_name="connection_analysis",
                status="FAIL",
                message=f"Error analyzing concurrent access: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results


async def main():
    """Main entry point for SQL and database validation"""
    logging.basicConfig(level=logging.INFO)
    
    framework = SQLDatabaseValidationFramework()
    
    print("Starting SQL and Database Validation...")
    print("=" * 60)
    
    results = await framework.run_comprehensive_validation()
    
    # Summary statistics
    total_checks = len(results)
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    skipped = sum(1 for r in results if r.status == "SKIP")
    
    print(f"\nValidation Summary:")
    print(f"Total Checks: {total_checks}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Skipped: {skipped}")
    print(f"Success Rate: {(passed/total_checks*100):.1f}%" if total_checks > 0 else "N/A")
    
    # Performance summary
    performance_results = [r for r in results if r.performance_metrics]
    if performance_results:
        print(f"\nPerformance Summary:")
        print("-" * 30)
        for result in performance_results:
            query_time = result.performance_metrics.get('query_time', 0)
            threshold = result.performance_metrics.get('threshold', 0)
            status_icon = "✓" if query_time <= threshold else "✗"
            print(f"{status_icon} {result.test_name}: {query_time:.3f}s (threshold: {threshold:.3f}s)")
    
    # Group results by category
    categories = {}
    for result in results:
        if result.validation_category not in categories:
            categories[result.validation_category] = []
        categories[result.validation_category].append(result)
    
    print(f"\nDetailed Results by Category:")
    print("-" * 60)
    
    for category_name, category_results in categories.items():
        print(f"\n{category_name.upper().replace('_', ' ')}:")
        for result in category_results:
            status_icon = "✓" if result.status == "PASS" else "✗" if result.status == "FAIL" else "⚠"
            print(f"  {status_icon} {result.test_name}: {result.message}")
            if result.details and result.status != "PASS":
                for key, value in result.details.items():
                    if key not in ["error", "traceback"]:
                        print(f"     {key}: {value}")
    
    # Exit with error code if any failures
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))