#!/bin/bash

# Simple Local Development Setup for MedGenEMR
echo "🏥 Setting up MedGenEMR for local development..."

# Stop any Docker containers
echo "🛑 Stopping Docker containers..."
docker-compose down 2>/dev/null || true
docker rm -f emr-postgres-local 2>/dev/null || true

# Start PostgreSQL
echo "🗄️  Starting PostgreSQL..."
docker run -d \
  --name emr-postgres-local \
  -e POSTGRES_DB=emr_db \
  -e POSTGRES_USER=emr_user \
  -e POSTGRES_PASSWORD=emr_password \
  -p 5432:5432 \
  postgres:15-alpine

echo "   Waiting for PostgreSQL to start..."
sleep 10

# Setup backend
echo "🐍 Setting up backend..."
cd backend

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements_local_dev.txt

# Run migrations
export DATABASE_URL="postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db"
alembic upgrade head

cd ..

# Setup frontend
echo "🌐 Setting up frontend..."
cd frontend

npm install

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    cat > .env << EOF
REACT_APP_API_URL=http://localhost:8000
REACT_APP_FHIR_URL=http://localhost:8000/fhir
EOF
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo "📋 Next steps:"
echo "   1. Run './start_dev_simple.sh' to start both servers"
echo "   2. Open http://localhost:3000 in your browser"
echo ""
echo "🔧 Development URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"