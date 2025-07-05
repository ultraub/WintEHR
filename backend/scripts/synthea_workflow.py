#!/usr/bin/env python3
"""
Unified Synthea Workflow Script

This script provides a complete workflow for:
1. Generating Synthea data
2. Resetting and initializing the database
3. Importing the generated data
4. Validating the import

Usage:
    python synthea_workflow.py full              # Run complete workflow
    python synthea_workflow.py generate          # Only generate data
    python synthea_workflow.py import            # Only import existing data
    python synthea_workflow.py validate          # Only validate imported data
"""

import asyncio
import subprocess
import sys
import os
import json
import shutil
from pathlib import Path
from datetime import datetime
import argparse
from typing import Optional

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL


class SyntheaWorkflow:
    """Manages the complete Synthea data workflow."""
    
    def __init__(self):
        self.synthea_dir = Path("../synthea")
        self.output_dir = self.synthea_dir / "output" / "fhir"
        self.backup_dir = Path("data/synthea_backups")
        self.log_file = Path("logs/synthea_workflow.log")
        
        # Ensure directories exist
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message to both console and file."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] [{level}] {message}"
        
        print(log_message)
        
        with open(self.log_file, "a") as f:
            f.write(log_message + "\n")
    
    def generate_synthea_data(self, count: int = 10, state: str = "Massachusetts", 
                            city: Optional[str] = None) -> bool:
        """Generate Synthea patient data."""
        self.log("🏥 Generating Synthea Data")
        self.log("=" * 60)
        
        # Check if Synthea exists
        if not self.synthea_dir.exists():
            self.log("❌ Synthea directory not found. Please install Synthea first.", "ERROR")
            self.log("Run: git clone https://github.com/synthetichealth/synthea.git ../synthea", "ERROR")
            return False
        
        # Clear previous output
        if self.output_dir.exists():
            self.log("📁 Backing up existing data...")
            backup_name = f"synthea_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            backup_path = self.backup_dir / backup_name
            shutil.move(str(self.output_dir), str(backup_path))
            self.log(f"✅ Backed up to: {backup_path}")
        
        # Build Synthea command
        cmd = [
            "./run_synthea",
            "-p", str(count),
            "-s", "0",  # Consistent seed
            "--exporter.years_of_history", "5",
            "--exporter.fhir.export", "true",
            "--exporter.ccda.export", "false",
            "--exporter.csv.export", "false",
            "--exporter.baseDirectory", "./output",
            f"'{state}'"
        ]
        
        if city:
            cmd[-1] = f"'{state}' '{city}'"
        
        # Run Synthea
        self.log(f"🚀 Generating {count} patients...")
        self.log(f"Command: {' '.join(cmd)}")
        
        try:
            os.chdir(self.synthea_dir)
            result = subprocess.run(" ".join(cmd), shell=True, capture_output=True, text=True)
            os.chdir("..")
            
            if result.returncode == 0:
                self.log(f"✅ Successfully generated {count} patients")
                
                # Count generated files
                if self.output_dir.exists():
                    files = list(self.output_dir.glob("*.json"))
                    self.log(f"📄 Generated {len(files)} FHIR bundle files")
                
                return True
            else:
                self.log(f"❌ Synthea generation failed: {result.stderr}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error running Synthea: {e}", "ERROR")
            return False
    
    async def reset_database(self) -> bool:
        """Reset and initialize the database."""
        self.log("\n🗄️ Resetting Database")
        self.log("=" * 60)
        
        try:
            # Run the reset script
            result = subprocess.run(
                [sys.executable, "scripts/reset_and_init_database.py"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                self.log("✅ Database reset successfully")
                return True
            else:
                self.log(f"❌ Database reset failed: {result.stderr}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error resetting database: {e}", "ERROR")
            return False
    
    async def import_data(self) -> bool:
        """Import Synthea data into the database."""
        self.log("\n📥 Importing Synthea Data")
        self.log("=" * 60)
        
        if not self.output_dir.exists():
            self.log("❌ No Synthea output found. Run generate first.", "ERROR")
            return False
        
        try:
            # Run the import script
            result = subprocess.run(
                [sys.executable, "scripts/synthea_import.py"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                self.log("✅ Data imported successfully")
                
                # Extract statistics from output
                if "Import Summary" in result.stdout:
                    self.log("\n📊 Import Statistics:")
                    for line in result.stdout.split('\n'):
                        if any(keyword in line for keyword in 
                               ['Total', 'Successfully', 'Failed', 'Resources by Type']):
                            self.log(f"  {line.strip()}")
                
                return True
            else:
                self.log(f"❌ Import failed: {result.stderr}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error importing data: {e}", "ERROR")
            return False
    
    async def validate_import(self) -> bool:
        """Validate the imported data."""
        self.log("\n🔍 Validating Import")
        self.log("=" * 60)
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        
        async with engine.begin() as conn:
            # Check resource counts
            result = await conn.execute(text("""
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources
                WHERE NOT deleted
                GROUP BY resource_type
                ORDER BY count DESC
            """))
            
            resources = result.fetchall()
            
            if resources:
                self.log("✅ Import validation successful")
                self.log("\n📊 Resource Summary:")
                
                total = 0
                for resource_type, count in resources:
                    self.log(f"  {resource_type}: {count}")
                    total += count
                
                self.log(f"\n  Total Resources: {total}")
                
                # Check for specific important resources
                patient_result = await conn.execute(text("""
                    SELECT COUNT(*) FROM fhir.resources 
                    WHERE resource_type = 'Patient' AND NOT deleted
                """))
                patient_count = patient_result.scalar()
                
                if patient_count > 0:
                    self.log(f"\n✅ Found {patient_count} patients")
                    
                    # Sample patient names
                    sample_result = await conn.execute(text("""
                        SELECT resource->>'id', 
                               resource->'name'->0->>'family',
                               resource->'name'->0->'given'->0
                        FROM fhir.resources 
                        WHERE resource_type = 'Patient' AND NOT deleted
                        LIMIT 5
                    """))
                    
                    self.log("\n👥 Sample Patients:")
                    for fhir_id, family, given in sample_result:
                        given_str = json.loads(given) if given else "Unknown"
                        self.log(f"  - {given_str} {family or 'Unknown'} (ID: {fhir_id})")
                
                return True
            else:
                self.log("❌ No resources found in database", "ERROR")
                return False
        
        await engine.dispose()
    
    async def run_full_workflow(self, count: int = 10, state: str = "Massachusetts", 
                              city: Optional[str] = None) -> bool:
        """Run the complete workflow."""
        self.log("🚀 Starting Full Synthea Workflow")
        self.log("=" * 60)
        self.log(f"Parameters: count={count}, state={state}, city={city or 'Any'}")
        
        # Step 1: Generate data
        if not self.generate_synthea_data(count, state, city):
            self.log("❌ Workflow failed at data generation", "ERROR")
            return False
        
        # Step 2: Reset database
        if not await self.reset_database():
            self.log("❌ Workflow failed at database reset", "ERROR")
            return False
        
        # Step 3: Import data
        if not await self.import_data():
            self.log("❌ Workflow failed at data import", "ERROR")
            return False
        
        # Step 4: Validate
        if not await self.validate_import():
            self.log("❌ Workflow failed at validation", "ERROR")
            return False
        
        self.log("\n🎉 Workflow completed successfully!")
        self.log("=" * 60)
        return True


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Synthea workflow management',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python synthea_workflow.py full                    # Run complete workflow with defaults
  python synthea_workflow.py full --count 20        # Generate 20 patients
  python synthea_workflow.py generate --count 5     # Only generate 5 patients
  python synthea_workflow.py import                  # Import existing data
  python synthea_workflow.py validate               # Validate imported data
        """
    )
    
    parser.add_argument(
        'command',
        choices=['full', 'generate', 'import', 'validate'],
        help='Command to run'
    )
    
    parser.add_argument(
        '--count',
        type=int,
        default=10,
        help='Number of patients to generate (default: 10)'
    )
    
    parser.add_argument(
        '--state',
        default='Massachusetts',
        help='State for patient generation (default: Massachusetts)'
    )
    
    parser.add_argument(
        '--city',
        help='City for patient generation (optional)'
    )
    
    args = parser.parse_args()
    
    workflow = SyntheaWorkflow()
    
    try:
        if args.command == 'full':
            success = await workflow.run_full_workflow(args.count, args.state, args.city)
        elif args.command == 'generate':
            success = workflow.generate_synthea_data(args.count, args.state, args.city)
        elif args.command == 'import':
            success = await workflow.import_data()
        elif args.command == 'validate':
            success = await workflow.validate_import()
        
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        workflow.log("\n⚠️ Workflow interrupted by user", "WARNING")
        sys.exit(1)
    except Exception as e:
        workflow.log(f"\n❌ Unexpected error: {e}", "ERROR")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())