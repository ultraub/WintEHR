# WintEHR Quick Reference Card

## 🚀 Essential Commands

```bash
# System Control
./start.sh                    # Start system
./fresh-deploy.sh            # Fresh deployment with data
docker-compose logs -f       # View logs

# Data Management
python backend/scripts/synthea_master.py full --count 10
python backend/scripts/generate_dicom_for_studies.py

# Quality & Testing
python .claude/agents/qa-agent.py --fix
docker exec emr-backend pytest tests/ -v
cd frontend && npm test
```

## 📁 Key Files

| What | Where |
|------|-------|
| FHIR Service | `frontend/src/services/fhirService.js` |
| Clinical Catalogs | `frontend/src/services/cdsClinicalDataService.js` |
| Event System | `frontend/src/contexts/ClinicalWorkflowContext.js` |
| Auth System | `backend/api/auth_enhanced.py` |
| FHIR Storage | `backend/fhir/core/storage.py` |

## 🎯 Critical Rules

1. **ALWAYS**: Research → TodoWrite → Implement → Review → Commit → Update Docs
2. **NEVER**: console.log() | Mock data | Hardcode IDs | Skip validation
3. **USE**: Synthea data | fhirService.js | Event patterns | Loading states

## 🔧 Common Patterns

```javascript
// State Management
const { resources, loading } = useFHIRResource();

// Events
await publish(CLINICAL_EVENTS.ORDER_PLACED, data);
subscribe(CLINICAL_EVENTS.ORDER_PLACED, handler);

// FHIR Operations
await fhirService.createResource('ResourceType', data);
await refreshPatientResources(patient.id);

// Safe Display
const display = resource?.code?.text || 
                resource?.code?.coding?.[0]?.display || 
                'Unknown';
```

## 🤖 Agent Commands

```bash
# Full feature development
python .claude/agents/feature-workflow.py "Feature description"

# Quality check & fix
python .claude/agents/qa-agent.py --fix

# FHIR validation
python .claude/agents/fhir-integration-checker.py
```

## 📚 Documentation

- **Main Guide**: [CLAUDE.md](./CLAUDE.md)
- **Detailed Reference**: [CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md)
- **Agent Guide**: [CLAUDE-AGENTS.md](./CLAUDE-AGENTS.md)
- **Module Docs**: `docs/modules/`

## ⚡ Quick Fixes

| Problem | Solution |
|---------|----------|
| CORS error | Check backend: `docker-compose ps` |
| Missing data | Load patients: `./fresh-deploy.sh` |
| WebSocket fail | Check JWT_ENABLED matches |
| Import error | Use `@mui/icons-material` |

---

**Remember**: Patient safety first. When in doubt, check the docs!