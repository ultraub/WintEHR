# WintEHR Documentation Index

Complete guide to WintEHR platform documentation.

**Last Updated**: November 2025

---

## Quick Links

### Getting Started
- **[Project README](../README.md)** - Project overview and quick start
- **[Quick Start Guide](../QUICKSTART.md)** - Fast deployment (5-20 minutes)
- **[Deployment Guide](DEPLOYMENT.md)** - Comprehensive deployment documentation
- **[Configuration Guide](CONFIGURATION.md)** - Complete configuration reference

### Core Documentation
- **[README](../README.md)** - Comprehensive project overview
- **[DEPLOYMENT](DEPLOYMENT.md)** - All deployment options (local, Azure, AWS, GCP)
- **[CONFIGURATION](CONFIGURATION.md)** - Configuration management system
- **[AZURE_DEPLOYMENT](AZURE_DEPLOYMENT.md)** - Azure-specific deployment details

### Advanced Features
- **[CDS Studio Documentation](#cds-hooks--clinical-decision-support)** - Clinical Decision Support
- **[Code Graph MCP](CODE_GRAPH_MCP.md)** - Code Graph MCP integration
- **[External Services Integration](EXTERNAL_SERVICES_INTEGRATION.md)** - Third-party integrations

---

## Documentation by Audience

### For Developers

**Getting Started:**
1. [Project README](../README.md) - Overview and tech stack
2. [Quick Start](../QUICKSTART.md) - Get running in 5 minutes
3. [Configuration Guide](CONFIGURATION.md) - Environment setup
4. [Deployment Guide](DEPLOYMENT.md) - Local development deployment

**Development:**
- Backend patterns: [`/backend/CLAUDE.md`](../backend/CLAUDE.md)
- Frontend patterns: [`/frontend/CLAUDE.md`](../frontend/CLAUDE.md)
- Code style: Serena memory `code_style_conventions.md`
- Common commands: Serena memory `suggested_commands.md`

**Reference:**
- Backend code: `backend/`
- Frontend code: `frontend/src/`
- Tests: `backend/tests/`, `frontend/tests/`
- Scripts: `backend/scripts/`, `deploy/`

### For System Administrators

**Deployment:**
- [Deployment Guide](DEPLOYMENT.md) - Complete deployment documentation
- [Azure Deployment](AZURE_DEPLOYMENT.md) - Azure-specific setup
- [Configuration Guide](CONFIGURATION.md) - Configuration reference

**Infrastructure:**
- Docker Compose orchestration
- Nginx reverse proxy configuration
- Let's Encrypt SSL automation
- Database management (PostgreSQL, HAPI FHIR)

**Monitoring:**
- Health check endpoints
- Container logs and monitoring
- Performance optimization

### For Healthcare IT Learners

**Understanding the Platform:**
- [README](../README.md) - Feature overview and capabilities
- [CDS Studio Documentation](#cds-hooks--clinical-decision-support) - Clinical decision support
- FHIR R4 resource implementation
- Medical imaging (DICOM) workflows

**Learning Resources:**
- FHIR R4 standard implementation
- Healthcare interoperability patterns
- Clinical workflow design
- EHR architecture patterns

---

## Documentation by Topic

### Deployment & Configuration

#### Deployment Options
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
  - Quick start deployment
  - Local development setup
  - Azure production deployment
  - Build process and troubleshooting

- **[QUICKSTART.md](../QUICKSTART.md)** - Fast deployment reference
  - One-command deployment
  - Common deployment scenarios
  - Essential commands
  - Quick troubleshooting

- **[AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md)** - Azure-specific deployment
  - Azure VM setup
  - Network security groups
  - SSL certificate automation
  - Azure-specific configuration

#### Configuration Management
- **[CONFIGURATION.md](CONFIGURATION.md)** - Complete configuration reference
  - Configuration files structure
  - Environment-specific configurations
  - Secrets management
  - Deployment scenarios
  - Validation and troubleshooting

### CDS Hooks & Clinical Decision Support

**CDS Studio Documentation:**
- **[CDS_STUDIO_VISUAL_BUILDER.md](CDS_STUDIO_VISUAL_BUILDER.md)** - Visual rule builder (1064 lines)
  - Visual interface for building CDS rules
  - Rule configuration and testing
  - Integration with FHIR resources

- **[CDS_STUDIO_IMPLEMENTATION_SUMMARY.md](CDS_STUDIO_IMPLEMENTATION_SUMMARY.md)** - Implementation details (696 lines)
  - Technical implementation overview
  - Architecture and design patterns
  - Integration points

- **[CDS_STUDIO_QUICK_REFERENCE.md](CDS_STUDIO_QUICK_REFERENCE.md)** - Quick reference (330 lines)
  - Common CDS operations
  - Rule examples
  - API endpoints

- **[CDS_STUDIO_DEPLOYMENT_CHECKLIST.md](CDS_STUDIO_DEPLOYMENT_CHECKLIST.md)** - Deployment checklist (337 lines)
  - Pre-deployment verification
  - Configuration requirements
  - Post-deployment testing

- **[CDS_VISUAL_BUILDER_DEPLOYMENT.md](CDS_VISUAL_BUILDER_DEPLOYMENT.md)** - Visual builder deployment (950 lines)
  - Deployment instructions
  - Configuration and setup
  - Troubleshooting

### Integration & External Services

- **[EXTERNAL_SERVICES_INTEGRATION.md](EXTERNAL_SERVICES_INTEGRATION.md)** - Third-party integrations
  - AI/LLM services (Anthropic Claude, OpenAI, Google Gemini)
  - Authentication providers
  - External APIs

- **[CODE_GRAPH_MCP.md](CODE_GRAPH_MCP.md)** - Code Graph MCP integration
  - Code Graph MCP server setup
  - Usage patterns
  - Integration with development workflow

---

## Project Structure

```
WintEHR/
├── README.md                 # Project overview
├── QUICKSTART.md            # Quick start guide
├── CONTRIBUTING.md          # Contributing guidelines
├── CLAUDE.md                # Claude Code context (NOT committed)
├── docs/                    # 👈 Public documentation
│   ├── INDEX.md            # This file
│   ├── DEPLOYMENT.md       # Deployment guide
│   ├── CONFIGURATION.md    # Configuration reference
│   ├── AZURE_DEPLOYMENT.md # Azure deployment
│   ├── CDS_STUDIO_*.md     # CDS Hooks documentation
│   ├── CODE_GRAPH_MCP.md   # Code Graph MCP
│   └── EXTERNAL_SERVICES_INTEGRATION.md
├── claudedocs/              # Claude session artifacts (NOT committed)
│   └── INDEX.md            # Claude docs index
├── backend/                 # Python FastAPI backend
│   ├── CLAUDE.md           # Backend patterns (NOT committed)
│   └── ...
├── frontend/                # React TypeScript frontend
│   ├── CLAUDE.md           # Frontend patterns (NOT committed)
│   └── ...
└── deploy/                  # Deployment scripts
```

---

## How to Use This Documentation

### New Developer Onboarding

1. Read [Project README](../README.md) for overview
2. Follow [Quick Start](../QUICKSTART.md) to get running
3. Study [Configuration Guide](CONFIGURATION.md) for environment setup
4. Review [Deployment Guide](DEPLOYMENT.md) for deployment options
5. Read [`/CLAUDE.md`](../CLAUDE.md) for critical patterns and context
6. Explore [Backend CLAUDE.md](../backend/CLAUDE.md) and [Frontend CLAUDE.md](../frontend/CLAUDE.md)

### Deploying WintEHR

1. Review [Deployment Guide](DEPLOYMENT.md) for your target environment
2. Follow [Configuration Guide](CONFIGURATION.md) to set up config files
3. For Azure: Use [Azure Deployment](AZURE_DEPLOYMENT.md)
4. For quick local setup: Use [Quick Start](../QUICKSTART.md)

### Understanding CDS Hooks

1. Start with [CDS Studio Quick Reference](CDS_STUDIO_QUICK_REFERENCE.md)
2. Learn visual builder in [CDS Visual Builder](CDS_STUDIO_VISUAL_BUILDER.md)
3. Understand implementation in [CDS Implementation Summary](CDS_STUDIO_IMPLEMENTATION_SUMMARY.md)
4. Deploy using [CDS Deployment Checklist](CDS_STUDIO_DEPLOYMENT_CHECKLIST.md)

### Troubleshooting

1. Check [Quick Start Troubleshooting](../QUICKSTART.md#troubleshooting)
2. Review [Deployment Guide Troubleshooting](DEPLOYMENT.md#troubleshooting)
3. Consult [Configuration Guide Troubleshooting](CONFIGURATION.md#troubleshooting)
4. Review CDS-specific troubleshooting in CDS documentation

---

## Contributing to Documentation

When making changes to the codebase:

### Always Update
- New deployment option → [DEPLOYMENT.md](DEPLOYMENT.md)
- New configuration → [CONFIGURATION.md](CONFIGURATION.md), `config.example.yaml`
- New CDS Hook → CDS Studio documentation
- New feature → [README.md](../README.md)
- Architectural change → [`/CLAUDE.md`](../CLAUDE.md)

### Documentation Standards
- Use Markdown for all docs
- Include code examples with syntax highlighting
- Add table of contents for long documents (>100 lines)
- Use consistent heading hierarchy
- Cross-reference related documents
- Update "Last Updated" dates

### Documentation Types

| Type | Location | Committed to Git | Audience |
|------|----------|------------------|----------|
| **Public Docs** | `docs/` | ✅ Yes | All users |
| **CLAUDE.md** | Root, subdirs | ❌ No | Claude Code only |
| **Claude Session** | `claudedocs/` | ❌ No | Claude Code only |
| **Code Comments** | Inline | ✅ Yes | Developers |
| **API Docs** | FastAPI inline | ✅ Yes | API users |

---

## External Resources

### Technologies Used
- **FastAPI**: https://fastapi.tiangolo.com/
- **React**: https://react.dev/
- **Material-UI**: https://mui.com/
- **FHIR R4**: http://hl7.org/fhir/R4/
- **HAPI FHIR**: https://hapifhir.io/
- **CDS Hooks**: https://cds-hooks.org/
- **Synthea**: https://synthea.mitre.org/
- **Docker**: https://docs.docker.com/

### Learning Resources
- **FHIR**: HL7 FHIR R4 specification
- **Healthcare IT**: Clinical workflow standards
- **Python/FastAPI**: Official FastAPI documentation
- **React/TypeScript**: React documentation + TypeScript handbook

---

## Quick Reference

### Essential Commands
```bash
# Deployment
./deploy.sh                    # Full deployment
./deploy.sh --skip-build      # Skip Docker rebuild
./deploy.sh status            # Check system status

# Backend
cd backend && pytest          # Run tests
cd backend && python main.py  # Run backend

# Frontend
cd frontend && npm start      # Development server
cd frontend && npm run build  # Production build
cd frontend && npm run lint   # Lint check

# Docker
docker-compose ps             # Check services
docker-compose logs -f        # View logs
docker-compose restart backend  # Restart service

# Database
docker exec -it emr-postgres psql -U emr_user -d emr_db

# HAPI FHIR
curl http://localhost:8888/fhir/metadata
curl http://localhost:8888/fhir/Patient?_summary=count
```

### Key Configuration Files
- `config.yaml` - Main configuration
- `.env` - Secrets and environment variables
- `config.example.yaml` - Configuration template
- `docker-compose.yml` - Docker services
- `docker-compose.prod.yml` - Production Docker config

### Important Directories
- `backend/api/` - API endpoints
- `backend/api/clinical/` - Clinical workflows
- `backend/api/cds_hooks/` - CDS Hooks
- `backend/scripts/` - Utility scripts
- `frontend/src/components/clinical/` - Clinical UI
- `frontend/src/components/fhir/` - FHIR Explorer
- `docs/` - Public documentation
- `claudedocs/` - Claude session artifacts

---

## Support

For questions or issues:
1. Check documentation (start here!)
2. Review GitHub issues
3. Consult FHIR and CDS Hooks specifications
4. Contact the development team
5. Create new issue with details

---

## Documentation Maintenance

### Review Schedule
- **Monthly**: Review all docs for currency
- **Per Release**: Update version numbers and features
- **Per Major Change**: Update affected documentation immediately

### Quality Checklist
- ✅ All code examples tested and working
- ✅ Screenshots current (if applicable)
- ✅ Links valid and not broken
- ✅ Versions and dates updated
- ✅ Cross-references correct
- ✅ Table of contents current

---

**Last Updated**: November 2025
**Documentation Version**: 2.0
**Platform Version**: 1.1.0

*Keep documentation current - it's part of the code!*
