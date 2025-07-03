#!/bin/bash
echo "🚀 Starting backend development server..."
cd backend
source venv/bin/activate
export DATABASE_URL="postgresql://emr_user:emr_password@localhost:5432/emr_db"
export ENVIRONMENT="development"
uvicorn main:app --reload --host 0.0.0.0 --port 8000