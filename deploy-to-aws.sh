#!/bin/bash

# WintEHR AWS Production Deployment Script
# This script deploys WintEHR to AWS EC2 in production mode

set -e

# Configuration
AWS_HOST="172.31.80.189"
AWS_USER="ec2-user"
KEY_FILE="/Users/robertbarrett/dev/emr-key.pem"
REPO_BRANCH="fhir-native-redesign"
APP_DIR="/home/ec2-user/WintEHR"

echo "🚀 Starting WintEHR AWS Production Deployment"
echo "Target: $AWS_USER@$AWS_HOST"
echo "Branch: $REPO_BRANCH"
echo "=========================================="

# Function to run commands on remote server
run_remote() {
    ssh -i "$KEY_FILE" -o ConnectTimeout=30 "$AWS_USER@$AWS_HOST" "$1"
}

# Function to copy files to remote server
copy_to_remote() {
    scp -i "$KEY_FILE" -r "$1" "$AWS_USER@$AWS_HOST:$2"
}

echo "✅ Step 1: Testing connection to AWS server..."
if ! run_remote "echo 'Connection successful'"; then
    echo "❌ Failed to connect to AWS server"
    echo "Please check:"
    echo "1. Server is running"
    echo "2. Security Group allows SSH from your IP"
    echo "3. Server IP address is correct"
    exit 1
fi

echo "✅ Step 2: Checking system info..."
run_remote "
    echo 'System Information:'
    uname -a
    echo 'Available Memory:'
    free -h
    echo 'Disk Space:'
    df -h
    echo 'Current User:'
    whoami
"

echo "✅ Step 3: Installing system dependencies..."
run_remote "
    # Update system
    sudo yum update -y
    
    # Install Docker
    if ! command -v docker &> /dev/null; then
        echo 'Installing Docker...'
        sudo yum install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker ec2-user
    else
        echo 'Docker already installed'
    fi
    
    # Install Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo 'Installing Docker Compose...'
        sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    else
        echo 'Docker Compose already installed'
    fi
    
    # Install Git
    if ! command -v git &> /dev/null; then
        sudo yum install -y git
    else
        echo 'Git already installed'
    fi
    
    # Install Node.js (needed for frontend builds)
    if ! command -v node &> /dev/null; then
        echo 'Installing Node.js...'
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo 'Node.js already installed'
    fi
    
    # Install Python 3 and pip
    if ! command -v python3 &> /dev/null; then
        sudo yum install -y python3 python3-pip
    else
        echo 'Python3 already installed'
    fi
"

echo "✅ Step 4: Setting up application directory..."
run_remote "
    # Remove existing directory if it exists
    if [ -d '$APP_DIR' ]; then
        echo 'Removing existing application directory...'
        rm -rf '$APP_DIR'
    fi
    
    # Create fresh directory
    mkdir -p '$APP_DIR'
    cd '$APP_DIR'
"

echo "✅ Step 5: Cloning repository..."
run_remote "
    cd '$APP_DIR'
    git clone https://github.com/robertpbarrett/MedGenEMR.git .
    git checkout '$REPO_BRANCH'
    echo 'Repository cloned successfully'
    echo 'Current branch:'
    git branch
    echo 'Latest commits:'
    git log --oneline -5
"

echo "✅ Step 6: Setting up production environment..."
run_remote "
    cd '$APP_DIR'
    
    # Create production environment file
    cat > .env.production << EOF
# Production Environment Configuration
ENVIRONMENT=production
DEBUG=false

# Database Configuration
POSTGRES_DB=emr_db
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=\$(openssl rand -base64 32)
DATABASE_URL=postgresql://emr_user:\${POSTGRES_PASSWORD}@postgres:5432/emr_db

# Security Configuration
JWT_SECRET_KEY=\$(openssl rand -base64 64)
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Server Configuration
BACKEND_PORT=8000
FRONTEND_PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://172.31.80.189:3000
CORS_ALLOWED_ORIGINS=*

# FHIR Configuration
FHIR_BASE_URL=http://localhost:8000/fhir/R4
ENABLE_FHIR_VALIDATION=true

# Performance Configuration
POSTGRES_MAX_CONNECTIONS=100
BACKEND_WORKERS=4

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30
EOF

    echo 'Production environment configured'
"

echo "✅ Step 7: Building application..."
run_remote "
    cd '$APP_DIR'
    
    # Ensure Docker service is running
    sudo systemctl start docker
    
    # Build the application in production mode
    echo 'Building WintEHR containers...'
    docker-compose -f docker-compose.yml build --no-cache
    
    echo 'Build completed successfully'
"

echo "✅ Step 8: Deploying with production data..."
run_remote "
    cd '$APP_DIR'
    
    # Start the application
    echo 'Starting WintEHR services...'
    docker-compose up -d
    
    # Wait for services to start
    echo 'Waiting for services to initialize...'
    sleep 30
    
    # Check service status
    echo 'Service status:'
    docker-compose ps
    
    # Deploy with production patient data (100 patients)
    echo 'Deploying production data...'
    if [ -f './fresh-deploy.sh' ]; then
        chmod +x ./fresh-deploy.sh
        ./fresh-deploy.sh --mode production --patients 100
    else
        echo 'Using alternative deployment method...'
        docker exec emr-backend python scripts/active/synthea_master.py full --count 100
    fi
"

echo "✅ Step 9: Configuring system services..."
run_remote "
    # Create systemd service for auto-start
    sudo tee /etc/systemd/system/wintehr.service > /dev/null << EOF
[Unit]
Description=WintEHR Electronic Medical Records System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    # Enable the service
    sudo systemctl daemon-reload
    sudo systemctl enable wintehr.service
    
    echo 'System service configured for auto-start'
"

echo "✅ Step 10: Final health checks..."
run_remote "
    cd '$APP_DIR'
    
    # Check all containers are running
    echo 'Container status:'
    docker-compose ps
    
    # Check logs for any errors
    echo 'Recent logs:'
    docker-compose logs --tail=20
    
    # Test API endpoints
    echo 'Testing API health...'
    sleep 10
    curl -f http://localhost:8000/health || echo 'Health check endpoint not ready yet'
    
    # Check database
    echo 'Checking database...'
    docker exec emr-backend python scripts/testing/validate_fhir_data.py --brief || echo 'Database validation pending'
    
    echo 'Deployment summary:'
    echo '- Application URL: http://172.31.80.189:3000'
    echo '- API URL: http://172.31.80.189:8000'
    echo '- FHIR API: http://172.31.80.189:8000/fhir/R4'
    echo '- Admin user: demo/password'
    echo '- System service: wintehr.service (auto-starts on boot)'
"

echo "🎉 WintEHR Production Deployment Complete!"
echo ""
echo "Next steps:"
echo "1. Configure AWS Security Groups to allow traffic on ports 3000 and 8000"
echo "2. Set up SSL/TLS certificates for production use"
echo "3. Configure backup procedures for the PostgreSQL database"
echo "4. Set up monitoring and alerting"
echo "5. Configure log rotation and management"
echo ""
echo "Access URLs:"
echo "- Frontend: http://172.31.80.189:3000"
echo "- Backend API: http://172.31.80.189:8000"
echo "- FHIR Endpoint: http://172.31.80.189:8000/fhir/R4"