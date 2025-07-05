#!/usr/bin/env python3
"""
Update Build Scripts to Use Synthea Master Script

This script provides examples and templates for updating build scripts
to use the new synthea_master.py instead of the old individual scripts.
"""

import os
from pathlib import Path

def create_build_script_examples():
    """Create example build script integrations."""
    
    print("🔧 Creating build script examples...")
    
    # Example Docker entrypoint update
    docker_example = """#!/bin/bash
# Updated Docker entrypoint with Synthea Master Script integration

set -e

echo "🏥 Starting MedGenEMR with optional Synthea data..."

# Check if we should generate Synthea data
if [[ "$GENERATE_SYNTHEA" == "true" ]]; then
    echo "🧬 Generating Synthea data..."
    
    # Setup Synthea if not already done
    if [[ ! -d "../synthea" ]]; then
        echo "Setting up Synthea..."
        cd /app && python scripts/synthea_master.py setup
    fi
    
    # Generate and import data
    PATIENT_COUNT=${SYNTHEA_PATIENT_COUNT:-10}
    VALIDATION_MODE=${SYNTHEA_VALIDATION_MODE:-transform_only}
    
    echo "Generating $PATIENT_COUNT patients with validation mode: $VALIDATION_MODE"
    cd /app && python scripts/synthea_master.py full \\
        --count $PATIENT_COUNT \\
        --validation-mode $VALIDATION_MODE \\
        ${SYNTHEA_INCLUDE_DICOM:+--include-dicom}
    
    echo "✅ Synthea data generation complete"
fi

# Start the main application
exec "$@"
"""
    
    # Example CI/CD pipeline update
    cicd_example = """# Updated CI/CD Pipeline Example
# GitHub Actions / GitLab CI / Jenkins

name: Test with Synthea Data

jobs:
  test-with-synthea:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Setup and generate Synthea data
        run: |
          cd backend
          # Setup Synthea (first time)
          python scripts/synthea_master.py setup
          
          # Generate test data (5 patients for faster testing)
          python scripts/synthea_master.py full --count 5 --validation-mode light
      
      - name: Run tests
        run: |
          cd backend
          python -m pytest tests/
      
      - name: Validate FHIR data
        run: |
          cd backend
          python scripts/synthea_master.py validate
"""
    
    # Example development setup script
    dev_setup_example = """#!/bin/bash
# Development Environment Setup Script

set -e

echo "🚀 Setting up MedGenEMR development environment..."

# Install backend dependencies
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup Synthea
echo "🧬 Setting up Synthea..."
python scripts/synthea_master.py setup

# Generate sample data
echo "📊 Generating sample data..."
python scripts/synthea_master.py full --count 5 --validation-mode transform_only

# Install frontend dependencies
cd ../frontend
npm install

echo "✅ Development environment ready!"
echo "💡 Use 'python scripts/synthea_master.py --help' for more options"
"""
    
    # Example start.sh integration
    start_sh_integration = """#!/bin/bash
# Example integration for start.sh

# Add this section before starting the backend

# Optional: Generate fresh Synthea data if requested
if [[ "$FRESH_SYNTHEA_DATA" == "true" ]]; then
    echo -e "${BLUE}🧬 Generating fresh Synthea data...${NC}"
    cd backend
    
    # Generate with environment variables or defaults
    PATIENT_COUNT=${SYNTHEA_PATIENT_COUNT:-10}
    VALIDATION_MODE=${SYNTHEA_VALIDATION_MODE:-transform_only}
    
    python scripts/synthea_master.py full \\
        --count $PATIENT_COUNT \\
        --validation-mode $VALIDATION_MODE \\
        ${INCLUDE_DICOM:+--include-dicom}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Synthea data generated successfully${NC}"
    else
        echo -e "${RED}❌ Synthea data generation failed${NC}"
        exit 1
    fi
    
    cd ..
fi
"""
    
    # Write examples to files
    examples_dir = Path("build_script_examples")
    examples_dir.mkdir(exist_ok=True)
    
    examples = {
        "docker-entrypoint-updated.sh": docker_example,
        "cicd-pipeline-example.yml": cicd_example,
        "dev-setup-example.sh": dev_setup_example,
        "start-sh-integration.sh": start_sh_integration
    }
    
    for filename, content in examples.items():
        file_path = examples_dir / filename
        with open(file_path, "w") as f:
            f.write(content)
        print(f"  ✅ Created: {file_path}")
    
    # Create environment variables guide
    env_guide = """# Environment Variables for Synthea Master Script

## Docker/Container Environment

```bash
# Enable Synthea data generation in containers
GENERATE_SYNTHEA=true

# Number of patients to generate (default: 10)
SYNTHEA_PATIENT_COUNT=20

# Validation mode (none, transform_only, light, strict)
SYNTHEA_VALIDATION_MODE=light

# Include DICOM file generation
SYNTHEA_INCLUDE_DICOM=true

# State for patient generation
SYNTHEA_STATE=California

# City for patient generation  
SYNTHEA_CITY=Los Angeles
```

## Development Environment

```bash
# Generate fresh data on startup
FRESH_SYNTHEA_DATA=true

# Include DICOM generation
INCLUDE_DICOM=true

# Patient count for development
SYNTHEA_PATIENT_COUNT=5
```

## Usage in Scripts

```bash
# Use environment variables with defaults
PATIENT_COUNT=${SYNTHEA_PATIENT_COUNT:-10}
VALIDATION_MODE=${SYNTHEA_VALIDATION_MODE:-transform_only}
STATE=${SYNTHEA_STATE:-Massachusetts}

python scripts/synthea_master.py full \\
    --count $PATIENT_COUNT \\
    --validation-mode $VALIDATION_MODE \\
    --state "$STATE" \\
    ${SYNTHEA_CITY:+--city "$SYNTHEA_CITY"} \\
    ${SYNTHEA_INCLUDE_DICOM:+--include-dicom}
```
"""
    
    env_file = examples_dir / "environment-variables-guide.md"
    with open(env_file, "w") as f:
        f.write(env_guide)
    print(f"  ✅ Created: {env_file}")
    
    print(f"\n📁 Examples created in: {examples_dir}")

def create_makefile_example():
    """Create a Makefile with Synthea integration."""
    
    makefile_content = """# Makefile with Synthea Master Script Integration

.PHONY: help setup synthea-setup synthea-generate synthea-import synthea-full synthea-clean dev-data test-data

help: ## Show this help message
	@echo "MedGenEMR Synthea Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \\033[36m%-20s\\033[0m %s\\n", $$1, $$2}'

setup: ## Initial project setup
	cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
	cd frontend && npm install

synthea-setup: ## Setup Synthea for data generation
	cd backend && python scripts/synthea_master.py setup

synthea-generate: ## Generate Synthea data (use COUNT=N for specific number)
	cd backend && python scripts/synthea_master.py generate --count $(or $(COUNT),10)

synthea-import: ## Import existing Synthea data (use MODE=strict/light/etc)
	cd backend && python scripts/synthea_master.py import --validation-mode $(or $(MODE),transform_only)

synthea-full: ## Complete Synthea workflow (generate + import)
	cd backend && python scripts/synthea_master.py full --count $(or $(COUNT),10) --validation-mode $(or $(MODE),transform_only) $(if $(DICOM),--include-dicom)

synthea-clean: ## Clean/wipe Synthea data from database
	cd backend && python scripts/synthea_master.py wipe

synthea-validate: ## Validate imported Synthea data
	cd backend && python scripts/synthea_master.py validate

dev-data: ## Generate development data (5 patients, fast)
	cd backend && python scripts/synthea_master.py full --count 5 --validation-mode transform_only

test-data: ## Generate test data (2 patients, strict validation)
	cd backend && python scripts/synthea_master.py full --count 2 --validation-mode strict

# Development shortcuts
dev: setup dev-data ## Complete development setup with sample data
	@echo "✅ Development environment ready!"
	@echo "💡 Run 'make start' to launch the application"

start: ## Start the application
	./start.sh

# Examples with parameters:
# make synthea-full COUNT=20 MODE=light DICOM=1
# make synthea-generate COUNT=50
# make synthea-import MODE=strict
"""
    
    makefile_path = Path("build_script_examples/Makefile")
    with open(makefile_path, "w") as f:
        f.write(makefile_content)
    print(f"  ✅ Created: {makefile_path}")

def main():
    """Main function to create all build script examples."""
    print("🔧 Creating Build Script Integration Examples")
    print("=" * 60)
    
    create_build_script_examples()
    create_makefile_example()
    
    print("\n✅ Build script examples created!")
    print("\n📋 Integration Checklist:")
    print("1. Review examples in build_script_examples/")
    print("2. Update your actual build scripts as needed")
    print("3. Test the new integrations")
    print("4. Update documentation")
    print("\n💡 Key Benefits:")
    print("- Single command for complete workflow")
    print("- Consistent error handling across environments")
    print("- Configurable validation for different use cases")
    print("- Environment variable support for automation")

if __name__ == "__main__":
    main()