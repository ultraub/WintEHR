# MedGenEMR Module Documentation

This directory contains module documentation for MedGenEMR. Due to rapid development, some documentation has been consolidated or moved to be closer to the code.

## 📚 Current Documentation

### Available Module Documentation
- [Clinical Workspace](./frontend/clinical-workspace.md) - Frontend clinical interface overview

### Quick Reference Guides (CLAUDE.md files)
Located throughout the codebase for AI agent assistance:
- `/CLAUDE.md` - Main project overview and quick reference
- `/backend/fhir/CLAUDE.md` - FHIR implementation guide
- `/backend/api/clinical/CLAUDE.md` - Clinical services API guide
- `/backend/scripts/CLAUDE.md` - Data management scripts guide
- `/frontend/src/components/clinical/CLAUDE.md` - Clinical UI components guide
- `/frontend/src/services/CLAUDE.md` - Frontend services guide
- `/docs/modules/CLAUDE.md` - Module documentation hub

### Comprehensive Documentation
- **API Reference**: [/docs/API_ENDPOINTS.md](../API_ENDPOINTS.md)
- **Architecture**: [/docs/ARCHITECTURE.md](../ARCHITECTURE.md)
- **Deployment**: [/docs/DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md)
- **Build Process**: [/docs/BUILD_PROCESS_ANALYSIS.md](../BUILD_PROCESS_ANALYSIS.md)

### Integration & Events
- **Cross-Module Integration**: [/docs/modules/integration/cross-module-integration.md](./integration/cross-module-integration.md)
- **Clinical Events**: See `/frontend/src/constants/clinicalEvents.js` for event definitions

### Archived Documentation
Previous versions and detailed documentation can be found in:
- [/docs/archive/](../archive/) - Historical documentation organized by date

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

## 📝 Note on Documentation Structure

The project uses a distributed documentation approach:
- **CLAUDE.md files** provide quick references for AI agents at key directories
- **Comprehensive guides** are maintained at the project root level
- **Module-specific details** are documented close to the code
- **API and technical references** are centralized in the docs directory

This approach ensures documentation stays current with rapid development while providing clear navigation paths.

---

**Last Updated**: 2025-01-20