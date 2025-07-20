# CLAUDE.md - Module Documentation Hub

**Purpose**: Central reference for all WintEHR module documentation, providing quick navigation and understanding of the modular architecture.

**Last Updated**: 2025-01-20

## 🎯 Overview

This directory contains comprehensive documentation for all WintEHR modules:
- Backend service modules and APIs
- Frontend clinical components and workflows
- Integration patterns between modules
- Standalone module documentation
- Cross-module event system documentation

## 📁 Actual Directory Structure

```
docs/modules/
├── README.md                    # Module documentation overview
├── CLAUDE.md                    # This file - module hub reference
├── frontend/                    # Frontend module docs
│   └── clinical-workspace.md   # Clinical workspace documentation
└── integration/                 # Integration docs
    └── cross-module-integration.md  # Event system documentation

Note: Additional documentation is distributed throughout the codebase
in CLAUDE.md files at key directories for better maintainability.
```

## 🔍 Quick Navigation

### Current Documentation Structure

#### Available Module Documentation
| Location | Purpose |
|----------|---------|
| [Clinical Workspace](frontend/clinical-workspace.md) | Frontend clinical interface overview |
| [Cross-Module Integration](integration/cross-module-integration.md) | Event system documentation |

#### CLAUDE.md Quick References
| Location | Purpose |
|----------|---------|
| `/CLAUDE.md` | Main project overview |
| `/backend/fhir/CLAUDE.md` | FHIR implementation guide |
| `/backend/api/clinical/CLAUDE.md` | Clinical services API |
| `/backend/scripts/CLAUDE.md` | Data management scripts |
| `/frontend/src/components/clinical/CLAUDE.md` | Clinical UI components |
| `/frontend/src/services/CLAUDE.md` | Frontend services |

#### Comprehensive Documentation
| Document | Purpose |
|----------|---------|
| [API_ENDPOINTS.md](../API_ENDPOINTS.md) | Complete API reference |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | System architecture |
| [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) | Deployment guide |
| [BUILD_PROCESS_ANALYSIS.md](../BUILD_PROCESS_ANALYSIS.md) | Build system details |

#### Code-Based Documentation
| Location | Purpose |
|----------|---------|
| `/frontend/src/constants/clinicalEvents.js` | Event definitions |
| `/backend/api/` | API endpoint implementations |
| `/backend/fhir/` | FHIR storage implementation |
| `/frontend/src/contexts/` | React context definitions |

## 📋 Module Architecture

### Core Principles
1. **Loose Coupling**: Modules communicate via events, not direct imports
2. **High Cohesion**: Related functionality grouped within modules
3. **Clear Interfaces**: Well-defined APIs and contracts
4. **Progressive Loading**: Lazy load modules for performance
5. **Error Isolation**: Module failures don't crash the system

### Module Types

#### Backend Modules
```
┌─────────────────────────────────────┐
│         API Gateway Layer           │
├─────────────────────────────────────┤
│    Clinical Service Modules         │
│  (Orders, Pharmacy, Lab, Imaging)   │
├─────────────────────────────────────┤
│      FHIR Storage Engine           │
│   (Resources, Search, History)      │
├─────────────────────────────────────┤
│         PostgreSQL Database         │
└─────────────────────────────────────┘
```

#### Frontend Modules
```
┌─────────────────────────────────────┐
│      Clinical Workspace UI          │
├─────────────────────────────────────┤
│        Component Modules            │
│  (Tabs, Dialogs, Common, Charts)   │
├─────────────────────────────────────┤
│        Service Layer               │
│  (FHIR, CDS, WebSocket, Search)   │
├─────────────────────────────────────┤
│    State Management (Contexts)      │
└─────────────────────────────────────┘
```

## 🔗 Module Communication

### Event-Driven Architecture
Modules communicate through a publish-subscribe event system:

```javascript
// Publisher module
publish(CLINICAL_EVENTS.ORDER_PLACED, {
  orderId: order.id,
  patientId: patient.id,
  orderType: 'medication'
});

// Subscriber modules
subscribe(CLINICAL_EVENTS.ORDER_PLACED, (data) => {
  // Pharmacy module updates queue
  // Results module watches for completion
  // Timeline module adds event
});
```

### Common Event Types
- `patient.selected` - Patient context change
- `order.placed` - New order created
- `result.ready` - Lab result available
- `medication.dispensed` - Medication dispensed
- `document.created` - New clinical note
- `alert.triggered` - Clinical alert

## 📝 Documentation Standards

### Module Documentation Template
Each module documentation should include:

1. **Overview** - Purpose and responsibilities
2. **Architecture** - Technical design and structure
3. **API Reference** - Endpoints or interfaces
4. **Data Flow** - How data moves through the module
5. **Dependencies** - What the module requires
6. **Events** - Published and subscribed events
7. **Configuration** - Module-specific settings
8. **Testing** - How to test the module
9. **Troubleshooting** - Common issues and solutions

### Code Examples
Include practical examples showing:
- Basic usage
- Advanced features
- Integration patterns
- Error handling

## 🚀 Creating New Modules

### Backend Module Checklist
- [ ] Define clear API endpoints
- [ ] Implement FHIR resource handling
- [ ] Add search parameter support
- [ ] Include proper authentication
- [ ] Publish relevant events
- [ ] Add comprehensive tests
- [ ] Document in this directory

### Frontend Module Checklist
- [ ] Create lazy-loaded component
- [ ] Implement loading states
- [ ] Add error boundaries
- [ ] Use proper contexts
- [ ] Subscribe to relevant events
- [ ] Include accessibility
- [ ] Document in this directory

## 🔍 Finding Module Information

### Quick Links by Feature
- **Patient Data**: [FHIR Storage](backend/fhir-storage.md)
- **Orders**: [Clinical Services](backend/clinical-services.md) + [Orders Tab](frontend/clinical-workspace.md#orders-tab)
- **Medications**: [Pharmacy Module](standalone/pharmacy-module.md)
- **Lab Results**: [Lab Module](standalone/lab-module.md)
- **Imaging**: [Imaging Module](standalone/imaging-module.md)
- **Real-time Updates**: [WebSocket Events](integration/websocket-events.md)
- **Clinical Alerts**: [CDS Integration](integration/cds-integration.md)

### Module Dependencies Map
```yaml
clinical-workspace:
  depends-on:
    - fhir-service
    - websocket-service
    - cds-service
  publishes:
    - tab.changed
    - patient.selected
  subscribes:
    - order.updated
    - result.ready

pharmacy-module:
  depends-on:
    - fhir-service
    - provider-service
  publishes:
    - prescription.filled
    - medication.dispensed
  subscribes:
    - order.placed
    - patient.selected
```

## 💡 Best Practices

1. **Read Module Docs First**: Before implementing features
2. **Follow Patterns**: Use established module patterns
3. **Update Documentation**: Keep docs current with changes
4. **Test Integration**: Verify cross-module communication
5. **Monitor Events**: Use event logs for debugging
6. **Version APIs**: Maintain backward compatibility

## 📝 Documentation Philosophy

WintEHR uses a **distributed documentation approach**:

1. **CLAUDE.md files** - Quick references at key directories for AI agents
2. **Module documentation** - Specific guides for major components
3. **Comprehensive guides** - Detailed references at project root
4. **Code comments** - Implementation details in the code itself

This approach ensures:
- Documentation stays close to the code it describes
- AI agents have context-specific guidance
- Developers can find information where they need it
- Documentation is more likely to stay current

## 🔗 Related Documentation

- **Main CLAUDE.md**: `/CLAUDE.md` - Project overview
- **Architecture**: `/docs/ARCHITECTURE.md` - System design
- **API Reference**: `/docs/API_ENDPOINTS.md` - Complete API docs
- **Deployment**: `/docs/DEPLOYMENT_CHECKLIST.md` - Deployment guide
- **Archived Docs**: `/docs/archive/` - Historical documentation

---

**Remember**: Good module documentation enables efficient development and maintenance. When in doubt, check for a CLAUDE.md file in the directory you're working in.