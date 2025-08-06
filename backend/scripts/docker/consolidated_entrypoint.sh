#!/bin/bash
# Consolidated Docker Entrypoint for WintEHR Backend
# Uses the consolidated patient data building scripts

set -e

echo "🏥 WintEHR Backend Starting with Consolidated Build System..."

# Configuration
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-emr_user}
DB_PASSWORD=${DB_PASSWORD:-emr_password}
DB_NAME=${DB_NAME:-emr_db}
PATIENT_COUNT=${PATIENT_COUNT:-20}
BUILD_TYPE=${BUILD_TYPE:-quick}
SKIP_BUILD=${SKIP_BUILD:-false}

# Export environment variables
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Function to wait for database
wait_for_database() {
    echo "⏳ Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
    local max_retries=30
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if pg_isready -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -q; then
            echo "✅ PostgreSQL is ready!"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        echo "PostgreSQL is unavailable - sleeping (attempt ${retry_count}/${max_retries})"
        sleep 2
    done
    
    echo "❌ PostgreSQL failed to become ready after ${max_retries} attempts"
    return 1
}

# Function to run consolidated build
run_consolidated_build() {
    echo "🚀 Running consolidated build process..."
    
    cd /app/scripts/active
    
    # Determine build type
    if [ "$BUILD_TYPE" = "full" ]; then
        echo "🔧 Running full build with ${PATIENT_COUNT} patients..."
        python master_build.py --full-build --patient-count ${PATIENT_COUNT} --environment production
    elif [ "$BUILD_TYPE" = "quick" ]; then
        echo "⚡ Running quick build with ${PATIENT_COUNT} patients..."
        python master_build.py --quick-build --patient-count ${PATIENT_COUNT} --environment production
    elif [ "$BUILD_TYPE" = "validate" ]; then
        echo "🔍 Running validation only..."
        python master_build.py --validate-only --environment production
    else
        echo "❌ Unknown build type: ${BUILD_TYPE}"
        echo "Available types: full, quick, validate"
        return 1
    fi
    
    local build_result=$?
    
    if [ $build_result -eq 0 ]; then
        echo "✅ Consolidated build completed successfully!"
        
        # Show final status
        echo "📊 Final system status:"
        python master_build.py --status
        
        return 0
    else
        echo "❌ Consolidated build failed!"
        return 1
    fi
}

# Function to run individual migration if needed
run_emergency_migration() {
    echo "🚨 Running emergency migration..."
    
    cd /app/scripts/active
    
    # Try consolidated database initialization
    echo "🔧 Attempting consolidated database initialization..."
    if python ../setup/init_database_definitive.py --mode production; then
        echo "✅ Emergency initialization successful"
        
        # Try basic migration
        echo "🔄 Running basic migrations..."
        python migration_runner.py --run-pending
        
        return 0
    else
        echo "❌ Emergency initialization failed"
        return 1
    fi
}

# Function to validate environment
validate_environment() {
    echo "🔍 Validating environment..."
    
    cd /app/scripts/active
    
    if python migration_runner.py --validate-environment; then
        echo "✅ Environment validation passed"
        return 0
    else
        echo "❌ Environment validation failed"
        return 1
    fi
}

# Main execution
main() {
    # Wait for database to be ready
    if ! wait_for_database; then
        echo "❌ Database not available, exiting..."
        exit 1
    fi
    
    # Skip build if requested
    if [ "$SKIP_BUILD" = "true" ]; then
        echo "⏭️ Skipping build process (SKIP_BUILD=true)"
        echo "🎯 Starting FastAPI server directly..."
        exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    fi
    
    # Validate environment first
    if ! validate_environment; then
        echo "⚠️ Environment validation failed, attempting emergency migration..."
        
        if ! run_emergency_migration; then
            echo "❌ Emergency migration failed, cannot proceed"
            exit 1
        fi
    fi
    
    # Run consolidated build
    if ! run_consolidated_build; then
        echo "❌ Build process failed"
        
        # Check if we should continue anyway
        if [ "$CONTINUE_ON_BUILD_FAILURE" = "true" ]; then
            echo "⚠️ Continuing despite build failure (CONTINUE_ON_BUILD_FAILURE=true)"
        else
            echo "❌ Exiting due to build failure"
            exit 1
        fi
    fi
    
    echo "🎯 Build process completed, starting FastAPI server..."
    
    # Start the FastAPI server
    exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
}

# Handle signals gracefully
trap 'echo "🛑 Received signal, shutting down..."; exit 0' SIGTERM SIGINT

# Run main function
main "$@"