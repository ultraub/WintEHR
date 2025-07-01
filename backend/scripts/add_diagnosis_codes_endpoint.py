#!/usr/bin/env python3
"""
Script to add an endpoint that returns available diagnosis codes
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

endpoint_code = '''
@router.get("/conditions/available-codes")
async def get_available_diagnosis_codes(
    search: Optional[str] = Query(None, description="Search term for diagnosis"),
    limit: int = Query(50, le=200, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """Get list of available diagnosis codes from existing conditions"""
    from sqlalchemy import func
    
    query = db.query(
        Condition.snomed_code,
        Condition.description,
        func.count(Condition.id).label('usage_count')
    ).filter(
        Condition.snomed_code.isnot(None)
    ).group_by(
        Condition.snomed_code,
        Condition.description
    )
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            func.lower(Condition.description).like(search_term)
        )
    
    # Order by usage count (most used first) and limit results
    codes = query.order_by(
        func.count(Condition.id).desc()
    ).limit(limit).all()
    
    return [
        {
            "snomed_code": code,
            "description": description,
            "usage_count": count,
            "code_system": "SNOMED CT"
        }
        for code, description, count in codes
    ]
'''

print("To add an endpoint for available diagnosis codes, add this to app_router.py:")
print(endpoint_code)
print("\nThis endpoint would return the diagnosis codes that are actually in use in the database.")