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
echo "Checking DICOM files for imaging studies..."
if [ -d "/app/data/generated_dicoms" ] && [ "$(ls -A /app/data/generated_dicoms 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "✅ DICOM files already exist"
else
    echo "Generating DICOM files for imaging studies..."
    python scripts/active/generate_dicom_for_studies.py || {
        echo "❌ DICOM generation failed"
        exit 1
    }
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p /app/data/generated_dicoms /app/data/dicom_uploads /app/logs

# Set permissions
chmod -R 755 /app/data

echo "🚀 Starting application..."
exec "$@"