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

# Initialize database schemas and tables (once, definitively)
echo "🔧 Initializing database..."
export DATABASE_URL="postgresql://emr_user:emr_password@${DB_HOST:-postgres}:5432/${DB_NAME:-emr_db}"

# Run the definitive database initialization
cd /app/scripts
python setup/init_database_definitive.py --mode production || {
    echo "❌ Database initialization failed"
    exit 1
}

# Verify database schema is ready
echo "🔍 Verifying database schema..."
python -c "
import asyncio
import asyncpg
import sys

async def verify_schema():
    try:
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@${DB_HOST:-postgres}:5432/${DB_NAME:-emr_db}')
        
        # Check critical tables exist
        tables = await conn.fetch(\"\"\"
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'fhir' 
            AND table_name IN ('resources', 'search_params', 'resource_history', 'references', 'compartments', 'audit_logs')
        \"\"\")
        
        table_names = {row['table_name'] for row in tables}
        required_tables = {'resources', 'search_params', 'resource_history', 'references', 'compartments', 'audit_logs'}
        
        if required_tables.issubset(table_names):
            print('✅ Database schema verification passed')
            await conn.close()
            return True
        else:
            missing = required_tables - table_names
            print(f'❌ Missing tables: {missing}')
            await conn.close()
            return False
    except Exception as e:
        print(f'❌ Schema verification failed: {e}')
        return False

success = asyncio.run(verify_schema())
sys.exit(0 if success else 1)
" || {
    echo "❌ Database schema verification failed"
    exit 1
}

# Generate DICOM files for imaging studies (if needed)
echo "🔍 Checking for DICOM files..."
if [ -d "/app/data/generated_dicoms" ] && [ "$(ls -A /app/data/generated_dicoms 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "✅ DICOM files already exist"
else
    # Check if there are any ImagingStudy resources first
    python -c "
import asyncio
import asyncpg

async def check_imaging_studies():
    try:
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@${DB_HOST:-postgres}:5432/${DB_NAME:-emr_db}')
        count = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'ImagingStudy' AND deleted = false\")
        await conn.close()
        return count > 0
    except:
        return False

has_studies = asyncio.run(check_imaging_studies())
exit(0 if has_studies else 1)
" && {
        echo "📸 Generating DICOM files for imaging studies..."
        python scripts/active/generate_dicom_for_studies.py || {
            echo "⚠️ DICOM generation had issues but continuing..."
        }
    } || {
        echo "ℹ️ No imaging studies found, skipping DICOM generation"
    }
fi

# Fix FHIR relationships if needed (only if data exists)
echo "🔍 Checking FHIR relationships..."
python -c "
import asyncio
import asyncpg

async def check_and_fix_relationships():
    try:
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@${DB_HOST:-postgres}:5432/${DB_NAME:-emr_db}')
        
        # Check if we have data
        resource_count = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources')
        if resource_count == 0:
            print('ℹ️ No resources found, skipping relationship check')
            await conn.close()
            return
        
        # Check for problematic Resource/ references
        bad_refs = await conn.fetchval(\"\"\"
            SELECT COUNT(*) 
            FROM fhir.resources 
            WHERE resource::text LIKE '%\"Resource/%'
        \"\"\")
        
        # Check for missing patient/subject search params
        missing_params = await conn.fetchval(\"\"\"
            SELECT COUNT(*) 
            FROM fhir.resources r
            WHERE r.resource_type IN ('Condition', 'Observation', 'MedicationRequest')
            AND r.deleted = false
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
                AND sp.param_name IN ('patient', 'subject')
            )
        \"\"\")
        
        await conn.close()
        
        if bad_refs > 0 or missing_params > 0:
            print(f'⚠️ Found {bad_refs} bad references and {missing_params} missing search params')
            print('🔧 Running relationship fixes...')
            return True
        else:
            print('✅ FHIR relationships look good')
            return False
    except Exception as e:
        print(f'⚠️ Could not check relationships: {e}')
        return False

needs_fix = asyncio.run(check_and_fix_relationships())
exit(0 if needs_fix else 1)
" && {
    echo "🔧 Fixing FHIR relationships..."
    python /app/scripts/active/fix_fhir_relationships.py || {
        echo "⚠️ Relationship fix had issues but continuing..."
    }
} || {
    echo "✅ FHIR relationships are correct"
}

# Create necessary directories
echo "Creating directories..."
mkdir -p /app/data/generated_dicoms /app/data/dicom_uploads /app/logs

# Set permissions
chmod -R 755 /app/data

echo "🚀 Starting application..."
exec "$@"