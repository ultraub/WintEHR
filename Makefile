# MedGenEMR Development Makefile
# Provides unified commands for development, testing, and deployment

.PHONY: help setup start stop restart status clean test lint build deploy

# Default target
help:
	@echo "MedGenEMR Development Commands"
	@echo "=============================="
	@echo ""
	@echo "Setup Commands:"
	@echo "  setup          - Initial project setup"
	@echo "  setup-dev      - Setup development environment"
	@echo "  setup-prod     - Setup production environment"
	@echo ""
	@echo "Service Commands:"
	@echo "  start          - Start all services"
	@echo "  start-quick    - Start services without test data"
	@echo "  stop           - Stop all services"
	@echo "  restart        - Restart all services"
	@echo "  status         - Show service status"
	@echo ""
	@echo "Development Commands:"
	@echo "  test           - Run all tests"
	@echo "  test-backend   - Run backend tests only"
	@echo "  test-frontend  - Run frontend tests only"
	@echo "  lint           - Run all linting"
	@echo "  lint-fix       - Fix linting issues"
	@echo "  format         - Format code"
	@echo ""
	@echo "Build Commands:"
	@echo "  build          - Build all components"
	@echo "  build-frontend - Build frontend only"
	@echo "  build-backend  - Build backend only"
	@echo ""
	@echo "Data Commands:"
	@echo "  data-generate  - Generate test data with Synthea"
	@echo "  data-reset     - Reset database and regenerate data"
	@echo "  data-validate  - Validate FHIR data"
	@echo ""
	@echo "Utility Commands:"
	@echo "  clean          - Clean build artifacts"
	@echo "  logs           - Show service logs"
	@echo "  shell-backend  - Open backend shell"
	@echo "  shell-db       - Open database shell"

# Setup commands
setup:
	@echo "Setting up MedGenEMR..."
	./start-all.sh setup

setup-dev:
	@echo "Setting up development environment..."
	export ENVIRONMENT=development && ./start-all.sh setup

setup-prod:
	@echo "Setting up production environment..."
	export ENVIRONMENT=production && ./start-all.sh setup

# Service commands
start:
	@echo "Starting all services..."
	./start-all.sh start

start-quick:
	@echo "Starting services without test data..."
	./start-all.sh start --skip-data

stop:
	@echo "Stopping all services..."
	./start-all.sh stop

restart:
	@echo "Restarting all services..."
	./start-all.sh restart

status:
	@echo "Checking service status..."
	./start-all.sh status

# Development commands
test: test-backend test-frontend

test-backend:
	@echo "Running backend tests..."
	cd backend && \
	source venv/bin/activate && \
	pytest tests/ -v --cov=. --cov-report=html --cov-report=term

test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm run test:ci

test-coverage:
	@echo "Running tests with coverage..."
	cd backend && source venv/bin/activate && pytest tests/ --cov=. --cov-report=html
	cd frontend && npm run test:coverage

lint: lint-backend lint-frontend

lint-backend:
	@echo "Linting backend code..."
	cd backend && \
	source venv/bin/activate && \
	flake8 . --exclude=venv,migrations --max-line-length=120 && \
	black --check . --exclude=venv && \
	isort --check-only .

lint-frontend:
	@echo "Linting frontend code..."
	cd frontend && npm run lint

lint-fix:
	@echo "Fixing linting issues..."
	cd backend && \
	source venv/bin/activate && \
	black . --exclude=venv && \
	isort .
	cd frontend && npm run lint:fix

format: lint-fix

# Build commands
build: build-backend build-frontend

build-backend:
	@echo "Building backend..."
	cd backend && \
	source venv/bin/activate && \
	pip install -r requirements.txt && \
	python -m compileall .

build-frontend:
	@echo "Building frontend..."
	cd frontend && \
	npm ci && \
	npm run build

build-prod:
	@echo "Building for production..."
	cd frontend && npm run build:production

# Data commands
data-generate:
	@echo "Generating test data..."
	./start-all.sh data

data-reset:
	@echo "Resetting database and regenerating data..."
	cd backend && \
	source venv/bin/activate && \
	python scripts/reset_and_init_database.py && \
	python scripts/synthea_workflow.py full --count 10

data-validate:
	@echo "Validating FHIR data..."
	cd backend && \
	source venv/bin/activate && \
	python scripts/synthea_import_with_validation.py

# Utility commands
clean:
	@echo "Cleaning build artifacts..."
	rm -rf frontend/build
	rm -rf frontend/node_modules/.cache
	rm -rf backend/__pycache__
	rm -rf backend/**/__pycache__
	rm -rf backend/venv
	rm -rf logs/*
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete

logs:
	@echo "Service logs:"
	@echo "============="
	@echo "Backend logs:"
	@tail -f logs/backend.log &
	@echo "Frontend logs:"
	@tail -f logs/frontend.log

shell-backend:
	@echo "Opening backend Python shell..."
	cd backend && source venv/bin/activate && python

shell-db:
	@echo "Opening database shell..."
	psql -h localhost -p 5432 -U emr_user -d emr_db

# Docker commands (for future use)
docker-build:
	@echo "Building Docker images..."
	docker-compose build

docker-up:
	@echo "Starting Docker containers..."
	docker-compose up -d

docker-down:
	@echo "Stopping Docker containers..."
	docker-compose down

docker-logs:
	@echo "Showing Docker logs..."
	docker-compose logs -f

# CI/CD helpers
ci-test:
	@echo "Running CI tests..."
	make test-backend
	make test-frontend
	make lint

ci-build:
	@echo "Running CI build..."
	make build

ci-deploy:
	@echo "Running CI deployment..."
	make build-prod
	# Add deployment commands here

# Development helpers
dev-reset:
	@echo "Resetting development environment..."
	make stop
	make clean
	make setup-dev
	make start

dev-update:
	@echo "Updating development environment..."
	git pull
	cd backend && source venv/bin/activate && pip install -r requirements.txt
	cd frontend && npm install
	make restart

# Database management
db-migrate:
	@echo "Running database migrations..."
	cd backend && source venv/bin/activate && alembic upgrade head

db-reset:
	@echo "Resetting database..."
	cd backend && source venv/bin/activate && python scripts/reset_and_init_database.py

db-backup:
	@echo "Backing up database..."
	pg_dump -h localhost -p 5432 -U emr_user emr_db > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Synthea specific
synthea-build:
	@echo "Building Synthea..."
	cd synthea && ./gradlew build -x test

synthea-generate:
	@echo "Generating Synthea data..."
	cd backend && \
	source venv/bin/activate && \
	python scripts/synthea_workflow.py generate --count 5

synthea-import:
	@echo "Importing Synthea data..."
	cd backend && \
	source venv/bin/activate && \
	python scripts/synthea_workflow.py import

# Documentation
docs-build:
	@echo "Building documentation..."
	# Add documentation build commands

docs-serve:
	@echo "Serving documentation..."
	# Add documentation serve commands