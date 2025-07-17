# MedGenEMR Module Documentation

This directory contains detailed documentation for all MedGenEMR modules, organized by system architecture.

## 📚 Documentation Structure

```
modules/
├── frontend/          # React frontend modules
├── backend/           # FastAPI backend modules
├── integration/       # Cross-module integration docs
└── standalone/        # Standalone components
```

## 🔍 Quick Navigation

### Frontend Modules
- [Clinical Workspace](./frontend/clinical-workspace.md) - Main patient care interface
- [FHIR Services](./frontend/fhir-services.md) - FHIR data management
- [Event System](./frontend/event-system.md) - Cross-module communication
- [Contexts & Hooks](./frontend/contexts-hooks.md) - State management

### Backend Modules
- [FHIR Storage Engine](./backend/fhir-storage.md) - Core FHIR persistence
- [API Endpoints](./backend/api-endpoints.md) - REST API documentation
- [Clinical Services](./backend/clinical-services.md) - Business logic
- [Authentication](./backend/authentication.md) - Auth system

### Integration
- [Cross-Module Events](./integration/cross-module-events.md) - Event patterns
- [WebSocket Integration](./integration/websocket.md) - Real-time updates
- [Data Flow](./integration/data-flow.md) - System-wide data patterns

### Standalone
- [Pharmacy Dashboard](./standalone/pharmacy-dashboard.md)
- [Provider Admin](./standalone/provider-admin.md)
- [Patient Portal](./standalone/patient-portal.md)

## 📋 Module Documentation Template

Each module documentation should include:

1. **Overview** - Purpose and key features
2. **Architecture** - Technical design and patterns
3. **Components** - Key files and their roles
4. **Integration Points** - How it connects with other modules
5. **Usage Examples** - Code snippets and patterns
6. **API Reference** - Detailed API documentation
7. **Testing** - How to test the module
8. **Recent Updates** - Change log with dates

## 🔗 Related Documentation

- **Quick Start**: [CLAUDE.md](../../CLAUDE.md)
- **Detailed Reference**: [CLAUDE-REFERENCE.md](../../CLAUDE-REFERENCE.md)
- **Agent Guide**: [CLAUDE-AGENTS.md](../../CLAUDE-AGENTS.md)
- **Architecture**: [docs/ARCHITECTURE.md](../ARCHITECTURE.md)

---

**Last Updated**: 2025-01-17