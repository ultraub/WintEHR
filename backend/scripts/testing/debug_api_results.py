#!/usr/bin/env python3
"""Debug why API returns 219 when query returns 215."""

import httpx
import asyncio
import json

async def debug_api():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get all results
        response = await client.get("http://localhost:8000/fhir/R4/Condition?recorded-date=ge1988-08-08T09:41:49%2B00:00&_count=1000")
        
        if response.status_code == 200:
            bundle = response.json()
            print(f"API returned total: {bundle.get('total', 0)}")
            
            # Check for duplicates in the bundle
            if 'entry' in bundle:
                ids = [entry['resource']['id'] for entry in bundle['entry']]
                unique_ids = set(ids)
                
                print(f"Resources in bundle: {len(ids)}")
                print(f"Unique IDs: {len(unique_ids)}")
                
                if len(ids) != len(unique_ids):
                    # Find duplicates
                    from collections import Counter
                    id_counts = Counter(ids)
                    dupes = {id: count for id, count in id_counts.items() if count > 1}
                    print(f"\nDuplicate IDs found: {dupes}")
                
                # Check if all have recordedDate
                without_recorded = []
                for entry in bundle['entry']:
                    resource = entry['resource']
                    if 'recordedDate' not in resource:
                        without_recorded.append(resource['id'])
                
                if without_recorded:
                    print(f"\nResources without recordedDate: {len(without_recorded)}")
                    print(f"IDs: {without_recorded[:5]}")
        else:
            print(f"API error: {response.status_code}")

if __name__ == "__main__":
    asyncio.run(debug_api())