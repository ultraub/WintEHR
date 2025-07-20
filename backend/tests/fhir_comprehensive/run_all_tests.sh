#!/bin/bash

# Run All FHIR Comprehensive Tests and Generate Reports
# Created: 2025-01-20

set -e  # Exit on error

echo "================================================"
echo "FHIR R4 Comprehensive Test Suite"
echo "================================================"
echo "Started: $(date)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create reports directory if it doesn't exist
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPORTS_DIR="$SCRIPT_DIR/reports"
mkdir -p "$REPORTS_DIR"

# Test data directory
TEST_DATA_DIR="$SCRIPT_DIR/test_data"
mkdir -p "$TEST_DATA_DIR"

# Check if running in Docker
if [ -f /.dockerenv ]; then
    DOCKER_FLAG="--docker"
    echo -e "${YELLOW}Running in Docker container${NC}"
else
    DOCKER_FLAG=""
    echo -e "${YELLOW}Running on host system${NC}"
fi

# Step 1: Setup test data
echo ""
echo -e "${GREEN}Step 1: Setting up test data...${NC}"
python "$SCRIPT_DIR/../../scripts/testing/setup_test_data.py" $DOCKER_FLAG

# Step 2: Run tests with different configurations
echo ""
echo -e "${GREEN}Step 2: Running test suites...${NC}"

# Define test categories
declare -a TEST_CATEGORIES=(
    "test_crud_operations.py::TestCRUDOperations"
    "test_search_simple.py::TestSimpleSearch"
    "test_search_complex.py::TestComplexSearch"
    "test_special_operations.py::TestSpecialOperations"
    "test_fhir_compliance.py::TestFHIRCompliance"
    "test_error_handling.py::TestErrorHandling"
)

# Run each category and capture results
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ALL_TESTS_REPORT="$REPORTS_DIR/all_tests_report_$TIMESTAMP.json"
HTML_REPORT="$REPORTS_DIR/test_report_$TIMESTAMP.html"
COVERAGE_REPORT="$REPORTS_DIR/coverage_report_$TIMESTAMP"

# Initialize combined JSON report
echo '{"test_results": [], "summary": {}}' > "$ALL_TESTS_REPORT"

# Run tests by category
for CATEGORY in "${TEST_CATEGORIES[@]}"; do
    echo ""
    echo -e "${YELLOW}Running $CATEGORY...${NC}"
    
    CATEGORY_NAME=$(echo "$CATEGORY" | cut -d':' -f1 | sed 's/test_//' | sed 's/.py//')
    CATEGORY_REPORT="$REPORTS_DIR/${CATEGORY_NAME}_$TIMESTAMP.json"
    
    # Run pytest for this category
    if pytest "$SCRIPT_DIR/$CATEGORY" \
        -v \
        --json-report \
        --json-report-file="$CATEGORY_REPORT" \
        --html="$REPORTS_DIR/${CATEGORY_NAME}_$TIMESTAMP.html" \
        --self-contained-html \
        --maxfail=50; then
        echo -e "${GREEN}✓ $CATEGORY_NAME tests passed${NC}"
    else
        echo -e "${RED}✗ $CATEGORY_NAME tests had failures${NC}"
    fi
    
    # Merge results into combined report
    if [ -f "$CATEGORY_REPORT" ]; then
        python3 -c "
import json
with open('$CATEGORY_REPORT', 'r') as f:
    category_data = json.load(f)
with open('$ALL_TESTS_REPORT', 'r') as f:
    all_data = json.load(f)

# Merge test results
if 'tests' in category_data:
    for test in category_data['tests']:
        all_data['test_results'].append({
            'test': test['nodeid'],
            'status': test['outcome'],
            'duration': test.get('duration', 0)
        })

# Update summary
if 'summary' in category_data:
    for key, value in category_data['summary'].items():
        if key in all_data['summary']:
            all_data['summary'][key] = all_data['summary'].get(key, 0) + value
        else:
            all_data['summary'][key] = value

with open('$ALL_TESTS_REPORT', 'w') as f:
    json.dump(all_data, f, indent=2)
"
    fi
done

# Step 3: Run with coverage
echo ""
echo -e "${GREEN}Step 3: Running tests with coverage analysis...${NC}"
pytest "$SCRIPT_DIR" \
    --cov=backend/fhir \
    --cov-report=html:"$COVERAGE_REPORT" \
    --cov-report=term \
    -q

# Step 4: Generate compliance matrix
echo ""
echo -e "${GREEN}Step 4: Generating compliance matrix...${NC}"
python "$SCRIPT_DIR/generate_compliance_matrix.py"

# Step 5: Generate summary report
echo ""
echo -e "${GREEN}Step 5: Generating summary report...${NC}"

# Create summary report
SUMMARY_REPORT="$REPORTS_DIR/summary_report_$TIMESTAMP.txt"
cat > "$SUMMARY_REPORT" << EOF
FHIR R4 API Test Summary Report
===============================
Generated: $(date)

Test Environment:
- Base URL: ${FHIR_BASE_URL:-http://localhost:8000/fhir/R4}
- Database: ${DATABASE_URL:-postgresql://emr_user:emr_password@localhost:5432/emr_db}

Test Results:
EOF

# Add test results summary
if [ -f "$ALL_TESTS_REPORT" ]; then
    python3 -c "
import json
with open('$ALL_TESTS_REPORT', 'r') as f:
    data = json.load(f)
    
summary = data.get('summary', {})
print(f\"Total Tests: {summary.get('total', 0)}\")
print(f\"Passed: {summary.get('passed', 0)}\")
print(f\"Failed: {summary.get('failed', 0)}\")
print(f\"Skipped: {summary.get('skipped', 0)}\")
print(f\"Duration: {summary.get('duration', 0):.2f} seconds\")
" >> "$SUMMARY_REPORT"
fi

# Add category breakdown
echo "" >> "$SUMMARY_REPORT"
echo "Test Category Breakdown:" >> "$SUMMARY_REPORT"
echo "------------------------" >> "$SUMMARY_REPORT"

for CATEGORY in "${TEST_CATEGORIES[@]}"; do
    CATEGORY_NAME=$(echo "$CATEGORY" | cut -d':' -f1 | sed 's/test_//' | sed 's/.py//')
    CATEGORY_REPORT="$REPORTS_DIR/${CATEGORY_NAME}_$TIMESTAMP.html"
    if [ -f "$CATEGORY_REPORT" ]; then
        echo "✓ $CATEGORY_NAME" >> "$SUMMARY_REPORT"
    else
        echo "✗ $CATEGORY_NAME (report not found)" >> "$SUMMARY_REPORT"
    fi
done

# Add report locations
echo "" >> "$SUMMARY_REPORT"
echo "Generated Reports:" >> "$SUMMARY_REPORT"
echo "------------------" >> "$SUMMARY_REPORT"
echo "Summary: $SUMMARY_REPORT" >> "$SUMMARY_REPORT"
echo "All Tests JSON: $ALL_TESTS_REPORT" >> "$SUMMARY_REPORT"
echo "Coverage: $COVERAGE_REPORT/index.html" >> "$SUMMARY_REPORT"
echo "Compliance Matrix: $REPORTS_DIR/compliance_matrix_*.html" >> "$SUMMARY_REPORT"

# Display summary
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Test Execution Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
cat "$SUMMARY_REPORT"

# Step 6: Check for critical failures
echo ""
if python3 -c "
import json
import sys
with open('$ALL_TESTS_REPORT', 'r') as f:
    data = json.load(f)
    failed = data.get('summary', {}).get('failed', 0)
    sys.exit(0 if failed == 0 else 1)
"; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Check reports for details.${NC}"
    exit 1
fi