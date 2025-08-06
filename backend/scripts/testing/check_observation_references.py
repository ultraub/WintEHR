#!/usr/bin/env python3
"""Check how observation patient references are stored."""

import asyncio
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


async def check_references():
    async with get_db_context() as db:
        print("Checking Observation patient references...\n")
        
        # Get sample observation references
        result = await db.execute(text("""
            SELECT 
                resource->'subject' as subject,
                resource->>'subject' as subject_str
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            LIMIT 5
        """))
        samples = result.fetchall()
        
        print("Sample subject references:")
        for sample in samples:
            print(f"  Raw: {sample.subject}")
            print(f"  String: {sample.subject_str}")
            if sample.subject:
                subject_data = json.loads(sample.subject) if isinstance(sample.subject, str) else sample.subject
                print(f"  Parsed: {subject_data}")
            print()
        
        # Check how references are indexed
        result = await db.execute(text("""
            SELECT DISTINCT
                sp.param_name,
                sp.value_reference,
                sp.value_string,
                COUNT(*) as count
            FROM fhir.search_params sp
            WHERE sp.resource_type = 'Observation'
            AND sp.param_name IN ('patient', 'subject')
            AND sp.value_reference IS NOT NULL
            GROUP BY sp.param_name, sp.value_reference, sp.value_string
            ORDER BY count DESC
            LIMIT 5
        """))
        indexed = result.fetchall()
        
        print("\nIndexed patient/subject references:")
        for idx in indexed:
            print(f"  param_name: {idx.param_name}")
            print(f"  value_reference: {idx.value_reference}")
            print(f"  value_string: {idx.value_string}")
            print(f"  count: {idx.count}")
            print()


if __name__ == "__main__":
    asyncio.run(check_references())