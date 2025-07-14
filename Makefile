# WintEHR Makefile
# Comprehensive build and deployment automation

.PHONY: help build up down restart logs shell test clean fresh init-data

# Default target
help:
	@echo "WintEHR Management Commands"
	@echo "============================="
	@echo "make build       - Build all Docker images"
	@echo "make up          - Start all services"
	@echo "make down        - Stop all services"
	@echo "make restart     - Restart all services"
	@echo "make logs        - View logs (use LOGS_TAIL=100 for specific lines)"
	@echo "make shell       - Open shell in backend container"
	@echo "make test        - Run tests"
	@echo "make clean       - Clean up containers and volumes"
	@echo "make fresh       - Fresh start with data generation"
	@echo "make init-data   - Initialize with sample data"
	@echo ""
	@echo "Environment variables:"
	@echo "  PATIENT_COUNT=20  - Number of patients to generate"
	@echo "  JWT_ENABLED=false - Enable/disable JWT authentication"

# Build all images
build:
	docker-compose build --no-cache

# Start services
up:
	docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 10
	@echo "Services running at:"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend: http://localhost:8000"
	@echo "  API Docs: http://localhost:8000/docs"

# Stop services
down:
	docker-compose down

# Restart services
restart: down up

# View logs
LOGS_TAIL ?= 50
logs:
	docker-compose logs -f --tail=$(LOGS_TAIL)

# Shell access
shell:
	docker-compose exec backend bash

# Run tests
test:
	docker-compose exec backend pytest tests/ -v

# Clean everything
clean:
	docker-compose down -v
	rm -rf backend/data/generated_dicoms/*
	rm -rf backend/data/dicom_uploads/*
	rm -rf synthea/output/fhir/*.json

# Fresh start with data
PATIENT_COUNT ?= 20
fresh: clean build up
	@echo "Waiting for database initialization..."
	@sleep 15
	@echo "Generating $(PATIENT_COUNT) patients..."
	docker-compose exec backend python scripts/synthea_master.py full \
		--count $(PATIENT_COUNT) \
		--include-dicom \
		--clean-names \
		--validation-mode transform_only
	@echo "Fresh start complete!"

# Initialize data only
init-data:
	docker-compose exec backend python scripts/synthea_master.py full \
		--count $(PATIENT_COUNT) \
		--include-dicom \
		--clean-names \
		--validation-mode transform_only

# Database operations
db-backup:
	docker-compose exec postgres pg_dump -U emr_user emr_db | gzip > backup_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Database backed up to backup_$$(date +%Y%m%d_%H%M%S).sql.gz"

db-restore:
	@echo "Usage: make db-restore FILE=backup_20240101_120000.sql.gz"
	@test -n "$(FILE)" || (echo "ERROR: Please specify FILE=backup_file.sql.gz" && exit 1)
	gunzip -c $(FILE) | docker-compose exec -T postgres psql -U emr_user emr_db

# Development helpers
dev-backend:
	cd backend && python main.py

dev-frontend:
	cd frontend && npm start

# Health checks
health:
	@echo "Checking service health..."
	@curl -s http://localhost:8000/health || echo "Backend not ready"
	@curl -s http://localhost:3000 || echo "Frontend not ready"
	@curl -s http://localhost:8000/fhir/R4/metadata || echo "FHIR API not ready"

# Docker stats
stats:
	docker stats --no-stream

# Update dependencies
update-deps:
	cd backend && pip install --upgrade -r requirements.txt
	cd frontend && npm update

# Security scan
security-scan:
	cd backend && pip install safety && safety check
	cd frontend && npm audit

# Production build
prod-build:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-up:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d