#!/bin/bash

# Simplified deployment wrapper with smart defaults
# Automatically detects environment and applies optimal settings

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Detect environment
if [ -f /var/lib/cloud/instance/vendor-data.txt ] || [ -f /sys/hypervisor/uuid ]; then
    ENV="prod"
    DEFAULT_PATIENTS=50
    echo -e "${BLUE}Detected AWS/Cloud environment${NC}"
else
    ENV="dev"
    DEFAULT_PATIENTS=20
    echo -e "${BLUE}Detected local development environment${NC}"
fi

# Parse simple arguments
case "$1" in
    clean)
        echo -e "${YELLOW}Performing clean deployment...${NC}"
        ./deploy.sh clean
        ./deploy.sh $ENV --patients ${2:-$DEFAULT_PATIENTS}
        ;;
    quick)
        echo -e "${YELLOW}Quick deployment (no patients)...${NC}"
        ./deploy.sh $ENV --patients 0
        ;;
    test)
        echo -e "${YELLOW}Test deployment (5 patients)...${NC}"
        ./deploy.sh $ENV --patients 5
        ;;
    full)
        echo -e "${YELLOW}Full deployment (${2:-$DEFAULT_PATIENTS} patients)...${NC}"
        ./deploy.sh $ENV --patients ${2:-$DEFAULT_PATIENTS}
        ;;
    *)
        # Default deployment with smart defaults
        PATIENTS=${1:-$DEFAULT_PATIENTS}
        echo -e "${GREEN}Standard deployment with $PATIENTS patients...${NC}"
        ./deploy.sh $ENV --patients $PATIENTS
        ;;
esac