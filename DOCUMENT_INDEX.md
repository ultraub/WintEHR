# Documentation Index

**Updated**: 2025-01-05 | **Total Docs**: 22+

## 🎯 Start Here

| Need | Document | Location |
|------|----------|----------|
| Quick commands & rules | CLAUDE.md | `/` |
| Fix an error | PROJECT_INTEGRITY_GUIDE.md | `/` |
| Find a component | FRONTEND_REDESIGN_TRACKER.md | `/docs/` |
| API reference | API_ENDPOINTS.md | `/docs/` |

## 📁 Quick Find by Task

### Development
- **Setup**: `/README.md` → Installation
- **Commands**: `/CLAUDE.md` → Quick start
- **Errors**: `/PROJECT_INTEGRITY_GUIDE.md` → Top 10 fixes
- **Testing**: `/docs/TESTING.md` → Test procedures

### Frontend Work  
- **Components**: `/docs/FRONTEND_REDESIGN_TRACKER.md` → Status
- **Architecture**: `/docs/FRONTEND_REDESIGN_PLAN.md` → Design
- **Clinical UI**: `/docs/CLINICAL_WORKSPACE_REDESIGN.md` → Workflows
- **Cleanup**: `/frontend/CLEANUP_PLAN.md` → Legacy removal

### Backend/API
- **Endpoints**: `/docs/API_ENDPOINTS.md` → FHIR & EMR APIs  
- **FHIR Guide**: `/docs/FHIR_README.md` → Implementation
- **Architecture**: `/docs/consolidated/ARCHITECTURE.md` → System design
- **Migration**: `/docs/MIGRATION_PLAN.md` → Legacy → FHIR

### Data & Testing
- **Synthea Data**: `/backend/SYNTHEA_IMPORT_SUMMARY.md` → Import stats
- **Validation**: `/backend/SYNTHEA_VALIDATION_REPORT.md` → Compliance
- **Test Data**: `/docs/TESTING.md` → Synthea generation

## 📊 Documentation Map

```
/
├── CLAUDE.md                    # Development guide
├── PROJECT_INTEGRITY_GUIDE.md   # Error patterns
├── DOCUMENT_INDEX.md           # This file
├── README.md                   # Installation
│
├── docs/
│   ├── API_ENDPOINTS.md        # API reference
│   ├── FHIR_README.md         # FHIR guide
│   ├── TESTING.md             # Test procedures
│   ├── FRONTEND_REDESIGN_*.md  # Frontend docs
│   └── consolidated/
│       └── ARCHITECTURE.md     # System design
│
├── frontend/
│   └── CLEANUP_PLAN.md        # Legacy cleanup
│
└── backend/
    ├── SYNTHEA_*.md           # Data imports
    └── scripts/README.md      # Script docs
```

## 🔄 Update Schedule

| Document | When to Update |
|----------|----------------|
| CLAUDE.md | New commands, architecture changes |
| PROJECT_INTEGRITY_GUIDE.md | New error patterns discovered |
| FRONTEND_REDESIGN_TRACKER.md | Component added/completed |
| API_ENDPOINTS.md | Endpoint changes |
| This Index | New docs added |

## 🤖 Claude AI Quick Menu

**Session Start**:
1. Load `/CLAUDE.md` for rules
2. Load `/PROJECT_INTEGRITY_GUIDE.md` for errors
3. Check TodoRead

**Frontend Work**:
- `/docs/FRONTEND_REDESIGN_TRACKER.md`
- `/src/hooks/useFHIRResources.js`
- `/src/components/clinical/`

**Backend Work**:
- `/docs/API_ENDPOINTS.md`
- `/backend/fhir_api/`
- `/backend/core/fhir/`

## 📈 Documentation Coverage

- **Core Guides**: 4 documents
- **Frontend**: 6 documents  
- **Backend/API**: 5 documents
- **Data/Testing**: 7 documents
- **Total**: 22+ documents

## 🔗 External Resources

- FHIR R4 Spec: https://hl7.org/fhir/R4/
- React Docs: https://react.dev
- FastAPI: https://fastapi.tiangolo.com
- Material-UI: https://mui.com