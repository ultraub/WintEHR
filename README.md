# EMR Training System

A comprehensive Electronic Medical Records (EMR) training system with FHIR R4 support, synthetic patient generation, and Clinical Decision Support (CDS) Hooks integration.

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd emr-training-system
   ```

2. **Run the setup script**
   ```bash
   ./setup_emr_system.sh
   ```

3. **Access the system**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Docker Deployment

```bash
docker-compose -f docker-compose.standalone.yml up -d
```

Access the system at http://localhost

## 🌟 Features

- **Patient Management**: Create, read, update patient records
- **Clinical Workspace**: View medications, conditions, vitals, and clinical notes
- **FHIR R4 Compliance**: Full support for FHIR resources
- **CDS Hooks**: Clinical decision support integration
- **Synthetic Data**: Automated generation of realistic patient data using Synthea
- **Provider Management**: Multiple provider support with patient assignment

## 📁 Architecture

```
emr-training-system/
├── backend/               # FastAPI backend application
│   ├── api/              # API endpoints and routers
│   ├── models/           # SQLAlchemy database models
│   ├── schemas/          # Pydantic schemas
│   └── scripts/          # Utility scripts
├── frontend/             # React frontend application
│   ├── public/          # Static assets
│   └── src/             # React components
├── synthea/             # Synthetic patient data generator
└── deployment/          # Deployment configurations
```

## 🔧 System Requirements

- Python 3.9+
- Node.js 18+
- Java 8+ (for Synthea)
- 4GB RAM minimum
- 10GB disk space

## 📦 Dependencies

### Backend
- FastAPI 0.104.1
- Pydantic 2.5.0
- SQLAlchemy 2.0.23
- FHIR Resources 6.5.0

### Frontend
- React 18.2.0
- Material-UI 5.14.18
- Axios 1.6.2

## 🚀 AWS Deployment

### Option 1: One-Click CloudFormation Deployment (Recommended)

Deploy the entire EMR system with a single CloudFormation template. This is the easiest method and handles all setup automatically.

#### Prerequisites

1. **AWS Account**: Active AWS account with appropriate permissions
2. **EC2 Key Pair**: Required for SSH access (create one if needed)
3. **AWS CLI** (optional): For command-line deployment

#### Step-by-Step Deployment

##### Create EC2 Key Pair (if needed)

**Using AWS Console:**
1. Go to EC2 Console → Key Pairs
2. Click "Create key pair"
3. Name: `emr-training-key` (or your choice)
4. Format: PEM (Mac/Linux) or PPK (Windows)
5. Download and save securely

**Using AWS CLI:**
```bash
aws ec2 create-key-pair --key-name emr-training-key \
  --query 'KeyMaterial' --output text > emr-training-key.pem
chmod 400 emr-training-key.pem
```

##### Deploy with CloudFormation Console (Easiest)

1. **Open CloudFormation**
   - Go to [AWS CloudFormation Console](https://console.aws.amazon.com/cloudformation)
   - Select your region (e.g., us-east-1)

2. **Create Stack**
   - Click "Create stack" → "With new resources"
   - Choose "Upload a template file"
   - Select `cloudformation-emr.yaml`
   - Click "Next"

3. **Configure Parameters**
   - **Stack name**: `emr-training-system`
   - **InstanceType**: `t3.medium` (recommended)
   - **KeyPairName**: Select from dropdown
   - **AllowedIPRange**: `0.0.0.0/0` or your IP: `YOUR_IP/32`
   - **PatientCount**: `50` (adjustable: 10-500)
   - Click "Next"

4. **Review and Create**
   - Accept defaults or add tags
   - Check: "I acknowledge that AWS CloudFormation might create IAM resources"
   - Click "Create stack"

5. **Monitor Progress**
   - Wait 5-10 minutes for "CREATE_COMPLETE"
   - Check "Events" tab for progress

6. **Access Your System**
   - Go to "Outputs" tab
   - Copy the `PublicURL` value
   - Open in browser (may take 5 more minutes for initial setup)

##### Deploy with AWS CLI

```bash
# Deploy stack
aws cloudformation create-stack \
  --stack-name emr-training-system \
  --template-body file://cloudformation-emr.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=emr-training-key \
    ParameterKey=InstanceType,ParameterValue=t3.medium \
    ParameterKey=AllowedIPRange,ParameterValue=0.0.0.0/0 \
    ParameterKey=PatientCount,ParameterValue=50 \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Check status
aws cloudformation describe-stacks \
  --stack-name emr-training-system \
  --query 'Stacks[0].StackStatus'

# Get outputs
aws cloudformation describe-stacks \
  --stack-name emr-training-system \
  --query 'Stacks[0].Outputs'
```

#### Post-Deployment

**SSH Access** (if needed):
```bash
ssh -i emr-training-key.pem ec2-user@<PUBLIC_IP>

# Check deployment logs
sudo tail -f /var/log/user-data.log

# Monitor Docker containers
sudo docker ps
sudo docker-compose logs -f
```

**Stack Management:**
- **Update**: CloudFormation Console → Stack → Update
- **Stop/Start**: EC2 Console → Stop instance (preserves data)
- **Delete**: `aws cloudformation delete-stack --stack-name emr-training-system`

#### Troubleshooting

| Issue | Solution |
|-------|----------|
| Stack creation failed | Check Events tab for specific error |
| Can't access URL | Wait 10-15 minutes for full deployment |
| "Connection refused" | Check security group allows port 80 |
| Invalid key pair | Ensure key exists in selected region |

#### Cost Optimization

- **Estimated Cost**: ~$30-40/month (t3.medium running 24/7)
- **Save Money**:
  - Stop instance when not in use
  - Use t3.small for testing ($15-20/month)
  - Set up auto-stop schedule with Lambda

Access the system via the URL in CloudFormation outputs (typically ready in 10-15 minutes).

## 🌐 Azure Deployment

### Option 1: One-Click ARM Template Deployment (Recommended)

Deploy the entire EMR system on Azure with a single ARM template.

#### Prerequisites

1. **Azure Account**: Active Azure subscription
2. **Azure CLI**: Install from [here](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
3. **Resource Group**: Created during deployment

#### Step-by-Step Deployment

##### Deploy with Azure Portal (Easiest)

1. **Login to Azure Portal**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to "Create a resource"

2. **Deploy Custom Template**
   - Search for "Template deployment"
   - Click "Build your own template in the editor"
   - Copy contents of `azure-deploy.json`
   - Click "Save"

3. **Configure Parameters**
   - **Resource Group**: Create new or select existing
   - **Location**: Choose your region
   - **VM Name**: `emr-training-vm`
   - **Admin Username**: `azureuser`
   - **Authentication Type**: Password or SSH Key
   - **VM Size**: `Standard_B2ms` (recommended)
   - **Patient Count**: `50`
   - **Allowed Source IP**: Your IP or `*` for all

4. **Review and Create**
   - Check "Terms and conditions"
   - Click "Create"
   - Wait 10-15 minutes for deployment

5. **Access Your System**
   - Go to "Outputs" section
   - Copy the `emrSystemURL`
   - Open in browser

##### Deploy with Azure CLI

```bash
# Login to Azure
az login

# Create resource group
az group create --name emr-training-rg --location eastus

# Deploy ARM template
az deployment group create \
  --resource-group emr-training-rg \
  --template-file azure-deploy.json \
  --parameters \
    vmName=emr-training-vm \
    adminUsername=azureuser \
    authenticationType=password \
    adminPasswordOrKey='YourSecurePassword123!' \
    vmSize=Standard_B2ms \
    patientCount=50

# Get outputs
az deployment group show \
  -g emr-training-rg -n azure-deploy \
  --query properties.outputs
```

### Option 2: Automated Script Deployment

Use our deployment script for various Azure services:

```bash
# Make script executable
chmod +x deploy-azure.sh

# Deploy to VM (recommended)
./deploy-azure.sh vm

# Deploy to Container Instances
./deploy-azure.sh aci

# Deploy to App Service
./deploy-azure.sh appservice
```

### Option 3: Azure Container Instances

For a containerized deployment without managing VMs:

```bash
# Set up Azure Container Registry
az acr create --resource-group emr-training-rg \
  --name emrtraining --sku Basic

# Build and push image
az acr build --registry emrtraining \
  --image emr-training:latest \
  --file Dockerfile.standalone .

# Deploy container
az container create \
  --resource-group emr-training-rg \
  --file azure-container.yaml
```

### Azure-Specific Features

#### Storage Options

- **Managed Disks**: Automatic for VMs
- **Azure Files**: For persistent container storage
- **Azure Blob**: For backup and archives

#### Security Configuration

- **Network Security Groups**: Pre-configured for HTTP/SSH
- **Azure AD Integration**: Optional for enterprise
- **Key Vault**: For secrets management

#### Monitoring

```bash
# View VM metrics
az monitor metrics list \
  --resource emr-training-vm \
  --resource-group emr-training-rg \
  --metric "Percentage CPU" \
  --interval PT1M

# View container logs
az container logs \
  --resource-group emr-training-rg \
  --name emr-training-container

# Enable Application Insights (optional)
az monitor app-insights component create \
  --app emr-insights \
  --location eastus \
  --resource-group emr-training-rg
```

### Cost Optimization

#### VM Pricing (East US)

| Size | vCPUs | RAM | Cost/Month |
|------|-------|-----|------------|
| B2s | 2 | 4 GB | ~$30 |
| B2ms | 2 | 8 GB | ~$60 |
| B4ms | 4 | 16 GB | ~$120 |

#### Cost Saving Tips

1. **Auto-Shutdown**: Configure in VM settings
2. **Spot Instances**: Up to 90% savings
3. **Reserved Instances**: 1-3 year commitments
4. **Dev/Test Pricing**: If eligible

```bash
# Configure auto-shutdown
az vm auto-shutdown \
  -g emr-training-rg \
  -n emr-training-vm \
  --time 1800 \
  --timezone "Eastern Standard Time"
```

### Troubleshooting Azure Deployments

| Issue | Solution |
|-------|----------|
| Deployment failed | Check Activity Log in portal |
| Cannot access URL | Verify NSG rules allow port 80 |
| SSH connection failed | Check NSG allows port 22 from your IP |
| High costs | Enable auto-shutdown, use smaller VM |

### Cleanup

```bash
# Delete entire resource group
az group delete --name emr-training-rg --yes

# Or use script
./deploy-azure.sh cleanup
```

### Option 2: Docker Container Deployment

#### Build and Push to ECR

```bash
# Configure AWS credentials
aws configure

# Run the deployment script
./deploy-aws.sh ec2
```

#### Deploy to EC2

1. **Using the generated user-data.sh**:
   - Launch an EC2 instance (Amazon Linux 2)
   - Choose t3.medium or larger
   - Configure security group (ports 80, 22)
   - Paste user-data.sh contents in Advanced Details

2. **Using AWS CLI**:
   ```bash
   aws ec2 run-instances \
     --image-id ami-0c02fb55956c7d316 \
     --instance-type t3.medium \
     --key-name your-keypair \
     --security-group-ids sg-xxxxxx \
     --user-data file://user-data.sh
   ```

#### Deploy to ECS Fargate

```bash
# Build and push image
./deploy-aws.sh ecs

# Create ECS cluster
aws ecs create-cluster --cluster-name emr-cluster

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service (update JSON with your subnet/security group)
aws ecs create-service --cluster emr-cluster --cli-input-json file://service-definition.json
```

#### Deploy to App Runner

```bash
# Build and push image
./deploy-aws.sh apprunner

# Create App Runner service
aws apprunner create-service --cli-input-json file://apprunner-service.json
```

### Option 3: Manual Docker Deployment on EC2

1. **Launch EC2 instance** (Amazon Linux 2, t3.medium)

2. **SSH into instance**:
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-ip
   ```

3. **Install Docker**:
   ```bash
   sudo yum update -y
   sudo amazon-linux-extras install docker -y
   sudo service docker start
   sudo usermod -a -G docker ec2-user
   ```

4. **Clone repository and deploy**:
   ```bash
   git clone <repository-url>
   cd emr-training-system
   docker-compose -f docker-compose.standalone.yml up -d
   ```

### Deployment Configuration

#### Environment Variables

Configure these in your deployment:

- `PATIENT_COUNT`: Number of synthetic patients to generate (default: 25)
- `SKIP_SYNTHEA`: Skip patient generation if true (default: false)
- `SKIP_IMPORT`: Skip data import if true (default: false)

#### Security Groups

Required inbound rules:
- Port 80 (HTTP) - From your IP or 0.0.0.0/0
- Port 22 (SSH) - From your IP only

#### Instance Sizing

- **Development**: t3.small (2 vCPU, 2 GB RAM)
- **Training**: t3.medium (2 vCPU, 4 GB RAM) - Recommended
- **Production**: t3.large (2 vCPU, 8 GB RAM) or larger

## 🔐 Security Considerations

- Always use HTTPS in production (configure with ALB or CloudFront)
- Restrict security groups to known IP ranges
- Use AWS Secrets Manager for sensitive configuration
- Enable CloudWatch logs for monitoring
- Regularly update dependencies

## 📊 Data Management

### Generating Synthetic Data

```bash
cd backend
python scripts/generate_synthea_data.py --patients 100
```

### Importing FHIR Data

```bash
python scripts/optimized_synthea_import.py \
  --input-dir data/synthea_output/fhir \
  --batch-size 20
```

### Adding Reference Ranges

```bash
python scripts/add_reference_ranges.py
```

## 🛠️ Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 80, 3000, 8000 are available
2. **Memory issues**: Increase Docker memory allocation or instance size
3. **Database locked**: Restart the backend service
4. **Missing data**: Re-run the import scripts

### Logs

- Backend logs: `/app/backend/logs/backend.log`
- Nginx logs: `/var/log/nginx/access.log`
- Docker logs: `docker-compose logs -f`

## 📚 API Documentation

Once deployed, access the interactive API documentation at:
- Swagger UI: `http://your-domain/docs`
- ReDoc: `http://your-domain/redoc`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Synthea for synthetic patient data generation
- FHIR community for healthcare data standards
- FastAPI and React communities

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting guide
- Review the API documentation

---

Built with ❤️ for healthcare training and education