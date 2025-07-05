#!/bin/bash
set -e

echo "🏥 MedGenEMR Backend Starting..."

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL..."
while ! pg_isready -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -q; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 1
done

echo "✅ PostgreSQL is ready!"

# Initialize database tables if needed
echo "🔧 Checking database schema..."
python -c "
import sys
sys.path.append('/app')
from scripts.init_database_tables import create_all_tables
create_all_tables()
" || echo "⚠️  Database initialization failed - may already exist"

# Initialize FHIR schema
echo "🔧 Checking FHIR schema..."
python scripts/init_fhir_schema.py || echo "⚠️  FHIR schema initialization failed - may already exist"

echo "🚀 Starting application..."
exec "$@"