#!/usr/bin/env python3
"""
Startup wrapper for the EMR backend
Handles common startup issues and provides better error messages
"""

import sys
import os
import subprocess
from pathlib import Path

def check_python_version():
    """Ensure Python version is 3.8+"""
    if sys.version_info < (3, 8):
        print(f"Error: Python 3.8+ is required. You have Python {sys.version}")
        print("Python 3.7 will not work due to FastAPI and Pydantic dependencies")
        sys.exit(1)

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import pydantic
    except ImportError as e:
        print(f"Error: Missing dependency - {e}")
        print("\nPlease install dependencies:")
        print("  pip install -r requirements.txt")
        print("\nOr use a virtual environment:")
        print("  python -m venv venv")
        print("  source venv/bin/activate  # On Windows: venv\\Scripts\\activate")
        print("  pip install -r requirements.txt")
        sys.exit(1)

def ensure_directories():
    """Create necessary directories"""
    dirs = ['data', 'logs', 'data/synthea_output']
    for dir_name in dirs:
        Path(dir_name).mkdir(parents=True, exist_ok=True)
    print("✓ Directories ready")

def check_database():
    """Check if database exists and is accessible"""
    db_path = Path('data/emr.db')
    if not db_path.exists():
        print("Note: Database will be created on first run")
    else:
        print(f"✓ Database found: {db_path}")

def start_backend():
    """Start the backend server"""
    print("\n🏥 Starting EMR Backend...")
    print("=" * 50)
    
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
        print(f"\nError starting backend: {e}")
        print("\nCommon solutions:")
        print("1. Check if port 8000 is already in use")
        print("2. Ensure all dependencies are installed")
        print("3. Check the logs directory for error details")
        sys.exit(1)

def main():
    """Main startup function"""
    print("EMR Backend Startup Check")
    print("=" * 50)
    
    check_python_version()
    print("✓ Python version OK")
    
    check_dependencies()
    print("✓ Dependencies installed")
    
    ensure_directories()
    check_database()
    
    start_backend()

if __name__ == "__main__":
    main()