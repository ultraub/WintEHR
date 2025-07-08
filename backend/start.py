#!/usr/bin/env python3
"""
Startup wrapper for the EMR backend
Handles common startup issues and provides better error messages
"""

import sys
import os
import subprocess
from pathlib import Path
import logging


def check_python_version():
    """Ensure Python version is 3.8+"""
    if sys.version_info < (3, 8):
        logging.error(f"Error: Python 3.8+ is required. You have Python {sys.version}")
        logging.info("Python 3.7 will not work due to FastAPI and Pydantic dependencies")
        sys.exit(1)

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import pydantic
    except ImportError as e:
        logging.error(f"Error: Missing dependency - {e}")
        logging.info("\nPlease install dependencies:")
        logging.info("  pip install -r requirements.txt")
        logging.info("\nOr use a virtual environment:")
        logging.info("  python -m venv venv")
        logging.info("  source venv/bin/activate  # On Windows: venv\\Scripts\\activate")
        logging.info("  pip install -r requirements.txt")
        sys.exit(1)

def ensure_directories():
    """Create necessary directories"""
    dirs = ['data', 'logs', 'data/synthea_output']
    for dir_name in dirs:
        Path(dir_name).mkdir(parents=True, exist_ok=True)
    logging.info("✓ Directories ready")
def check_database():
    """Check if database exists and is accessible"""
    db_path = Path('data/emr.db')
    if not db_path.exists():
        logging.info("Note: Database will be created on first run")
    else:
        logging.info(f"✓ Database found: {db_path}")
def start_backend():
    """Start the backend server"""
    logging.info("\n🏥 Starting EMR Backend...")
    logging.info("=" * 50)
    # Set environment variables
    os.environ['PYTHONUNBUFFERED'] = '1'
    
    # Import and run main
    try:
        import main
        import uvicorn
        
        # Run with explicit host and port
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except Exception as e:
        logging.error(f"\nError starting backend: {e}")
        logging.info("\nCommon solutions:")
        logging.info("1. Check if port 8000 is already in use")
        logging.info("2. Ensure all dependencies are installed")
        logging.error("3. Check the logs directory for error details")
        sys.exit(1)

def main():
    """Main startup function"""
    logging.info("EMR Backend Startup Check")
    logging.info("=" * 50)
    check_python_version()
    logging.info("✓ Python version OK")
    check_dependencies()
    logging.info("✓ Dependencies installed")
    ensure_directories()
    check_database()
    
    start_backend()

if __name__ == "__main__":
    main()