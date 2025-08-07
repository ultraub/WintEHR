# WintEHR Developer Guide

**Version**: 1.0.0  
**Last Updated**: 2025-08-06

## Table of Contents
- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Code Structure](#code-structure)
- [Development Workflow](#development-workflow)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [Database Development](#database-development)
- [Testing](#testing)
- [Code Style](#code-style)
- [Contributing](#contributing)

## Getting Started

### Quick Setup
```bash
# Clone the repository
git clone https://github.com/ultraub/WintEHR.git
cd WintEHR

# Start development environment
./deploy.sh dev --patients 20

# Access the application
open http://localhost
```

### Development Prerequisites
- Git
- Docker Desktop (includes Docker Compose)
- Node.js 18+ (for local development)
- Python 3.9+ (for local development)
- VS Code or preferred IDE

### Recommended VS Code Extensions
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-python.python",
    "ms-python.vscode-pylance",
    "bradlc.vscode-tailwindcss",
    "dsznajder.es7-react-js-snippets",
    "ms-vscode.vscode-typescript-tsc",
    "ms-azuretools.vscode-docker"
  ]
}
```

## Development Environment

### Environment Setup
```bash
# Install dependencies locally (optional for IDE support)
cd frontend && npm install
cd ../backend && pip install -r requirements.txt

# Copy environment template
cp .env.example .env.development

# Start services with hot-reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Development URLs
- **Frontend**: http://localhost:3000 (with hot-reload)
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Database**: localhost:5432
- **Redis**: localhost:6379

### Development Accounts
| Username | Password | Role | Use Case |
|----------|----------|------|----------|
| demo | password | Physician | Full clinical features |
| nurse | password | Nurse | Limited prescribing |
| pharmacist | password | Pharmacist | Pharmacy module |
| admin | password | Admin | System configuration |

## Code Structure

### Repository Layout
```
WintEHR/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── utils/          # Utility functions
│   │   └── styles/         # Global styles
│   ├── public/             # Static assets
│   └── package.json
│
├── backend/                 # FastAPI application
│   ├── api/                # API endpoints
│   │   ├── auth/          # Authentication
│   │   ├── fhir/          # FHIR endpoints
│   │   └── services/      # Service endpoints
│   ├── fhir/              # FHIR implementation
│   │   ├── core/          # Core FHIR logic
│   │   └── resources/     # Resource handlers
│   ├── services/          # Business logic
│   ├── database/          # Database models
│   ├── scripts/           # Utility scripts
│   └── requirements.txt
│
├── docs/                   # Documentation
├── tests/                  # Test suites
├── nginx/                  # Nginx configuration
├── docker-compose.yml      # Container orchestration
└── deploy.sh              # Deployment script
```

## Development Workflow

### Git Workflow

#### Branch Strategy
```bash
# Main branches
main          # Production-ready code
develop       # Development integration
fhir-native-redesign  # Current active branch

# Feature branches
feature/add-patient-search
feature/implement-cds-hooks

# Bugfix branches
bugfix/fix-login-error
bugfix/resolve-fhir-validation

# Release branches
release/v1.0.0
```

#### Commit Convention
```bash
# Format: <type>(<scope>): <subject>

# Types:
feat: New feature
fix: Bug fix
docs: Documentation
style: Code style changes
refactor: Code refactoring
test: Test changes
chore: Build/tool changes

# Examples:
git commit -m "feat(patient): Add patient search functionality"
git commit -m "fix(auth): Resolve JWT token expiration issue"
git commit -m "docs: Update API documentation"
```

### Development Cycle
```bash
# 1. Create feature branch
git checkout -b feature/your-feature

# 2. Make changes and test
# ... code changes ...
npm test
pytest

# 3. Commit changes
git add .
git commit -m "feat: Add your feature"

# 4. Push to remote
git push origin feature/your-feature

# 5. Create pull request
# Via GitHub UI or CLI
gh pr create --title "Add your feature" --body "Description"
```

## Frontend Development

### React Component Structure
```javascript
// components/clinical/PatientCard.jsx
import React, { useState, useEffect } from 'react';
import { Card, Typography } from '@mui/material';
import { useFHIRResource } from '@/hooks/useFHIRResource';

const PatientCard = ({ patientId }) => {
  const { resource: patient, loading, error } = useFHIRResource('Patient', patientId);
  
  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <Card>
      <Typography variant="h6">
        {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
      </Typography>
      {/* Component content */}
    </Card>
  );
};

export default PatientCard;
```

### State Management
```javascript
// contexts/PatientContext.js
import React, { createContext, useContext, useState } from 'react';

const PatientContext = createContext();

export const PatientProvider = ({ children }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  
  const value = {
    selectedPatient,
    setSelectedPatient,
    patients,
    setPatients
  };
  
  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within PatientProvider');
  }
  return context;
};
```

### Service Integration
```javascript
// services/fhirClient.js
import axios from 'axios';

class FHIRClient {
  constructor(baseURL = '/api/fhir/R4') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/fhir+json'
      }
    });
    
    // Add auth interceptor
    this.client.interceptors.request.use(config => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }
  
  async read(resourceType, id) {
    const response = await this.client.get(`/${resourceType}/${id}`);
    return response.data;
  }
  
  async search(resourceType, params) {
    const response = await this.client.get(`/${resourceType}`, { params });
    return response.data;
  }
  
  async create(resourceType, resource) {
    const response = await this.client.post(`/${resourceType}`, resource);
    return response.data;
  }
}

export default new FHIRClient();
```

### Custom Hooks
```javascript
// hooks/useFHIRResource.js
import { useState, useEffect } from 'react';
import fhirClient from '@/services/fhirClient';

export const useFHIRResource = (resourceType, id) => {
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchResource = async () => {
      try {
        setLoading(true);
        const data = await fhirClient.read(resourceType, id);
        setResource(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchResource();
    }
  }, [resourceType, id]);
  
  return { resource, loading, error };
};
```

### Component Testing
```javascript
// __tests__/PatientCard.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import PatientCard from '@/components/clinical/PatientCard';
import { FHIRResourceProvider } from '@/contexts/FHIRResourceContext';

describe('PatientCard', () => {
  it('displays patient name', async () => {
    const mockPatient = {
      id: '123',
      name: [{ given: ['John'], family: 'Doe' }]
    };
    
    render(
      <FHIRResourceProvider>
        <PatientCard patientId="123" />
      </FHIRResourceProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});
```

## Backend Development

### FastAPI Route Structure
```python
# api/fhir/patient.py
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from fhir.core.storage import FHIRStorageEngine
from api.auth.dependencies import get_current_user

router = APIRouter(prefix="/fhir/R4", tags=["FHIR"])

@router.get("/Patient/{patient_id}")
async def read_patient(
    patient_id: str,
    storage: FHIRStorageEngine = Depends(get_storage),
    current_user = Depends(get_current_user)
):
    """Read a patient resource by ID."""
    try:
        patient = await storage.read("Patient", patient_id)
        if not patient:
            raise HTTPException(404, f"Patient {patient_id} not found")
        return patient
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/Patient")
async def create_patient(
    patient: dict,
    storage: FHIRStorageEngine = Depends(get_storage),
    current_user = Depends(get_current_user)
):
    """Create a new patient resource."""
    try:
        # Validate FHIR resource
        if patient.get("resourceType") != "Patient":
            raise HTTPException(400, "Invalid resource type")
        
        # Create resource
        created = await storage.create("Patient", patient)
        return created
    except Exception as e:
        raise HTTPException(500, str(e))
```

### Service Layer
```python
# services/clinical_catalog.py
from typing import List, Dict, Optional
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

class ClinicalCatalogService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_medication_catalog(
        self, 
        search: Optional[str] = None
    ) -> List[Dict]:
        """Get available medications from patient data."""
        query = text("""
            SELECT DISTINCT
                resource_data->>'code' as code,
                resource_data->'code'->'coding'->0->>'display' as name,
                resource_data->'code'->'coding'->0->>'system' as system
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND resource_data->>'code' IS NOT NULL
        """)
        
        if search:
            query = text(query.text + " AND resource_data->'code'->'text' ILIKE :search")
            result = await self.db.execute(query, {"search": f"%{search}%"})
        else:
            result = await self.db.execute(query)
        
        medications = []
        for row in result:
            medications.append({
                "code": row.code,
                "name": row.name,
                "system": row.system
            })
        
        return medications
```

### Database Models
```python
# database/models.py
from sqlalchemy import Column, String, DateTime, JSON, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class FHIRResource(Base):
    __tablename__ = "resources"
    __table_args__ = {"schema": "fhir"}
    
    id = Column(String, primary_key=True)
    resource_type = Column(String, nullable=False, index=True)
    resource_data = Column(JSON, nullable=False)
    version_id = Column(Integer, default=1)
    last_updated = Column(DateTime, server_default=func.now())
    
    def to_fhir(self):
        """Convert to FHIR format."""
        resource = self.resource_data.copy()
        resource["id"] = self.id
        resource["meta"] = {
            "versionId": str(self.version_id),
            "lastUpdated": self.last_updated.isoformat()
        }
        return resource
```

### Async Database Operations
```python
# database/session.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=40
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### Background Tasks
```python
# services/background_tasks.py
from celery import Celery
from typing import List

celery_app = Celery(
    'wintehr',
    broker='redis://redis:6379/0',
    backend='redis://redis:6379/1'
)

@celery_app.task
def generate_dicom_images(study_id: str):
    """Generate DICOM images for an imaging study."""
    # Implementation
    pass

@celery_app.task
def index_search_parameters(resource_ids: List[str]):
    """Index search parameters for resources."""
    # Implementation
    pass

@celery_app.task
def send_clinical_notification(event_type: str, data: dict):
    """Send real-time clinical notifications."""
    # Implementation
    pass
```

## Database Development

### Migration Management
```bash
# Create new migration
alembic revision --autogenerate -m "Add new table"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Query Optimization
```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT r.* 
FROM fhir.resources r
JOIN fhir.search_params sp ON r.id = sp.resource_id
WHERE sp.param_name = 'patient'
AND sp.value_reference = 'Patient/123';

-- Create optimized indexes
CREATE INDEX idx_search_params_lookup 
ON fhir.search_params(param_name, value_reference)
WHERE value_reference IS NOT NULL;
```

### JSONB Operations
```sql
-- Query JSONB data
SELECT 
    resource_data->>'birthDate' as birth_date,
    resource_data->'name'->0->>'family' as last_name
FROM fhir.resources
WHERE resource_type = 'Patient'
AND resource_data @> '{"gender": "female"}';

-- Update JSONB field
UPDATE fhir.resources
SET resource_data = jsonb_set(
    resource_data,
    '{active}',
    'true'::jsonb
)
WHERE id = 'patient-123';
```

## Testing

### Unit Testing

#### Frontend Tests
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test PatientCard

# Watch mode
npm test -- --watch
```

#### Backend Tests
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=api --cov-report=html

# Run specific test
pytest tests/test_patient_api.py

# Run with verbose output
pytest -v
```

### Integration Testing
```python
# tests/integration/test_patient_workflow.py
import pytest
from httpx import AsyncClient
from app import app

@pytest.mark.asyncio
async def test_patient_creation_workflow():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create patient
        patient_data = {
            "resourceType": "Patient",
            "name": [{"family": "Test", "given": ["User"]}]
        }
        response = await client.post("/fhir/R4/Patient", json=patient_data)
        assert response.status_code == 201
        patient_id = response.json()["id"]
        
        # Read patient
        response = await client.get(f"/fhir/R4/Patient/{patient_id}")
        assert response.status_code == 200
        
        # Search patient
        response = await client.get("/fhir/R4/Patient?name=Test")
        assert response.status_code == 200
        assert response.json()["total"] >= 1
```

### E2E Testing
```javascript
// tests/e2e/patient.spec.js
describe('Patient Management', () => {
  beforeEach(() => {
    cy.login('demo', 'password');
    cy.visit('/patients');
  });
  
  it('should create a new patient', () => {
    cy.get('[data-testid="add-patient-btn"]').click();
    cy.get('[name="firstName"]').type('John');
    cy.get('[name="lastName"]').type('Doe');
    cy.get('[name="birthDate"]').type('1990-01-01');
    cy.get('[data-testid="save-btn"]').click();
    
    cy.contains('Patient created successfully').should('be.visible');
    cy.contains('John Doe').should('be.visible');
  });
});
```

## Code Style

### JavaScript/TypeScript
```javascript
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "no-console": "warn",
    "react/prop-types": "off"
  }
}
```

### Python
```python
# pyproject.toml
[tool.black]
line-length = 88
target-version = ['py39']

[tool.isort]
profile = "black"
line_length = 88

[tool.pylint]
max-line-length = 88
disable = ["C0114", "C0116"]
```

### Pre-commit Hooks
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      
  - repo: https://github.com/psf/black
    rev: 23.3.0
    hooks:
      - id: black
        
  - repo: https://github.com/pycqa/isort
    rev: 5.12.0
    hooks:
      - id: isort
```

## Contributing

### Setting Up Development Environment
```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/WintEHR.git
cd WintEHR

# Add upstream remote
git remote add upstream https://github.com/ultraub/WintEHR.git

# Install pre-commit hooks
pip install pre-commit
pre-commit install

# Start development
./deploy.sh dev
```

### Development Guidelines

#### Code Quality Standards
- Write clean, readable code
- Follow established patterns
- Add comprehensive tests
- Document complex logic
- Use meaningful variable names
- Keep functions small and focused

#### Pull Request Process
1. Create feature branch from `develop`
2. Write code and tests
3. Ensure all tests pass
4. Update documentation
5. Submit PR with clear description
6. Address review feedback
7. Squash commits if requested

#### Review Checklist
- [ ] Code follows project style guide
- [ ] Tests cover new functionality
- [ ] Documentation is updated
- [ ] No console.log or print statements
- [ ] Security best practices followed
- [ ] Performance impact considered
- [ ] Breaking changes documented

### Debugging Tips

#### Frontend Debugging
```javascript
// Use React DevTools
// Install browser extension

// Add debug statements
console.group('Patient Data');
console.log('Patient:', patient);
console.log('Loading:', loading);
console.groupEnd();

// Use debugger statement
debugger; // Execution will pause here

// Performance profiling
console.time('fetchPatient');
await fetchPatient(id);
console.timeEnd('fetchPatient');
```

#### Backend Debugging
```python
# Use Python debugger
import pdb; pdb.set_trace()

# Use IPython debugger (better)
import ipdb; ipdb.set_trace()

# Async debugging
import aiodebug
aiodebug.log_slow_callbacks(0.1)

# SQL query logging
import logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
```

#### Docker Debugging
```bash
# Access container shell
docker exec -it emr-backend /bin/bash

# View real-time logs
docker-compose logs -f backend

# Inspect container
docker inspect emr-backend

# Check resource usage
docker stats emr-backend
```

## Performance Optimization

### Frontend Performance
```javascript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  // Component logic
});

// Use useMemo for expensive calculations
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(data);
}, [data]);

// Use useCallback for stable callbacks
const handleClick = useCallback(() => {
  // Handle click
}, [dependency]);

// Lazy load components
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

### Backend Performance
```python
# Use async/await properly
async def fetch_multiple_resources(ids: List[str]):
    tasks = [fetch_resource(id) for id in ids]
    return await asyncio.gather(*tasks)

# Use database connection pooling
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True
)

# Cache expensive operations
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_calculation(param):
    # Expensive logic
    return result
```

---

Built with ❤️ for the healthcare community.