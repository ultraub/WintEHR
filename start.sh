#!/bin/bash

# =============================================================================
# MedGenEMR Start Script - Compatibility Wrapper
# =============================================================================
# This script redirects to the new modular deployment system
# For direct access to options, use: ./scripts/master-deploy.sh --help

echo "🔄 Redirecting to new deployment system..."
echo ""

# Pass all arguments to the master deployment script
exec ./scripts/master-deploy.sh "$@"