#!/bin/bash
# WintEHR Complete Server Wipe Script
# =====================================================================
# This script performs a complete server cleanup to ensure a fresh start
# for deployment. It removes ALL traces of previous installations.
#
# CRITICAL: This script is MANDATORY before every deployment attempt
#
# Usage:
#   ./cleanup-server.sh                    # Full wipe (production-safe)
#   ./cleanup-server.sh --nuclear          # Nuclear wipe (removes Docker itself)
#   ./cleanup-server.sh --dry-run          # Show what would be removed
# =====================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default mode
DRY_RUN=false
NUCLEAR=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --nuclear)
            NUCLEAR=true
            shift
            ;;
        --help|-h)
            cat << EOF
WintEHR Server Cleanup Script

Usage:
  ./cleanup-server.sh [OPTIONS]

Options:
  --dry-run          Show what would be removed without actually removing
  --nuclear          Remove Docker itself (use for complete reset)
  --help, -h         Show this help message

Description:
  Performs a complete cleanup of the WintEHR installation:
  - Stops all Docker containers
  - Removes all Docker containers (including stopped ones)
  - Removes all Docker volumes (including data)
  - Removes all Docker images (including WintEHR images)
  - Removes all Docker networks (except default)
  - Cleans up generated data directories
  - Removes SSL certificates
  - Removes configuration artifacts
  - Stops any lingering processes

WARNING: This is destructive and cannot be undone!
Always backup important data before running this script.

Examples:
  ./cleanup-server.sh              # Standard cleanup
  ./cleanup-server.sh --dry-run    # Preview cleanup actions
  ./cleanup-server.sh --nuclear    # Remove everything including Docker

EOF
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run './cleanup-server.sh --help' for usage"
            exit 1
            ;;
    esac
done

# Print header
echo "=============================================================================="
if [ "$DRY_RUN" = true ]; then
    echo "                WintEHR Server Cleanup (DRY RUN)"
else
    echo "                WintEHR Server Cleanup"
fi
echo "=============================================================================="
echo ""

if [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}${BOLD}WARNING: This will remove ALL WintEHR data and Docker resources!${NC}"
    echo -e "${YELLOW}This action cannot be undone.${NC}"
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
    echo
    if [[ ! $REPLY = "yes" ]]; then
        echo -e "${GREEN}Cleanup cancelled${NC}"
        exit 0
    fi
    echo ""
fi

# Helper function for dry-run mode
execute() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY RUN]${NC} $*"
    else
        echo -e "${BLUE}Executing:${NC} $*"
        eval "$*" || true  # Continue on error
    fi
}

# ============================================================================
# STEP 1: Stop All Docker Containers
# ============================================================================
echo -e "${BOLD}Step 1: Stopping all Docker containers...${NC}"

if command -v docker &> /dev/null; then
    RUNNING_CONTAINERS=$(docker ps -q 2>/dev/null || true)
    if [ -n "$RUNNING_CONTAINERS" ]; then
        echo "   Found $(echo "$RUNNING_CONTAINERS" | wc -l | tr -d ' ') running containers"
        execute "docker stop $RUNNING_CONTAINERS"
    else
        echo "   No running containers found"
    fi
else
    echo "   Docker not installed, skipping"
fi
echo ""

# ============================================================================
# STEP 2: Remove All Docker Containers
# ============================================================================
echo -e "${BOLD}Step 2: Removing all Docker containers...${NC}"

if command -v docker &> /dev/null; then
    ALL_CONTAINERS=$(docker ps -aq 2>/dev/null || true)
    if [ -n "$ALL_CONTAINERS" ]; then
        echo "   Found $(echo "$ALL_CONTAINERS" | wc -l | tr -d ' ') containers (including stopped)"
        execute "docker rm -f $ALL_CONTAINERS"
    else
        echo "   No containers found"
    fi
else
    echo "   Docker not installed, skipping"
fi
echo ""

# ============================================================================
# STEP 3: Remove All Docker Volumes
# ============================================================================
echo -e "${BOLD}Step 3: Removing all Docker volumes...${NC}"

if command -v docker &> /dev/null; then
    ALL_VOLUMES=$(docker volume ls -q 2>/dev/null || true)
    if [ -n "$ALL_VOLUMES" ]; then
        echo "   Found $(echo "$ALL_VOLUMES" | wc -l | tr -d ' ') volumes"
        execute "docker volume rm -f $ALL_VOLUMES"
    else
        echo "   No volumes found"
    fi
else
    echo "   Docker not installed, skipping"
fi
echo ""

# ============================================================================
# STEP 4: Remove All Docker Images
# ============================================================================
echo -e "${BOLD}Step 4: Removing all Docker images...${NC}"

if command -v docker &> /dev/null; then
    ALL_IMAGES=$(docker images -q 2>/dev/null || true)
    if [ -n "$ALL_IMAGES" ]; then
        echo "   Found $(echo "$ALL_IMAGES" | wc -l | tr -d ' ') images"
        execute "docker rmi -f $ALL_IMAGES"
    else
        echo "   No images found"
    fi
else
    echo "   Docker not installed, skipping"
fi
echo ""

# ============================================================================
# STEP 5: Remove All Docker Networks (except defaults)
# ============================================================================
echo -e "${BOLD}Step 5: Removing Docker networks...${NC}"

if command -v docker &> /dev/null; then
    CUSTOM_NETWORKS=$(docker network ls --filter "type=custom" -q 2>/dev/null || true)
    if [ -n "$CUSTOM_NETWORKS" ]; then
        echo "   Found $(echo "$CUSTOM_NETWORKS" | wc -l | tr -d ' ') custom networks"
        execute "docker network rm $CUSTOM_NETWORKS"
    else
        echo "   No custom networks found"
    fi
else
    echo "   Docker not installed, skipping"
fi
echo ""

# ============================================================================
# STEP 6: Docker System Prune
# ============================================================================
echo -e "${BOLD}Step 6: Docker system prune...${NC}"

if command -v docker &> /dev/null; then
    execute "docker system prune -af --volumes"
    echo "   Cleaned up dangling resources"
else
    echo "   Docker not installed, skipping"
fi
echo ""

# ============================================================================
# STEP 7: Clean up data directories
# ============================================================================
echo -e "${BOLD}Step 7: Cleaning up data directories...${NC}"

DATA_DIRS=(
    "./data"
    "./logs"
    "./backups"
    "./backend/data/generated_dicoms"
    "./backend/logs"
    "./frontend/build"
    "./frontend/node_modules/.cache"
)

for dir in "${DATA_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "   Removing $dir"
        execute "rm -rf $dir"
    fi
done
echo ""

# ============================================================================
# STEP 8: Clean up SSL certificates
# ============================================================================
echo -e "${BOLD}Step 8: Cleaning up SSL certificates...${NC}"

SSL_DIRS=(
    "./certbot"
    "./ssl"
    "./certs"
    "/etc/letsencrypt"  # System location (requires sudo)
)

for dir in "${SSL_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "   Removing $dir"
        if [[ "$dir" == /etc/* ]]; then
            execute "sudo rm -rf $dir"
        else
            execute "rm -rf $dir"
        fi
    fi
done
echo ""

# ============================================================================
# STEP 9: Clean up configuration artifacts
# ============================================================================
echo -e "${BOLD}Step 9: Cleaning up configuration artifacts...${NC}"

CONFIG_FILES=(
    "./.env.generated"
    "./docker-compose.override.yml"
    "./*.log"
)

for file in "${CONFIG_FILES[@]}"; do
    if ls $file 1> /dev/null 2>&1; then
        echo "   Removing $file"
        execute "rm -f $file"
    fi
done
echo ""

# ============================================================================
# STEP 10: Kill lingering processes
# ============================================================================
echo -e "${BOLD}Step 10: Checking for lingering processes...${NC}"

# Check for node processes
NODE_PROCS=$(ps aux | grep -E 'node.*react|node.*webpack' | grep -v grep | awk '{print $2}' || true)
if [ -n "$NODE_PROCS" ]; then
    echo "   Found Node.js processes: $NODE_PROCS"
    execute "kill -9 $NODE_PROCS"
fi

# Check for Python/uvicorn processes
PYTHON_PROCS=$(ps aux | grep -E 'python.*uvicorn|python.*fastapi' | grep -v grep | awk '{print $2}' || true)
if [ -n "$PYTHON_PROCS" ]; then
    echo "   Found Python processes: $PYTHON_PROCS"
    execute "kill -9 $PYTHON_PROCS"
fi

if [ -z "$NODE_PROCS" ] && [ -z "$PYTHON_PROCS" ]; then
    echo "   No lingering processes found"
fi
echo ""

# ============================================================================
# STEP 11: Clean up package caches (optional)
# ============================================================================
echo -e "${BOLD}Step 11: Cleaning up package caches...${NC}"

# Clean pip cache
if command -v pip3 &> /dev/null; then
    execute "pip3 cache purge"
fi

# Clean npm cache
if command -v npm &> /dev/null; then
    execute "npm cache clean --force"
fi
echo ""

# ============================================================================
# STEP 12: Nuclear option - Remove Docker itself
# ============================================================================
if [ "$NUCLEAR" = true ]; then
    echo -e "${BOLD}${RED}Step 12: NUCLEAR MODE - Removing Docker...${NC}"
    echo -e "${YELLOW}This will remove Docker itself. You'll need to reinstall it.${NC}"

    if [ "$DRY_RUN" = false ]; then
        read -p "Are you REALLY sure? (type 'NUCLEAR' to confirm): " -r
        if [[ $REPLY = "NUCLEAR" ]]; then
            # Detect OS and remove Docker
            if [[ "$OSTYPE" == "linux-gnu"* ]]; then
                execute "sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin"
                execute "sudo apt-get autoremove -y"
                execute "sudo rm -rf /var/lib/docker"
                execute "sudo rm -rf /var/lib/containerd"
            elif [[ "$OSTYPE" == "darwin"* ]]; then
                echo "   On macOS, uninstall Docker Desktop manually"
                echo "   Then run: rm -rf ~/Library/Containers/com.docker.docker"
            fi
        else
            echo "   Skipping Docker removal"
        fi
    else
        echo -e "${BLUE}[DRY RUN]${NC} Would remove Docker installation"
    fi
    echo ""
fi

# ============================================================================
# Completion
# ============================================================================
echo "=============================================================================="
if [ "$DRY_RUN" = true ]; then
    echo -e "${GREEN}${BOLD}Dry Run Complete${NC}"
    echo ""
    echo "The above actions would be performed in a real cleanup."
    echo "Run without --dry-run to execute the cleanup."
else
    echo -e "${GREEN}${BOLD}Server Cleanup Complete! ✓${NC}"
    echo ""
    echo "The server has been completely wiped and is ready for fresh deployment."
    echo ""
    echo "Next steps:"
    echo "  1. Verify cleanup: docker ps -a  (should show no containers)"
    echo "  2. Run deployment: ./deploy.sh --environment production"
fi
echo "=============================================================================="
