#!/bin/bash

echo "Setting up EMR repository for GitHub..."

# Check if we're in the EMR directory
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: Please run this script from the EMR directory"
    exit 1
fi

# Initialize git if needed
if [ ! -d ".git" ]; then
    git init
    git branch -M main
fi

# Add files in batches to avoid OneDrive issues
echo "Adding backend files..."
git add backend/requirements.txt backend/main.py backend/Dockerfile
git add backend/api/*.py
git add backend/models/*.py
git add backend/scripts/*.py
git add backend/services/*.py

echo "Adding frontend files..."
git add frontend/package.json frontend/Dockerfile frontend/nginx.conf
git add frontend/src/App.js
git add frontend/src/index.js
git add frontend/src/pages/*.js
git add frontend/src/components/*.js
git add frontend/src/contexts/*.js
git add frontend/src/services/*.js

echo "Adding configuration files..."
git add docker-compose.yml docker-compose.aws.yml .gitignore
git add README.md AWS_DEPLOYMENT.md

echo "Creating initial commit..."
git commit -m "Initial commit: EMR training system for AWS deployment"

echo ""
echo "Next steps:"
echo "1. Create a new repository on GitHub"
echo "2. Add the remote: git remote add origin https://github.com/yourusername/emr-training.git"
echo "3. Push to GitHub: git push -u origin main"