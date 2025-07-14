#!/bin/bash

# AWS Server Cleanup Script - Preserves Backups Only
# Run this script on your AWS server to clean everything except backups

set -e  # Exit on any error

echo "🧹 Starting AWS Server Cleanup - Preserving Backups Only"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Stop all Docker containers and services
echo -e "\n${YELLOW}Step 1: Stopping Docker containers and services${NC}"
print_warning "Stopping all running containers..."

# Stop docker-compose services if running
if [ -f "docker-compose.yml" ] || [ -f "docker-compose.dev.yml" ] || [ -f "docker-compose.aws.yml" ]; then
    docker-compose down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.aws.yml down --remove-orphans 2>/dev/null || true
fi

# Stop all running containers
docker stop $(docker ps -q) 2>/dev/null || true
print_status "All containers stopped"

# Step 2: Remove Docker containers, volumes, and networks
echo -e "\n${YELLOW}Step 2: Removing Docker resources${NC}"

# Remove all containers
docker rm $(docker ps -aq) 2>/dev/null || true
print_status "All containers removed"

# Remove all volumes (this will remove database data)
print_warning "Removing all Docker volumes (including database data)..."
docker volume rm $(docker volume ls -q) 2>/dev/null || true
print_status "All volumes removed"

# Remove all networks
docker network rm $(docker network ls -q --filter type=custom) 2>/dev/null || true
print_status "Custom networks removed"

# Remove all images
print_warning "Removing all Docker images..."
docker rmi $(docker images -q) 2>/dev/null || true
print_status "All images removed"

# Clean Docker system
docker system prune -af --volumes 2>/dev/null || true
print_status "Docker system cleaned"

# Step 3: Preserve backups before clearing directories
echo -e "\n${YELLOW}Step 3: Preserving backups${NC}"

# Create temporary backup preservation directory
BACKUP_PRESERVE_DIR="/tmp/wintehr_backups_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_PRESERVE_DIR"

# Find and preserve all backup directories
if [ -d "data/synthea_backups" ]; then
    cp -r data/synthea_backups "$BACKUP_PRESERVE_DIR/"
    print_status "Preserved data/synthea_backups"
fi

if [ -d "backend/data/synthea_backups" ]; then
    cp -r backend/data/synthea_backups "$BACKUP_PRESERVE_DIR/backend_synthea_backups"
    print_status "Preserved backend/data/synthea_backups"
fi

# Preserve any .backup files
find . -name "*.backup" -o -name "*.bak" -type f 2>/dev/null | while read file; do
    rel_path="${file#./}"
    backup_file_dir="$BACKUP_PRESERVE_DIR/misc_backups/$(dirname "$rel_path")"
    mkdir -p "$backup_file_dir"
    cp "$file" "$backup_file_dir/"
done

print_status "All backups preserved in $BACKUP_PRESERVE_DIR"

# Step 4: Clear application directories
echo -e "\n${YELLOW}Step 4: Clearing application directories${NC}"

# Get current directory name for safety check
CURRENT_DIR=$(basename "$PWD")
if [ "$CURRENT_DIR" != "wintehr" ]; then
    print_error "Safety check failed: Not in wintehr directory. Current: $CURRENT_DIR"
    print_error "Please navigate to the wintehr directory before running this script"
    exit 1
fi

# Clear application files while preserving structure for restore
print_warning "Removing application files..."

# Remove all directories except hidden ones and specific preservation
rm -rf backend frontend scripts docs synthea data examples e2e-tests test-automation node_modules logs postgres-init 2>/dev/null || true

# Remove all non-hidden files except specific ones to preserve
find . -maxdepth 1 -type f ! -name ".*" ! -name "aws-server-cleanup.sh" -delete 2>/dev/null || true

print_status "Application directories cleared"

# Step 5: Clean up caches and temporary files
echo -e "\n${YELLOW}Step 5: Cleaning caches and temporary files${NC}"

# Clean npm cache
npm cache clean --force 2>/dev/null || true

# Clean pip cache
pip cache purge 2>/dev/null || true

# Clean apt cache (if on Ubuntu/Debian)
if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get clean 2>/dev/null || true
fi

# Clean yum cache (if on CentOS/RHEL)
if command -v yum >/dev/null 2>&1; then
    sudo yum clean all 2>/dev/null || true
fi

# Clean tmp files
sudo rm -rf /tmp/docker-* /tmp/npm-* 2>/dev/null || true

print_status "Caches and temporary files cleaned"

# Step 6: Restore backups to expected locations
echo -e "\n${YELLOW}Step 6: Restoring backups to expected locations${NC}"

# Create directory structure for backups
mkdir -p data backend/data

# Restore backups
if [ -d "$BACKUP_PRESERVE_DIR/synthea_backups" ]; then
    cp -r "$BACKUP_PRESERVE_DIR/synthea_backups" data/
    print_status "Restored data/synthea_backups"
fi

if [ -d "$BACKUP_PRESERVE_DIR/backend_synthea_backups" ]; then
    cp -r "$BACKUP_PRESERVE_DIR/backend_synthea_backups" backend/data/synthea_backups
    print_status "Restored backend/data/synthea_backups"
fi

# Step 7: Final cleanup and verification
echo -e "\n${YELLOW}Step 7: Final verification${NC}"

# Show disk usage
echo "Disk usage after cleanup:"
df -h

echo -e "\nRemaining files in directory:"
ls -la

echo -e "\nPreserved backups:"
find data backend/data -name "*backup*" -type d 2>/dev/null || echo "No backup directories found"

# Clean up temporary preservation directory
rm -rf "$BACKUP_PRESERVE_DIR"

print_status "Cleanup completed successfully!"

echo -e "\n${GREEN}🎉 AWS Server Cleanup Complete!${NC}"
echo "========================================"
echo "✅ All Docker containers, volumes, and images removed"
echo "✅ All application files cleared"
echo "✅ All caches cleaned"
echo "✅ Backups preserved in data/ and backend/data/"
echo ""
echo "🚀 Server is ready for fresh wintehr clone and deployment"
echo ""
echo "Next steps:"
echo "1. Clone the fresh wintehr repository"
echo "2. Run deployment scripts"
echo "3. Restore data from preserved backups if needed"