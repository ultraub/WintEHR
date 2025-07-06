#!/bin/bash
#
# Azure Deployment Script for EMR Training System
# Supports VM, Container Instances, and App Service deployments
#

set -e

# Configuration
RESOURCE_GROUP=${RESOURCE_GROUP:-emr-training-rg}
LOCATION=${LOCATION:-eastus}
DEPLOYMENT_TYPE=${1:-vm}  # vm, aci, or appservice
ACR_NAME=${ACR_NAME:-emrtraining$RANDOM}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🏥 EMR Training System - Azure Deployment${NC}"
echo "========================================="
echo "Deployment Type: $DEPLOYMENT_TYPE"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo ""

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo -e "${RED}Azure CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Login check
echo -e "${YELLOW}Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo "Please login to Azure:"
    az login
fi

# Create resource group
echo -e "${YELLOW}Creating resource group...${NC}"
az group create --name $RESOURCE_GROUP --location $LOCATION

# Function to build and push to ACR
push_to_acr() {
    echo -e "${YELLOW}Setting up Azure Container Registry...${NC}"
    
    # Create ACR
    az acr create --resource-group $RESOURCE_GROUP \
        --name $ACR_NAME --sku Basic --location $LOCATION
    
    # Enable admin user
    az acr update -n $ACR_NAME --admin-enabled true
    
    # Get credentials
    ACR_USERNAME=$(az acr credential show -n $ACR_NAME --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show -n $ACR_NAME --query passwords[0].value -o tsv)
    ACR_SERVER="$ACR_NAME.azurecr.io"
    
    # Login to ACR
    echo $ACR_PASSWORD | docker login $ACR_SERVER -u $ACR_USERNAME --password-stdin
    
    # Build and push image
    echo -e "${YELLOW}Building and pushing Docker image...${NC}"
    docker build -f Dockerfile.standalone -t emr-training:latest .
    docker tag emr-training:latest $ACR_SERVER/emr-training:latest
    docker push $ACR_SERVER/emr-training:latest
    
    echo -e "${GREEN}✓ Image pushed to ACR: $ACR_SERVER/emr-training:latest${NC}"
    echo "$ACR_SERVER|$ACR_USERNAME|$ACR_PASSWORD"
}

# VM Deployment
deploy_vm() {
    echo -e "${YELLOW}Deploying to Azure VM...${NC}"
    
    # Deploy ARM template
    az deployment group create \
        --resource-group $RESOURCE_GROUP \
        --template-file azure-deploy.json \
        --parameters \
            vmName=emr-training-vm \
            adminUsername=azureuser \
            authenticationType=password \
            adminPasswordOrKey="$(openssl rand -base64 32)" \
            vmSize=Standard_B2ms \
            patientCount=50 \
            allowedSourceIP="*"
    
    # Get outputs
    PUBLIC_IP=$(az deployment group show \
        -g $RESOURCE_GROUP -n azure-deploy \
        --query properties.outputs.publicIPAddress.value -o tsv)
    
    FQDN=$(az deployment group show \
        -g $RESOURCE_GROUP -n azure-deploy \
        --query properties.outputs.fqdn.value -o tsv)
    
    echo -e "${GREEN}✓ VM deployment complete!${NC}"
    echo ""
    echo "Access your EMR system at:"
    echo "  URL: http://$FQDN"
    echo "  IP: http://$PUBLIC_IP"
    echo ""
    echo "SSH access: ssh azureuser@$FQDN"
    echo ""
    echo "Note: Initial setup may take 10-15 minutes"
}

# Container Instances Deployment
deploy_aci() {
    echo -e "${YELLOW}Deploying to Azure Container Instances...${NC}"
    
    # Push to ACR first
    ACR_INFO=$(push_to_acr)
    IFS='|' read -r ACR_SERVER ACR_USERNAME ACR_PASSWORD <<< "$ACR_INFO"
    
    # Create container instance
    az container create \
        --resource-group $RESOURCE_GROUP \
        --name emr-training-aci \
        --image $ACR_SERVER/emr-training:latest \
        --registry-username $ACR_USERNAME \
        --registry-password $ACR_PASSWORD \
        --dns-name-label emr-training-$RANDOM \
        --ports 80 \
        --cpu 2 \
        --memory 4 \
        --environment-variables \
            PATIENT_COUNT=25 \
            SKIP_SYNTHEA=false \
            SKIP_IMPORT=false \
        --restart-policy OnFailure
    
    # Get FQDN
    FQDN=$(az container show \
        --resource-group $RESOURCE_GROUP \
        --name emr-training-aci \
        --query ipAddress.fqdn -o tsv)
    
    echo -e "${GREEN}✓ Container Instance deployment complete!${NC}"
    echo ""
    echo "Access your EMR system at: http://$FQDN"
    echo ""
    echo "View logs: az container logs -g $RESOURCE_GROUP -n emr-training-aci"
    echo "Note: Initial setup may take 10-15 minutes"
}

# App Service Deployment
deploy_appservice() {
    echo -e "${YELLOW}Deploying to Azure App Service...${NC}"
    
    # Push to ACR first
    ACR_INFO=$(push_to_acr)
    IFS='|' read -r ACR_SERVER ACR_USERNAME ACR_PASSWORD <<< "$ACR_INFO"
    
    # Create App Service Plan
    az appservice plan create \
        --name emr-training-plan \
        --resource-group $RESOURCE_GROUP \
        --sku B2 \
        --is-linux
    
    # Create Web App
    az webapp create \
        --resource-group $RESOURCE_GROUP \
        --plan emr-training-plan \
        --name emr-training-$RANDOM \
        --deployment-container-image-name $ACR_SERVER/emr-training:latest
    
    # Configure container settings
    az webapp config appsettings set \
        --resource-group $RESOURCE_GROUP \
        --name emr-training-$RANDOM \
        --settings \
            WEBSITES_PORT=80 \
            PATIENT_COUNT=25 \
            SKIP_SYNTHEA=false \
            SKIP_IMPORT=false
    
    # Configure ACR credentials
    az webapp config container set \
        --name emr-training-$RANDOM \
        --resource-group $RESOURCE_GROUP \
        --docker-custom-image-name $ACR_SERVER/emr-training:latest \
        --docker-registry-server-url https://$ACR_SERVER \
        --docker-registry-server-user $ACR_USERNAME \
        --docker-registry-server-password $ACR_PASSWORD
    
    # Get URL
    URL=$(az webapp show \
        --name emr-training-$RANDOM \
        --resource-group $RESOURCE_GROUP \
        --query defaultHostName -o tsv)
    
    echo -e "${GREEN}✓ App Service deployment complete!${NC}"
    echo ""
    echo "Access your EMR system at: https://$URL"
    echo ""
    echo "View logs: az webapp log tail -g $RESOURCE_GROUP -n emr-training-$RANDOM"
    echo "Note: Initial setup may take 10-15 minutes"
}

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Cleaning up resources...${NC}"
    read -p "Delete resource group $RESOURCE_GROUP? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        az group delete --name $RESOURCE_GROUP --yes
        echo -e "${GREEN}✓ Resources deleted${NC}"
    fi
}

# Main execution
case $DEPLOYMENT_TYPE in
    vm)
        deploy_vm
        ;;
    aci)
        deploy_aci
        ;;
    appservice)
        deploy_appservice
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo -e "${RED}Invalid deployment type: $DEPLOYMENT_TYPE${NC}"
        echo "Usage: $0 [vm|aci|appservice|cleanup]"
        echo ""
        echo "Options:"
        echo "  vm         - Deploy to Azure Virtual Machine (recommended)"
        echo "  aci        - Deploy to Azure Container Instances"
        echo "  appservice - Deploy to Azure App Service"
        echo "  cleanup    - Delete all resources"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✓ Deployment preparation complete!${NC}"
echo ""
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo ""
echo "To view all resources:"
echo "  az resource list -g $RESOURCE_GROUP -o table"
echo ""
echo "To cleanup resources:"
echo "  ./deploy-azure.sh cleanup"