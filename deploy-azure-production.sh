#!/bin/bash

# Teaching EMR System - Azure Production Deployment Script
# Supports 100+ patients with full Synthea data integration

set -e

# Default values
RESOURCE_GROUP="${RESOURCE_GROUP:-emr-production-rg}"
LOCATION="${LOCATION:-eastus}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-emr-production-deployment}"
VM_NAME="${VM_NAME:-emr-production-vm}"
ADMIN_USERNAME="${ADMIN_USERNAME:-emradmin}"
VM_SIZE="${VM_SIZE:-Standard_D4s_v3}"
DEPLOYMENT_PROFILE="${DEPLOYMENT_PROFILE:-production}"
TEMPLATE_FILE="${TEMPLATE_FILE:-azure-deploy-production.json}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Teaching EMR System - Azure Production Deployment${NC}"
echo -e "${GREEN}================================================${NC}"

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -g, --resource-group    Resource group name (default: $RESOURCE_GROUP)"
    echo "  -l, --location         Azure region (default: $LOCATION)"
    echo "  -n, --vm-name          VM name (default: $VM_NAME)"
    echo "  -u, --username         Admin username (default: $ADMIN_USERNAME)"
    echo "  -s, --vm-size          VM size (default: $VM_SIZE)"
    echo "  -p, --profile          Deployment profile (default: $DEPLOYMENT_PROFILE)"
    echo "  -k, --ssh-key          Path to SSH public key file"
    echo "  -d, --domain           Custom domain name (for HTTPS)"
    echo "  -h, --help            Display this help message"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -l|--location)
            LOCATION="$2"
            shift 2
            ;;
        -n|--vm-name)
            VM_NAME="$2"
            shift 2
            ;;
        -u|--username)
            ADMIN_USERNAME="$2"
            shift 2
            ;;
        -s|--vm-size)
            VM_SIZE="$2"
            shift 2
            ;;
        -p|--profile)
            DEPLOYMENT_PROFILE="$2"
            shift 2
            ;;
        -k|--ssh-key)
            SSH_KEY_FILE="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN_NAME="$2"
            ENABLE_HTTPS="true"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        echo -e "${RED}Azure CLI not found. Please install it first.${NC}"
        echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        echo -e "${RED}Not logged in to Azure. Please run 'az login' first.${NC}"
        exit 1
    fi
    
    # Check template file
    if [ ! -f "$TEMPLATE_FILE" ]; then
        echo -e "${RED}Template file not found: $TEMPLATE_FILE${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Prerequisites check passed.${NC}"
}

# Set authentication type and credentials
setup_credentials() {
    if [ -n "$SSH_KEY_FILE" ] && [ -f "$SSH_KEY_FILE" ]; then
        echo -e "${YELLOW}Using SSH key authentication${NC}"
        AUTH_TYPE="sshPublicKey"
        ADMIN_CREDENTIAL=$(cat "$SSH_KEY_FILE")
    else
        echo -e "${YELLOW}Using password authentication${NC}"
        AUTH_TYPE="password"
        
        # Prompt for password
        echo -n "Enter admin password: "
        read -s ADMIN_PASSWORD
        echo
        echo -n "Confirm admin password: "
        read -s ADMIN_PASSWORD_CONFIRM
        echo
        
        if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; then
            echo -e "${RED}Passwords do not match!${NC}"
            exit 1
        fi
        
        ADMIN_CREDENTIAL="$ADMIN_PASSWORD"
    fi
}

# Create resource group
create_resource_group() {
    echo -e "${YELLOW}Creating resource group...${NC}"
    
    if az group exists --name "$RESOURCE_GROUP" | grep -q true; then
        echo -e "${YELLOW}Resource group already exists: $RESOURCE_GROUP${NC}"
    else
        az group create \
            --name "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --output none
        echo -e "${GREEN}Resource group created: $RESOURCE_GROUP${NC}"
    fi
}

# Deploy template
deploy_template() {
    echo -e "${YELLOW}Deploying EMR system...${NC}"
    echo -e "${YELLOW}This may take 15-20 minutes...${NC}"
    
    # Build parameters
    PARAMETERS="{
        \"vmName\": {\"value\": \"$VM_NAME\"},
        \"adminUsername\": {\"value\": \"$ADMIN_USERNAME\"},
        \"authenticationType\": {\"value\": \"$AUTH_TYPE\"},
        \"adminPasswordOrKey\": {\"value\": \"$ADMIN_CREDENTIAL\"},
        \"vmSize\": {\"value\": \"$VM_SIZE\"},
        \"deploymentProfile\": {\"value\": \"$DEPLOYMENT_PROFILE\"}
    }"
    
    # Add optional parameters
    if [ -n "$DOMAIN_NAME" ]; then
        PARAMETERS=$(echo "$PARAMETERS" | jq ". + {
            \"enableHttps\": {\"value\": true},
            \"domainName\": {\"value\": \"$DOMAIN_NAME\"}
        }")
    fi
    
    # Deploy
    DEPLOYMENT_OUTPUT=$(az deployment group create \
        --name "$DEPLOYMENT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --template-file "$TEMPLATE_FILE" \
        --parameters "$PARAMETERS" \
        --output json)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Deployment completed successfully!${NC}"
    else
        echo -e "${RED}Deployment failed!${NC}"
        exit 1
    fi
}

# Get deployment outputs
get_outputs() {
    echo -e "${YELLOW}Getting deployment outputs...${NC}"
    
    VM_IP=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.vmPublicIpAddress.value')
    VM_FQDN=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.vmFqdn.value')
    EMR_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.emrUrl.value')
    SSH_COMMAND=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.sshCommand.value')
    STORAGE_ACCOUNT=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.storageAccountName.value')
}

# Wait for deployment to complete
wait_for_deployment() {
    echo -e "${YELLOW}Waiting for EMR system to be ready...${NC}"
    
    MAX_ATTEMPTS=30
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f -s "$EMR_URL/api/health" &>/dev/null; then
            echo -e "${GREEN}EMR system is ready!${NC}"
            return 0
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
        echo "Waiting for system to start... ($ATTEMPT/$MAX_ATTEMPTS)"
        sleep 30
    done
    
    echo -e "${YELLOW}System may still be starting. You can check the status manually.${NC}"
}

# Save deployment information
save_deployment_info() {
    cat > azure-deployment-info.json << EOF
{
  "resourceGroup": "$RESOURCE_GROUP",
  "location": "$LOCATION",
  "vmName": "$VM_NAME",
  "vmSize": "$VM_SIZE",
  "publicIpAddress": "$VM_IP",
  "fqdn": "$VM_FQDN",
  "emrUrl": "$EMR_URL",
  "sshCommand": "$SSH_COMMAND",
  "storageAccount": "$STORAGE_ACCOUNT",
  "deploymentProfile": "$DEPLOYMENT_PROFILE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    echo -e "${GREEN}Deployment info saved to azure-deployment-info.json${NC}"
}

# Main execution
main() {
    check_prerequisites
    setup_credentials
    create_resource_group
    deploy_template
    get_outputs
    wait_for_deployment
    save_deployment_info
    
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}Deployment Summary:${NC}"
    echo -e "${GREEN}Resource Group: $RESOURCE_GROUP${NC}"
    echo -e "${GREEN}VM Name: $VM_NAME${NC}"
    echo -e "${GREEN}Public IP: $VM_IP${NC}"
    echo -e "${GREEN}FQDN: $VM_FQDN${NC}"
    echo -e "${GREEN}EMR URL: $EMR_URL${NC}"
    echo -e "${GREEN}SSH: $SSH_COMMAND${NC}"
    echo -e "${GREEN}Storage Account: $STORAGE_ACCOUNT${NC}"
    echo -e "${GREEN}================================================${NC}"
    
    if [ "$AUTH_TYPE" == "password" ]; then
        echo -e "${YELLOW}Note: Remember your admin password for SSH access${NC}"
    fi
    
    echo -e "${GREEN}You can now access the EMR system at: $EMR_URL${NC}"
    echo -e "${GREEN}Default credentials are available in the provider dropdown${NC}"
}

# Run main function
main