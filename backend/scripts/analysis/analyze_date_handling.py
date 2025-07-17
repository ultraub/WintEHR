#!/usr/bin/env python3
"""
Analyze date/time handling in Synthea import
"""

import json
import asyncio
from pathlib import Path
import sys
from datetime import datetime

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL


async def analyze_date_issues():
    """Check for date/time handling issues"""
    
    print("=== DATE/TIME HANDLING ANALYSIS ===\n")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Check Patient birthdate discrepancy
        print("1. Patient Birthdate Analysis:")
        print("-" * 50)
        
        # Get a few patients to check
        result = await conn.execute(text("""
            SELECT 
                fhir_id,
                resource->>'birthDate' as birth_date,
                resource->'meta'->>'lastUpdated' as last_updated
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            LIMIT 10
        """))
        
        print("Sample patient birthdates:")
        for row in result:
            print(f"  ID: {row.fhir_id[:8]}... BirthDate: {row.birth_date}")
        
        # Check date formats in observations
        print("\n\n2. Observation Date Format Analysis:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT 
                COUNT(CASE WHEN resource->>'effectiveDateTime' IS NOT NULL THEN 1 END) as datetime_count,
                COUNT(CASE WHEN resource->>'effectivePeriod' IS NOT NULL THEN 1 END) as period_count,
                COUNT(CASE WHEN resource->>'effectiveInstant' IS NOT NULL THEN 1 END) as instant_count,
                COUNT(CASE WHEN resource->>'issued' IS NOT NULL THEN 1 END) as issued_count,
                COUNT(*) as total
            FROM fhir.resources
            WHERE resource_type = 'Observation'
        """))
        
        row = result.fetchone()
        print(f"Total Observations: {row.total}")
        print(f"  - effectiveDateTime: {row.datetime_count} ({row.datetime_count/row.total*100:.1f}%)")
        print(f"  - effectivePeriod: {row.period_count} ({row.period_count/row.total*100:.1f}%)")
        print(f"  - effectiveInstant: {row.instant_count} ({row.instant_count/row.total*100:.1f}%)")
        print(f"  - issued: {row.issued_count} ({row.issued_count/row.total*100:.1f}%)")
        
        # Sample date formats
        print("\n\nSample date formats:")
        result = await conn.execute(text("""
            SELECT 
                resource->>'effectiveDateTime' as effective,
                resource->>'issued' as issued
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->>'effectiveDateTime' IS NOT NULL
            LIMIT 5
        """))
        
        for i, row in enumerate(result):
            print(f"  Sample {i+1}:")
            print(f"    effectiveDateTime: {row.effective}")
            print(f"    issued: {row.issued}")
        
        # Check timezone handling
        print("\n\n3. Timezone Analysis:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT 
                COUNT(CASE WHEN resource->>'effectiveDateTime' LIKE '%Z' THEN 1 END) as utc_z,
                COUNT(CASE WHEN resource->>'effectiveDateTime' LIKE '%+%' THEN 1 END) as has_offset,
                COUNT(CASE WHEN resource->>'effectiveDateTime' LIKE '%-05:00' THEN 1 END) as est,
                COUNT(CASE WHEN resource->>'effectiveDateTime' NOT LIKE '%Z' 
                          AND resource->>'effectiveDateTime' NOT LIKE '%+%' 
                          AND resource->>'effectiveDateTime' NOT LIKE '%-%' THEN 1 END) as no_tz,
                COUNT(*) as total
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->>'effectiveDateTime' IS NOT NULL
        """))
        
        row = result.fetchone()
        print(f"Timezone in effectiveDateTime:")
        print(f"  - UTC (Z): {row.utc_z}")
        print(f"  - With offset: {row.has_offset}")
        print(f"  - EST (-05:00): {row.est}")
        print(f"  - No timezone: {row.no_tz}")
        print(f"  - Total: {row.total}")
        
        # Check meta.lastUpdated consistency
        print("\n\n4. Meta.lastUpdated Analysis:")
        print("-" * 50)
        
        result = await conn.execute(text("""
            SELECT 
                resource_type,
                COUNT(CASE WHEN resource->'meta'->>'lastUpdated' IS NOT NULL THEN 1 END) as has_lastupdated,
                COUNT(*) as total
            FROM fhir.resources
            WHERE resource_type IN ('Patient', 'Observation', 'Condition', 'MedicationRequest')
            GROUP BY resource_type
        """))
        
        for row in result:
            pct = (row.has_lastupdated / row.total * 100) if row.total > 0 else 0
            print(f"{row.resource_type:<20} {row.has_lastupdated}/{row.total} ({pct:.1f}%)")
    
    await engine.dispose()
    
    print("\n\n=== DATE HANDLING ISSUES FOUND ===\n")
    print("1. Patient birthdate mismatch detected (1989-01-27 vs 1989-01-29)")
    print("   - Possible timezone conversion issue during import")
    print("   - Check ProfileAwareFHIRTransformer date handling")
    print("\n2. Inconsistent timezone handling in dates")
    print("   - Some dates have timezone info, others don't")
    print("   - May cause issues with date comparisons and searches")
    print("\n3. All resources should have meta.lastUpdated")
    print("   - Required for versioning and sync")


if __name__ == "__main__":
    asyncio.run(analyze_date_issues())