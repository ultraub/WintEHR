#!/bin/bash

# =============================================================================
# Module 04a: Reference Indexing
# =============================================================================
# Ensures all FHIR references are properly extracted and indexed
# This is critical for the relationship viewer and graph visualization features

set -e

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
MODE="development"
ROOT_DIR=""
SKIP_DATA=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        --root-dir=*)
            ROOT_DIR="${1#*=}"
            shift
            ;;
        --skip-data=*)
            SKIP_DATA="${1#*=}"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

log() {
    echo -e "${BLUE}[REF-INDEX]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Change to root directory
cd "$ROOT_DIR"

if [ "$SKIP_DATA" = "true" ]; then
    log "⏭️ Skipping reference indexing as requested"
    exit 0
fi

log "🔗 Starting FHIR reference indexing..."

# Check current state
log "Checking current reference state..."
CURRENT_REF_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.references" 2>/dev/null || echo "0")
CURRENT_REF_COUNT=$(echo $CURRENT_REF_COUNT | tr -d ' ')
log "  Current references in database: $CURRENT_REF_COUNT"

# Get resource count for comparison
RESOURCE_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL" 2>/dev/null || echo "0")
RESOURCE_COUNT=$(echo $RESOURCE_COUNT | tr -d ' ')
log "  Total resources in database: $RESOURCE_COUNT"

# Calculate expected references (rough estimate: 3-5 references per resource on average)
EXPECTED_MIN_REFS=$((RESOURCE_COUNT * 3))
EXPECTED_MAX_REFS=$((RESOURCE_COUNT * 5))

# Check if we need to populate references
if [ "$CURRENT_REF_COUNT" -lt "$EXPECTED_MIN_REFS" ]; then
    log "References seem low ($CURRENT_REF_COUNT < expected minimum $EXPECTED_MIN_REFS)"
    log "Running reference population..."
    
    # Try the urn:uuid aware version first
    if docker exec emr-backend test -f /app/scripts/populate_references_urn_uuid.py; then
        log "Using UUID-aware reference extractor..."
        
        # Run with timeout (10 minutes max)
        timeout 600 docker exec emr-backend python scripts/populate_references_urn_uuid.py 2>&1 | while IFS= read -r line; do
            if echo "$line" | grep -q "Progress:"; then
                echo -ne "\r${BLUE}[REF-INDEX]${NC} $line"
            else
                echo ""
                log "$line"
            fi
        done
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            success "Reference population completed successfully"
        elif [ ${PIPESTATUS[0]} -eq 124 ]; then
            warning "Reference population timed out after 10 minutes"
            log "Checking if partial population was successful..."
        else
            warning "Reference population failed, trying basic version..."
            
            # Try basic version as fallback
            if docker exec emr-backend test -f /app/scripts/populate_references_table.py; then
                docker exec emr-backend python scripts/populate_references_table.py || {
                    error "Both reference population methods failed"
                }
            fi
        fi
    else
        error "Reference population script not found"
    fi
else
    log "References look adequate ($CURRENT_REF_COUNT references for $RESOURCE_COUNT resources)"
fi

# Verify results
log "Verifying reference population..."

# Get new reference count
NEW_REF_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.references" 2>/dev/null || echo "0")
NEW_REF_COUNT=$(echo $NEW_REF_COUNT | tr -d ' ')

# Get reference statistics
log "Reference statistics:"
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 
    source_type, 
    target_type, 
    COUNT(*) as count 
FROM fhir.references 
GROUP BY source_type, target_type 
ORDER BY count DESC 
LIMIT 10" 2>/dev/null || warning "Could not get reference statistics"

# Check for orphaned references
ORPHANED_REFS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "
SELECT COUNT(*) 
FROM fhir.references ref
WHERE NOT EXISTS (
    SELECT 1 FROM fhir.resources r 
    WHERE r.id = ref.source_id 
    AND (r.deleted = FALSE OR r.deleted IS NULL)
)" 2>/dev/null || echo "0")
ORPHANED_REFS=$(echo $ORPHANED_REFS | tr -d ' ')

if [ "$ORPHANED_REFS" -gt "0" ]; then
    warning "Found $ORPHANED_REFS orphaned references"
    log "Cleaning up orphaned references..."
    docker exec emr-postgres psql -U emr_user -d emr_db -c "
    DELETE FROM fhir.references ref
    WHERE NOT EXISTS (
        SELECT 1 FROM fhir.resources r 
        WHERE r.id = ref.source_id 
        AND (r.deleted = FALSE OR r.deleted IS NULL)
    )" || warning "Could not clean orphaned references"
fi

# Final summary
if [ "$NEW_REF_COUNT" -gt "$CURRENT_REF_COUNT" ]; then
    REFS_ADDED=$((NEW_REF_COUNT - CURRENT_REF_COUNT))
    success "Reference indexing completed"
    log "  References added: $REFS_ADDED"
    log "  Total references: $NEW_REF_COUNT"
    log "  Average references per resource: $((NEW_REF_COUNT / RESOURCE_COUNT))"
elif [ "$NEW_REF_COUNT" -eq "0" ]; then
    error "No references found after indexing - relationship viewer will not work"
else
    success "Reference verification completed"
    log "  Total references: $NEW_REF_COUNT"
fi

# Create summary file
cat > "$ROOT_DIR/logs/reference-indexing-summary.json" <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "initial_references": $CURRENT_REF_COUNT,
    "final_references": $NEW_REF_COUNT,
    "references_added": $((NEW_REF_COUNT - CURRENT_REF_COUNT)),
    "total_resources": $RESOURCE_COUNT,
    "orphaned_references_cleaned": $ORPHANED_REFS,
    "average_refs_per_resource": $((NEW_REF_COUNT / RESOURCE_COUNT))
}
EOF

log "✨ Reference indexing module completed"