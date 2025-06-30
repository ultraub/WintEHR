# AWS Deployment Guide

## Prerequisites
- AWS Account
- EC2 Instance (t3.medium minimum)
- Security Group with ports 80, 8000 open

## Step-by-Step Deployment

### 1. Launch EC2 Instance
```bash
# Amazon Linux 2023 AMI recommended
# Instance type: t3.medium (2 vCPU, 4GB RAM)
# Storage: 20GB minimum
```

### 2. Connect and Install Docker
```bash
# Connect to instance
ssh -i your-key.pem ec2-user@your-instance-ip

# Install Docker
sudo yum update -y
sudo yum install docker git -y
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for group changes
exit
```

### 3. Deploy Application
```bash
# Reconnect to instance
ssh -i your-key.pem ec2-user@your-instance-ip

# Clone repository
git clone https://github.com/yourusername/emr-training.git
cd emr-training

# Start services
docker-compose -f docker-compose.aws.yml up -d

# Initialize database (first time only)
docker-compose -f docker-compose.aws.yml --profile setup up data-init
```

### 4. Access Application
- Frontend: http://your-ec2-public-ip
- Backend API: http://your-ec2-public-ip:8000
- API Docs: http://your-ec2-public-ip:8000/docs

### 5. Security Considerations
Since this is a training environment:
- Uses SQLite (no external database needed)
- Simple JWT authentication
- CORS allows all origins
- No HTTPS required

For production use, you would need:
- PostgreSQL/MySQL database
- Proper secrets management
- HTTPS with certificates
- Restricted CORS origins