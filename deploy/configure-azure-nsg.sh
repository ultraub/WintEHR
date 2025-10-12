#!/bin/bash
# Azure Network Security Group Configuration
# Configures firewall rules for WintEHR deployment on Azure
#
# Usage:
#   bash deploy/configure-azure-nsg.sh
#
# Prerequisites:
#   - Azure CLI installed and logged in
#   - Configuration loaded via deploy/load_config.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo -e "${BLUE}Azure NSG Configuration${NC}"
echo "======================================"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Error: Azure CLI is not installed${NC}"
    echo "   Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${RED}❌ Error: Not logged in to Azure${NC}"
    echo "   Run: az login"
    exit 1
fi

echo -e "${GREEN}✅ Azure CLI ready${NC}"
echo ""

# Load configuration if not already loaded
if [ -z "$WINTEHR_AZURE_RESOURCE_GROUP" ]; then
    echo -e "${BLUE}📋 Loading configuration...${NC}"
    source deploy/load_config.sh
fi

# Check required configuration
if [ -z "$WINTEHR_AZURE_RESOURCE_GROUP" ] || [ -z "$WINTEHR_AZURE_VM_NAME" ] || [ -z "$WINTEHR_AZURE_NSG_NAME" ]; then
    echo -e "${RED}❌ Error: Azure configuration not found${NC}"
    echo "   Ensure config.yaml has azure section with:"
    echo "   - resource_group"
    echo "   - vm_name"
    echo "   - nsg_name"
    exit 1
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  Resource Group: $WINTEHR_AZURE_RESOURCE_GROUP"
echo "  VM Name:        $WINTEHR_AZURE_VM_NAME"
echo "  NSG Name:       $WINTEHR_AZURE_NSG_NAME"
echo ""

# Check if NSG exists
if ! az network nsg show \
    --resource-group "$WINTEHR_AZURE_RESOURCE_GROUP" \
    --name "$WINTEHR_AZURE_NSG_NAME" \
    &> /dev/null; then
    echo -e "${YELLOW}⚠️  NSG does not exist, creating...${NC}"

    az network nsg create \
        --resource-group "$WINTEHR_AZURE_RESOURCE_GROUP" \
        --name "$WINTEHR_AZURE_NSG_NAME" \
        --location "${WINTEHR_AZURE_LOCATION}"

    echo -e "${GREEN}✅ NSG created${NC}"
fi

# Configure NSG rules based on configuration
echo -e "${BLUE}🔒 Configuring NSG rules...${NC}"

# Priority counter
PRIORITY=100

# SSH Access (port 22)
echo "  → SSH (port 22)"
az network nsg rule create \
    --resource-group "$WINTEHR_AZURE_RESOURCE_GROUP" \
    --nsg-name "$WINTEHR_AZURE_NSG_NAME" \
    --name "Allow-SSH" \
    --priority $PRIORITY \
    --access Allow \
    --protocol Tcp \
    --direction Inbound \
    --source-address-prefixes ${WINTEHR_SECURITY_ALLOWED_IPS:-"*"} \
    --source-port-ranges "*" \
    --destination-address-prefixes "*" \
    --destination-port-ranges 22 \
    --description "SSH access" \
    &> /dev/null || echo "     (rule may already exist)"

PRIORITY=$((PRIORITY + 10))

# HTTP Access (port from config)
if [ "$WINTEHR_DEPLOYMENT_ENABLE_SSL" != "true" ] || [ "${WINTEHR_SERVICES_PORTS_NGINX_HTTP}" != "80" ]; then
    echo "  → HTTP (port ${WINTEHR_SERVICES_PORTS_NGINX_HTTP})"
    az network nsg rule create \
        --resource-group "$WINTEHR_AZURE_RESOURCE_GROUP" \
        --nsg-name "$WINTEHR_AZURE_NSG_NAME" \
        --name "Allow-HTTP" \
        --priority $PRIORITY \
        --access Allow \
        --protocol Tcp \
        --direction Inbound \
        --source-address-prefixes ${WINTEHR_SECURITY_ALLOWED_IPS:-"*"} \
        --source-port-ranges "*" \
        --destination-address-prefixes "*" \
        --destination-port-ranges ${WINTEHR_SERVICES_PORTS_NGINX_HTTP} \
        --description "HTTP access" \
        &> /dev/null || echo "     (rule may already exist)"

    PRIORITY=$((PRIORITY + 10))
fi

# HTTPS Access (port from config)
if [ "$WINTEHR_DEPLOYMENT_ENABLE_SSL" = "true" ]; then
    echo "  → HTTPS (port ${WINTEHR_SERVICES_PORTS_NGINX_HTTPS})"
    az network nsg rule create \
        --resource-group "$WINTEHR_AZURE_RESOURCE_GROUP" \
        --nsg-name "$WINTEHR_AZURE_NSG_NAME" \
        --name "Allow-HTTPS" \
        --priority $PRIORITY \
        --access Allow \
        --protocol Tcp \
        --direction Inbound \
        --source-address-prefixes ${WINTEHR_SECURITY_ALLOWED_IPS:-"*"} \
        --source-port-ranges "*" \
        --destination-address-prefixes "*" \
        --destination-port-ranges ${WINTEHR_SERVICES_PORTS_NGINX_HTTPS} \
        --description "HTTPS access" \
        &> /dev/null || echo "     (rule may already exist)"

    PRIORITY=$((PRIORITY + 10))
fi

echo -e "${GREEN}✅ NSG rules configured${NC}"
echo ""

# Display current rules
echo -e "${BLUE}📋 Current NSG Rules:${NC}"
az network nsg rule list \
    --resource-group "$WINTEHR_AZURE_RESOURCE_GROUP" \
    --nsg-name "$WINTEHR_AZURE_NSG_NAME" \
    --output table \
    --query "[?direction=='Inbound'].{Priority:priority, Name:name, Port:destinationPortRange, Access:access}"

echo ""
echo -e "${GREEN}✅ Azure NSG configuration complete${NC}"
