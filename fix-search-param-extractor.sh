#!/bin/bash
###############################################################################
# Critical Fix: Search Parameter Extractor Method Signature
#
# Purpose: Fix the extract_parameters method signature that's causing
#          search parameter indexing to fail completely
#
# Issue: Method is missing @staticmethod decorator or self parameter
# Impact: 17,091 errors during import, 0 search parameters created
#
# Date: 2025-10-04
###############################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Critical Fix: Search Parameter Extractor             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# File to fix
FILE="backend/fhir/core/search_param_extraction.py"

echo -e "${YELLOW}Checking current method signature...${NC}"

# Check if @staticmethod exists
if grep -q "@staticmethod" "$FILE" | grep -A 1 "def extract_parameters"; then
    echo -e "${GREEN}✓ @staticmethod decorator already present${NC}"
    exit 0
fi

# Check current signature
CURRENT_SIG=$(grep -A 0 "def extract_parameters" "$FILE" | head -1)
echo "Current: $CURRENT_SIG"

# Check if it has self parameter
if echo "$CURRENT_SIG" | grep -q "def extract_parameters(self,"; then
    echo -e "${GREEN}✓ Method already has 'self' parameter${NC}"
    exit 0
fi

# Backup the file
echo -e "${YELLOW}Creating backup...${NC}"
cp "$FILE" "${FILE}.backup.$(date +%Y%m%d-%H%M%S)"
echo -e "${GREEN}✓ Backup created${NC}"

# Fix the method signature by adding @staticmethod decorator
echo -e "${YELLOW}Adding @staticmethod decorator...${NC}"

# Find line number of the method
LINE_NUM=$(grep -n "def extract_parameters" "$FILE" | head -1 | cut -d':' -f1)

if [ -z "$LINE_NUM" ]; then
    echo -e "${RED}✗ Could not find extract_parameters method${NC}"
    exit 1
fi

# Insert @staticmethod decorator before the method
sed -i.tmp "${LINE_NUM}i\\
    @staticmethod" "$FILE"

rm -f "${FILE}.tmp"

echo -e "${GREEN}✓ Fix applied${NC}"

# Verify the fix
echo -e "${YELLOW}Verifying fix...${NC}"
if grep -B 1 "def extract_parameters" "$FILE" | grep -q "@staticmethod"; then
    echo -e "${GREEN}✓ Verification successful${NC}"
    echo ""
    echo "Modified section:"
    grep -B 1 -A 2 "def extract_parameters" "$FILE" | head -4
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Fix Applied Successfully!                             ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test the fix with a small import: python scripts/active/synthea_master.py full --count 2"
    echo "2. Verify search parameters are created: psql -c 'SELECT COUNT(*) FROM fhir.search_params'"
    echo "3. If successful, re-run full deployment"
else
    echo -e "${RED}✗ Verification failed${NC}"
    echo "Restoring backup..."
    mv "${FILE}.backup."* "$FILE" 2>/dev/null || true
    exit 1
fi
