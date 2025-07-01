#!/usr/bin/env python3
"""
Unified deployment setup script for Teaching EMR System.
Reads deployment.config.json and executes appropriate setup steps.
"""
import os
import sys
import json
import subprocess
import argparse
import logging
import time
import shutil
from pathlib import Path
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('deployment_setup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EMRDeploymentSetup:
    def __init__(self, config_path='deployment.config.json', profile='local_dev'):
        self.config_path = config_path
        self.profile = profile
        self.config = self.load_config()
        self.profile_config = self.config['deployment_profiles'][profile]
        self.start_time = time.time()
        
    def load_config(self):
        """Load deployment configuration from JSON file."""
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Configuration file {self.config_path} not found")
            sys.exit(1)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in configuration file: {e}")
            sys.exit(1)
    
    def check_prerequisites(self):
        """Check that all required tools are installed."""
        logger.info("Checking prerequisites...")
        
        requirements = {
            'python': ['python', '--version'],
            'npm': ['npm', '--version'],
            'java': ['java', '-version'],
            'docker': ['docker', '--version'],
            'git': ['git', '--version']
        }
        
        missing = []
        for tool, cmd in requirements.items():
            try:
                subprocess.run(cmd, capture_output=True, check=True)
                logger.info(f"✓ {tool} is installed")
            except (subprocess.CalledProcessError, FileNotFoundError):
                missing.append(tool)
                logger.warning(f"✗ {tool} is not installed")
        
        if missing:
            logger.error(f"Missing prerequisites: {', '.join(missing)}")
            logger.error("Please install missing tools before continuing")
            sys.exit(1)
        
        return True
    
    def setup_directories(self):
        """Create necessary directories."""
        logger.info("Setting up directories...")
        
        directories = [
            'backend/data',
            'backend/logs',
            'backend/uploads/dicom',
            'data/synthea_output',
            'data/dicom_generated'
        ]
        
        for dir_path in directories:
            Path(dir_path).mkdir(parents=True, exist_ok=True)
            logger.info(f"Created directory: {dir_path}")
    
    def create_synthea_properties(self):
        """Create Synthea properties file based on configuration."""
        logger.info("Creating Synthea properties file...")
        
        properties = self.config['synthea_settings']['properties']
        synthea_dir = Path('synthea')
        synthea_dir.mkdir(exist_ok=True)
        
        props_file = synthea_dir / 'synthea.properties'
        with open(props_file, 'w') as f:
            for key, value in properties.items():
                f.write(f"{key} = {str(value).lower() if isinstance(value, bool) else value}\n")
        
        logger.info(f"Created {props_file}")
    
    def download_synthea(self):
        """Download Synthea if not present."""
        synthea_jar = Path('synthea/synthea-with-dependencies.jar')
        
        if synthea_jar.exists():
            logger.info("Synthea already downloaded")
            return
        
        logger.info("Downloading Synthea...")
        
        url = "https://github.com/synthetichealth/synthea/releases/download/master-branch-latest/synthea-with-dependencies.jar"
        
        try:
            # Try wget first, fallback to curl
            try:
                subprocess.run([
                    'wget', '-O', str(synthea_jar), url
                ], check=True)
            except (subprocess.CalledProcessError, FileNotFoundError):
                # Use curl as fallback (macOS)
                subprocess.run([
                    'curl', '-L', '-o', str(synthea_jar), url
                ], check=True)
            logger.info("Synthea downloaded successfully")
        except subprocess.CalledProcessError:
            logger.error("Failed to download Synthea")
            sys.exit(1)
    
    def generate_synthea_data(self):
        """Generate synthetic patient data using Synthea."""
        logger.info(f"Generating {self.profile_config['patient_count']} patients with Synthea...")
        
        synthea_config = self.profile_config['synthea']
        heap_size = self.config['synthea_settings']['java_heap_size']
        
        # Build Synthea command
        cmd = [
            'java', f'-Xmx{heap_size}',
            '-jar', 'synthea/synthea-with-dependencies.jar',
            '-p', str(self.profile_config['patient_count']),
            '-s', str(synthea_config['seed']),
            '--exporter.baseDirectory', './data/synthea_output'
        ]
        
        # Add export format flags
        for format in synthea_config['export_formats']:
            cmd.extend([f'--exporter.{format}.export', 'true'])
        
        # Add location
        cmd.append(synthea_config['location'])
        
        # Run Synthea
        try:
            subprocess.run(cmd, check=True)
            logger.info("Synthea data generation completed")
        except subprocess.CalledProcessError as e:
            logger.error(f"Synthea generation failed: {e}")
            sys.exit(1)
    
    def setup_database(self):
        """Initialize the database."""
        logger.info("Setting up database...")
        
        os.chdir('backend')
        try:
            # Create database tables
            subprocess.run([
                'python', '-c',
                "from database.database import engine; from models.models import Base; Base.metadata.create_all(bind=engine)"
            ], check=True)
            logger.info("Database tables created")
        except subprocess.CalledProcessError:
            logger.error("Failed to create database tables")
            sys.exit(1)
        finally:
            os.chdir('..')
    
    def import_synthea_data(self):
        """Import Synthea data into the database."""
        logger.info("Importing Synthea data...")
        
        os.chdir('backend')
        try:
            # Use comprehensive setup for more reliable import
            subprocess.run([
                'python', 
                'scripts/comprehensive_setup.py',
                '--skip-synthea',  # We already generated data
                '--patients', str(self.profile_config['patient_count'])
            ], check=True)
            
            logger.info("Synthea FHIR data imported")
            
            # Import clinical notes if enabled
            if self.profile_config['enable_clinical_notes']:
                logger.info("Importing clinical notes...")
                subprocess.run([
                    'python',
                    'scripts/import_synthea_with_notes.py'
                ], check=True)
                logger.info("Clinical notes imported")
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Data import failed: {e}")
            sys.exit(1)
        finally:
            os.chdir('..')
    
    def create_providers(self):
        """Create provider accounts."""
        logger.info(f"Creating {self.profile_config['provider_count']} provider accounts...")
        
        os.chdir('backend')
        try:
            # Use enhanced provider creation script if it exists
            provider_script = 'scripts/create_sample_providers_enhanced.py'
            if not os.path.exists(provider_script):
                provider_script = 'scripts/create_sample_providers.py'
            
            cmd = ['python', provider_script]
            if 'enhanced' in provider_script:
                cmd.extend(['--count', str(self.profile_config['provider_count'])])
            
            subprocess.run(cmd, check=True)
            logger.info("Providers created")
        except subprocess.CalledProcessError:
            logger.error("Failed to create providers")
            sys.exit(1)
        finally:
            os.chdir('..')
    
    def assign_patients_to_providers(self):
        """Assign patients to providers."""
        if not self.profile_config['enable_patient_provider_assignment']:
            logger.info("Patient-provider assignment disabled")
            return
        
        logger.info("Assigning patients to providers...")
        
        os.chdir('backend')
        try:
            # Use automated assignment script if it exists
            assignment_script = 'scripts/assign_patients_to_providers_auto.py'
            if not os.path.exists(assignment_script):
                assignment_script = 'scripts/assign_patients_to_providers.py'
            
            cmd = ['python', assignment_script]
            if 'auto' in assignment_script:
                cmd.append('--force')  # Force reassignment for fresh deployments
            
            subprocess.run(cmd, check=True)
            logger.info("Patients assigned to providers")
        except subprocess.CalledProcessError:
            logger.error("Failed to assign patients to providers")
            sys.exit(1)
        finally:
            os.chdir('..')
    
    def add_lab_reference_ranges(self):
        """Add reference ranges to lab results."""
        if not self.profile_config['enable_labs_with_ranges']:
            logger.info("Lab reference ranges disabled")
            return
        
        logger.info("Adding lab reference ranges...")
        
        os.chdir('backend')
        try:
            subprocess.run([
                'python',
                'scripts/add_reference_ranges.py'
            ], check=True)
            logger.info("Lab reference ranges added")
        except subprocess.CalledProcessError:
            logger.error("Failed to add lab reference ranges")
            # Non-critical, continue
        finally:
            os.chdir('..')
    
    def generate_dicom_files(self):
        """Generate DICOM files for imaging studies."""
        if not self.profile_config['enable_imaging']:
            logger.info("DICOM generation disabled")
            return
        
        logger.info("Generating DICOM files for imaging studies...")
        
        os.chdir('backend')
        try:
            subprocess.run([
                'python',
                'scripts/generate_dicom_for_synthea.py'
            ], check=True)
            logger.info("DICOM files generated")
        except subprocess.CalledProcessError:
            logger.error("Failed to generate DICOM files")
            # Non-critical, continue
        finally:
            os.chdir('..')
    
    def populate_clinical_catalogs(self):
        """Populate clinical catalogs with reference data."""
        if not self.config['post_processing']['populate_clinical_catalogs']:
            return
        
        logger.info("Populating clinical catalogs...")
        
        os.chdir('backend')
        try:
            subprocess.run([
                'python',
                'scripts/populate_clinical_catalogs.py'
            ], check=True)
            logger.info("Clinical catalogs populated")
        except subprocess.CalledProcessError:
            logger.error("Failed to populate clinical catalogs")
            # Non-critical, continue
        finally:
            os.chdir('..')
    
    def build_frontend(self):
        """Build the frontend application."""
        logger.info("Building frontend...")
        
        os.chdir('frontend')
        try:
            # Install dependencies
            subprocess.run(['npm', 'install'], check=True)
            
            # Build for production
            subprocess.run(['npm', 'run', 'build'], check=True)
            logger.info("Frontend built successfully")
        except subprocess.CalledProcessError:
            logger.error("Frontend build failed")
            sys.exit(1)
        finally:
            os.chdir('..')
    
    def run_tests(self):
        """Run test suite if configured."""
        if not self.config['test_settings']['run_tests_after_setup']:
            logger.info("Test execution disabled")
            return
        
        logger.info("Running test suite...")
        
        os.chdir('backend')
        try:
            cmd = [
                'python', '-m', 'pytest',
                'tests/', '-v',
                '--cov=.', 
                f'--cov-fail-under={self.config["test_settings"]["min_coverage_percent"]}'
            ]
            
            subprocess.run(cmd, check=True)
            logger.info("All tests passed")
        except subprocess.CalledProcessError:
            logger.warning("Some tests failed")
            # Non-critical for setup
        finally:
            os.chdir('..')
    
    def create_env_file(self):
        """Create .env file with deployment settings."""
        logger.info("Creating environment configuration...")
        
        env_vars = self.config['environment_defaults'].copy()
        
        # Override with profile-specific database settings
        if self.profile_config['database']['type'] == 'sqlite':
            env_vars['DATABASE_URL'] = f"sqlite:///./{self.profile_config['database']['path']}"
        else:
            env_vars['DATABASE_URL'] = self.profile_config['database']['connection_string']
        
        # Write backend .env
        with open('backend/.env', 'w') as f:
            for key, value in env_vars.items():
                f.write(f"{key}={value}\n")
        
        # Write frontend .env
        with open('frontend/.env', 'w') as f:
            f.write("REACT_APP_API_URL=\n")  # Empty for production
        
        logger.info("Environment files created")
    
    def print_summary(self):
        """Print deployment summary."""
        elapsed = time.time() - self.start_time
        minutes = int(elapsed // 60)
        seconds = int(elapsed % 60)
        
        logger.info("\n" + "="*60)
        logger.info("DEPLOYMENT SETUP COMPLETED")
        logger.info("="*60)
        logger.info(f"Profile: {self.profile}")
        logger.info(f"Patients: {self.profile_config['patient_count']}")
        logger.info(f"Providers: {self.profile_config['provider_count']}")
        logger.info(f"Time elapsed: {minutes}m {seconds}s")
        logger.info("\nNext steps:")
        logger.info("1. Start the backend: cd backend && python main.py")
        logger.info("2. Start the frontend: cd frontend && npm start")
        logger.info("3. Access the application at http://localhost:3000")
        logger.info("="*60)
    
    def run(self):
        """Execute the complete deployment setup."""
        logger.info(f"Starting EMR deployment setup with profile: {self.profile}")
        
        try:
            self.check_prerequisites()
            self.setup_directories()
            self.create_synthea_properties()
            self.create_env_file()
            self.download_synthea()
            self.generate_synthea_data()
            self.setup_database()
            self.import_synthea_data()
            self.create_providers()
            self.assign_patients_to_providers()
            self.add_lab_reference_ranges()
            self.generate_dicom_files()
            self.populate_clinical_catalogs()
            self.build_frontend()
            self.run_tests()
            self.print_summary()
            
        except Exception as e:
            logger.error(f"Setup failed: {e}")
            sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='EMR Deployment Setup')
    parser.add_argument(
        '--profile',
        choices=['local_dev', 'production', 'cloud'],
        default='local_dev',
        help='Deployment profile to use'
    )
    parser.add_argument(
        '--config',
        default='deployment.config.json',
        help='Path to deployment configuration file'
    )
    parser.add_argument(
        '--skip-synthea',
        action='store_true',
        help='Skip Synthea data generation'
    )
    parser.add_argument(
        '--skip-tests',
        action='store_true', 
        help='Skip running tests after setup'
    )
    
    args = parser.parse_args()
    
    # Override test setting if requested
    if args.skip_tests:
        with open(args.config, 'r') as f:
            config = json.load(f)
        config['test_settings']['run_tests_after_setup'] = False
        with open(args.config, 'w') as f:
            json.dump(config, f, indent=2)
    
    setup = EMRDeploymentSetup(args.config, args.profile)
    
    if args.skip_synthea:
        # Skip Synthea generation but run everything else
        setup.generate_synthea_data = lambda: logger.info("Skipping Synthea generation")
    
    setup.run()

if __name__ == '__main__':
    main()