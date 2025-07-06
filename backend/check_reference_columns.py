#!/usr/bin/env python3
"""
Check which columns reference parameters are stored in
"""

import psycopg2

def check_reference_columns():
    """Check the actual columns used for reference parameters."""
    
    print("=== Checking Reference Parameter Columns ===\n")
    
    # Connect to database
    conn = psycopg2.connect(
        host='localhost',
        port=5432,
        database='emr_db',
        user='emr_user',
        password='emr_password'
    )
    cursor = conn.cursor()
    
    # Check what columns contain our patient reference data
    patient_id = "92675303-ca5b-136a-169b-e764c5753f06"
    
    print(f"Checking columns for patient {patient_id}:\n")
    
    # Check value_string column
    cursor.execute("""
        SELECT COUNT(*) FROM fhir.search_params 
        WHERE param_name = 'patient' 
        AND value_string LIKE %s
    """, (f'%{patient_id}%',))
    string_count = cursor.fetchone()[0]
    print(f"value_string column: {string_count} records")
    
    # Check value_reference column
    cursor.execute("""
        SELECT COUNT(*) FROM fhir.search_params 
        WHERE param_name = 'patient' 
        AND value_reference = %s
    """, (patient_id,))
    reference_count = cursor.fetchone()[0]
    print(f"value_reference column: {reference_count} records")
    
    # Check actual values in both columns
    print(f"\nSample values for patient parameter:")
    cursor.execute("""
        SELECT value_string, value_reference 
        FROM fhir.search_params 
        WHERE param_name = 'patient' 
        LIMIT 5
    """)
    
    for row in cursor.fetchall():
        print(f"  value_string: '{row[0]}', value_reference: '{row[1]}'")
    
    # Check subject parameter too
    print(f"\nSample values for subject parameter:")
    cursor.execute("""
        SELECT value_string, value_reference 
        FROM fhir.search_params 
        WHERE param_name = 'subject' 
        LIMIT 5
    """)
    
    for row in cursor.fetchall():
        print(f"  value_string: '{row[0]}', value_reference: '{row[1]}'")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    check_reference_columns()