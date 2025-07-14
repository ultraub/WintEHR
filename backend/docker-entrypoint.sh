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

# Initialize database schemas and tables
echo "🔧 Initializing database..."

# Wait for database to be fully ready and schema initialized
echo "Waiting for database schema to be available..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Check if schemas exist
    if PGPASSWORD=${DB_PASSWORD:-emr_password} psql -h ${DB_HOST:-postgres} -U ${DB_USER:-emr_user} -d ${DB_NAME:-emr_db} -c "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'fhir'" | grep -q "1"; then
        echo "✅ Database schema initialized via docker-entrypoint-initdb.d"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "❌ Database schema not initialized, attempting manual initialization..."
        
        # Fallback: Run Alembic migration
        echo "Running Alembic database migration..."
        export DATABASE_URL="postgresql://emr_user:emr_password@${DB_HOST:-postgres}:5432/${DB_NAME:-emr_db}"
        
        # Check if migration is needed
        if alembic current 2>/dev/null | grep -q "head"; then
            echo "✅ Database already up to date"
        else
            echo "Running initial migration..."
            alembic upgrade head || {
                echo "⚠️  Alembic migration failed, trying direct SQL..."
                
                # Final fallback: Direct SQL execution
                if [ -f "/app/scripts/init_complete.sql" ]; then
                    PGPASSWORD=${DB_PASSWORD:-emr_password} psql -h ${DB_HOST:-postgres} -U ${DB_USER:-emr_user} -d ${DB_NAME:-emr_db} -f /app/scripts/init_complete.sql || echo "⚠️  SQL initialization failed"
                fi
            }
        fi
        break
    fi
    
    echo "Waiting for database schema initialization... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

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
            AND table_name IN ('resources', 'search_params', 'resource_history', 'references')
        \"\"\")
        
        table_names = {row['table_name'] for row in tables}
        required_tables = {'resources', 'search_params', 'resource_history', 'references'}
        
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

# Generate DICOM files for existing imaging studies if not already present
echo "Checking DICOM files for imaging studies..."
if [ -d "/app/data/generated_dicoms" ] && [ "$(ls -A /app/data/generated_dicoms 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "✅ DICOM files already exist"
else
    echo "Generating DICOM files for imaging studies..."
    # Use the realistic DICOM generator if available, otherwise fall back to basic one
    if [ -f "scripts/generate_realistic_dicoms.py" ]; then
        echo "Using realistic DICOM generator..."
        python scripts/generate_realistic_dicoms.py || python scripts/generate_dicom_for_studies.py || echo "⚠️  DICOM generation skipped"
    else
        python scripts/generate_dicom_for_studies.py || echo "⚠️  DICOM generation skipped"
    fi
fi

# Generate imaging reports for studies if not already present
echo "Checking imaging reports..."
if [ -f "scripts/generate_imaging_reports.py" ]; then
    python scripts/generate_imaging_reports.py || echo "⚠️  Imaging report generation skipped"
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p /app/data/generated_dicoms /app/data/dicom_uploads /app/logs

# Set permissions
chmod -R 755 /app/data

echo "🚀 Starting application..."
exec "$@"