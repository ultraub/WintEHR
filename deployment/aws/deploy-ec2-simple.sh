#!/bin/bash
#
# Simplified EC2 Deployment Script for EMR Training System
# This script handles common deployment issues found during testing
#

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🏥 EMR Training System - EC2 Deployment Helper${NC}"
echo "================================================"

# Function to check if running on EC2
check_ec2() {
    if [ ! -f /sys/hypervisor/uuid ] || [ $(head -c 3 /sys/hypervisor/uuid) != "ec2" ]; then
        echo -e "${YELLOW}Warning: This script is designed for Amazon EC2 instances${NC}"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to install Docker
install_docker() {
    echo -e "${YELLOW}Installing Docker...${NC}"
    
    if command -v docker &> /dev/null; then
        echo "Docker is already installed"
        return
    fi
    
    # For Amazon Linux 2
    if [ -f /etc/system-release ] && grep -q "Amazon Linux" /etc/system-release; then
        sudo amazon-linux-extras install docker -y
        sudo service docker start
        sudo systemctl enable docker
        sudo usermod -a -G docker $USER
        echo -e "${GREEN}✓ Docker installed (Amazon Linux 2)${NC}"
    # For Ubuntu
    elif [ -f /etc/lsb-release ]; then
        sudo apt-get update
        sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
        sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -a -G docker $USER
        echo -e "${GREEN}✓ Docker installed (Ubuntu)${NC}"
    else
        echo -e "${RED}Unsupported OS. Please install Docker manually.${NC}"
        exit 1
    fi
}

# Function to install Docker Compose
install_docker_compose() {
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    
    if [ -f /usr/local/bin/docker-compose ]; then
        echo "Docker Compose is already installed"
        return
    fi
    
    # Install specific version that works
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
        -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Test installation
    if /usr/local/bin/docker-compose version &> /dev/null; then
        echo -e "${GREEN}✓ Docker Compose installed${NC}"
    else
        echo -e "${RED}Docker Compose installation failed${NC}"
        exit 1
    fi
}

# Function to clone repository
clone_repository() {
    echo -e "${YELLOW}Setting up repository...${NC}"
    
    # Install git if needed
    if ! command -v git &> /dev/null; then
        if [ -f /etc/system-release ] && grep -q "Amazon Linux" /etc/system-release; then
            sudo yum install -y git
        else
            sudo apt-get install -y git
        fi
    fi
    
    # Clone or update repository
    if [ -d "/opt/emr-system" ]; then
        echo "Repository already exists, updating..."
        cd /opt/emr-system
        sudo git pull
    else
        sudo mkdir -p /opt
        cd /opt
        sudo git clone https://github.com/ultraub/MedGenEMR.git emr-system
    fi
    
    echo -e "${GREEN}✓ Repository ready${NC}"
}

# Function to prepare build environment
prepare_build() {
    echo -e "${YELLOW}Preparing build environment...${NC}"
    
    cd /opt
    
    # Create proper directory structure for Docker build
    sudo rm -rf emr-build
    sudo mkdir -p emr-build
    
    # Check if repository has EMR subdirectory
    if [ -d "emr-system/EMR" ]; then
        echo "Found EMR subdirectory structure"
        # Copy everything from EMR directory
        sudo cp -r emr-system/EMR/* emr-build/
        # Copy deployment files from EMR directory if they exist there
        for file in Dockerfile.standalone docker-compose.standalone.yml nginx.conf supervisord.conf startup.sh; do
            if [ -f "emr-system/EMR/$file" ]; then
                sudo cp "emr-system/EMR/$file" emr-build/
            elif [ -f "emr-system/$file" ]; then
                sudo cp "emr-system/$file" emr-build/
            fi
        done
    else
        # Repository is flat structure
        echo "Using flat repository structure"
        sudo cp -r emr-system/* emr-build/
    fi
    
    cd emr-build
    
    # Use fixed Dockerfile if original has issues
    if [ -f "Dockerfile.standalone.fixed" ]; then
        echo "Using fixed Dockerfile"
        sudo mv Dockerfile.standalone.fixed Dockerfile.standalone
    fi
    
    # Fix common Dockerfile issues
    if [ -f "Dockerfile.standalone" ]; then
        # Replace npm ci with npm install to handle lock file issues
        sudo sed -i 's/npm ci/npm install/' Dockerfile.standalone
        
        # If Dockerfile has EMR/ prefix in COPY commands, remove it
        if grep -q "COPY EMR/" Dockerfile.standalone; then
            echo "Fixing COPY paths in Dockerfile"
            sudo sed -i 's|COPY EMR/|COPY |g' Dockerfile.standalone
        fi
    fi
    
    echo -e "${GREEN}✓ Build environment prepared${NC}"
}

# Function to build and run
build_and_run() {
    echo -e "${YELLOW}Building and starting EMR system...${NC}"
    
    cd /opt/emr-build
    
    # Stop any existing containers
    sudo /usr/local/bin/docker-compose -f docker-compose.standalone.yml down 2>/dev/null || true
    
    # Set environment variables
    export PATIENT_COUNT=${PATIENT_COUNT:-25}
    export SKIP_SYNTHEA=${SKIP_SYNTHEA:-false}
    export SKIP_IMPORT=${SKIP_IMPORT:-false}
    
    # Build and run
    echo "Starting build (this may take 10-15 minutes)..."
    sudo -E /usr/local/bin/docker-compose -f docker-compose.standalone.yml up -d --build
    
    echo -e "${GREEN}✓ Build initiated${NC}"
}

# Function to check status
check_status() {
    echo -e "${YELLOW}Checking deployment status...${NC}"
    
    # Wait a bit for container to start
    sleep 10
    
    # Check if container is running
    if sudo docker ps | grep -q "emr"; then
        echo -e "${GREEN}✓ Container is running${NC}"
        
        # Get container name
        CONTAINER=$(sudo docker ps --filter "ancestor=emr-build-emr" --format "{{.Names}}" | head -1)
        if [ -z "$CONTAINER" ]; then
            CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep emr | head -1)
        fi
        
        echo "Container: $CONTAINER"
        echo ""
        echo "To view logs:"
        echo "  sudo docker logs -f $CONTAINER"
        echo ""
        echo "To check health:"
        echo "  curl http://localhost/api/health"
        echo ""
        
        # Get public IP
        PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
        echo "Once ready, access the system at:"
        echo "  http://$PUBLIC_IP"
        echo ""
        echo "Note: Full startup may take 10-15 minutes"
    else
        echo -e "${RED}Container is not running${NC}"
        echo "Check build logs:"
        echo "  cd /opt/emr-build"
        echo "  sudo /usr/local/bin/docker-compose -f docker-compose.standalone.yml logs"
    fi
}

# Function to show troubleshooting tips
show_troubleshooting() {
    echo ""
    echo -e "${YELLOW}Troubleshooting Commands:${NC}"
    echo "------------------------"
    echo "# Check container status:"
    echo "sudo docker ps -a"
    echo ""
    echo "# View container logs:"
    echo "sudo docker logs \$(sudo docker ps -aq | head -1)"
    echo ""
    echo "# Restart deployment:"
    echo "cd /opt/emr-build && sudo /usr/local/bin/docker-compose -f docker-compose.standalone.yml restart"
    echo ""
    echo "# Rebuild from scratch:"
    echo "cd /opt/emr-build && sudo /usr/local/bin/docker-compose -f docker-compose.standalone.yml down"
    echo "sudo /usr/local/bin/docker-compose -f docker-compose.standalone.yml up -d --build"
    echo ""
    echo "# Check disk space:"
    echo "df -h"
    echo ""
    echo "# Monitor build progress:"
    echo "watch -n 1 'sudo docker ps && echo && df -h /var/lib/docker'"
}

# Main execution
main() {
    check_ec2
    install_docker
    install_docker_compose
    clone_repository
    prepare_build
    build_and_run
    check_status
    show_troubleshooting
}

# Run main function
main

echo ""
echo -e "${GREEN}✓ Deployment script complete${NC}"
echo "The EMR system should be available in 10-15 minutes."