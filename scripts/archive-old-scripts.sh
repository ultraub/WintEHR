#!/bin/bash

# =============================================================================
# Archive Old Build Scripts
# =============================================================================
# Safely archives redundant build scripts that have been replaced by the
# new modular deployment system

set -e

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log() {
    echo -e "${BLUE}[ARCHIVE]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Change to project root
cd "$(dirname "$0")/.."

log "📦 Archiving redundant build scripts..."

# Create archive directory
ARCHIVE_DIR="scripts/archived/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$ARCHIVE_DIR"

# List of scripts to archive
SCRIPTS_TO_ARCHIVE=(
    "deploy-complete.sh"
    "deploy.sh"
    "fresh-deploy.sh"
    "unified-deploy.sh"
    "backend/scripts/init_complete.sh"
    "start.sh"  # If this is also being replaced
)

# Archive each script
ARCHIVED_COUNT=0
for script in "${SCRIPTS_TO_ARCHIVE[@]}"; do
    if [ -f "$script" ]; then
        log "Archiving: $script"
        cp "$script" "$ARCHIVE_DIR/"
        ((ARCHIVED_COUNT++))
    else
        warning "Not found: $script (skipping)"
    fi
done

# Create archive info file
cat > "$ARCHIVE_DIR/ARCHIVE_INFO.md" << EOF
# Archived Build Scripts

**Archived on:** $(date)
**Reason:** Replaced by new modular deployment system

## New System

The following scripts have been replaced by the new modular deployment system:

- Master script: \`scripts/master-deploy.sh\`
- Modules: \`scripts/modules/\`

## Archived Scripts

These scripts were archived from the root directory:

$(for script in "${SCRIPTS_TO_ARCHIVE[@]}"; do
    if [ -f "$script" ]; then
        echo "- \`$script\`"
    fi
done)

## Migration Guide

To use the new system:

\`\`\`bash
# Fresh deployment
./scripts/master-deploy.sh --clean --patients=10

# Production deployment
./scripts/master-deploy.sh --production --patients=20

# Quick development setup
./scripts/master-deploy.sh
\`\`\`

For more options, see \`./scripts/master-deploy.sh --help\`
EOF

success "Archived $ARCHIVED_COUNT scripts to $ARCHIVE_DIR"

# Ask user if they want to remove the original files
echo ""
read -p "$(echo -e "${YELLOW}Remove original scripts? (y/N): ${NC}")" -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Removing original scripts..."
    
    for script in "${SCRIPTS_TO_ARCHIVE[@]}"; do
        if [ -f "$script" ]; then
            rm "$script"
            success "Removed: $script"
        fi
    done
    
    log "✨ Cleanup complete!"
    log "📁 Archived scripts saved in: $ARCHIVE_DIR"
else
    warning "Original scripts kept. You can manually remove them later."
    log "📁 Backup saved in: $ARCHIVE_DIR"
fi

# Update start.sh if it exists and wasn't removed
if [ -f "start.sh" ]; then
    log "Creating compatibility wrapper for start.sh..."
    cat > "start.sh" << 'EOF'
#!/bin/bash

# Compatibility wrapper - redirects to new master deployment script
echo "🔄 Redirecting to new deployment system..."
echo ""
exec ./scripts/master-deploy.sh "$@"
EOF
    chmod +x start.sh
    success "Updated start.sh as compatibility wrapper"
fi