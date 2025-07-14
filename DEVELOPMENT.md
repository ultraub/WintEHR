# WintEHR Development Environment

## 🔥 Hot Reload Development Setup

This document describes the hot reload development environment for WintEHR, enabling rapid development with automatic recompilation and reloading.

## Quick Start

```bash
# Start development environment with hot reload
./start-dev.sh

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

## Architecture

### Development Stack
- **Frontend**: React 18 with Webpack Dev Server (port 3000)
- **Backend**: FastAPI with uvicorn --reload (port 8000)
- **Database**: PostgreSQL 15 (port 5432)
- **Container Orchestration**: Docker Compose

### Hot Reload Configuration

#### Backend (Python/FastAPI)
- **File**: `backend/Dockerfile.dev`
- **Command**: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app`
- **Environment Variables**:
  - `PYTHONUNBUFFERED=1` - Real-time logging
  - `PYTHONDONTWRITEBYTECODE=1` - Skip .pyc files
  - `WATCHFILES_FORCE_POLLING=true` - File watching in Docker

#### Frontend (React)
- **File**: `frontend/Dockerfile.dev`
- **Command**: `npm start`
- **Environment Variables**:
  - `CHOKIDAR_USEPOLLING=true` - File watching in Docker
  - `WATCHPACK_POLLING=true` - Webpack polling
  - `FAST_REFRESH=true` - React Fast Refresh
  - `WDS_SOCKET_HOST=localhost` - WebSocket configuration

## File Structure

```
📁 WintEHR/
├── 🐳 docker-compose.dev.yml     # Development configuration
├── 📁 backend/
│   └── 🐳 Dockerfile.dev         # Backend development image
├── 📁 frontend/
│   └── 🐳 Dockerfile.dev         # Frontend development image
├── 🚀 start-dev.sh               # Development startup script
└── 🧪 test-hot-reload.sh         # Hot reload verification
```

## Development Workflow

### 1. Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd WintEHR

# Start development environment
./start-dev.sh
```

### 2. Development Process

#### Backend Development
1. Edit any Python file in `backend/`
2. uvicorn automatically detects changes
3. API server reloads within 1-2 seconds
4. Changes are immediately available at http://localhost:8000

#### Frontend Development
1. Edit any React file in `frontend/src/`
2. Webpack detects changes and recompiles
3. Browser automatically refreshes or hot-swaps components
4. Changes are immediately visible at http://localhost:3000

### 3. Testing Changes
```bash
# Verify hot reload is working
./test-hot-reload.sh

# Monitor logs in real-time
docker-compose -f docker-compose.dev.yml logs -f

# Check specific service logs
docker-compose -f docker-compose.dev.yml logs backend -f
docker-compose -f docker-compose.dev.yml logs frontend -f
```

## Development URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | React development server |
| **Backend API** | http://localhost:8000 | FastAPI with hot reload |
| **API Documentation** | http://localhost:8000/docs | Interactive Swagger UI |
| **FHIR Endpoint** | http://localhost:8000/fhir/R4 | FHIR R4 REST API |
| **Database** | postgresql://localhost:5432/emr_db | PostgreSQL connection |

## Environment Variables

### Backend (.env)
```bash
# Authentication
JWT_ENABLED=false                    # Development mode (no auth)
JWT_SECRET=dev-secret-key

# Database
DATABASE_URL=postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db

# Python Development
PYTHONUNBUFFERED=1                   # Real-time logging
PYTHONDONTWRITEBYTECODE=1            # Skip .pyc generation
WATCHFILES_FORCE_POLLING=true        # File watching in containers

# External APIs (optional)
ANTHROPIC_API_KEY=                   # For UI Composer features
```

### Frontend
```bash
# API Endpoints
REACT_APP_FHIR_ENDPOINT=http://localhost:8000/fhir/R4
REACT_APP_EMR_API=http://localhost:8000/api/emr
REACT_APP_CLINICAL_CANVAS_API=http://localhost:8000/api/clinical-canvas

# Development
CHOKIDAR_USEPOLLING=true             # File watching
WATCHPACK_POLLING=true               # Webpack polling
FAST_REFRESH=true                    # React Fast Refresh
WDS_SOCKET_HOST=localhost            # Dev server WebSocket
WDS_SOCKET_PORT=3000
```

## Container Configuration

### Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| **Volumes** | Source code mounted | Code copied to image |
| **Reload** | Automatic | Manual restart required |
| **Build** | Development dependencies | Production optimized |
| **Ports** | Direct access (3000, 8000) | Reverse proxy (80, 443) |
| **Environment** | Development defaults | Production secrets |

### Volume Mounts
```yaml
backend:
  volumes:
    - ./backend:/app              # Source code hot reload
    - /app/__pycache__            # Exclude Python cache

frontend:
  volumes:
    - ./frontend:/app             # Source code hot reload
    - /app/node_modules           # Persist node modules
```

## Troubleshooting

### Common Issues

#### Hot Reload Not Working
```bash
# Check container logs
docker-compose -f docker-compose.dev.yml logs backend --tail=20
docker-compose -f docker-compose.dev.yml logs frontend --tail=20

# Restart specific service
docker-compose -f docker-compose.dev.yml restart backend
docker-compose -f docker-compose.dev.yml restart frontend
```

#### File Watching Issues (macOS/Windows)
```bash
# Increase file watcher limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Force polling mode (all platforms)
export CHOKIDAR_USEPOLLING=true
export WATCHFILES_FORCE_POLLING=true
```

#### Port Conflicts
```bash
# Check what's using ports
lsof -i :3000
lsof -i :8000
lsof -i :5432

# Stop conflicting services
docker stop $(docker ps -q)
```

#### Database Issues
```bash
# Reset database completely
docker-compose -f docker-compose.dev.yml down -v
./start-dev.sh

# Import fresh data
cd backend && python scripts/synthea_master.py full --count 10
```

### Performance Optimization

#### Speed Up Initial Startup
```bash
# Pre-build development images
docker-compose -f docker-compose.dev.yml build

# Use cached node_modules
docker volume create wintehr_frontend_node_modules
```

#### Reduce Resource Usage
```bash
# Limit container resources
docker-compose -f docker-compose.dev.yml up --scale frontend=1 --scale backend=1
```

## Development Commands

### Container Management
```bash
# Start development environment
./start-dev.sh

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Restart single service
docker-compose -f docker-compose.dev.yml restart backend

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Shell into container
docker-compose -f docker-compose.dev.yml exec backend bash
docker-compose -f docker-compose.dev.yml exec frontend sh
```

### Database Operations
```bash
# Connect to database
docker-compose -f docker-compose.dev.yml exec postgres psql -U emr_user -d emr_db

# Import sample data
docker-compose -f docker-compose.dev.yml exec backend python scripts/synthea_master.py import

# Run database migrations
docker-compose -f docker-compose.dev.yml exec backend python scripts/init_database_definitive.py
```

### Testing
```bash
# Run backend tests
docker-compose -f docker-compose.dev.yml exec backend pytest tests/ -v

# Run frontend tests
docker-compose -f docker-compose.dev.yml exec frontend npm test

# Integration tests
./test-hot-reload.sh
```

## Production Deployment

When ready for production, switch to the production configuration:

```bash
# Stop development environment
docker-compose -f docker-compose.dev.yml down

# Start production environment
./start.sh
```

## Best Practices

### Development Workflow
1. **Always use development environment** for coding
2. **Test changes frequently** using hot reload
3. **Monitor logs** for errors and warnings
4. **Use production environment** for final testing
5. **Commit working code** regularly

### Code Organization
1. **Backend**: Use proper module structure in `backend/`
2. **Frontend**: Follow React component patterns in `frontend/src/`
3. **Shared**: Keep common utilities in appropriate directories
4. **Tests**: Write tests alongside implementation

### Performance
1. **Minimize container rebuilds** by using volume mounts
2. **Use .dockerignore** to exclude unnecessary files
3. **Leverage Docker layer caching** for faster builds
4. **Monitor resource usage** during development

## Recent Updates

### 2025-07-12: Hot Reload Implementation
- ✅ Created `docker-compose.dev.yml` with hot reload configuration
- ✅ Added `Dockerfile.dev` for both frontend and backend
- ✅ Implemented `start-dev.sh` automated setup script
- ✅ Added `test-hot-reload.sh` verification script
- ✅ Configured environment variables for optimal development
- ✅ Tested both backend (Python) and frontend (React) hot reload
- ✅ Documented complete development workflow

### Features Added
- **Backend Hot Reload**: uvicorn --reload with file watching
- **Frontend Hot Reload**: React development server with Fast Refresh
- **Volume Optimization**: Efficient file mounting for rapid iteration
- **Environment Isolation**: Separate development configuration
- **Automated Scripts**: One-command setup and testing
- **Comprehensive Documentation**: Complete development guide

This development environment enables rapid iteration and testing, significantly improving the development experience for WintEHR.