#!/usr/bin/env python3
"""
Database Summary Report
Shows current state of the EMR database with record counts
"""

import sqlite3
import sys
from termcolor import colored

def generate_database_summary(db_path: str):
    """Generate comprehensive database summary"""
    print(colored("="*80, "blue"))
    print(colored("EMR DATABASE SUMMARY REPORT", "blue", attrs=["bold"]))
    print(colored("="*80, "blue"))
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get table counts
    tables = [
        'patients', 'providers', 'organizations', 'locations', 'encounters',
        'conditions', 'medications', 'observations', 'procedures', 'immunizations',
        'allergies', 'careplans', 'devices', 'diagnostic_reports', 'imaging_studies',
        'payers', 'claims'
    ]
    
    print(colored("\nRECORD COUNTS BY TABLE:", "green", attrs=["bold"]))
    print("-" * 40)
    
    total_records = 0
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            total_records += count
            
            # Color code based on count
            if count > 1000:
                color = "green"
            elif count > 100:
                color = "yellow"
            elif count > 0:
                color = "cyan"
            else:
                color = "red"
                
            print(colored(f"{table:20} {count:>8,}", color))
        except sqlite3.OperationalError:
            print(colored(f"{table:20} {'N/A':>8}", "red"))
    
    print("-" * 40)
    print(colored(f"{'TOTAL RECORDS:':20} {total_records:>8,}", "white", attrs=["bold"]))
    
    # Patient demographics summary
    print(colored("\nPATIENT DEMOGRAPHICS:", "green", attrs=["bold"]))
    print("-" * 40)
    
    # Gender distribution
    cursor.execute("SELECT gender, COUNT(*) FROM patients GROUP BY gender")
    gender_results = cursor.fetchall()
    for gender, count in gender_results:
        print(f"Gender {gender:15} {count:>8}")
    
    # Active vs inactive
    cursor.execute("SELECT is_active, COUNT(*) FROM patients GROUP BY is_active")
    active_results = cursor.fetchall()
    for is_active, count in active_results:
        status = "Active" if is_active else "Inactive"
        print(f"{status:20} {count:>8}")
    
    # Deceased patients
    cursor.execute("SELECT COUNT(*) FROM patients WHERE date_of_death IS NOT NULL")
    deceased_count = cursor.fetchone()[0]
    print(f"{'Deceased:':20} {deceased_count:>8}")
    
    # Age ranges
    cursor.execute("""
        SELECT 
            CASE 
                WHEN strftime('%Y', 'now') - strftime('%Y', date_of_birth) < 18 THEN 'Under 18'
                WHEN strftime('%Y', 'now') - strftime('%Y', date_of_birth) < 65 THEN '18-64'
                ELSE '65+'
            END as age_group,
            COUNT(*) as count
        FROM patients 
        GROUP BY age_group
    """)
    age_results = cursor.fetchall()
    for age_group, count in age_results:
        print(f"Age {age_group:15} {count:>8}")
    
    # Clinical data summary
    print(colored("\nCLINICAL DATA SUMMARY:", "green", attrs=["bold"]))
    print("-" * 40)
    
    # Encounters by class
    cursor.execute("SELECT encounter_class, COUNT(*) FROM encounters GROUP BY encounter_class ORDER BY COUNT(*) DESC")
    encounter_results = cursor.fetchall()
    for enc_class, count in encounter_results[:5]:  # Top 5
        print(f"Encounter {enc_class:11} {count:>8,}")
    
    # Observations by type
    cursor.execute("SELECT observation_type, COUNT(*) FROM observations GROUP BY observation_type ORDER BY COUNT(*) DESC")
    obs_results = cursor.fetchall()
    for obs_type, count in obs_results[:5]:  # Top 5
        obs_type = obs_type or "Unknown"
        print(f"Obs {obs_type:15} {count:>8,}")
    
    # Top conditions
    cursor.execute("SELECT description, COUNT(*) FROM conditions GROUP BY description ORDER BY COUNT(*) DESC LIMIT 5")
    condition_results = cursor.fetchall()
    for condition, count in condition_results:
        condition_short = condition[:15] + "..." if len(condition) > 15 else condition
        print(f"Condition {condition_short:11} {count:>8}")
    
    # Date range analysis
    print(colored("\nDATE RANGE ANALYSIS:", "green", attrs=["bold"]))
    print("-" * 40)
    
    # Patient birth date range
    cursor.execute("SELECT MIN(date_of_birth), MAX(date_of_birth) FROM patients")
    min_birth, max_birth = cursor.fetchone()
    print(f"Birth dates: {min_birth} to {max_birth}")
    
    # Encounter date range
    cursor.execute("SELECT MIN(encounter_date), MAX(encounter_date) FROM encounters")
    min_enc, max_enc = cursor.fetchone()
    if min_enc and max_enc:
        print(f"Encounters: {min_enc[:10]} to {max_enc[:10]}")
    
    # Observation date range
    cursor.execute("SELECT MIN(observation_date), MAX(observation_date) FROM observations")
    min_obs, max_obs = cursor.fetchone()
    if min_obs and max_obs:
        print(f"Observations: {min_obs[:10]} to {max_obs[:10]}")
    
    # Database schema info
    print(colored("\nSCHEMA VERIFICATION:", "green", attrs=["bold"]))
    print("-" * 40)
    
    # Check for key columns we added
    key_columns = [
        ('patients', 'is_active'),
        ('observations', 'provider_id')
    ]
    
    for table, column in key_columns:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [col[1] for col in cursor.fetchall()]
        if column in columns:
            print(colored(f"✓ {table}.{column} exists", "green"))
        else:
            print(colored(f"✗ {table}.{column} missing", "red"))
    
    # FHIR resource availability
    print(colored("\nFHIR RESOURCE AVAILABILITY:", "green", attrs=["bold"]))
    print("-" * 40)
    
    fhir_mappings = {
        'Patient': 'patients',
        'Encounter': 'encounters', 
        'Observation': 'observations',
        'Condition': 'conditions',
        'MedicationRequest': 'medications',
        'Practitioner': 'providers',
        'Organization': 'organizations',
        'Location': 'locations',
        'AllergyIntolerance': 'allergies',
        'Immunization': 'immunizations',
        'Procedure': 'procedures',
        'CarePlan': 'careplans',
        'Device': 'devices',
        'DiagnosticReport': 'diagnostic_reports',
        'ImagingStudy': 'imaging_studies'
    }
    
    for fhir_resource, table in fhir_mappings.items():
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            status = "✓" if count > 0 else "○"
            color = "green" if count > 0 else "yellow"
            print(colored(f"{status} {fhir_resource:20} {count:>8,} records", color))
        except sqlite3.OperationalError:
            print(colored(f"✗ {fhir_resource:20} {'Table missing':>15}", "red"))
    
    conn.close()
    
    print(colored("\n" + "="*80, "blue"))
    print(colored("Report generated successfully", "blue"))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python database_summary.py <db_path>")
        print("Example: python database_summary.py backend/data/emr.db")
        sys.exit(1)
        
    db_path = sys.argv[1]
    generate_database_summary(db_path)