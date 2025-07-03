#!/bin/bash
set -e

echo "🐘 Setting up PostgreSQL for MedGenEMR"
echo "====================================="

# Configuration
DB_NAME="medgenemr"
DB_USER="emr_user"
DB_PASSWORD="emr_password"
DB_HOST="localhost"
DB_PORT="5432"

# Check if PostgreSQL is running in Docker
if ! docker ps | grep -q postgres-medgenemr; then
    echo "📦 Starting PostgreSQL in Docker..."
    docker run -d \
        --name postgres-medgenemr \
        -e POSTGRES_USER=$DB_USER \
        -e POSTGRES_PASSWORD=$DB_PASSWORD \
        -e POSTGRES_DB=$DB_NAME \
        -p $DB_PORT:5432 \
        -v medgenemr_postgres_data:/var/lib/postgresql/data \
        postgres:15-alpine
    
    echo "⏳ Waiting for PostgreSQL to start..."
    sleep 5
else
    echo "✅ PostgreSQL container already running"
fi

# Wait for PostgreSQL to be ready
echo "🔍 Checking PostgreSQL connection..."
for i in {1..30}; do
    if docker exec postgres-medgenemr pg_isready -U $DB_USER > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    echo "⏳ Waiting for PostgreSQL... ($i/30)"
    sleep 1
done

# Create extensions
echo "🔧 Creating PostgreSQL extensions..."
docker exec postgres-medgenemr psql -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" || true
docker exec postgres-medgenemr psql -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";" || true

# Switch to PostgreSQL environment
echo "🔄 Switching to PostgreSQL configuration..."
if [ -f .env ]; then
    mv .env .env.sqlite.backup
fi
cp .env.postgres .env

# Run Alembic migrations
echo "📊 Running database migrations..."
cd ..
source venv/bin/activate 2>/dev/null || python -m venv venv && source venv/bin/activate

# Install asyncpg if not already installed
pip install asyncpg

# Run migrations
alembic upgrade head

echo ""
echo "✅ PostgreSQL setup complete!"
echo ""
echo "Database Details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
echo "Connection URL:"
echo "  postgresql+asyncpg://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "To connect with psql:"
echo "  docker exec -it postgres-medgenemr psql -U $DB_USER -d $DB_NAME"
echo ""