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

### Option 1: One-Click CloudFormation Deployment

Deploy the entire EMR system with a single CloudFormation template:

```bash
aws cloudformation create-stack \
  --stack-name emr-training-system \
  --template-body file://cloudformation-emr.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=your-keypair \
    ParameterKey=InstanceType,ParameterValue=t3.medium \
    ParameterKey=PatientCount,ParameterValue=50 \
  --capabilities CAPABILITY_IAM
```

Access the system via the URL in the CloudFormation outputs.

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