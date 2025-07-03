#!/bin/bash

# Teaching EMR System - Production EC2 Deployment Script
# Supports 100+ patients with full Synthea data integration

set -e

# Configuration
DEPLOYMENT_PROFILE="${DEPLOYMENT_PROFILE:-production}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.large}"
REGION="${AWS_REGION:-us-east-1}"
KEY_NAME="${KEY_NAME:-emr-key}"
SECURITY_GROUP_NAME="emr-production-sg"
INSTANCE_NAME="EMR-Production-${DEPLOYMENT_PROFILE}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Teaching EMR System - Production Deployment${NC}"
echo -e "${GREEN}===========================================${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}AWS CLI not found. Please install it first.${NC}"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}AWS credentials not configured. Please run 'aws configure'.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Prerequisites check passed.${NC}"
}

# Create or update security group
setup_security_group() {
    echo -e "${YELLOW}Setting up security group...${NC}"
    
    # Check if security group exists
    SG_ID=$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=${SECURITY_GROUP_NAME}" \
        --query 'SecurityGroups[0].GroupId' \
        --output text 2>/dev/null || echo "None")
    
    if [ "$SG_ID" == "None" ]; then
        # Create security group
        SG_ID=$(aws ec2 create-security-group \
            --group-name "${SECURITY_GROUP_NAME}" \
            --description "Security group for EMR Production System" \
            --query 'GroupId' \
            --output text)
        
        echo -e "${GREEN}Created security group: ${SG_ID}${NC}"
        
        # Add rules
        aws ec2 authorize-security-group-ingress \
            --group-id "${SG_ID}" \
            --protocol tcp \
            --port 80 \
            --cidr 0.0.0.0/0 \
            --group-rule-description "HTTP access"
        
        aws ec2 authorize-security-group-ingress \
            --group-id "${SG_ID}" \
            --protocol tcp \
            --port 443 \
            --cidr 0.0.0.0/0 \
            --group-rule-description "HTTPS access"
        
        aws ec2 authorize-security-group-ingress \
            --group-id "${SG_ID}" \
            --protocol tcp \
            --port 22 \
            --cidr 0.0.0.0/0 \
            --group-rule-description "SSH access"
    else
        echo -e "${GREEN}Using existing security group: ${SG_ID}${NC}"
    fi
}

# Get latest Amazon Linux 2 AMI
get_ami_id() {
    echo -e "${YELLOW}Finding latest Amazon Linux 2 AMI...${NC}"
    
    AMI_ID=$(aws ec2 describe-images \
        --owners amazon \
        --filters \
            "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" \
            "Name=state,Values=available" \
        --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
        --output text)
    
    echo -e "${GREEN}Using AMI: ${AMI_ID}${NC}"
}

# Create user data script
create_user_data() {
    cat > user-data.sh << 'EOF'
#!/bin/bash
set -e

# Log all output
exec > >(tee -a /var/log/user-data.log)
exec 2>&1

echo "Starting EMR deployment at $(date)"

# Update system
yum update -y

# Install dependencies
yum install -y \
    docker \
    git \
    python3 \
    python3-pip \
    java-11-amazon-corretto-headless \
    htop \
    tmux

# Install docker-compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start and enable Docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Create EMR directory
mkdir -p /opt/emr
cd /opt/emr

# Clone repository (replace with your repository URL)
git clone https://github.com/your-repo/emr-system.git . || {
    echo "Failed to clone repository. Creating minimal structure..."
    mkdir -p backend frontend scripts
}

# Create deployment configuration
cat > deployment.config.json << 'CONFIG'
{
  "deployment_profiles": {
    "local_dev": {
      "patient_count": 10,
      "provider_count": 3,
      "enable_clinical_notes": true,
      "enable_imaging": true,
      "enable_labs_with_ranges": true,
      "enable_cds_hooks": true,
      "enable_fhir": true,
      "database_type": "sqlite"
    },
    "production": {
      "patient_count": 100,
      "provider_count": 20,
      "enable_clinical_notes": true,
      "enable_imaging": true,
      "enable_labs_with_ranges": true,
      "enable_cds_hooks": true,
      "enable_fhir": true,
      "database_type": "sqlite"
    },
    "cloud": {
      "patient_count": 200,
      "provider_count": 50,
      "enable_clinical_notes": true,
      "enable_imaging": true,
      "enable_labs_with_ranges": true,
      "enable_cds_hooks": true,
      "enable_fhir": true,
      "database_type": "postgresql"
    }
  }
}
CONFIG

# Create environment file
cat > .env << ENV
DEPLOYMENT_PROFILE=${DEPLOYMENT_PROFILE}
DATABASE_URL=sqlite:///./data/emr.db
SECRET_KEY=$(openssl rand -hex 32)
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8
CORS_ORIGINS=*
REACT_APP_API_URL=
BACKEND_PORT=8000
FRONTEND_PORT=80
LOG_LEVEL=INFO
ENV

# Create docker-compose file if not exists
if [ ! -f docker-compose.deployment.yml ]; then
    cat > docker-compose.deployment.yml << 'COMPOSE'
version: '3.8'

services:
  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile.production
    container_name: emr-backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=sqlite:///./data/emr.db
      - SECRET_KEY=${SECRET_KEY}
      - JWT_ALGORITHM=HS256
      - JWT_EXPIRATION_HOURS=8
      - CORS_ORIGINS=*
    volumes:
      - emr-data:/app/data
      - emr-logs:/app/logs
      - emr-dicom:/app/dicom_storage
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.production
    container_name: emr-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  data-init:
    build: 
      context: ./backend
      dockerfile: Dockerfile.production
    container_name: emr-data-init
    command: |
      bash -c "
        python scripts/unified_deployment_setup.py --profile ${DEPLOYMENT_PROFILE}
      "
    environment:
      - DATABASE_URL=sqlite:///./data/emr.db
      - DEPLOYMENT_PROFILE=${DEPLOYMENT_PROFILE}
    volumes:
      - emr-data:/app/data
      - ./deployment.config.json:/app/deployment.config.json:ro
    depends_on:
      backend:
        condition: service_healthy
    profiles:
      - setup

volumes:
  emr-data:
  emr-logs:
  emr-dicom:
COMPOSE
fi

# Build and start services
echo "Building Docker images..."
docker-compose -f docker-compose.deployment.yml build

echo "Starting services..."
docker-compose -f docker-compose.deployment.yml up -d backend frontend

# Wait for backend to be healthy
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -f http://localhost:8000/api/health &>/dev/null; then
        echo "Backend is healthy!"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 5
done

# Initialize data
echo "Initializing data with ${DEPLOYMENT_PROFILE} profile..."
docker-compose -f docker-compose.deployment.yml --profile setup up data-init

# Setup log rotation
cat > /etc/logrotate.d/emr << 'LOGROTATE'
/opt/emr/backend/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 emruser emruser
}
LOGROTATE

# Create systemd service
cat > /etc/systemd/system/emr.service << 'SYSTEMD'
[Unit]
Description=EMR Production System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/emr
ExecStart=/usr/local/bin/docker-compose -f docker-compose.deployment.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.deployment.yml down
User=root
Group=docker

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable emr.service

# Setup automatic backups
cat > /opt/emr/backup.sh << 'BACKUP'
#!/bin/bash
BACKUP_DIR="/opt/emr/backups"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker exec emr-backend sqlite3 /app/data/emr.db ".backup /app/data/backup_$DATE.db"

# Compress backup
tar -czf $BACKUP_DIR/emr_backup_$DATE.tar.gz -C /opt/emr/backend/data .

# Keep only last 7 days of backups
find $BACKUP_DIR -name "emr_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: emr_backup_$DATE.tar.gz"
BACKUP

chmod +x /opt/emr/backup.sh

# Schedule daily backups
echo "0 2 * * * /opt/emr/backup.sh >> /var/log/emr-backup.log 2>&1" | crontab -

# Set permissions
chown -R ec2-user:ec2-user /opt/emr

echo "EMR deployment completed at $(date)"
echo "Access the system at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"

# Create completion marker
touch /opt/emr/.deployment_complete
EOF

    echo -e "${GREEN}User data script created.${NC}"
}

# Launch EC2 instance
launch_instance() {
    echo -e "${YELLOW}Launching EC2 instance...${NC}"
    
    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id "${AMI_ID}" \
        --instance-type "${INSTANCE_TYPE}" \
        --key-name "${KEY_NAME}" \
        --security-group-ids "${SG_ID}" \
        --user-data file://user-data.sh \
        --block-device-mappings "DeviceName=/dev/xvda,Ebs={VolumeSize=100,VolumeType=gp3,DeleteOnTermination=true,Encrypted=true}" \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${INSTANCE_NAME}},{Key=Environment,Value=production},{Key=Application,Value=EMR}]" \
        --query 'Instances[0].InstanceId' \
        --output text)
    
    echo -e "${GREEN}Instance launched: ${INSTANCE_ID}${NC}"
    
    # Wait for instance to be running
    echo -e "${YELLOW}Waiting for instance to start...${NC}"
    aws ec2 wait instance-running --instance-ids "${INSTANCE_ID}"
    
    # Get public IP
    PUBLIC_IP=$(aws ec2 describe-instances \
        --instance-ids "${INSTANCE_ID}" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    echo -e "${GREEN}Instance is running!${NC}"
    echo -e "${GREEN}Public IP: ${PUBLIC_IP}${NC}"
}

# Check deployment status
check_deployment() {
    echo -e "${YELLOW}Checking deployment status...${NC}"
    
    # Wait for user data to complete
    echo "Waiting for deployment to complete (this may take 10-15 minutes)..."
    
    for i in {1..30}; do
        if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
            -i "${KEY_NAME}.pem" "ec2-user@${PUBLIC_IP}" \
            "test -f /opt/emr/.deployment_complete" 2>/dev/null; then
            echo -e "${GREEN}Deployment completed successfully!${NC}"
            break
        fi
        echo "Still deploying... ($i/30)"
        sleep 30
    done
}

# Main execution
main() {
    check_prerequisites
    setup_security_group
    get_ami_id
    create_user_data
    launch_instance
    check_deployment
    
    # Clean up
    rm -f user-data.sh
    
    echo -e "${GREEN}===========================================${NC}"
    echo -e "${GREEN}Deployment Summary:${NC}"
    echo -e "${GREEN}Instance ID: ${INSTANCE_ID}${NC}"
    echo -e "${GREEN}Public IP: ${PUBLIC_IP}${NC}"
    echo -e "${GREEN}URL: http://${PUBLIC_IP}${NC}"
    echo -e "${GREEN}SSH: ssh -i ${KEY_NAME}.pem ec2-user@${PUBLIC_IP}${NC}"
    echo -e "${GREEN}===========================================${NC}"
    
    # Save deployment info
    cat > deployment-info.json << EOF
{
  "instance_id": "${INSTANCE_ID}",
  "public_ip": "${PUBLIC_IP}",
  "security_group": "${SG_ID}",
  "deployment_profile": "${DEPLOYMENT_PROFILE}",
  "region": "${REGION}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    echo -e "${YELLOW}Deployment info saved to deployment-info.json${NC}"
}

# Run main function
main