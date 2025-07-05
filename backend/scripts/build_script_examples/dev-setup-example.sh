#!/bin/bash
# Development Environment Setup Script

set -e

echo "🚀 Setting up MedGenEMR development environment..."

# Install backend dependencies
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup Synthea
echo "🧬 Setting up Synthea..."
python scripts/synthea_master.py setup

# Generate sample data
echo "📊 Generating sample data..."
python scripts/synthea_master.py full --count 5 --validation-mode transform_only

# Install frontend dependencies
cd ../frontend
npm install

echo "✅ Development environment ready!"
echo "💡 Use 'python scripts/synthea_master.py --help' for more options"
