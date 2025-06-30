#!/bin/bash
#
# EMR System AWS Deployment Script
# Reliable deployment for EC2 instances
#

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🏥 EMR System AWS Deployment${NC}"
echo "=============================="

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

# Install Docker based on OS
install_docker() {
    echo -e "${YELLOW}Installing Docker...${NC}"
    
    if [ "$OS" = "amzn" ]; then
        # Amazon Linux 2
        sudo yum update -y
        sudo yum install -y docker git
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -a -G docker $USER
    elif [ "$OS" = "ubuntu" ]; then
        # Ubuntu
        sudo apt-get update
        sudo apt-get install -y docker.io git
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -a -G docker $USER
    else
        echo -e "${RED}Unsupported OS: $OS${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Docker installed${NC}"
}

# Check prerequisites
check_prerequisites() {
    if ! command -v docker &> /dev/null; then
        install_docker
    else
        echo -e "${GREEN}✓ Docker already installed${NC}"
    fi
    
    if ! command -v git &> /dev/null; then
        echo -e "${RED}Git is required but not installed${NC}"
        exit 1
    fi
}

# Clone or update repository
setup_repository() {
    echo -e "${YELLOW}Setting up repository...${NC}"
    
    if [ -d "EMR" ]; then
        echo "Repository exists, pulling latest changes..."
        cd EMR
        git pull || true
    else
        echo "Cloning repository..."
        git clone https://github.com/ultraub/MedGenEMR.git EMR
        cd EMR
    fi
    
    echo -e "${GREEN}✓ Repository ready${NC}"
}

# Deploy using Docker
deploy_with_docker() {
    echo -e "${YELLOW}Deploying with Docker...${NC}"
    
    # Stop any existing containers
    sudo docker stop emr-system 2>/dev/null || true
    sudo docker rm emr-system 2>/dev/null || true
    
    # Build the image
    echo "Building Docker image..."
    sudo docker build -t emr-system .
    
    # Run the container
    echo "Starting container..."
    sudo docker run -d \
        --name emr-system \
        -p 80:80 \
        -v $(pwd)/backend/data:/app/backend/data \
        --restart unless-stopped \
        emr-system
    
    echo -e "${GREEN}✓ Container started${NC}"
}

# Alternative: Deploy with docker-compose
deploy_with_compose() {
    echo -e "${YELLOW}Deploying with docker-compose...${NC}"
    
    # Install docker-compose if needed
    if ! command -v docker-compose &> /dev/null; then
        echo "Installing docker-compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
    
    # Use the simple docker-compose file
    if [ -f "docker-compose.simple.yml" ]; then
        sudo docker-compose -f docker-compose.simple.yml down
        sudo docker-compose -f docker-compose.simple.yml up -d --build
    else
        echo -e "${RED}docker-compose.simple.yml not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Services started with docker-compose${NC}"
}

# Wait for services to be ready
wait_for_services() {
    echo -e "${YELLOW}Waiting for services to start...${NC}"
    
    for i in {1..60}; do
        if curl -f http://localhost/api/health &> /dev/null; then
            echo -e "${GREEN}✓ Services are ready${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    
    echo -e "${RED}Services failed to start${NC}"
    return 1
}

# Show deployment info
show_info() {
    echo ""
    echo "======================================"
    echo -e "${GREEN}✓ EMR System Deployed Successfully!${NC}"
    echo "======================================"
    
    # Get public IP
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
    
    echo ""
    echo "Access the system at:"
    echo "  Main Application: http://$PUBLIC_IP/"
    echo "  API Documentation: http://$PUBLIC_IP/docs"
    echo ""
    echo "Default login: Select any provider from the dropdown"
    echo ""
    echo "To check logs:"
    echo "  sudo docker logs emr-system"
    echo ""
    echo "To stop the system:"
    echo "  sudo docker stop emr-system"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    setup_repository
    
    # Check if we should use docker-compose
    if [ "$1" = "--compose" ] && [ -f "docker-compose.simple.yml" ]; then
        deploy_with_compose
    else
        deploy_with_docker
    fi
    
    wait_for_services
    show_info
}

# Handle errors
trap 'echo -e "\n${RED}Deployment failed. Check logs with: sudo docker logs emr-system${NC}"' ERR

# Run main function
main "$@"