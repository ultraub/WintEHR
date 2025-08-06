#!/usr/bin/env python3
"""
Test script to verify relationship discovery is working with URN references
"""

import asyncio
import json
import sys
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Add parent directories to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import get_db_session
from fhir.core.storage import FHIRStorageEngine

async def test_relationship_discovery():
    """Test relationship discovery with actual patient data"""
    async for db in get_db_session():
        storage = FHIRStorageEngine(db)
        
        # Get a sample patient
        result = await db.execute(
            text("SELECT fhir_id, resource FROM fhir.resources WHERE resource_type = 'Patient' LIMIT 1")
        )
        patient_row = result.first()
        
        if not patient_row:
            print("❌ No patients found in database")
            return
            
        patient_id = patient_row.fhir_id
        patient_data = json.loads(patient_row.resource) if isinstance(patient_row.resource, str) else patient_row.resource
        print(f"✅ Found patient: {patient_id}")
        print(f"   Name: {patient_data.get('name', [{}])[0].get('text', 'Unknown')}")
        
        # Get conditions for this patient to check references
        result = await db.execute(
            text("""
                SELECT fhir_id, resource 
                FROM fhir.resources 
                WHERE resource_type = 'Condition' 
                AND resource @> jsonb_build_object('subject', jsonb_build_object('reference', :ref::text))
                LIMIT 5
            """),
            {"ref": f"urn:uuid:{patient_id}"}
        )
        
        conditions = result.all()
        print(f"\n📋 Found {len(conditions)} conditions with URN references to patient")
        
        for condition in conditions:
            condition_data = json.loads(condition.resource) if isinstance(condition.resource, str) else condition.resource
            subject_ref = condition_data.get('subject', {}).get('reference', '')
            print(f"   - Condition {condition.fhir_id}: subject = {subject_ref}")
            
            # Check if it's a URN reference
            if subject_ref.startswith("urn:uuid:"):
                print(f"     ✅ URN reference detected")
            else:
                print(f"     ❓ Standard reference format")
        
        # Test the API endpoint directly
        print("\n🔍 Testing relationship discovery API...")
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            url = f"http://localhost:8000/api/fhir-relationships/discover/Patient/{patient_id}"
            params = {"depth": 2, "include_counts": True}
            
            try:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"✅ API call successful")
                        print(f"   Nodes: {len(data.get('nodes', []))}")
                        print(f"   Links: {len(data.get('links', []))}")
                        
                        # Show first few links
                        links = data.get('links', [])[:5]
                        for link in links:
                            print(f"   - {link['source']} -> {link['target']} ({link['field']})")
                    else:
                        error_data = await response.text()
                        print(f"❌ API error: {response.status}")
                        print(f"   {error_data}")
            except Exception as e:
                print(f"❌ Failed to call API: {str(e)}")
        
        # Check search parameters table for URN references
        print("\n🔍 Checking search parameters table...")
        result = await db.execute(
            text("""
                SELECT COUNT(*) as count 
                FROM fhir.search_params 
                WHERE param_name IN ('patient', 'subject') 
                AND value_string LIKE 'urn:uuid:%'
            """)
        )
        urn_count = result.scalar()
        print(f"   Found {urn_count} URN references in search parameters")
        
        # Get a sample of URN references
        result = await db.execute(
            text("""
                SELECT resource_type, resource_id, param_name, value_string 
                FROM fhir.search_params 
                WHERE param_name IN ('patient', 'subject') 
                AND value_string LIKE 'urn:uuid:%'
                LIMIT 5
            """)
        )
        
        for row in result:
            print(f"   - {row.resource_type}/{row.resource_id}: {row.param_name} = {row.value_string}")
        
        # Exit after first iteration
        return

if __name__ == "__main__":
    asyncio.run(test_relationship_discovery())