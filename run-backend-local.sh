#!/bin/bash

# Run backend server locally with hot reload

cd backend

# Activate virtual environment
source venv/bin/activate

# Export PostgreSQL path
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Load environment variables
export $(cat ../.env | grep -v '^#' | xargs)

# Create DICOM storage directory if it doesn't exist
mkdir -p /tmp/dicom_storage

# Run database migrations
alembic upgrade head

# Start server with hot reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level info