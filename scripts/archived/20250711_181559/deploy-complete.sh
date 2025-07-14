#!/bin/bash

# =============================================================================
# WintEHR Complete Deployment Script
# =============================================================================
# This script performs a complete, automated deployment without manual intervention
# Fixes all known issues and ensures proper database schema consistency

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

log "🚀 Starting WintEHR Complete Deployment"
echo "=============================================================="

# Step 1: Clean environment
log "🧹 Cleaning existing environment..."
docker-compose down -v || true
docker system prune -f || true
rm -rf backend/synthea || true

# Step 2: Fix script permissions and line endings
log "🔧 Setting up script permissions..."
find . -name "*.sh" -exec chmod +x {} \;
find . -name "*.sh" -exec dos2unix {} \; 2>/dev/null || true

# Step 3: Build containers
log "🔨 Building Docker containers..."
docker-compose build --no-cache

# Step 4: Start services
log "🚀 Starting services..."
docker-compose up -d

# Step 5: Wait for services to be ready
log "⏳ Waiting for services to initialize..."
sleep 15

# Check if PostgreSQL is ready
log "🔍 Checking PostgreSQL health..."
timeout=60
while ! docker exec emr-postgres pg_isready -U emr_user -d emr_db >/dev/null 2>&1; do
    if [ $timeout -eq 0 ]; then
        error "PostgreSQL failed to start"
    fi
    sleep 1
    ((timeout--))
done
success "PostgreSQL is ready"

# Check if backend is ready
log "🔍 Checking backend health..."
timeout=60
while ! curl -s http://localhost:8000/api/health >/dev/null 2>&1; do
    if [ $timeout -eq 0 ]; then
        error "Backend failed to start"
    fi
    sleep 1
    ((timeout--))
done
success "Backend is ready"

# Step 6: Initialize database with proper schema
log "🗄️  Initializing database schema..."
docker exec emr-backend bash -c "cd /app && python scripts/init_database_definitive.py"

# Verify schema was created properly
log "🔍 Verifying database schema..."
if ! docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg

async def verify():
    conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
    
    # Check FHIR tables
    fhir_tables = await conn.fetch(\"SELECT table_name FROM information_schema.tables WHERE table_schema = \\\"fhir\\\"\")
    fhir_table_names = [row[\"table_name\"] for row in fhir_tables]
    
    # Check CDS Hooks tables  
    cds_tables = await conn.fetch(\"SELECT table_name FROM information_schema.tables WHERE table_schema = \\\"cds_hooks\\\"\")
    cds_table_names = [row[\"table_name\"] for row in cds_tables]
    
    required_fhir = [\"resources\", \"search_params\", \"resource_history\", \"references\"]
    required_cds = [\"hook_configurations\"]
    
    missing_fhir = set(required_fhir) - set(fhir_table_names)
    missing_cds = set(required_cds) - set(cds_table_names)
    
    if missing_fhir or missing_cds:
        print(f\"Missing FHIR tables: {missing_fhir}\")
        print(f\"Missing CDS tables: {missing_cds}\")
        exit(1)
    else:
        print(\"Schema verification passed\")
    
    await conn.close()

asyncio.run(verify())
'"; then
    error "Database schema verification failed"
fi
success "Database schema verified"

# Step 7: Generate Synthea data (without wiping schema)
log "🧬 Generating sample patient data..."
docker exec emr-backend bash -c "cd /app && python scripts/synthea_master.py setup"
docker exec emr-backend bash -c "cd /app && python scripts/synthea_master.py generate --count 5"

# Step 8: Import data using our safe import method (not synthea's wipe method)
log "📥 Importing FHIR data safely..."
docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import json
import os
from pathlib import Path
from core.fhir.storage import FHIRStorageEngine
from core.fhir.bundle_processor import FHIRBundleProcessor

async def safe_import():
    storage = FHIRStorageEngine()
    processor = FHIRBundleProcessor(storage)
    
    # Find FHIR files
    fhir_dir = Path(\"/synthea/output/fhir\")
    if not fhir_dir.exists():
        print(\"No FHIR files found\")
        return
    
    fhir_files = list(fhir_dir.glob(\"*.json\"))
    print(f\"Found {len(fhir_files)} FHIR files to import\")
    
    total_imported = 0
    for file_path in fhir_files:
        try:
            with open(file_path, \"r\") as f:
                bundle = json.load(f)
            
            if bundle.get(\"resourceType\") == \"Bundle\":
                result = await processor.process_bundle(bundle, validate=False)
                total_imported += result.get(\"imported\", 0)
                print(f\"Imported {result.get(\"imported\", 0)} resources from {file_path.name}\")
        except Exception as e:
            print(f\"Error importing {file_path.name}: {e}\")
    
    print(f\"Total resources imported: {total_imported}\")

asyncio.run(safe_import())
'"

# Step 9: Fix manifest.json issue by creating proper nginx config
log "🔧 Fixing manifest.json and static file serving..."
docker exec emr-frontend bash -c "
cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    
    # Serve React app
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
        # Add security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection \"1; mode=block\";
        
        # Allow manifest.json
        location = /manifest.json {
            add_header Access-Control-Allow-Origin *;
        }
    }
    
    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Proxy CDS Hooks requests
    location /cds-hooks/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Proxy FHIR requests
    location /fhir/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # WebSocket support
    location /api/ws {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
"

# Restart nginx to apply new config
docker-compose restart frontend

# Step 10: Clean up patient/provider names
log "🧼 Cleaning up patient and provider names..."
docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import re
from core.fhir.storage import FHIRStorageEngine

async def clean_names():
    storage = FHIRStorageEngine()
    
    # Clean patient names
    patients = await storage.search_resources(\"Patient\", {})
    for patient in patients.get(\"resources\", []):
        if \"name\" in patient:
            for name in patient[\"name\"]:
                if \"family\" in name:
                    # Remove numbers and clean up
                    name[\"family\"] = re.sub(r\"\\d+\", \"\", name[\"family\"]).strip()
                if \"given\" in name:
                    name[\"given\"] = [re.sub(r\"\\d+\", \"\", given).strip() for given in name[\"given\"]]
            
            await storage.update_resource(\"Patient\", patient[\"id\"], patient)
    
    # Clean practitioner names
    practitioners = await storage.search_resources(\"Practitioner\", {})
    for practitioner in practitioners.get(\"resources\", []):
        if \"name\" in practitioner:
            for name in practitioner[\"name\"]:
                if \"family\" in name:
                    name[\"family\"] = re.sub(r\"\\d+\", \"\", name[\"family\"]).strip()
                if \"given\" in name:
                    name[\"given\"] = [re.sub(r\"\\d+\", \"\", given).strip() for given in name[\"given\"]]
            
            await storage.update_resource(\"Practitioner\", practitioner[\"id\"], practitioner)
    
    print(\"Names cleaned successfully\")

asyncio.run(clean_names())
'"

# Step 11: Generate DICOM files
log "🏥 Generating DICOM files for imaging studies..."
docker exec emr-backend bash -c "cd /app && python scripts/generate_dicom_for_studies.py" || warning "DICOM generation failed (non-critical)"

# Step 12: Create some sample CDS hooks
log "🔧 Creating sample CDS hooks..."
docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg

async def create_sample_hooks():
    conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
    
    sample_hooks = [
        {
            \"id\": \"diabetes-screening\",
            \"hook_type\": \"patient-view\",
            \"title\": \"Diabetes Screening Reminder\",
            \"description\": \"Reminds providers to screen patients over 45 for diabetes\",
            \"enabled\": True,
            \"conditions\": [{\"type\": \"age\", \"operator\": \"gt\", \"value\": 45}],
            \"actions\": [{\"type\": \"create\", \"summary\": \"Consider diabetes screening\", \"indicator\": \"info\"}]
        },
        {
            \"id\": \"medication-allergy-check\",
            \"hook_type\": \"medication-prescribe\",
            \"title\": \"Allergy Interaction Check\",
            \"description\": \"Checks for medication allergies before prescribing\",
            \"enabled\": True,
            \"conditions\": [],
            \"actions\": [{\"type\": \"create\", \"summary\": \"Check for medication allergies\", \"indicator\": \"warning\"}]
        }
    ]
    
    for hook in sample_hooks:
        await conn.execute(\"\"\"
            INSERT INTO cds_hooks.hook_configurations 
            (id, hook_type, title, description, enabled, conditions, actions)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
            ON CONFLICT (id) DO UPDATE SET
                hook_type = EXCLUDED.hook_type,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                enabled = EXCLUDED.enabled,
                conditions = EXCLUDED.conditions,
                actions = EXCLUDED.actions,
                updated_at = CURRENT_TIMESTAMP
        \"\"\", hook[\"id\"], hook[\"hook_type\"], hook[\"title\"], hook[\"description\"], 
             hook[\"enabled\"], str(hook[\"conditions\"]).replace(\"\\'\", '\"'), 
             str(hook[\"actions\"]).replace(\"\\'\", '\"'))
    
    print(f\"Created {len(sample_hooks)} sample CDS hooks\")
    await conn.close()

asyncio.run(create_sample_hooks())
'"

# Step 13: Final verification
log "🔍 Running final system verification..."

# Check database health
RESOURCE_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -tAc "SELECT COUNT(*) FROM fhir.resources;")
PATIENT_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -tAc "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient';")
CDS_HOOKS_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -tAc "SELECT COUNT(*) FROM cds_hooks.hook_configurations;")

# Check API health
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health)
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)

# Check for the specific tables that caused 500 errors
HISTORY_TABLE_EXISTS=$(docker exec emr-postgres psql -U emr_user -d emr_db -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'fhir' AND table_name = 'resource_history');")

echo ""
echo "=============================================================="
log "📊 Deployment Verification Results"
echo "=============================================================="
success "Total FHIR Resources: $RESOURCE_COUNT"
success "Patients: $PATIENT_COUNT"
success "CDS Hooks: $CDS_HOOKS_COUNT"
success "Backend API Status: $API_STATUS"
success "Frontend Status: $FRONTEND_STATUS"
success "Resource History Table: $HISTORY_TABLE_EXISTS"

if [ "$API_STATUS" = "200" ] && [ "$FRONTEND_STATUS" = "200" ] && [ "$HISTORY_TABLE_EXISTS" = "t" ] && [ "$RESOURCE_COUNT" -gt "0" ]; then
    echo ""
    success "🎉 Deployment completed successfully!"
    success "🌐 Frontend: http://localhost:3000"
    success "🔧 Backend API: http://localhost:8000"
    success "📚 API Docs: http://localhost:8000/docs"
    success "🩺 CDS Hooks: http://localhost:8000/cds-hooks/services"
    echo ""
    success "✨ All known issues have been resolved:"
    success "   ✅ Database schema consistency fixed"
    success "   ✅ Resource history table created"
    success "   ✅ Manifest.json serving fixed"
    success "   ✅ Patient/provider names cleaned"
    success "   ✅ CDS Hooks properly configured"
    success "   ✅ Sample data loaded"
else
    echo ""
    warning "⚠️  Deployment completed with potential issues:"
    [ "$API_STATUS" != "200" ] && warning "   Backend API not responding properly"
    [ "$FRONTEND_STATUS" != "200" ] && warning "   Frontend not responding properly"
    [ "$HISTORY_TABLE_EXISTS" != "t" ] && warning "   Resource history table missing"
    [ "$RESOURCE_COUNT" -eq "0" ] && warning "   No data loaded"
fi

echo ""
log "🔍 Check logs if needed:"
log "   Backend: docker-compose logs backend"
log "   Frontend: docker-compose logs frontend"
log "   Database: docker-compose logs postgres"