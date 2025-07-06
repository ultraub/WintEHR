#!/usr/bin/env python3
import sys
sys.path.append('/Users/robertbarrett/dev/MedGenEMR/backend')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import DATABASE_URL
from api.cds_hooks.cds_hooks_router import CDSHookEngine
from datetime import datetime

# Create database session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # Create engine
    cds_engine = CDSHookEngine(db)
    
    # Test getting patient
    patient_id = "b47dba3f-d775-84e6-3160-663fcea0f795"
    context = {
        "patientId": patient_id,
        "userId": "test-user"
    }
    
    # Test age condition
    condition = {
        "type": "patient-age",
        "parameters": {
            "operator": ">=",
            "value": "65"
        }
    }
    
    print(f"Testing patient {patient_id}")
    result = cds_engine._evaluate_condition(condition, context)
    print(f"Age condition result: {result}")
    
finally:
    db.close()