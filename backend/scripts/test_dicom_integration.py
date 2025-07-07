#!/usr/bin/env python3
"""
Test DICOM Integration Script

This script tests the complete DICOM integration workflow:
1. Checks ImagingStudy resources
2. Verifies DICOM directory naming
3. Tests DICOM API endpoints
4. Validates image loading

Usage:
    python scripts/test_dicom_integration.py
"""

import asyncio
import asyncpg
import json
import requests
from pathlib import Path

async def test_dicom_integration():
    """Test the complete DICOM integration."""
    
    print("🔍 Testing DICOM Integration")
    print("=" * 50)
    
    # Connect to database
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    
    try:
        # Get ImagingStudy resources with extensions
        studies = await conn.fetch("""
            SELECT 
                fhir_id,
                resource
            FROM fhir.resources 
            WHERE resource_type = 'ImagingStudy' 
            AND deleted = false
            ORDER BY last_updated DESC
            LIMIT 3
        """)
        
        print(f"Found {len(studies)} ImagingStudy resources to test")
        
        for study in studies:
            study_id = study['fhir_id']
            resource = json.loads(study['resource'])
            extensions = resource.get('extension', [])
            description = resource.get('description', 'Unknown')
            
            print(f"\n📋 Testing Study: {study_id}")
            print(f"   Description: {description}")
            
            # Find DICOM directory extension
            dicom_dir = None
            for ext in extensions:
                if ext.get('url') == 'http://example.org/fhir/StructureDefinition/dicom-directory':
                    dicom_dir = ext.get('valueString')
                    break
            
            if not dicom_dir:
                print("   ❌ No DICOM directory extension found")
                continue
            
            print(f"   📁 DICOM Directory: {dicom_dir}")
            
            # Check if directory exists
            dicom_path = Path(f"/app/data/generated_dicoms/{dicom_dir}")
            if not dicom_path.exists():
                print("   ❌ DICOM directory does not exist on filesystem")
                continue
            
            print("   ✅ DICOM directory exists")
            
            # Count DICOM files
            dcm_files = list(dicom_path.glob("*.dcm"))
            print(f"   📊 Found {len(dcm_files)} DICOM files")
            
            # Test API endpoints
            base_url = "http://localhost:8000"
            
            # Test metadata endpoint
            try:
                response = requests.get(f"{base_url}/api/dicom/studies/{dicom_dir}/metadata", timeout=5)
                if response.status_code == 200:
                    metadata = response.json()
                    instances = metadata.get('instances', [])
                    print(f"   ✅ Metadata API: {len(instances)} instances")
                else:
                    print(f"   ❌ Metadata API failed: {response.status_code}")
                    continue
            except Exception as e:
                print(f"   ❌ Metadata API error: {e}")
                continue
            
            # Test image endpoint for first instance
            if instances:
                first_instance = instances[0]
                instance_num = first_instance.get('instanceNumber', 1)
                
                try:
                    response = requests.get(
                        f"{base_url}/api/dicom/studies/{dicom_dir}/instances/{instance_num}/image",
                        timeout=10
                    )
                    if response.status_code == 200:
                        image_size = len(response.content)
                        print(f"   ✅ Image API: {image_size} bytes")
                    else:
                        print(f"   ❌ Image API failed: {response.status_code}")
                except Exception as e:
                    print(f"   ❌ Image API error: {e}")
            
            # Test viewer config endpoint
            try:
                response = requests.get(f"{base_url}/api/dicom/studies/{dicom_dir}/viewer-config", timeout=5)
                if response.status_code == 200:
                    config = response.json()
                    config_instances = config.get('instances', [])
                    print(f"   ✅ Viewer Config: {len(config_instances)} instances")
                else:
                    print(f"   ❌ Viewer Config failed: {response.status_code}")
            except Exception as e:
                print(f"   ❌ Viewer Config error: {e}")
        
    finally:
        await conn.close()
    
    print("\n✅ DICOM Integration Test Complete")
    print("=" * 50)

if __name__ == '__main__':
    asyncio.run(test_dicom_integration())