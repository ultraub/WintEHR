# EMR Training System

A simplified Electronic Medical Records system for AWS deployment.

## Quick Start

```bash
# Run with Docker
docker-compose -f docker-compose.aws.yml up

# Initialize with sample data
docker-compose -f docker-compose.aws.yml --profile setup up data-init
```

## AWS Deployment

1. Launch an EC2 instance (t3.medium or larger recommended)
2. Install Docker and Docker Compose
3. Clone this repository
4. Run `docker-compose -f docker-compose.aws.yml up -d`

## Access

- Frontend: http://your-instance-ip
- Backend API: http://your-instance-ip:8000
- API Documentation: http://your-instance-ip:8000/docs

## Default Login

Select any provider from the dropdown on the login page.