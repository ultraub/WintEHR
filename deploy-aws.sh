#!/bin/bash
#
# AWS Deployment Script for EMR Training System
# Supports EC2, ECS, and App Runner deployments
#

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REPOSITORY_NAME="emr-training-system"
IMAGE_TAG=${IMAGE_TAG:-latest}
DEPLOYMENT_TYPE=${1:-ec2}  # ec2, ecs, or apprunner

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🏥 EMR Training System - AWS Deployment${NC}"
echo "========================================="
echo "Deployment Type: $DEPLOYMENT_TYPE"
echo "AWS Region: $AWS_REGION"
echo ""

# Function to build and push to ECR
push_to_ecr() {
    echo -e "${YELLOW}Building and pushing Docker image to ECR...${NC}"
    
    # Get AWS account ID
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME"
    
    # Create ECR repository if it doesn't exist
    aws ecr describe-repositories --repository-names $ECR_REPOSITORY_NAME --region $AWS_REGION 2>/dev/null || \
        aws ecr create-repository --repository-name $ECR_REPOSITORY_NAME --region $AWS_REGION
    
    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
    
    # Build and tag image
    docker build -f Dockerfile.standalone -t $ECR_REPOSITORY_NAME:$IMAGE_TAG .
    docker tag $ECR_REPOSITORY_NAME:$IMAGE_TAG $ECR_URI:$IMAGE_TAG
    
    # Push to ECR
    docker push $ECR_URI:$IMAGE_TAG
    
    echo -e "${GREEN}✓ Image pushed to ECR: $ECR_URI:$IMAGE_TAG${NC}"
    echo $ECR_URI:$IMAGE_TAG
}

# EC2 Deployment
deploy_ec2() {
    echo -e "${YELLOW}Deploying to EC2...${NC}"
    
    cat > user-data.sh << 'EOF'
#!/bin/bash
# EC2 User Data Script

# Update system
yum update -y

# Install Docker
amazon-linux-extras install docker -y
service docker start
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create app directory
mkdir -p /opt/emr-system
cd /opt/emr-system

# Create docker-compose file
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  emr:
    image: DOCKER_IMAGE_URI
    ports:
      - "80:80"
    environment:
      - PATIENT_COUNT=50
    volumes:
      - emr_data:/app/backend/data
      - emr_logs:/app/backend/logs
    restart: unless-stopped

volumes:
  emr_data:
  emr_logs:
COMPOSE

# Replace image URI
sed -i "s|DOCKER_IMAGE_URI|${ECR_URI}|g" docker-compose.yml

# Start the application
$(aws ecr get-login --no-include-email --region ${AWS_REGION})
docker-compose up -d

# Setup CloudWatch Logs (optional)
yum install -y awslogs
systemctl start awslogsd
systemctl enable awslogsd.service
EOF

    # Replace variables in user-data
    ECR_URI=$(push_to_ecr)
    sed -i "s|DOCKER_IMAGE_URI|${ECR_URI}|g" user-data.sh
    sed -i "s|${AWS_REGION}|${AWS_REGION}|g" user-data.sh
    
    echo -e "${GREEN}✓ EC2 deployment prepared${NC}"
    echo ""
    echo "To launch an EC2 instance:"
    echo "1. Go to EC2 Console"
    echo "2. Launch instance with Amazon Linux 2"
    echo "3. Choose t3.medium or larger"
    echo "4. Configure security group to allow:"
    echo "   - HTTP (80) from anywhere"
    echo "   - SSH (22) from your IP"
    echo "5. In Advanced Details, paste the contents of user-data.sh"
    echo ""
    echo "Or use AWS CLI:"
    echo "aws ec2 run-instances \\"
    echo "  --image-id ami-0c02fb55956c7d316 \\"
    echo "  --instance-type t3.medium \\"
    echo "  --key-name YOUR_KEY_PAIR \\"
    echo "  --security-group-ids YOUR_SG_ID \\"
    echo "  --user-data file://user-data.sh"
}

# ECS Deployment
deploy_ecs() {
    echo -e "${YELLOW}Deploying to ECS...${NC}"
    
    ECR_URI=$(push_to_ecr)
    
    # Create task definition
    cat > task-definition.json << EOF
{
  "family": "emr-training-system",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "emr",
      "image": "${ECR_URI}",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PATIENT_COUNT",
          "value": "50"
        }
      ],
      "mountPoints": [
        {
          "sourceVolume": "emr-data",
          "containerPath": "/app/backend/data"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/emr-training-system",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost/api/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ],
  "volumes": [
    {
      "name": "emr-data",
      "efsVolumeConfiguration": {
        "fileSystemId": "YOUR_EFS_ID",
        "transitEncryption": "ENABLED"
      }
    }
  ]
}
EOF
    
    # Create service definition
    cat > service-definition.json << EOF
{
  "serviceName": "emr-training-system",
  "taskDefinition": "emr-training-system",
  "desiredCount": 1,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["YOUR_SUBNET_ID"],
      "securityGroups": ["YOUR_SG_ID"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "YOUR_TARGET_GROUP_ARN",
      "containerName": "emr",
      "containerPort": 80
    }
  ],
  "healthCheckGracePeriodSeconds": 60
}
EOF
    
    echo -e "${GREEN}✓ ECS deployment files created${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Create an EFS filesystem for persistent storage"
    echo "2. Update task-definition.json with your EFS ID"
    echo "3. Create an ALB with target group"
    echo "4. Update service-definition.json with your subnet, security group, and target group"
    echo "5. Register task definition:"
    echo "   aws ecs register-task-definition --cli-input-json file://task-definition.json"
    echo "6. Create service:"
    echo "   aws ecs create-service --cluster YOUR_CLUSTER --cli-input-json file://service-definition.json"
}

# App Runner Deployment
deploy_apprunner() {
    echo -e "${YELLOW}Deploying to App Runner...${NC}"
    
    ECR_URI=$(push_to_ecr)
    
    # Create App Runner configuration
    cat > apprunner.yaml << EOF
version: 1.0
runtime: docker
build:
  commands:
    build:
      - echo "No build commands"
run:
  runtime-version: latest
  command: /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
  network:
    port: 80
    env: PORT
  env:
    - name: PATIENT_COUNT
      value: "25"
    - name: SKIP_SYNTHEA
      value: "false"
EOF
    
    # Create service configuration
    cat > apprunner-service.json << EOF
{
  "ServiceName": "emr-training-system",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "${ECR_URI}",
      "ImageConfiguration": {
        "Port": "80",
        "RuntimeEnvironmentVariables": {
          "PATIENT_COUNT": "25"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": false
  },
  "InstanceConfiguration": {
    "Cpu": "1 vCPU",
    "Memory": "2 GB"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 30,
    "Timeout": 10,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 3
  }
}
EOF
    
    echo -e "${GREEN}✓ App Runner configuration created${NC}"
    echo ""
    echo "To create App Runner service:"
    echo "aws apprunner create-service --cli-input-json file://apprunner-service.json"
}

# Main execution
case $DEPLOYMENT_TYPE in
    ec2)
        deploy_ec2
        ;;
    ecs)
        deploy_ecs
        ;;
    apprunner)
        deploy_apprunner
        ;;
    *)
        echo -e "${RED}Invalid deployment type: $DEPLOYMENT_TYPE${NC}"
        echo "Usage: $0 [ec2|ecs|apprunner]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✓ Deployment preparation complete!${NC}"