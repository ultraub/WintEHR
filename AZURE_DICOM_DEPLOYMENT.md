# Azure DICOM Deployment Guide

This guide provides comprehensive instructions for deploying the EMR system with DICOM viewing capabilities on Microsoft Azure.

## Architecture Overview

The Azure deployment supports multiple architectures:
- **Azure Container Instances (ACI)**: Simple container deployment for development/testing
- **Azure Kubernetes Service (AKS)**: Production-ready container orchestration
- **Azure App Service**: Platform-as-a-Service for web applications
- **Azure Virtual Machines**: Traditional VM-based deployment

## Prerequisites

1. **Azure CLI**: Install from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
2. **Docker**: For building container images
3. **kubectl**: For AKS deployments
4. **Azure subscription**: With appropriate permissions

## Quick Setup

```bash
# Login to Azure
az login

# Set default subscription
az account set --subscription "your-subscription-id"

# Create resource group
az group create --name EMR-DICOM-RG --location eastus
```

## Deployment Option 1: Azure Container Instances (Recommended for Testing)

### Step 1: Create Azure Container Registry

```bash
# Create ACR
az acr create \
  --resource-group EMR-DICOM-RG \
  --name emrdicomregistry \
  --sku Basic \
  --admin-enabled true

# Get login server
ACR_LOGIN_SERVER=$(az acr show --name emrdicomregistry --query loginServer --output tsv)
echo "ACR Login Server: $ACR_LOGIN_SERVER"
```

### Step 2: Build and Push Images

```bash
# Login to ACR
az acr login --name emrdicomregistry

# Build and push backend
cd backend
docker build -t $ACR_LOGIN_SERVER/emr-backend:latest .
docker push $ACR_LOGIN_SERVER/emr-backend:latest

# Build and push frontend
cd ../frontend
docker build -t $ACR_LOGIN_SERVER/emr-frontend:latest .
docker push $ACR_LOGIN_SERVER/emr-frontend:latest
```

### Step 3: Create Azure File Share for DICOM Storage

```bash
# Create storage account
az storage account create \
  --name emrdicomstorage$(date +%s) \
  --resource-group EMR-DICOM-RG \
  --location eastus \
  --sku Standard_LRS

# Get storage account name and key
STORAGE_ACCOUNT=$(az storage account list --resource-group EMR-DICOM-RG --query '[0].name' -o tsv)
STORAGE_KEY=$(az storage account keys list \
  --resource-group EMR-DICOM-RG \
  --account-name $STORAGE_ACCOUNT \
  --query '[0].value' -o tsv)

# Create file shares
az storage share create \
  --name dicom-files \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY \
  --quota 100

az storage share create \
  --name emr-data \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY \
  --quota 50

az storage share create \
  --name emr-logs \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY \
  --quota 10
```

### Step 4: Deploy Container Instance

Create `azure-aci-deployment.yaml`:

```yaml
apiVersion: 2019-12-01
location: eastus
name: emr-dicom-container-group
properties:
  containers:
  - name: backend
    properties:
      image: emrdicomregistry.azurecr.io/emr-backend:latest
      resources:
        requests:
          cpu: 2
          memoryInGb: 4
      ports:
      - port: 8000
      environmentVariables:
      - name: DATABASE_URL
        value: sqlite:////app/data/emr.db
      - name: SECRET_KEY
        secureValue: your-secret-key-change-in-production
      - name: CORS_ORIGINS
        value: "http://localhost,https://*.azurecontainer.io"
      volumeMounts:
      - name: dicom-share
        mountPath: /app/uploads/dicom
      - name: data-share
        mountPath: /app/data
      - name: logs-share
        mountPath: /app/logs
  - name: frontend
    properties:
      image: emrdicomregistry.azurecr.io/emr-frontend:latest
      resources:
        requests:
          cpu: 1
          memoryInGb: 1
      ports:
      - port: 80
      environmentVariables:
      - name: REACT_APP_API_URL
        value: ""
  osType: Linux
  ipAddress:
    type: Public
    ports:
    - protocol: tcp
      port: 80
    - protocol: tcp
      port: 8000
    dnsNameLabel: emr-dicom-system
  imageRegistryCredentials:
  - server: emrdicomregistry.azurecr.io
    username: emrdicomregistry
    password: your-acr-password
  volumes:
  - name: dicom-share
    azureFile:
      shareName: dicom-files
      storageAccountName: ${STORAGE_ACCOUNT}
      storageAccountKey: ${STORAGE_KEY}
  - name: data-share
    azureFile:
      shareName: emr-data
      storageAccountName: ${STORAGE_ACCOUNT}
      storageAccountKey: ${STORAGE_KEY}
  - name: logs-share
    azureFile:
      shareName: emr-logs
      storageAccountName: ${STORAGE_ACCOUNT}
      storageAccountKey: ${STORAGE_KEY}
```

Deploy the container group:

```bash
# Get ACR password
ACR_PASSWORD=$(az acr credential show --name emrdicomregistry --query passwords[0].value -o tsv)

# Replace variables in YAML and deploy
envsubst < azure-aci-deployment.yaml > azure-aci-deployment-final.yaml
az container create --resource-group EMR-DICOM-RG --file azure-aci-deployment-final.yaml
```

## Deployment Option 2: Azure Kubernetes Service (Production)

### Step 1: Create AKS Cluster

```bash
# Create AKS cluster with managed identity
az aks create \
  --resource-group EMR-DICOM-RG \
  --name EMR-DICOM-Cluster \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-addons monitoring \
  --generate-ssh-keys \
  --enable-managed-identity

# Get credentials
az aks get-credentials --resource-group EMR-DICOM-RG --name EMR-DICOM-Cluster

# Attach ACR to AKS
az aks update -n EMR-DICOM-Cluster -g EMR-DICOM-RG --attach-acr emrdicomregistry
```

### Step 2: Create Storage Class for Azure Files

Create `azure-files-sc.yaml`:

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: azurefile
provisioner: kubernetes.io/azure-file
mountOptions:
  - dir_mode=0777
  - file_mode=0777
  - uid=0
  - gid=0
  - mfsymlinks
  - cache=strict
parameters:
  skuName: Standard_LRS
  storageAccount: ${STORAGE_ACCOUNT}
```

### Step 3: Create Persistent Volume Claims

Create `pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dicom-pvc
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: azurefile
  resources:
    requests:
      storage: 500Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-pvc
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: azurefile
  resources:
    requests:
      storage: 100Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: logs-pvc
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: azurefile
  resources:
    requests:
      storage: 50Gi
```

### Step 4: Create Kubernetes Deployment

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: emr-backend
  labels:
    app: emr-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: emr-backend
  template:
    metadata:
      labels:
        app: emr-backend
    spec:
      containers:
      - name: backend
        image: emrdicomregistry.azurecr.io/emr-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          value: "sqlite:////app/data/emr.db"
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: emr-secrets
              key: secret-key
        - name: CORS_ORIGINS
          value: "http://localhost,https://*.azurecontainer.io,https://*.azure.com"
        volumeMounts:
        - name: dicom-storage
          mountPath: /app/uploads/dicom
        - name: data-storage
          mountPath: /app/data
        - name: logs-storage
          mountPath: /app/logs
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: dicom-storage
        persistentVolumeClaim:
          claimName: dicom-pvc
      - name: data-storage
        persistentVolumeClaim:
          claimName: data-pvc
      - name: logs-storage
        persistentVolumeClaim:
          claimName: logs-pvc
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: emr-frontend
  labels:
    app: emr-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: emr-frontend
  template:
    metadata:
      labels:
        app: emr-frontend
    spec:
      containers:
      - name: frontend
        image: emrdicomregistry.azurecr.io/emr-frontend:latest
        ports:
        - containerPort: 80
        env:
        - name: REACT_APP_API_URL
          value: ""
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: emr-backend-service
spec:
  selector:
    app: emr-backend
  ports:
    - protocol: TCP
      port: 8000
      targetPort: 8000
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: emr-frontend-service
spec:
  type: LoadBalancer
  selector:
    app: emr-frontend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
---
apiVersion: v1
kind: Secret
metadata:
  name: emr-secrets
type: Opaque
data:
  secret-key: eW91ci1zZWNyZXQta2V5LWNoYW5nZS1pbi1wcm9kdWN0aW9u # base64 encoded
```

### Step 5: Deploy to AKS

```bash
# Apply storage class and PVCs
kubectl apply -f azure-files-sc.yaml
kubectl apply -f pvc.yaml

# Wait for PVCs to be bound
kubectl get pvc

# Deploy application
kubectl apply -f k8s-deployment.yaml

# Get external IP
kubectl get service emr-frontend-service
```

## Deployment Option 3: Azure App Service

### Step 1: Create App Service Plan

```bash
# Create App Service Plan
az appservice plan create \
  --name EMR-DICOM-Plan \
  --resource-group EMR-DICOM-RG \
  --sku P2V2 \
  --is-linux

# Create backend web app
az webapp create \
  --resource-group EMR-DICOM-RG \
  --plan EMR-DICOM-Plan \
  --name emr-dicom-backend \
  --deployment-container-image-name emrdicomregistry.azurecr.io/emr-backend:latest

# Create frontend web app
az webapp create \
  --resource-group EMR-DICOM-RG \
  --plan EMR-DICOM-Plan \
  --name emr-dicom-frontend \
  --deployment-container-image-name emrdicomregistry.azurecr.io/emr-frontend:latest
```

### Step 2: Configure App Settings

```bash
# Configure backend settings
az webapp config appsettings set \
  --resource-group EMR-DICOM-RG \
  --name emr-dicom-backend \
  --settings \
    DATABASE_URL="sqlite:////home/data/emr.db" \
    SECRET_KEY="your-secret-key-change-in-production" \
    CORS_ORIGINS="https://emr-dicom-frontend.azurewebsites.net"

# Configure frontend settings
az webapp config appsettings set \
  --resource-group EMR-DICOM-RG \
  --name emr-dicom-frontend \
  --settings \
    REACT_APP_API_URL="https://emr-dicom-backend.azurewebsites.net"

# Configure ACR credentials for both apps
az webapp config container set \
  --resource-group EMR-DICOM-RG \
  --name emr-dicom-backend \
  --docker-custom-image-name emrdicomregistry.azurecr.io/emr-backend:latest \
  --docker-registry-server-url https://emrdicomregistry.azurecr.io \
  --docker-registry-server-user emrdicomregistry \
  --docker-registry-server-password $ACR_PASSWORD

az webapp config container set \
  --resource-group EMR-DICOM-RG \
  --name emr-dicom-frontend \
  --docker-custom-image-name emrdicomregistry.azurecr.io/emr-frontend:latest \
  --docker-registry-server-url https://emrdicomregistry.azurecr.io \
  --docker-registry-server-user emrdicomregistry \
  --docker-registry-server-password $ACR_PASSWORD
```

### Step 3: Mount Azure File Share

```bash
# Mount file share for DICOM storage
az webapp config storage-account add \
  --resource-group EMR-DICOM-RG \
  --name emr-dicom-backend \
  --custom-id dicom-storage \
  --storage-type AzureFiles \
  --account-name $STORAGE_ACCOUNT \
  --share-name dicom-files \
  --access-key $STORAGE_KEY \
  --mount-path /app/uploads/dicom

# Mount file share for data
az webapp config storage-account add \
  --resource-group EMR-DICOM-RG \
  --name emr-dicom-backend \
  --custom-id data-storage \
  --storage-type AzureFiles \
  --account-name $STORAGE_ACCOUNT \
  --share-name emr-data \
  --access-key $STORAGE_KEY \
  --mount-path /app/data
```

## Security Configuration

### Network Security

```bash
# Create Virtual Network
az network vnet create \
  --resource-group EMR-DICOM-RG \
  --name EMR-VNet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name default \
  --subnet-prefix 10.0.1.0/24

# Create Network Security Group
az network nsg create \
  --resource-group EMR-DICOM-RG \
  --name EMR-NSG

# Allow HTTP and HTTPS
az network nsg rule create \
  --resource-group EMR-DICOM-RG \
  --nsg-name EMR-NSG \
  --name AllowHTTP \
  --priority 100 \
  --source-address-prefixes '*' \
  --destination-port-ranges 80 \
  --access Allow

az network nsg rule create \
  --resource-group EMR-DICOM-RG \
  --nsg-name EMR-NSG \
  --name AllowHTTPS \
  --priority 101 \
  --source-address-prefixes '*' \
  --destination-port-ranges 443 \
  --access Allow

# Allow backend API (restrict to known sources in production)
az network nsg rule create \
  --resource-group EMR-DICOM-RG \
  --nsg-name EMR-NSG \
  --name AllowAPI \
  --priority 102 \
  --source-address-prefixes '*' \
  --destination-port-ranges 8000 \
  --access Allow
```

### SSL/TLS Configuration

For AKS with ingress controller:

```bash
# Install nginx ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.0.0/deploy/static/provider/cloud/deploy.yaml

# Install cert-manager
kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.5.3/cert-manager.yaml
```

Create `ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: emr-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  tls:
  - hosts:
    - emr.yourdomain.com
    secretName: emr-tls
  rules:
  - host: emr.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: emr-backend-service
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: emr-frontend-service
            port:
              number: 80
```

## Monitoring and Logging

### Azure Monitor Integration

```bash
# Enable monitoring for AKS
az aks enable-addons \
  --resource-group EMR-DICOM-RG \
  --name EMR-DICOM-Cluster \
  --addons monitoring

# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group EMR-DICOM-RG \
  --workspace-name EMR-DICOM-Workspace \
  --location eastus
```

### Application Insights

```bash
# Create Application Insights
az extension add -n application-insights
az monitor app-insights component create \
  --app EMR-DICOM-Insights \
  --location eastus \
  --resource-group EMR-DICOM-RG \
  --application-type web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app EMR-DICOM-Insights \
  --resource-group EMR-DICOM-RG \
  --query instrumentationKey -o tsv)
```

### Alert Rules

Create storage usage alerts:

```bash
# Alert when DICOM storage exceeds 80%
az monitor metrics alert create \
  --name "DICOM Storage High Usage" \
  --resource-group EMR-DICOM-RG \
  --scopes "/subscriptions/{subscription-id}/resourceGroups/EMR-DICOM-RG/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT" \
  --condition "avg UsedCapacity > 800000000000" \
  --description "Alert when DICOM storage exceeds 80% of 1TB" \
  --evaluation-frequency 5m \
  --window-size 15m \
  --severity 2
```

## Backup and Disaster Recovery

### Azure Backup

```bash
# Create Recovery Services vault
az backup vault create \
  --resource-group EMR-DICOM-RG \
  --name EMR-DICOM-Vault \
  --location eastus

# Enable backup for file shares
az backup protection enable-for-azurefileshare \
  --vault-name EMR-DICOM-Vault \
  --resource-group EMR-DICOM-RG \
  --policy-name DefaultPolicy \
  --storage-account $STORAGE_ACCOUNT \
  --azure-file-share dicom-files
```

### Automated Backups

Create backup script:

```bash
#!/bin/bash
# backup-dicom.sh

RESOURCE_GROUP="EMR-DICOM-RG"
STORAGE_ACCOUNT=$(az storage account list --resource-group $RESOURCE_GROUP --query '[0].name' -o tsv)
BACKUP_CONTAINER="dicom-backup"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup container if it doesn't exist
az storage container create \
  --name $BACKUP_CONTAINER \
  --account-name $STORAGE_ACCOUNT

# Copy DICOM files to backup location
az storage blob sync \
  --source-container dicom-files \
  --destination-container $BACKUP_CONTAINER/$DATE \
  --account-name $STORAGE_ACCOUNT

echo "Backup completed: $BACKUP_CONTAINER/$DATE"
```

## Performance Optimization

### CDN Configuration

```bash
# Create CDN profile
az cdn profile create \
  --resource-group EMR-DICOM-RG \
  --name EMR-DICOM-CDN \
  --sku Standard_Microsoft

# Create CDN endpoint
az cdn endpoint create \
  --resource-group EMR-DICOM-RG \
  --profile-name EMR-DICOM-CDN \
  --name emr-dicom-endpoint \
  --origin emr-dicom-frontend.azurewebsites.net \
  --origin-host-header emr-dicom-frontend.azurewebsites.net
```

### Azure Cache for Redis

```bash
# Create Redis cache for DICOM metadata
az redis create \
  --resource-group EMR-DICOM-RG \
  --name emr-dicom-cache \
  --location eastus \
  --sku Basic \
  --vm-size c0

# Get Redis connection string
REDIS_KEY=$(az redis list-keys \
  --resource-group EMR-DICOM-RG \
  --name emr-dicom-cache \
  --query primaryKey -o tsv)

echo "Redis connection: emr-dicom-cache.redis.cache.windows.net:6380,password=$REDIS_KEY,ssl=True"
```

## Cost Optimization

### Resource Tagging

```bash
# Tag all resources for cost tracking
az group update \
  --name EMR-DICOM-RG \
  --tags Environment=Production Project=EMR-DICOM Owner=HealthcareIT

# Tag storage account
az storage account update \
  --name $STORAGE_ACCOUNT \
  --resource-group EMR-DICOM-RG \
  --tags Environment=Production Project=EMR-DICOM DataType=DICOM
```

### Auto-scaling Configuration

For AKS:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: emr-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: emr-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Troubleshooting

### Common Issues

1. **Container startup failures**:
```bash
# Check container logs
az container logs --resource-group EMR-DICOM-RG --name emr-dicom-container-group --container-name backend

# For AKS
kubectl logs deployment/emr-backend
```

2. **Storage access issues**:
```bash
# Verify file share connectivity
az storage file list \
  --share-name dicom-files \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY
```

3. **Network connectivity**:
```bash
# Test endpoint accessibility
curl -I https://emr-dicom-backend.azurewebsites.net/api/health
```

### Debug Commands

```bash
# Check resource status
az resource list --resource-group EMR-DICOM-RG --output table

# Monitor container metrics
az monitor metrics list \
  --resource "/subscriptions/{subscription-id}/resourceGroups/EMR-DICOM-RG/providers/Microsoft.ContainerInstance/containerGroups/emr-dicom-container-group" \
  --metric "CpuUsage,MemoryUsage"

# View activity log
az monitor activity-log list \
  --resource-group EMR-DICOM-RG \
  --max-events 50
```

## Maintenance Checklist

### Weekly Tasks
- [ ] Review Azure cost analysis
- [ ] Check storage usage and growth trends
- [ ] Monitor application performance metrics
- [ ] Review security alerts and logs

### Monthly Tasks
- [ ] Update container images
- [ ] Review and rotate secrets
- [ ] Test backup and restore procedures
- [ ] Security patching for infrastructure

### Quarterly Tasks
- [ ] Review resource sizing and optimization
- [ ] Update disaster recovery procedures
- [ ] Security audit and compliance review
- [ ] Capacity planning review

## Support and Documentation

- **Azure Documentation**: https://docs.microsoft.com/en-us/azure/
- **AKS Documentation**: https://docs.microsoft.com/en-us/azure/aks/
- **Container Instances**: https://docs.microsoft.com/en-us/azure/container-instances/
- **Azure Monitor**: https://docs.microsoft.com/en-us/azure/azure-monitor/

For EMR-specific DICOM issues, refer to the main DICOM_DEPLOYMENT_GUIDE.md file.