#!/bin/bash
set -e

echo "🏥 MedGenEMR Backend Starting..."

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL..."
while ! pg_isready -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-emr_user} -q; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 1
done

echo "✅ PostgreSQL is ready!"

# Initialize database schemas and tables
echo "🔧 Initializing database..."

# Create schemas
echo "Creating schemas..."
python -c "
import asyncio
import asyncpg
import os

async def init_schemas():
    try:
        conn = await asyncpg.connect(os.environ.get('DATABASE_URL', 'postgresql://emr_user:emr_password@postgres:5432/emr_db'))
        await conn.execute('CREATE SCHEMA IF NOT EXISTS fhir')
        await conn.execute('CREATE SCHEMA IF NOT EXISTS cds_hooks')
        await conn.close()
        print('✅ Schemas created')
    except Exception as e:
        print(f'⚠️  Schema creation failed: {e}')

asyncio.run(init_schemas())
"

# Run SQL initialization
echo "Running SQL initialization..."
if [ -f "/app/scripts/init_complete.sql" ]; then
    PGPASSWORD=${DB_PASSWORD:-emr_password} psql -h ${DB_HOST:-postgres} -U ${DB_USER:-emr_user} -d ${DB_NAME:-emr_db} -f /app/scripts/init_complete.sql || echo "⚠️  SQL initialization failed: $?"
elif [ -f "scripts/init_complete.sql" ]; then
    PGPASSWORD=${DB_PASSWORD:-emr_password} psql -h ${DB_HOST:-postgres} -U ${DB_USER:-emr_user} -d ${DB_NAME:-emr_db} -f scripts/init_complete.sql || echo "⚠️  SQL initialization failed: $?"
else
    echo "⚠️  init_complete.sql not found! Looking in:"
    echo "   - /app/scripts/"
    echo "   - ./scripts/"
    ls -la /app/scripts/ 2>/dev/null || echo "   /app/scripts/ does not exist"
    ls -la scripts/ 2>/dev/null || echo "   ./scripts/ does not exist"
fi

# Initialize FHIR tables
echo "Initializing FHIR tables..."
python scripts/init_database.py || echo "⚠️  FHIR table initialization skipped"

# Initialize search tables
echo "Initializing search tables..."
python scripts/init_search_tables.py || echo "⚠️  Search table initialization skipped"

# Generate DICOM files for existing imaging studies if not already present
echo "Checking DICOM files for imaging studies..."
if [ -d "/app/data/generated_dicoms" ] && [ "$(ls -A /app/data/generated_dicoms 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "✅ DICOM files already exist"
else
    echo "Generating DICOM files for imaging studies..."
    python scripts/generate_dicom_for_studies.py || echo "⚠️  DICOM generation skipped"
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p /app/data/generated_dicoms /app/data/dicom_uploads /app/logs

# Set permissions
chmod -R 755 /app/data

echo "🚀 Starting application..."
exec "$@"