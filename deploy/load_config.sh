#!/bin/bash
# WintEHR Configuration Loader for Bash
# Loads configuration from YAML files and exports as environment variables
#
# Usage:
#   source deploy/load_config.sh
#   echo $WINTEHR_DEPLOYMENT_PATIENT_COUNT

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is required but not installed" >&2
    return 1 2>/dev/null || exit 1
fi

# Check if PyYAML is installed
if ! python3 -c "import yaml" 2>/dev/null; then
    echo "❌ Error: PyYAML is required but not installed" >&2
    echo "   Install with: pip install pyyaml python-dotenv" >&2
    return 1 2>/dev/null || exit 1
fi

# Load and validate configuration, then export as environment variables
export_config() {
    local environment="${1:-production}"

    # Execute the export script and eval the output
    local output
    if output=$(cd "$PROJECT_ROOT" && python3 "$SCRIPT_DIR/export_config.py" "$environment" 2>&1); then
        eval "$output"
        return 0
    else
        echo "$output" >&2
        return 1
    fi
}

# Export configuration
if ! export_config "$@"; then
    echo "❌ Failed to load configuration" >&2
    return 1 2>/dev/null || exit 1
fi

# Print success message if running interactively
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "✅ Configuration loaded and exported"
    echo ""
    echo "Available environment variables (sample):"
    echo "  WINTEHR_DEPLOYMENT_ENVIRONMENT = $WINTEHR_DEPLOYMENT_ENVIRONMENT"
    echo "  WINTEHR_DEPLOYMENT_PATIENT_COUNT = $WINTEHR_DEPLOYMENT_PATIENT_COUNT"
    echo "  WINTEHR_DEPLOYMENT_ENABLE_SSL = $WINTEHR_DEPLOYMENT_ENABLE_SSL"
    echo "  WINTEHR_SSL_DOMAIN_NAME = $WINTEHR_SSL_DOMAIN_NAME"
    echo "  WINTEHR_SERVICES_PORTS_BACKEND = $WINTEHR_SERVICES_PORTS_BACKEND"
    echo ""
    echo "All variables are prefixed with WINTEHR_"
fi
