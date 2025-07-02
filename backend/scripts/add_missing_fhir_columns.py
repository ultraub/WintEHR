#!/usr/bin/env python3
"""
Database migration script to add missing FHIR-required columns
Adds:
- is_active column to patients table
- provider_id column to observations table
"""

import sqlite3
import os
import shutil
from datetime import datetime
import sys

def backup_database(db_path: str) -> str:
    """Create a backup of the database before migration"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{db_path}.backup_{timestamp}"
    
    try:
        shutil.copy2(db_path, backup_path)
        print(f"✓ Database backed up to: {backup_path}")
        return backup_path
    except Exception as e:
        print(f"✗ Failed to backup database: {e}")
        raise

def check_column_exists(cursor, table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns

def add_missing_columns(db_path: str):
    """Add missing columns to the database"""
    print(f"Connecting to database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check current schema
        print("\nChecking current schema...")
        
        # Check patients table
        patients_has_active = check_column_exists(cursor, "patients", "is_active")
        print(f"Patients table has is_active: {patients_has_active}")
        
        # Check observations table  
        observations_has_provider = check_column_exists(cursor, "observations", "provider_id")
        print(f"Observations table has provider_id: {observations_has_provider}")
        
        changes_made = False
        
        # Add is_active column to patients if missing
        if not patients_has_active:
            print("\nAdding is_active column to patients table...")
            cursor.execute("""
                ALTER TABLE patients 
                ADD COLUMN is_active BOOLEAN DEFAULT 1
            """)
            print("✓ Added is_active column to patients")
            changes_made = True
        else:
            print("✓ Patients table already has is_active column")
            
        # Add provider_id column to observations if missing
        if not observations_has_provider:
            print("\nAdding provider_id column to observations table...")
            cursor.execute("""
                ALTER TABLE observations 
                ADD COLUMN provider_id VARCHAR
            """)
            print("✓ Added provider_id column to observations")
            changes_made = True
            
            # Note: We can't add FOREIGN KEY constraints to existing tables in SQLite
            # The constraint will be enforced by the SQLAlchemy model
            print("Note: Foreign key constraint will be enforced by SQLAlchemy model")
        else:
            print("✓ Observations table already has provider_id column")
            
        if changes_made:
            # Verify the changes
            print("\nVerifying changes...")
            
            cursor.execute("SELECT COUNT(*) FROM patients")
            patient_count = cursor.fetchone()[0]
            print(f"Total patients: {patient_count}")
            
            if not patients_has_active:
                cursor.execute("SELECT COUNT(*) FROM patients WHERE is_active = 1")
                active_count = cursor.fetchone()[0]
                print(f"Active patients (default): {active_count}")
            
            cursor.execute("SELECT COUNT(*) FROM observations")
            obs_count = cursor.fetchone()[0]
            print(f"Total observations: {obs_count}")
            
            if not observations_has_provider:
                cursor.execute("SELECT COUNT(*) FROM observations WHERE provider_id IS NULL")
                null_provider_count = cursor.fetchone()[0]
                print(f"Observations without provider: {null_provider_count}")
            
            # Commit the changes
            conn.commit()
            print("\n✓ Migration completed successfully!")
            
        else:
            print("\n✓ No migration needed - all columns already exist")
            
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

def main():
    """Main migration function"""
    print("="*60)
    print("FHIR Schema Migration Script")
    print("Adding missing columns for FHIR R4 compliance")
    print("="*60)
    
    # Default database path
    db_path = "data/emr.db"
    
    # Allow custom database path as argument
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    
    # Check if database exists
    if not os.path.exists(db_path):
        print(f"✗ Database not found: {db_path}")
        print("Usage: python add_missing_fhir_columns.py [database_path]")
        sys.exit(1)
    
    try:
        # Backup the database
        backup_path = backup_database(db_path)
        
        # Run the migration
        add_missing_columns(db_path)
        
        print(f"\n{'='*60}")
        print("Migration Summary:")
        print(f"✓ Database: {db_path}")
        print(f"✓ Backup: {backup_path}")
        print(f"✓ Added missing FHIR columns")
        print("✓ Ready for FHIR R4 compliance")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"\n{'='*60}")
        print("Migration Failed!")
        print(f"Error: {e}")
        print(f"Database backup available at: {backup_path if 'backup_path' in locals() else 'Not created'}")
        print(f"{'='*60}")
        sys.exit(1)

if __name__ == "__main__":
    main()