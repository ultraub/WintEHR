#!/bin/bash
set -e

echo "🏥 WintEHR Backend Starting..."

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL..."
while ! pg_isready -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-emr_user} -q; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 1
done

echo "✅ PostgreSQL is ready!"

# Check database initialization
echo "🔧 Checking database..."
# Use POSTGRES_PASSWORD from environment (set by docker-compose from .env)
export DB_PASSWORD="${POSTGRES_PASSWORD:-emr_password}"
export DATABASE_URL="postgresql+asyncpg://emr_user:${DB_PASSWORD}@${DB_HOST:-postgres}:5432/${DB_NAME:-emr_db}"

# Verify required schemas exist (postgres-init script should have created these)
echo "🔍 Verifying database schemas..."
python -c "
import asyncio
import asyncpg
import sys
import os

async def verify_schema():
    try:
        import urllib.parse
        db_password = os.environ.get('POSTGRES_PASSWORD', 'emr_password')
        # URL encode password to handle special characters
        encoded_password = urllib.parse.quote_plus(db_password)
        conn = await asyncpg.connect(f'postgresql://emr_user:{encoded_password}@${DB_HOST:-postgres}:5432/${DB_NAME:-emr_db}')

        # Check that required schemas exist
        schemas = await conn.fetch(\"\"\"
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name IN ('auth', 'cds_hooks', 'audit')
        \"\"\")

        schema_names = {row['schema_name'] for row in schemas}
        required_schemas = {'auth', 'cds_hooks', 'audit'}

        if required_schemas.issubset(schema_names):
            print('✅ Database schemas verified (auth, cds_hooks, audit)')

            # Check if HAPI FHIR has resources
            try:
                # HAPI FHIR stores resources in hfj_resource table
                # Try to query it; if table doesn't exist yet, HAPI will create it on first startup
                resource_count = await conn.fetchval('SELECT COUNT(*) FROM hfj_resource', timeout=5)
                print(f'✅ HAPI FHIR initialized with {resource_count} resources')
            except Exception as e:
                # Table may not exist yet - HAPI FHIR will create it on startup
                print('ℹ️ HAPI FHIR tables not yet initialized (normal on first run)')

            await conn.close()
            return True
        else:
            missing = required_schemas - schema_names
            print(f'❌ Missing schemas: {missing}')
            print('⚠️ Run postgres-init scripts to initialize database')
            await conn.close()
            return False
    except Exception as e:
        print(f'❌ Schema verification failed: {e}')
        return False

success = asyncio.run(verify_schema())
sys.exit(0 if success else 1)
" || {
    echo "❌ Database schema verification failed"
    echo "💡 Ensure postgres-init scripts have run to create auth, cds_hooks, and audit schemas"
    exit 1
}

# Generate DICOM files for imaging studies (if needed)
echo "🔍 Checking for DICOM files..."
if [ -d "/app/data/generated_dicoms" ] && [ "$(ls -A /app/data/generated_dicoms 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "✅ DICOM files already exist"
else
    echo "ℹ️ DICOM file generation currently disabled during FHIR migration"
    echo "💡 To generate DICOM files, run: python scripts/active/generate_dicom_for_studies.py"
fi

# FHIR relationship management now handled by HAPI FHIR server
echo "ℹ️ FHIR resource management handled by HAPI FHIR server"

# Create necessary directories
echo "Creating directories..."
mkdir -p /app/data/generated_dicoms /app/data/dicom_uploads /app/logs /app/synthea/build/libs /app/synthea/output

# Set permissions
chmod -R 755 /app/data

# Ensure Synthea JAR exists (may be missing if volume mount overwrites /app)
SYNTHEA_JAR="/app/synthea/build/libs/synthea-with-dependencies.jar"
if [ ! -f "$SYNTHEA_JAR" ]; then
    echo "📦 Synthea JAR not found, downloading..."
    curl -fL --progress-bar --retry 3 --retry-delay 5 \
        https://github.com/synthetichealth/synthea/releases/download/v3.3.0/synthea-with-dependencies.jar \
        -o "$SYNTHEA_JAR"
    if [ -f "$SYNTHEA_JAR" ] && [ -s "$SYNTHEA_JAR" ]; then
        echo "✅ Synthea JAR downloaded successfully"
    else
        echo "⚠️ Failed to download Synthea JAR - patient generation may not work"
    fi
else
    echo "✅ Synthea JAR found"
fi

# Ensure we're in the correct directory for the application
cd /app

echo "🚀 Starting application..."
exec "$@"