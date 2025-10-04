#!/bin/bash
set -e

SERVER="wintehr.eastus2.cloudapp.azure.com"
SSH_KEY="$HOME/.ssh/WintEHR-key.pem"

echo "🚀 Updating frontend on Azure..."

# Sync frontend files
echo "📦 Syncing frontend files..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'build' \
  --exclude '.git' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  ./frontend/ azureuser@$SERVER:~/WintEHR/frontend/

# Rebuild and restart frontend container
echo "🔨 Rebuilding frontend container..."
ssh -i $SSH_KEY -o StrictHostKeyChecking=no azureuser@$SERVER << 'EOF'
cd ~/WintEHR
docker-compose build frontend
docker-compose up -d frontend
echo "✅ Frontend updated and restarted!"
EOF

echo "✅ Frontend deployment complete!"
echo "🌐 Access at: http://$SERVER"
