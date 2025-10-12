# WintEHR Configuration Guide

Complete reference for configuring and deploying WintEHR with the configuration management system.

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration Files](#configuration-files)
- [Configuration Options](#configuration-options)
- [Environment-Specific Configurations](#environment-specific-configurations)
- [Secrets Management](#secrets-management)
- [Deployment Scenarios](#deployment-scenarios)
- [Validation](#validation)
- [Troubleshooting](#troubleshooting)

## Quick Start

### First-Time Setup

```bash
# 1. Copy example configuration files
cp config.example.yaml config.yaml
cp .env.example .env

# 2. Edit configuration
vim config.yaml  # Configure deployment settings
vim .env         # Set secrets (passwords, API keys)

# 3. Validate configuration
python3 deploy/validate_config.py

# 4. Deploy
./deploy.sh
```

### Development Environment

```bash
# Create dev-specific configuration
cp config.yaml config.dev.yaml

# Edit for development
vim config.dev.yaml  # Set patient_count: 10, enable_ssl: false

# Deploy in dev mode
./deploy.sh --environment dev
```

## Configuration Files

### config.yaml

Main configuration file (committed to git). Contains all non-secret deployment settings.

**Location**: `/config.yaml` (project root)

**Format**: YAML

**Structure**:
```yaml
deployment:        # Deployment settings
  environment      # dev, staging, production
  patient_count    # Number of synthetic patients
  enable_ssl       # SSL/HTTPS enabled

azure:             # Azure infrastructure
  resource_group   # Resource group name
  vm_name          # Virtual machine name
  nsg_name         # Network security group
  location         # Azure region

ssl:               # SSL/TLS configuration
  domain_name      # Fully qualified domain name
  ssl_email        # Admin email for certificates
  provider         # letsencrypt or custom

services:          # Service configuration
  ports            # Port mappings
  container_names  # Docker container names
  image_tags       # Docker image versions

database:          # Database configuration
  host             # Database host
  port             # Database port
  name             # Database name

hapi_fhir:         # HAPI FHIR settings
  memory           # JVM memory allocation
  validation_mode  # FHIR validation level
  narrative_enabled

synthea:           # Synthea configuration
  state            # US state for patients
  seed             # Random seed
  jar_version      # Synthea version

security:          # Network security
  allowed_ips      # IP whitelist (CIDR)
  cors_origins     # CORS allowed origins

paths:             # Storage paths
  data             # Persistent data
  logs             # Application logs
  backups          # Backup location
  uploads          # User uploads
```

### .env

Secrets file (NEVER commit to git). Contains passwords, API keys, and other sensitive data.

**Location**: `/.env` (project root)

**Format**: KEY=value

**Required Variables**:
```bash
# Database Credentials
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=<secure-random-password>
POSTGRES_DB=emr_db

# Application Secrets
SECRET_KEY=<random-secret-key>
JWT_SECRET=<random-jwt-secret>
```

**Optional Variables**:
```bash
# API Keys
TAVILY_API_KEY=<tavily-api-key>
ANTHROPIC_API_KEY=<anthropic-api-key>
```

### config.{environment}.yaml

Environment-specific configuration overrides.

**Supported Environments**:
- `config.dev.yaml` - Development
- `config.staging.yaml` - Staging
- `config.prod.yaml` - Production

**Example** (`config.dev.yaml`):
```yaml
deployment:
  patient_count: 10      # Fewer patients for dev
  enable_ssl: false      # No SSL for local dev

services:
  ports:
    frontend: 3001       # Avoid port conflicts
```

## Configuration Options

### Deployment Settings

#### deployment.environment

**Type**: String
**Options**: `dev`, `staging`, `production`
**Default**: `production`
**Description**: Deployment environment type. Affects logging, debug mode, and default settings.

```yaml
deployment:
  environment: production
```

#### deployment.patient_count

**Type**: Integer
**Range**: 1-1000+
**Default**: 50
**Description**: Number of synthetic patients to generate with Synthea.

**Guidelines**:
- **Dev**: 10 patients (fast testing)
- **Demo**: 50 patients (realistic data)
- **Production**: 100+ patients (comprehensive testing)

```yaml
deployment:
  patient_count: 50
```

#### deployment.enable_ssl

**Type**: Boolean
**Default**: `true`
**Description**: Enable SSL/HTTPS with automatic certificate generation.

**Requirements**:
- Valid domain name
- Domain points to server's public IP
- Ports 80 and 443 accessible

```yaml
deployment:
  enable_ssl: true
```

### Azure Infrastructure

#### azure.resource_group

**Type**: String
**Required**: For Azure deployments
**Description**: Azure resource group containing VM and network resources.

**Must exist** - create with:
```bash
az group create --name wintehr-rg --location eastus2
```

#### azure.vm_name

**Type**: String
**Required**: For Azure deployments
**Description**: Virtual machine name running the application.

#### azure.nsg_name

**Type**: String
**Required**: For Azure deployments
**Description**: Network Security Group for firewall rules.

#### azure.location

**Type**: String
**Default**: `eastus2`
**Description**: Azure region for resources.

**Common Regions**:
- `eastus`, `eastus2` - US East Coast
- `westus2` - US West Coast
- `centralus` - US Central
- `westeurope` - Europe

```yaml
azure:
  resource_group: wintehr-rg
  vm_name: wintehr-vm
  nsg_name: wintehr-nsg
  location: eastus2
```

### SSL/TLS Configuration

#### ssl.domain_name

**Type**: String
**Required**: If `enable_ssl: true`
**Format**: Fully qualified domain name (FQDN)

**Examples**:
- Azure: `wintehr.eastus2.cloudapp.azure.com`
- Custom: `ehr.example.com`

**Important**: DNS must be configured before SSL setup.

#### ssl.ssl_email

**Type**: String
**Required**: If `enable_ssl: true`
**Format**: Valid email address

**Description**: Admin email for Let's Encrypt notifications (renewal reminders, security notices).

#### ssl.provider

**Type**: String
**Options**: `letsencrypt`, `custom`
**Default**: `letsencrypt`

**Description**:
- `letsencrypt`: Free automated certificates (recommended)
- `custom`: Bring your own certificate files

```yaml
ssl:
  domain_name: wintehr.eastus2.cloudapp.azure.com
  ssl_email: admin@example.com
  provider: letsencrypt
```

### Service Configuration

#### services.ports

**Type**: Object (key-value pairs)
**Description**: Port mappings for all services.

**Defaults**:
```yaml
services:
  ports:
    frontend: 3000        # React app (internal)
    backend: 8000         # FastAPI server (internal)
    hapi_fhir: 8888       # HAPI FHIR server (internal)
    postgres: 5432        # PostgreSQL (internal)
    redis: 6379           # Redis cache (internal)
    nginx_http: 80        # Nginx HTTP (public)
    nginx_https: 443      # Nginx HTTPS (public)
```

**Validation**: Ports must be 1-65535, no duplicates.

#### services.container_names

**Type**: Object
**Description**: Docker container names for management.

**Usage**: `docker exec`, `docker logs`, service references.

#### services.image_tags

**Type**: Object
**Description**: Docker image versions to use.

**Options**: `latest`, `stable`, specific version (e.g., `v1.2.3`)

**Recommendation**: Use specific versions for production stability.

### Database Configuration

#### database.host

**Type**: String
**Default**: `postgres`
**Description**: Database host.

**Options**:
- `postgres` - Docker container (recommended)
- `localhost` - Local PostgreSQL
- IP/hostname - External database

#### database.port

**Type**: Integer
**Default**: 5432
**Description**: PostgreSQL port.

#### database.name

**Type**: String
**Default**: `emr_db`
**Description**: Database name used by HAPI FHIR.

**Note**: Username and password are in `.env` file.

### HAPI FHIR Settings

#### hapi_fhir.memory

**Type**: String
**Format**: `<number>g` (gigabytes)
**Default**: `2g`

**Description**: JVM memory allocation for HAPI FHIR.

**Recommendations**:
- **Small** (1-50 patients): `1g`
- **Medium** (50-500 patients): `2g`
- **Large** (500+ patients): `4g` or more

**Important**: Must not exceed (VM memory - 2GB for other services).

#### hapi_fhir.validation_mode

**Type**: String
**Options**: `NEVER`, `ONCE`, `ALWAYS`
**Default**: `NEVER`

**Description**:
- `NEVER`: No validation (fastest, recommended for trusted data)
- `ONCE`: Validate first occurrence of each resource type
- `ALWAYS`: Validate every resource (slowest, strictest)

**Note**: Synthea data is pre-validated, so `NEVER` is safe.

### Synthea Configuration

#### synthea.state

**Type**: String
**Default**: `Massachusetts`
**Description**: US state for patient demographics.

**Affects**:
- Disease prevalence
- Demographics
- Provider networks

**Options**: Any US state name (e.g., `California`, `Texas`, `Florida`)

#### synthea.seed

**Type**: Integer
**Default**: 12345
**Description**: Random seed for reproducible data generation.

**Usage**: Same seed + same patient_count = same patients every time.

#### synthea.jar_version

**Type**: String
**Default**: `3.2.0`
**Description**: Synthea JAR version to download.

**Latest Stable**: 3.2.0

**Check releases**: https://github.com/synthetichealth/synthea/releases

### Security Configuration

#### security.allowed_ips

**Type**: Array of strings
**Format**: CIDR notation
**Default**: `[]` (allow all)

**Description**: IP address whitelist for access control.

**Examples**:
```yaml
security:
  allowed_ips:
    - "203.0.113.5/32"          # Single IP
    - "198.51.100.0/24"         # Subnet
```

**Note**: Applied to Azure NSG rules if using Azure deployment.

#### security.cors_origins

**Type**: Array of strings
**Default**: `["*"]`

**Description**: CORS (Cross-Origin Resource Sharing) allowed origins.

**Development**: Use `["*"]` to allow all origins.

**Production**: Specify exact domains:
```yaml
security:
  cors_origins:
    - "https://wintehr.com"
    - "https://app.wintehr.com"
```

### Storage Paths

**Type**: Strings
**Description**: All paths are inside Docker containers.

**Defaults**:
```yaml
paths:
  data: /app/data          # Persistent data
  logs: /app/logs          # Application logs
  backups: /app/backups    # System backups
  uploads: /app/uploads    # User files (DICOM, etc.)
```

**Note**: Mapped to host volumes in docker-compose. Only change if you have specific storage requirements.

## Environment-Specific Configurations

### Configuration Merging

The configuration system merges multiple sources in priority order:

**Priority** (highest to lowest):
1. Environment variables (`WINTEHR_*` format)
2. `.env` file (secrets only)
3. `config.{environment}.yaml` (environment-specific)
4. `config.yaml` (base configuration)
5. Default values in code

### Creating Environment Configs

**Development** (`config.dev.yaml`):
```yaml
deployment:
  patient_count: 10
  enable_ssl: false

services:
  ports:
    frontend: 3001
```

**Staging** (`config.staging.yaml`):
```yaml
deployment:
  patient_count: 50
  enable_ssl: true

ssl:
  domain_name: staging.wintehr.com
```

**Production** (`config.prod.yaml`):
```yaml
deployment:
  patient_count: 100
  enable_ssl: true

hapi_fhir:
  memory: 4g
```

### Environment Variable Overrides

Format: `WINTEHR_SECTION_KEY=value`

**Examples**:
```bash
# Override patient count
export WINTEHR_DEPLOYMENT_PATIENT_COUNT=25

# Override domain
export WINTEHR_SSL_DOMAIN_NAME=custom.domain.com

# Override ports
export WINTEHR_SERVICES_PORTS_FRONTEND=3002
```

**Usage**:
```bash
# One-time override
WINTEHR_DEPLOYMENT_PATIENT_COUNT=25 ./deploy.sh

# Persistent override
export WINTEHR_DEPLOYMENT_PATIENT_COUNT=25
./deploy.sh
```

## Secrets Management

### Required Secrets

**Database Credentials**:
```bash
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=<secure-random-password>
POSTGRES_DB=emr_db
```

**Application Secrets**:
```bash
SECRET_KEY=<random-secret-key>
JWT_SECRET=<random-jwt-secret>
```

### Generating Secure Secrets

**Linux/Mac**:
```bash
# Database password
openssl rand -base64 32

# Application secrets
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

**Requirements**:
- Minimum 16 characters for passwords
- Minimum 32 characters for secret keys
- Each secret should be different
- Use random generation, not dictionary words

### Secret Storage

**Local Development**: `.env` file (not committed)

**Production**: Use secret management services:
- Azure Key Vault
- AWS Secrets Manager
- HashiCorp Vault

### .gitignore

Ensure `.env` is in `.gitignore`:
```
.env
*.env
!.env.example
```

## Deployment Scenarios

### Local Development

```bash
# 1. Configuration
cp config.example.yaml config.dev.yaml
# Edit: patient_count: 10, enable_ssl: false

# 2. Deploy
./deploy.sh --environment dev
```

### Azure Cloud

```bash
# 1. Configuration
vim config.yaml
# Set:
#   - azure.resource_group
#   - azure.vm_name
#   - ssl.domain_name
#   - ssl.ssl_email

# 2. Deploy
./deploy.sh

# 3. Configure firewall
# Automatic via deploy.sh
```

### Custom Domain

```bash
# 1. DNS Configuration
# Point your-domain.com to server IP

# 2. Configuration
vim config.yaml
# Set:
#   - ssl.domain_name: your-domain.com
#   - ssl.ssl_email: admin@your-domain.com

# 3. Deploy
./deploy.sh
```

### Multi-Environment

```bash
# Development
./deploy.sh --environment dev

# Staging
./deploy.sh --environment staging

# Production
./deploy.sh --environment production
```

## Validation

### Manual Validation

```bash
python3 deploy/validate_config.py
```

**Options**:
```bash
# Specific environment
python3 deploy/validate_config.py --environment staging

# With configuration summary
python3 deploy/validate_config.py --summary

# Verbose output
python3 deploy/validate_config.py --verbose
```

### Automatic Validation

Validation runs automatically during `./deploy.sh`:
- Checks required fields
- Validates field formats
- Verifies secret strength
- Checks for conflicts

### Validation Errors

**Common Issues**:

**Missing required field**:
```
Missing required field: ssl.domain_name
```
**Solution**: Add missing field to config.yaml

**Invalid format**:
```
Invalid domain_name format: bad domain
```
**Solution**: Use valid FQDN (e.g., `example.com`)

**Weak secret**:
```
POSTGRES_PASSWORD is weak (length: 8, recommended: 16+)
```
**Solution**: Generate stronger password

## Troubleshooting

### Configuration Not Loading

**Symptom**: "config.yaml not found"

**Solution**:
```bash
# Copy example configuration
cp config.example.yaml config.yaml
vim config.yaml
```

### Validation Failures

**Symptom**: Validation errors prevent deployment

**Check**:
1. Required fields present
2. Formats correct (email, domain, ports)
3. No duplicate ports
4. Secrets set in .env

**Re-validate**:
```bash
python3 deploy/validate_config.py --verbose
```

### Environment Variable Override Not Working

**Format**: `WINTEHR_SECTION_KEY` (note underscores)

**Examples**:
```bash
# Correct
export WINTEHR_DEPLOYMENT_PATIENT_COUNT=25

# Wrong
export deployment_patient_count=25  # Missing prefix
export DEPLOYMENT_PATIENT_COUNT=25  # Wrong prefix
```

### Secrets Not Found

**Symptom**: "POSTGRES_PASSWORD not set"

**Solution**:
```bash
# 1. Verify .env exists
ls -la .env

# 2. Check contents
cat .env | grep POSTGRES_PASSWORD

# 3. Source manually (testing)
source .env
echo $POSTGRES_PASSWORD
```

### Port Conflicts

**Symptom**: "Port already in use"

**Solution**:
```bash
# 1. Check what's using the port
sudo lsof -i :8000

# 2. Change port in config.yaml
vim config.yaml
# Change services.ports.backend: 8001

# 3. Redeploy
./deploy.sh
```

### Azure NSG Configuration Fails

**Symptom**: NSG rules not created

**Check**:
1. Azure CLI installed and logged in
2. Resource group exists
3. Sufficient permissions

**Manual fix**:
```bash
# Login
az login

# Create resource group if needed
az group create --name wintehr-rg --location eastus2

# Run NSG configuration
bash deploy/configure-azure-nsg.sh
```

### SSL Certificate Fails

**Symptom**: Let's Encrypt certificate not obtained

**Check**:
1. Domain resolves to server IP: `nslookup your-domain.com`
2. Ports 80/443 accessible: `curl http://your-domain.com`
3. Nginx running: `docker ps | grep nginx`

**Manual fix**:
```bash
# Run SSL setup separately
bash deploy/setup-ssl.sh
```

## Advanced Topics

### Custom Configuration Loaders

The configuration system is extensible. Create custom loaders for:
- Database-backed configuration
- Remote configuration services
- Encrypted configuration files

**Example** (read from database):
```python
from deploy.config_loader import ConfigLoader

class DatabaseConfigLoader(ConfigLoader):
    def load(self, environment):
        base_config = super().load(environment)
        # Merge with database config
        db_config = fetch_from_database()
        return self._deep_merge(base_config, db_config)
```

### Configuration Validation Rules

Add custom validation rules in `deploy/validate_config.py`:

```python
def validate_custom_rule(config):
    if config['deployment']['patient_count'] > 500:
        if config['hapi_fhir']['memory'] < '4g':
            raise ConfigurationError(
                "Large patient counts require more memory"
            )
```

### Configuration Templates

Generate configuration from templates:

```bash
# Generate config from template
python -c "
from jinja2 import Template
template = Template(open('config.template.yaml').read())
print(template.render(domain='example.com', patients=50))
" > config.yaml
```

## Best Practices

1. **Version Control**: Commit config.yaml, NOT .env
2. **Environment Separation**: Use config.{env}.yaml for environment differences
3. **Secret Rotation**: Regularly rotate passwords and API keys
4. **Validation**: Always validate before deploying
5. **Documentation**: Document custom configuration choices
6. **Backup**: Keep backup of working configurations
7. **Testing**: Test configuration changes in dev before production
8. **Monitoring**: Monitor configuration drift in production

## See Also

- [Main README](../README.md) - Project overview
- [Deployment Guide](DEPLOYMENT_STATUS.md) - Deployment procedures
- [Scripts Guide](../backend/scripts/CLAUDE.md) - Data management scripts
