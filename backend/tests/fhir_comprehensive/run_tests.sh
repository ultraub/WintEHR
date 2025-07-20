#!/bin/bash
#
# Run FHIR API Comprehensive Tests
# 
# This script sets up the test environment and runs the comprehensive
# FHIR API test suite with proper data preparation.
#
# Usage:
#   ./run_tests.sh                    # Run all tests
#   ./run_tests.sh --quick            # Skip environment setup
#   ./run_tests.sh --module <module>  # Run specific test module
#   ./run_tests.sh --help             # Show help
#
# Created: 2025-01-20

set -e

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"
SKIP_SETUP=false
TEST_MODULE=""
VERBOSE=false
GENERATE_REPORT=true
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="$SCRIPT_DIR/reports"
LOG_FILE="$REPORT_DIR/test_run_${TIMESTAMP}.log"

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[TEST]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

section() {
    echo "" | tee -a "$LOG_FILE"
    echo -e "${PURPLE}================================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${PURPLE} $1${NC}" | tee -a "$LOG_FILE"
    echo -e "${PURPLE}================================================${NC}" | tee -a "$LOG_FILE"
}

# Show usage
show_usage() {
    cat << EOF
FHIR API Comprehensive Test Runner

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --quick             Skip environment setup (use existing)
    --module <name>     Run specific test module only
    --no-report         Skip report generation
    --verbose           Enable verbose output
    --help              Show this help message

TEST MODULES:
    crud                CRUD operations for all resource types
    search_simple       Basic search parameter tests
    search_complex      Complex search and chained queries
    special_ops         Special FHIR operations
    compliance          FHIR R4 compliance tests
    error_handling      Error scenarios and edge cases

EXAMPLES:
    $0                          # Full test suite with setup
    $0 --quick                  # Run tests without setup
    $0 --module search_simple   # Run only search tests
    $0 --quick --verbose        # Quick run with details

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            SKIP_SETUP=true
            shift
            ;;
        --module)
            TEST_MODULE="$2"
            shift 2
            ;;
        --no-report)
            GENERATE_REPORT=false
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Main execution
main() {
    section "🏥 FHIR API Comprehensive Test Suite"
    log "Starting test run at $(date)"
    log "Log file: $LOG_FILE"
    
    # Change to backend directory for proper imports
    cd "$BACKEND_DIR"
    
    # Step 1: Environment setup
    if [ "$SKIP_SETUP" = "false" ]; then
        section "🔧 Setting up test environment"
        
        log "Running test environment setup..."
        if python tests/fhir_comprehensive/setup_test_environment.py >> "$LOG_FILE" 2>&1; then
            success "Test environment ready"
        else
            error "Test environment setup failed. Check $LOG_FILE for details"
        fi
    else
        log "Skipping environment setup (--quick mode)"
    fi
    
    # Step 2: Run tests
    section "🧪 Running FHIR API tests"
    
    # Build pytest command
    PYTEST_CMD="python -m pytest"
    PYTEST_ARGS="-v"
    
    if [ "$VERBOSE" = "true" ]; then
        PYTEST_ARGS="$PYTEST_ARGS -s"
    fi
    
    # Add asyncio mode
    PYTEST_ARGS="$PYTEST_ARGS -o asyncio_mode=auto"
    
    # Add specific module if requested
    if [ -n "$TEST_MODULE" ]; then
        case $TEST_MODULE in
            crud)
                TEST_PATH="tests/fhir_comprehensive/test_crud_operations.py"
                ;;
            search_simple)
                TEST_PATH="tests/fhir_comprehensive/test_search_simple.py"
                ;;
            search_complex)
                TEST_PATH="tests/fhir_comprehensive/test_search_complex.py"
                ;;
            special_ops)
                TEST_PATH="tests/fhir_comprehensive/test_special_operations.py"
                ;;
            compliance)
                TEST_PATH="tests/fhir_comprehensive/test_fhir_compliance.py"
                ;;
            error_handling)
                TEST_PATH="tests/fhir_comprehensive/test_error_handling.py"
                ;;
            *)
                error "Unknown test module: $TEST_MODULE"
                ;;
        esac
        log "Running specific module: $TEST_MODULE"
    else
        TEST_PATH="tests/fhir_comprehensive/"
        log "Running all test modules"
    fi
    
    # Add JUnit XML output for reporting
    PYTEST_ARGS="$PYTEST_ARGS --junit-xml=$REPORT_DIR/junit_${TIMESTAMP}.xml"
    
    # Run the tests
    log "Executing: $PYTEST_CMD $TEST_PATH $PYTEST_ARGS"
    
    if $PYTEST_CMD $TEST_PATH $PYTEST_ARGS 2>&1 | tee -a "$LOG_FILE"; then
        TEST_RESULT=0
        success "All tests passed!"
    else
        TEST_RESULT=$?
        warning "Some tests failed (exit code: $TEST_RESULT)"
    fi
    
    # Step 3: Generate compliance report
    if [ "$GENERATE_REPORT" = "true" ]; then
        section "📊 Generating compliance report"
        
        if python tests/fhir_comprehensive/generate_compliance_matrix.py \
            --output "$REPORT_DIR/compliance_matrix_${TIMESTAMP}.html" >> "$LOG_FILE" 2>&1; then
            success "Compliance report generated"
            log "Report saved to: $REPORT_DIR/compliance_matrix_${TIMESTAMP}.html"
        else
            warning "Failed to generate compliance report"
        fi
    fi
    
    # Step 4: Summary
    section "📋 Test Summary"
    
    # Parse test results
    if [ -f "$REPORT_DIR/junit_${TIMESTAMP}.xml" ]; then
        # Extract test counts from JUnit XML
        TOTAL_TESTS=$(grep -o 'tests="[0-9]*"' "$REPORT_DIR/junit_${TIMESTAMP}.xml" | head -1 | grep -o '[0-9]*' || echo "0")
        FAILED_TESTS=$(grep -o 'failures="[0-9]*"' "$REPORT_DIR/junit_${TIMESTAMP}.xml" | head -1 | grep -o '[0-9]*' || echo "0")
        ERROR_TESTS=$(grep -o 'errors="[0-9]*"' "$REPORT_DIR/junit_${TIMESTAMP}.xml" | head -1 | grep -o '[0-9]*' || echo "0")
        SKIPPED_TESTS=$(grep -o 'skipped="[0-9]*"' "$REPORT_DIR/junit_${TIMESTAMP}.xml" | head -1 | grep -o '[0-9]*' || echo "0")
        
        PASSED_TESTS=$((TOTAL_TESTS - FAILED_TESTS - ERROR_TESTS - SKIPPED_TESTS))
        
        log "Total tests: $TOTAL_TESTS"
        log "Passed: $PASSED_TESTS"
        log "Failed: $FAILED_TESTS"
        log "Errors: $ERROR_TESTS"
        log "Skipped: $SKIPPED_TESTS"
    fi
    
    log ""
    log "Test run completed at $(date)"
    log "Full log: $LOG_FILE"
    
    if [ "$GENERATE_REPORT" = "true" ] && [ -f "$REPORT_DIR/compliance_matrix_${TIMESTAMP}.html" ]; then
        log "Compliance report: $REPORT_DIR/compliance_matrix_${TIMESTAMP}.html"
    fi
    
    # Return appropriate exit code
    exit $TEST_RESULT
}

# Error handling
trap 'error "Test run interrupted"' INT TERM

# Run main function
main