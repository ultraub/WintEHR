# DICOM Viewer Deployment Guide

This guide covers deploying the EMR system with full DICOM viewing capabilities on local environments, AWS, and Azure.

## Overview

The EMR system now includes a full DICOM viewer with the following features:
- WADO-URI compliant image serving
- Real-time DICOM file upload and processing
- Multi-frame image navigation
- Window/Level adjustments
- Measurement tools (length, angle, ROI)
- Persistent storage of DICOM files

## Prerequisites

- Docker and Docker Compose
- Python 3.9+ (for local development)
- Node.js 18+ (for local development)
- AWS CLI (for AWS deployment)
- Azure CLI (for Azure deployment)

## Local Deployment

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd EMR
```

2. Create necessary directories:
```bash
mkdir -p backend/uploads/dicom
mkdir -p backend/data
mkdir -p backend/logs
```

3. Start the services:
```bash
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Manual Setup

1. Backend setup:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
mkdir -p uploads/dicom data logs
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. Frontend setup:
```bash
cd frontend
npm install
npm start
```

## AWS Deployment

### Using EC2 with Docker

1. Launch an EC2 instance:
```bash
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxx \
  --subnet-id subnet-xxxxxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=EMR-DICOM-Server}]'
```

2. Configure security group:
```bash
# Allow HTTP, HTTPS, and backend API
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0
```

3. SSH into the instance and deploy:
```bash
ssh -i your-key.pem ec2-user@<instance-ip>

# Install Docker
sudo yum update -y
sudo yum install -y docker git
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone and deploy
git clone <repository-url>
cd EMR
docker-compose up -d
```

### Using ECS with Fargate

1. Create ECR repositories:
```bash
aws ecr create-repository --repository-name emr-backend
aws ecr create-repository --repository-name emr-frontend
```

2. Build and push images:
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push backend
cd backend
docker build -t emr-backend .
docker tag emr-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/emr-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/emr-backend:latest

# Build and push frontend
cd ../frontend
docker build -t emr-frontend .
docker tag emr-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/emr-frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/emr-frontend:latest
```

3. Create ECS task definition (save as `ecs-task-definition.json`):
```json
{
  "family": "emr-dicom",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/emr-backend:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "sqlite:////app/data/emr.db"
        }
      ],
      "mountPoints": [
        {
          "sourceVolume": "dicom-storage",
          "containerPath": "/app/uploads/dicom"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/emr-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    },
    {
      "name": "frontend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/emr-frontend:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "dependsOn": [
        {
          "containerName": "backend",
          "condition": "HEALTHY"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/emr-frontend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "volumes": [
    {
      "name": "dicom-storage",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-xxxxxxxx",
        "rootDirectory": "/dicom"
      }
    }
  ]
}
```

4. Create EFS for DICOM storage:
```bash
aws efs create-file-system --creation-token emr-dicom-storage --tags "Key=Name,Value=EMR-DICOM-Storage"
```

5. Deploy to ECS:
```bash
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json
aws ecs create-service \
  --cluster your-cluster \
  --service-name emr-dicom \
  --task-definition emr-dicom:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxxxxx],securityGroups=[sg-xxxxxxxx],assignPublicIp=ENABLED}"
```

## Azure Deployment

### Using Azure Container Instances

1. Create a resource group:
```bash
az group create --name EMR-DICOM-RG --location eastus
```

2. Create Azure File Share for DICOM storage:
```bash
# Create storage account
az storage account create \
  --name emrdicomstorage \
  --resource-group EMR-DICOM-RG \
  --location eastus \
  --sku Standard_LRS

# Get storage key
STORAGE_KEY=$(az storage account keys list \
  --resource-group EMR-DICOM-RG \
  --account-name emrdicomstorage \
  --query '[0].value' \
  --output tsv)

# Create file share
az storage share create \
  --name dicom-files \
  --account-name emrdicomstorage \
  --account-key $STORAGE_KEY \
  --quota 100
```

3. Create container instance (save as `azure-container.yaml`):
```yaml
apiVersion: 2019-12-01
location: eastus
name: emr-dicom-container-group
properties:
  containers:
  - name: backend
    properties:
      image: emrbackend.azurecr.io/emr-backend:latest
      resources:
        requests:
          cpu: 1
          memoryInGb: 1.5
      ports:
      - port: 8000
      environmentVariables:
      - name: DATABASE_URL
        value: sqlite:////app/data/emr.db
      volumeMounts:
      - name: dicom-share
        mountPath: /app/uploads/dicom
  - name: frontend
    properties:
      image: emrfrontend.azurecr.io/emr-frontend:latest
      resources:
        requests:
          cpu: 0.5
          memoryInGb: 0.5
      ports:
      - port: 80
  osType: Linux
  ipAddress:
    type: Public
    ports:
    - protocol: tcp
      port: 80
    - protocol: tcp
      port: 8000
  volumes:
  - name: dicom-share
    azureFile:
      shareName: dicom-files
      storageAccountName: emrdicomstorage
      storageAccountKey: <storage-key>
```

4. Deploy the container group:
```bash
az container create --resource-group EMR-DICOM-RG --file azure-container.yaml
```

### Using Azure Kubernetes Service (AKS)

1. Create AKS cluster:
```bash
az aks create \
  --resource-group EMR-DICOM-RG \
  --name EMR-DICOM-Cluster \
  --node-count 2 \
  --enable-addons monitoring \
  --generate-ssh-keys
```

2. Get credentials:
```bash
az aks get-credentials --resource-group EMR-DICOM-RG --name EMR-DICOM-Cluster
```

3. Create Kubernetes deployment (save as `k8s-deployment.yaml`):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: emr-backend
spec:
  replicas: 2
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
        image: emrbackend.azurecr.io/emr-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          value: "sqlite:////app/data/emr.db"
        volumeMounts:
        - name: dicom-storage
          mountPath: /app/uploads/dicom
      volumes:
      - name: dicom-storage
        persistentVolumeClaim:
          claimName: dicom-pvc
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: emr-frontend
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
        image: emrfrontend.azurecr.io/emr-frontend:latest
        ports:
        - containerPort: 80
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
kind: PersistentVolumeClaim
metadata:
  name: dicom-pvc
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: azurefile
  resources:
    requests:
      storage: 100Gi
```

4. Deploy to AKS:
```bash
kubectl apply -f k8s-deployment.yaml
```

## DICOM Storage Considerations

### Storage Requirements

- **Local Development**: Uses Docker volumes, minimal setup required
- **AWS**: 
  - EC2: Use EBS volumes for persistent storage
  - ECS: Use EFS for shared storage across containers
  - S3: Consider S3 for long-term archival with lifecycle policies
- **Azure**:
  - Azure Files for container instances
  - Azure Blob Storage for long-term archival
  - Managed disks for VMs

### Backup Strategies

1. **AWS Backup**:
```bash
# Create EBS snapshot
aws ec2 create-snapshot --volume-id vol-xxxxxxxx --description "EMR DICOM Backup"

# S3 sync for archival
aws s3 sync /app/uploads/dicom s3://emr-dicom-backup/$(date +%Y%m%d)/
```

2. **Azure Backup**:
```bash
# Create file share snapshot
az storage share snapshot --name dicom-files --account-name emrdicomstorage

# Blob storage sync
az storage blob sync -s /app/uploads/dicom -c dicom-backup --account-name emrdicomstorage
```

## Security Considerations

### DICOM Data Security

1. **Encryption at Rest**:
   - Enable encryption on all storage volumes
   - Use managed keys or customer-managed keys

2. **Encryption in Transit**:
   - Always use HTTPS for web traffic
   - Consider VPN for sensitive environments

3. **Access Control**:
   - Implement role-based access control (RBAC)
   - Audit all DICOM file access
   - Use signed URLs for temporary access

### Network Security

1. **AWS Security Groups**:
```bash
# Restrict backend access to frontend only
aws ec2 authorize-security-group-ingress \
  --group-id sg-backend \
  --protocol tcp \
  --port 8000 \
  --source-group sg-frontend
```

2. **Azure Network Security Groups**:
```bash
# Create NSG rule
az network nsg rule create \
  --resource-group EMR-DICOM-RG \
  --nsg-name EMR-NSG \
  --name AllowFrontendToBackend \
  --priority 100 \
  --source-address-prefixes VirtualNetwork \
  --destination-port-ranges 8000 \
  --access Allow
```

## Monitoring and Logging

### AWS CloudWatch

1. Create log groups:
```bash
aws logs create-log-group --log-group-name /aws/emr/backend
aws logs create-log-group --log-group-name /aws/emr/frontend
```

2. Set up alarms:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name emr-dicom-storage-usage \
  --alarm-description "Alert when DICOM storage exceeds 80%" \
  --metric-name VolumeUtilization \
  --namespace AWS/EBS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

### Azure Monitor

1. Enable diagnostics:
```bash
az monitor diagnostic-settings create \
  --name emr-diagnostics \
  --resource /subscriptions/.../resourceGroups/EMR-DICOM-RG/providers/Microsoft.ContainerInstance/containerGroups/emr-dicom-container-group \
  --logs '[{"category": "ContainerInstanceLog", "enabled": true}]' \
  --workspace /subscriptions/.../resourceGroups/EMR-DICOM-RG/providers/Microsoft.OperationalInsights/workspaces/emr-workspace
```

## Performance Optimization

### DICOM Loading Performance

1. **Enable caching**:
   - Use Redis for metadata caching
   - Implement browser caching for viewed images

2. **Image preprocessing**:
   - Generate thumbnails on upload
   - Pre-calculate common window/level presets

3. **CDN Integration**:
   - AWS CloudFront for global distribution
   - Azure CDN for improved latency

### Database Optimization

For production deployments with high DICOM volume:

1. **Migrate from SQLite to PostgreSQL**:
```bash
# Update DATABASE_URL
DATABASE_URL=postgresql://user:password@db-host:5432/emr_db
```

2. **Add database indices**:
```sql
CREATE INDEX idx_dicom_study_patient ON dicom_study(patient_id);
CREATE INDEX idx_dicom_instance_series ON dicom_instance(series_id);
CREATE INDEX idx_dicom_study_date ON dicom_study(study_date);
```

## Troubleshooting

### Common Issues

1. **DICOM upload fails**:
   - Check file permissions on upload directory
   - Verify sufficient disk space
   - Check DICOM file validity

2. **Viewer shows black screen**:
   - Verify WADO endpoint accessibility
   - Check browser console for CORS errors
   - Ensure image format is supported

3. **Performance issues**:
   - Monitor disk I/O
   - Check network latency
   - Review container resource limits

### Debug Commands

```bash
# Check DICOM storage usage
docker exec emr-backend df -h /app/uploads/dicom

# View recent uploads
docker exec emr-backend ls -la /app/uploads/dicom/

# Check backend logs for DICOM errors
docker logs emr-backend | grep -i dicom

# Test WADO endpoint
curl http://localhost:8000/api/imaging/wado/studies/1/series
```

## Maintenance

### Regular Tasks

1. **Weekly**:
   - Review DICOM storage usage
   - Check for failed uploads
   - Monitor performance metrics

2. **Monthly**:
   - Archive old studies to cold storage
   - Update security patches
   - Review access logs

3. **Quarterly**:
   - Performance optimization review
   - Storage capacity planning
   - Security audit

## Support

For issues specific to DICOM functionality:
1. Check backend logs for detailed error messages
2. Verify DICOM file format compliance
3. Test with sample DICOM files from the `backend/sample_dicoms` directory
4. Review browser console for client-side errors

For deployment issues:
1. Verify all environment variables are set correctly
2. Check network connectivity between services
3. Ensure sufficient resources (CPU, memory, storage)
4. Review cloud provider service limits