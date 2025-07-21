#!/usr/bin/env python3
"""
Comprehensive analysis of Synthea data in the database.
This script analyzes actual data to inform testing strategies.

Created: 2025-01-20
"""

import asyncio
import asyncpg
import json
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Set


class SyntheaDataAnalyzer:
    """Analyze Synthea data patterns for comprehensive testing."""
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn = None
        self.results = {
            "summary": {},
            "resource_counts": {},
            "relationships": defaultdict(lambda: defaultdict(int)),
            "search_parameters": defaultdict(set),
            "data_patterns": defaultdict(dict),
            "temporal_ranges": {},
            "code_systems": defaultdict(set),
            "reference_patterns": defaultdict(list)
        }
    
    async def connect(self):
        """Connect to database."""
        self.conn = await asyncpg.connect(self.db_url)
    
    async def close(self):
        """Close database connection."""
        if self.conn:
            await self.conn.close()
    
    async def analyze_resource_counts(self):
        """Get counts of all resource types."""
        print("📊 Analyzing resource counts...")
        
        query = """
        SELECT resource_type, COUNT(*) as count
        FROM fhir.resources
        WHERE deleted = false OR deleted IS NULL
        GROUP BY resource_type
        ORDER BY count DESC
        """
        
        rows = await self.conn.fetch(query)
        
        total = 0
        for row in rows:
            self.results["resource_counts"][row["resource_type"]] = row["count"]
            total += row["count"]
        
        self.results["summary"]["total_resources"] = total
        self.results["summary"]["resource_types"] = len(rows)
        
        print(f"   Found {total:,} resources across {len(rows)} types")
    
    async def analyze_relationships(self):
        """Analyze resource relationships and references."""
        print("🔗 Analyzing resource relationships...")
        
        # Get reference data from the references table
        query = """
        SELECT 
            source_type,
            target_type,
            reference_path,
            COUNT(*) as count
        FROM fhir.references
        GROUP BY source_type, target_type, reference_path
        ORDER BY count DESC
        LIMIT 100
        """
        
        rows = await self.conn.fetch(query)
        
        for row in rows:
            key = f"{row['source_type']}.{row['reference_path']}"
            self.results["relationships"][key][row['target_type']] = row['count']
        
        print(f"   Found {len(rows)} relationship patterns")
    
    async def analyze_search_parameters(self):
        """Analyze what search parameters are actually indexed."""
        print("🔍 Analyzing search parameters...")
        
        query = """
        SELECT 
            resource_type,
            param_name,
            param_type,
            COUNT(DISTINCT resource_id) as resource_count
        FROM fhir.search_params
        GROUP BY resource_type, param_name, param_type
        ORDER BY resource_type, param_name
        """
        
        rows = await self.conn.fetch(query)
        
        param_stats = defaultdict(lambda: defaultdict(int))
        
        for row in rows:
            resource_type = row['resource_type']
            param_name = row['param_name']
            self.results["search_parameters"][resource_type].add(param_name)
            param_stats[resource_type][param_name] = row['resource_count']
        
        self.results["summary"]["indexed_parameters"] = len(rows)
        self.results["data_patterns"]["parameter_coverage"] = dict(param_stats)
        
        print(f"   Found {len(rows)} indexed search parameters")
    
    async def analyze_patient_data(self):
        """Analyze patient-specific data patterns."""
        print("👥 Analyzing patient data patterns...")
        
        # Get patient demographics
        query = """
        SELECT 
            resource->>'gender' as gender,
            resource->>'birthDate' as birth_date,
            resource->>'deceasedDateTime' as deceased_date,
            resource->'name'->0->>'family' as family_name,
            resource->'identifier'->0->>'system' as id_system,
            resource->'address'->0->>'state' as state
        FROM fhir.resources
        WHERE resource_type = 'Patient'
        AND (deleted = false OR deleted IS NULL)
        """
        
        rows = await self.conn.fetch(query)
        
        patterns = {
            "genders": defaultdict(int),
            "deceased_count": 0,
            "states": defaultdict(int),
            "birth_years": defaultdict(int),
            "identifier_systems": set()
        }
        
        for row in rows:
            if row['gender']:
                patterns['genders'][row['gender']] += 1
            if row['deceased_date']:
                patterns['deceased_count'] += 1
            if row['state']:
                patterns['states'][row['state']] += 1
            if row['birth_date']:
                year = row['birth_date'][:4]
                patterns['birth_years'][year] += 1
            if row['id_system']:
                patterns['identifier_systems'].add(row['id_system'])
        
        self.results["data_patterns"]["patient_demographics"] = {
            "genders": dict(patterns['genders']),
            "deceased_count": patterns['deceased_count'],
            "states": dict(patterns['states']),
            "birth_year_range": {
                "min": min(patterns['birth_years'].keys()) if patterns['birth_years'] else None,
                "max": max(patterns['birth_years'].keys()) if patterns['birth_years'] else None
            },
            "identifier_systems": list(patterns['identifier_systems'])
        }
        
        print(f"   Analyzed {len(rows)} patients")
    
    async def analyze_temporal_data(self):
        """Analyze date ranges in the data."""
        print("📅 Analyzing temporal data ranges...")
        
        temporal_queries = {
            "Encounter": "resource->'period'->>'start'",
            "Condition": "resource->>'onsetDateTime'",
            "Observation": "resource->>'effectiveDateTime'",
            "MedicationRequest": "resource->>'authoredOn'",
            "Procedure": "resource->>'performedDateTime'"
        }
        
        for resource_type, date_path in temporal_queries.items():
            if self.results["resource_counts"].get(resource_type, 0) > 0:
                query = f"""
                SELECT 
                    MIN(({date_path})::timestamp) as min_date,
                    MAX(({date_path})::timestamp) as max_date,
                    COUNT(*) as count
                FROM fhir.resources
                WHERE resource_type = $1
                AND {date_path} IS NOT NULL
                AND (deleted = false OR deleted IS NULL)
                """
                
                try:
                    row = await self.conn.fetchrow(query, resource_type)
                    
                    if row and row['count'] > 0:
                        self.results["temporal_ranges"][resource_type] = {
                            "min_date": str(row['min_date']) if row['min_date'] else None,
                            "max_date": str(row['max_date']) if row['max_date'] else None,
                            "count_with_dates": row['count']
                        }
                except Exception as e:
                    print(f"   Warning: Could not analyze temporal data for {resource_type}: {e}")
                    continue
        
        print(f"   Analyzed temporal ranges for {len(self.results['temporal_ranges'])} resource types")
    
    async def analyze_code_systems(self):
        """Analyze coding systems used in the data."""
        print("🏷️  Analyzing code systems...")
        
        # Check common coded elements
        code_queries = [
            ("Condition", "resource->'code'->'coding'->0->>'system'"),
            ("Observation", "resource->'code'->'coding'->0->>'system'"),
            ("MedicationRequest", "resource->'medicationCodeableConcept'->'coding'->0->>'system'"),
            ("Procedure", "resource->'code'->'coding'->0->>'system'")
        ]
        
        for resource_type, system_path in code_queries:
            if self.results["resource_counts"].get(resource_type, 0) > 0:
                query = f"""
                SELECT DISTINCT {system_path} as system
                FROM fhir.resources
                WHERE resource_type = $1
                AND {system_path} IS NOT NULL
                AND (deleted = false OR deleted IS NULL)
                """
                
                rows = await self.conn.fetch(query, resource_type)
                
                for row in rows:
                    if row['system']:
                        self.results["code_systems"][resource_type].add(row['system'])
        
        # Convert sets to lists for JSON serialization
        for resource_type in self.results["code_systems"]:
            self.results["code_systems"][resource_type] = list(self.results["code_systems"][resource_type])
        
        print(f"   Found code systems for {len(self.results['code_systems'])} resource types")
    
    async def analyze_reference_formats(self):
        """Analyze reference formats used in the data."""
        print("🔗 Analyzing reference formats...")
        
        # First check the actual column names in the references table
        columns_query = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'fhir' 
        AND table_name = 'references'
        """
        
        columns = await self.conn.fetch(columns_query)
        column_names = [col['column_name'] for col in columns]
        
        # The reference value might be in a different column
        # Let's check what columns we have
        if 'reference' in column_names:
            ref_column = 'reference'
        elif 'target_id' in column_names:
            ref_column = 'target_id'
        else:
            print(f"   Available columns: {column_names}")
            print("   Warning: Could not find reference column")
            return
        
        # Sample references to understand formats
        query = f"""
        SELECT DISTINCT
            source_type,
            reference_path,
            {ref_column} as target_reference
        FROM fhir.references
        WHERE {ref_column} IS NOT NULL
        LIMIT 1000
        """
        
        rows = await self.conn.fetch(query)
        
        reference_formats = defaultdict(set)
        
        for row in rows:
            ref = row['target_reference']
            if ref:
                # Determine format
                if ref.startswith('urn:uuid:'):
                    format_type = 'urn:uuid'
                elif '/' in ref:
                    format_type = 'relative'
                else:
                    format_type = 'other'
                
                key = f"{row['source_type']}.{row['reference_path']}"
                reference_formats[key].add(format_type)
        
        # Convert to regular dict with lists
        self.results["data_patterns"]["reference_formats"] = {
            k: list(v) for k, v in reference_formats.items()
        }
        
        print(f"   Analyzed reference formats for {len(reference_formats)} paths")
    
    async def analyze_complex_queries(self):
        """Analyze data patterns that inform complex query testing."""
        print("🔄 Analyzing complex query patterns...")
        
        try:
            # First check the compartments table structure
            columns_query = """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'compartments'
            """
            
            columns = await self.conn.fetch(columns_query)
            column_names = [col['column_name'] for col in columns]
            
            if 'compartments' in self.results["summary"].get("tables", []) or column_names:
                # Find patients with the most resources (for testing _revinclude)
                query = """
                SELECT 
                    c.compartment_id as patient_id,
                    COUNT(DISTINCT r.resource_type) as resource_types,
                    COUNT(*) as total_resources
                FROM fhir.compartments c
                JOIN fhir.resources r ON r.id = c.resource_id
                WHERE c.compartment_type = 'Patient'
                GROUP BY c.compartment_id
                ORDER BY total_resources DESC
                LIMIT 5
                """
                
                rows = await self.conn.fetch(query)
            else:
                print("   Warning: Compartments table not found or empty")
                rows = []
        except Exception as e:
            print(f"   Warning: Could not analyze compartments: {e}")
            rows = []
        
        self.results["data_patterns"]["patients_with_most_resources"] = [
            {
                "patient_id": row['patient_id'],
                "resource_types": row['resource_types'],
                "total_resources": row['total_resources']
            }
            for row in rows
        ]
        
        # Find common observation codes
        query = """
        SELECT 
            resource->'code'->'coding'->0->>'code' as code,
            resource->'code'->>'text' as display,
            COUNT(*) as count
        FROM fhir.resources
        WHERE resource_type = 'Observation'
        AND resource->'code'->'coding'->0->>'code' IS NOT NULL
        AND (deleted = false OR deleted IS NULL)
        GROUP BY code, display
        ORDER BY count DESC
        LIMIT 10
        """
        
        rows = await self.conn.fetch(query)
        
        self.results["data_patterns"]["common_observation_codes"] = [
            {
                "code": row['code'],
                "display": row['display'],
                "count": row['count']
            }
            for row in rows
        ]
        
        print(f"   Found {len(self.results['data_patterns']['patients_with_most_resources'])} patients with rich data")
    
    def generate_report(self) -> str:
        """Generate a comprehensive analysis report."""
        report = [
            "# Synthea Data Analysis Report",
            f"\nGenerated: {datetime.now().isoformat()}",
            "\n## Summary",
            f"- Total Resources: {self.results['summary'].get('total_resources', 0):,}",
            f"- Resource Types: {self.results['summary'].get('resource_types', 0)}",
            f"- Indexed Parameters: {self.results['summary'].get('indexed_parameters', 0)}",
            "\n## Resource Counts"
        ]
        
        for resource_type, count in sorted(self.results["resource_counts"].items(), key=lambda x: x[1], reverse=True):
            report.append(f"- {resource_type}: {count:,}")
        
        report.append("\n## Top Relationships")
        relationship_count = 0
        for path, targets in sorted(self.results["relationships"].items())[:20]:
            for target, count in sorted(targets.items(), key=lambda x: x[1], reverse=True):
                report.append(f"- {path} → {target}: {count:,}")
                relationship_count += 1
                if relationship_count >= 20:
                    break
            if relationship_count >= 20:
                break
        
        report.append("\n## Search Parameters by Resource Type")
        for resource_type in sorted(self.results["search_parameters"].keys())[:10]:
            params = sorted(self.results["search_parameters"][resource_type])
            report.append(f"\n### {resource_type}")
            report.append(f"Parameters: {', '.join(params[:15])}")
            if len(params) > 15:
                report.append(f"... and {len(params) - 15} more")
        
        report.append("\n## Patient Demographics")
        demographics = self.results["data_patterns"].get("patient_demographics", {})
        if demographics:
            report.append(f"- Genders: {demographics.get('genders', {})}")
            report.append(f"- Deceased: {demographics.get('deceased_count', 0)}")
            report.append(f"- Birth Year Range: {demographics.get('birth_year_range', {})}")
        
        report.append("\n## Temporal Ranges")
        for resource_type, ranges in self.results["temporal_ranges"].items():
            report.append(f"- {resource_type}: {ranges['min_date'][:10]} to {ranges['max_date'][:10]}")
        
        report.append("\n## Code Systems Used")
        for resource_type, systems in sorted(self.results["code_systems"].items()):
            if systems:
                report.append(f"- {resource_type}: {', '.join(systems[:3])}")
        
        return "\n".join(report)
    
    async def analyze_all(self):
        """Run all analyses."""
        await self.connect()
        
        try:
            await self.analyze_resource_counts()
            await self.analyze_relationships()
            await self.analyze_search_parameters()
            await self.analyze_patient_data()
            await self.analyze_temporal_data()
            await self.analyze_code_systems()
            await self.analyze_reference_formats()
            await self.analyze_complex_queries()
            
            # Save detailed results as JSON
            with open('/app/tests/fhir_comprehensive/reports/synthea_data_analysis.json', 'w') as f:
                json.dump(self.results, f, indent=2, default=str)
            
            # Generate and save report
            report = self.generate_report()
            with open('/app/tests/fhir_comprehensive/reports/SYNTHEA_DATA_ANALYSIS.md', 'w') as f:
                f.write(report)
            
            print(f"\n✅ Analysis complete! Reports saved to:")
            print(f"   - synthea_data_analysis.json (detailed data)")
            print(f"   - SYNTHEA_DATA_ANALYSIS.md (summary report)")
            
        finally:
            await self.close()


async def main():
    """Run the analysis."""
    db_url = "postgresql://emr_user:emr_password@postgres:5432/emr_db"
    
    analyzer = SyntheaDataAnalyzer(db_url)
    await analyzer.analyze_all()


if __name__ == "__main__":
    asyncio.run(main())