# Makefile with Synthea Master Script Integration

.PHONY: help setup synthea-setup synthea-generate synthea-import synthea-full synthea-clean dev-data test-data

help: ## Show this help message
	@echo "MedGenEMR Synthea Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Initial project setup
	cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
	cd frontend && npm install

synthea-setup: ## Setup Synthea for data generation
	cd backend && python scripts/synthea_master.py setup

synthea-generate: ## Generate Synthea data (use COUNT=N for specific number)
	cd backend && python scripts/synthea_master.py generate --count $(or $(COUNT),10)

synthea-import: ## Import existing Synthea data (use MODE=strict/light/etc)
	cd backend && python scripts/synthea_master.py import --validation-mode $(or $(MODE),transform_only)

synthea-full: ## Complete Synthea workflow (generate + import)
	cd backend && python scripts/synthea_master.py full --count $(or $(COUNT),10) --validation-mode $(or $(MODE),transform_only) $(if $(DICOM),--include-dicom)

synthea-clean: ## Clean/wipe Synthea data from database
	cd backend && python scripts/synthea_master.py wipe

synthea-validate: ## Validate imported Synthea data
	cd backend && python scripts/synthea_master.py validate

dev-data: ## Generate development data (5 patients, fast)
	cd backend && python scripts/synthea_master.py full --count 5 --validation-mode transform_only

test-data: ## Generate test data (2 patients, strict validation)
	cd backend && python scripts/synthea_master.py full --count 2 --validation-mode strict

# Development shortcuts
dev: setup dev-data ## Complete development setup with sample data
	@echo "✅ Development environment ready!"
	@echo "💡 Run 'make start' to launch the application"

start: ## Start the application
	./start.sh

# Examples with parameters:
# make synthea-full COUNT=20 MODE=light DICOM=1
# make synthea-generate COUNT=50
# make synthea-import MODE=strict
