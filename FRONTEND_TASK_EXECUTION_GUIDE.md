# Frontend Task Execution Guide

## Task Execution Framework

### Before Starting Any Task

#### 1. Deep Review Checklist
- [ ] Read all related component code
- [ ] Trace data flow from backend to UI
- [ ] Identify all dependencies
- [ ] Review FHIR resource specifications
- [ ] Check for existing patterns in codebase
- [ ] Document current behavior
- [ ] List all files that will be modified

#### 2. Planning Requirements
- [ ] Create detailed technical design
- [ ] Identify potential breaking changes
- [ ] Plan data migration if needed
- [ ] Design test scenarios
- [ ] Estimate completion time
- [ ] Identify rollback strategy

#### 3. Environment Preparation
- [ ] Create feature branch
- [ ] Ensure clean working directory
- [ ] Start dev server with hot reload: `npm start`
- [ ] Open browser DevTools Console
- [ ] Enable React DevTools Profiler
- [ ] Open Network tab to monitor API calls
- [ ] Keep test runner in watch mode: `npm test -- --watch`
- [ ] Prepare test data

## Detailed Execution Plans

### Phase 1 Critical Fixes - Execution Details

#### Task 1.1: Remove Duplicate Components
**Execution Plan:**
```bash
# 1. Create safety branch
git checkout -b cleanup/remove-duplicates

# 2. Find all imports
grep -r "ChartReviewTab_backup\|ChartReviewTab_v2" frontend/src/
grep -r "ErrorBoundaryDemo\|PrototypeMode\|Storybook\|TutorialMode" frontend/src/

# 3. For each file found:
- Document what it does
- Check git history for context
- Verify no unique features
- Remove import statements first
- Then delete file

# 4. Test incrementally
npm run build
npm test
npm start
```

**Validation Script:**
```javascript
// Run after cleanup
const fs = require('fs');
const path = require('path');

const deletedFiles = [
  'ChartReviewTab_backup.js',
  'ChartReviewTab_v2.js',
  'ErrorBoundaryDemo.js',
  // ... etc
];

deletedFiles.forEach(file => {
  const exists = fs.existsSync(path.join('./frontend/src/components', file));
  console.assert(!exists, `File ${file} still exists!`);
});
```

#### Task 1.2: Fix Notification System
**Backend Implementation Plan:**
```python
# 1. Create notification model
class Notification(Base):
    id: str
    user_id: str
    type: str  # alert, task, message, system
    priority: str  # high, medium, low
    title: str
    message: str
    data: dict  # FHIR resource reference
    read: bool
    created_at: datetime
    read_at: Optional[datetime]

# 2. Create API endpoints
POST   /api/notifications
GET    /api/notifications?user_id=xxx&read=false
PATCH  /api/notifications/:id/read
DELETE /api/notifications/:id

# 3. WebSocket events
notification.created
notification.read
notification.deleted
```

**Frontend Implementation:**
```javascript
// 1. NotificationService.js
class NotificationService {
  constructor(websocket, fhirService) {
    this.ws = websocket;
    this.fhir = fhirService;
    this.notifications = [];
    this.subscribers = new Set();
  }

  async fetchNotifications() {
    const response = await fetch('/api/notifications?read=false');
    this.notifications = await response.json();
    this.notifySubscribers();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    // Set up WebSocket listeners
    this.ws.on('notification.created', this.handleNew);
  }
}

// 2. Update NotificationContext
const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const notificationService = useRef(new NotificationService());

  useEffect(() => {
    notificationService.current.subscribe(setNotifications);
    notificationService.current.fetchNotifications();
  }, []);
};
```

#### Task 1.3: Fix Authentication System
**Step-by-Step Execution:**

1. **Find all hardcoded references:**
```bash
# Search for hardcoded IDs
grep -r "Practitioner/[a-f0-9-]*" frontend/src/
grep -r "Dr\. Smith\|Dr Smith" frontend/src/
grep -r "userId.*=.*['\"]" frontend/src/

# Document each occurrence
echo "File: Location: Current Code: Replacement Needed" > auth_fixes.txt
```

2. **Create dynamic user service:**
```javascript
// services/userService.js
export class UserService {
  constructor(fhirService) {
    this.fhir = fhirService;
    this.currentUser = null;
  }

  async getCurrentPractitioner() {
    if (this.currentUser) return this.currentUser;
    
    const token = localStorage.getItem('token');
    const decoded = jwt_decode(token);
    
    // Fetch actual Practitioner resource
    const practitioner = await this.fhir.read(
      'Practitioner',
      decoded.practitioner_id
    );
    
    this.currentUser = practitioner;
    return practitioner;
  }

  getPractitionerReference() {
    if (!this.currentUser) throw new Error('User not loaded');
    return {
      reference: `Practitioner/${this.currentUser.id}`,
      display: this.getDisplayName()
    };
  }
}
```

3. **Update each component systematically:**
```javascript
// Before:
const order = {
  requester: {
    reference: "Practitioner/abc-123", // HARDCODED!
    display: "Dr. Smith"
  }
};

// After:
const userService = useUserService();
const practitioner = await userService.getCurrentPractitioner();
const order = {
  requester: userService.getPractitionerReference()
};
```

#### Task 1.4: Fix ServiceRequest Import
**Debugging Process:**

1. **Analyze import failure:**
```bash
# Run import with debug logging
docker exec emr-backend python -m scripts.active.synthea_master import \
  --verbose \
  --resource-type ServiceRequest \
  --debug-validation

# Check validation errors
docker exec emr-backend python -c "
from sqlalchemy import create_engine, text
engine = create_engine('postgresql://emr_user:password@db/emr_db')
with engine.connect() as conn:
    result = conn.execute(text('''
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN status = 'error' THEN 1 END) as errors
        FROM import_log
        WHERE resource_type = 'ServiceRequest'
    '''))
    print(result.fetchone())
"
```

2. **Fix validation issues:**
```python
# Update validator to handle missing references
class ServiceRequestValidator(FHIRValidator):
    def validate_references(self, resource):
        # Check if encounter exists
        if 'encounter' in resource:
            encounter_id = resource['encounter']['reference'].split('/')[-1]
            if not self.check_exists('Encounter', encounter_id):
                # Create placeholder or skip
                self.warnings.append(f"Missing encounter: {encounter_id}")
                # Don't fail validation
        return True
```

### Phase 2 Quick Wins - Execution Details

#### Task 2.1: Expand Lab Results
**Implementation Approach:**

1. **Update data fetching:**
```javascript
// Before:
const observations = await fhirService.search('Observation', {
  patient: patientId,
  category: 'vital-signs',
  _sort: '-date'
});

// After:
const fetchAllObservations = async (patientId) => {
  // Fetch all categories in parallel
  const categories = [
    'vital-signs',
    'laboratory', 
    'imaging',
    'social-history',
    'clinical'
  ];
  
  const promises = categories.map(cat => 
    fhirService.search('Observation', {
      patient: patientId,
      category: cat,
      _sort: '-date',
      _count: 100
    })
  );
  
  const results = await Promise.all(promises);
  return results.flat();
};
```

2. **Create categorized display:**
```javascript
const CategorizedResults = ({ observations }) => {
  const categorized = useMemo(() => {
    return observations.reduce((acc, obs) => {
      const category = obs.category?.[0]?.coding?.[0]?.code || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(obs);
      return acc;
    }, {});
  }, [observations]);

  return (
    <Tabs>
      {Object.entries(categorized).map(([category, obs]) => (
        <TabPanel key={category} label={formatCategory(category)}>
          <ObservationList observations={obs} />
        </TabPanel>
      ))}
    </Tabs>
  );
};
```

### Phase 3 Architecture - Execution Details

#### Task 3.1: Standardize FHIR Service Usage
**Migration Process:**

1. **Find all direct calls:**
```javascript
// Create a script to find violations
const findDirectFetchCalls = () => {
  const files = glob.sync('frontend/src/**/*.js');
  const violations = [];
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/fetch\s*\(\s*['"`].*\/fhir/g);
    if (matches) {
      violations.push({ file, matches });
    }
  });
  
  return violations;
};
```

2. **Systematic replacement:**
```javascript
// Create migration helper
const migrateFetchToService = (code) => {
  // Before:
  // const response = await fetch(`/fhir/R4/Patient/${id}`);
  // const data = await response.json();
  
  // After:
  // const data = await fhirService.read('Patient', id);
  
  return code
    .replace(/fetch\(`\/fhir\/R4\/(\w+)\/\${(\w+)}`\)/g, 
             "fhirService.read('$1', $2)")
    .replace(/fetch\(`\/fhir\/R4\/(\w+)\?(.+)`\)/g,
             "fhirService.search('$1', $2)");
};
```

## Testing Strategy for Each Task

### Unit Test Template
```javascript
describe('Task X.X: [Task Name]', () => {
  beforeEach(() => {
    // Setup test environment
    // Mock dependencies
    // Prepare test data
  });

  describe('Subtask X.X.1', () => {
    it('should [expected behavior]', async () => {
      // Arrange
      const input = createTestData();
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result).toMatchExpectation();
    });

    it('should handle error case', async () => {
      // Test error scenarios
    });
  });
});
```

### Integration Test Checklist (Hot Reload)
- [ ] Test with real FHIR data
- [ ] Verify WebSocket reconnects after hot reload
- [ ] Check cross-component communication survives reload
- [ ] Test with multiple browser tabs/users
- [ ] Verify data persistence through reloads
- [ ] Monitor performance in React Profiler
- [ ] Use React DevTools to inspect state changes
- [ ] Check Network tab for duplicate requests after reload

### Manual Test Scenarios
1. **Happy Path**: Standard workflow completion
2. **Edge Cases**: Boundary conditions
3. **Error Cases**: Network failures, invalid data
4. **Performance**: Large datasets, concurrent users
5. **Security**: Access control, data privacy

## Code Review Checklist

### Before Submitting PR
- [ ] All tests passing
- [ ] No console.log statements
- [ ] Loading states implemented
- [ ] Error handling complete
- [ ] FHIR compliance verified
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] No hardcoded values
- [ ] Event publishing added
- [ ] Accessibility checked

### Review Focus Areas
1. **FHIR Compliance**: Proper resource handling
2. **Security**: No exposed sensitive data
3. **Performance**: Efficient queries, caching
4. **Maintainability**: Clear code, good patterns
5. **Testing**: Adequate coverage
6. **Documentation**: Clear and complete

## Rollback Procedures

### For Each Task
1. **Feature Flag Approach**
```javascript
const FEATURES = {
  NEW_NOTIFICATION_SYSTEM: process.env.REACT_APP_NEW_NOTIFICATIONS === 'true',
  ENHANCED_LABS: process.env.REACT_APP_ENHANCED_LABS === 'true'
};

// In component
if (FEATURES.NEW_NOTIFICATION_SYSTEM) {
  return <NewNotificationCenter />;
} else {
  return <LegacyNotifications />;
}
```

2. **Database Rollback**
```sql
-- Keep migration rollback scripts
-- migrations/rollback/001_remove_notifications.sql
DROP TABLE IF EXISTS notifications;
DROP INDEX IF EXISTS idx_notifications_user;
```

3. **Quick Disable**
```javascript
// Emergency bypass in case of critical issues
if (window.DISABLE_NEW_FEATURE) {
  return <LegacyComponent />;
}
```

## Monitoring During Rollout

### Key Metrics
1. **Performance**
   - API response times
   - Frontend rendering time
   - WebSocket message latency

2. **Errors**
   - JavaScript error rate
   - API error responses
   - Failed FHIR validations

3. **Usage**
   - Feature adoption rate
   - User actions per session
   - Data completeness

### Monitoring Implementation
```javascript
// Add to each new feature
const trackFeatureUsage = (feature, action) => {
  if (window.analytics) {
    window.analytics.track('Feature Usage', {
      feature,
      action,
      timestamp: new Date().toISOString(),
      user: getCurrentUser().id
    });
  }
};
```

## Success Criteria Validation

### Phase Completion Requirements
1. **All subtasks completed**
2. **All tests passing**
3. **Code review approved**
4. **Documentation complete**
5. **No regression issues**
6. **Performance targets met**
7. **Clinical validation passed**

### Sign-off Process
- [ ] Developer testing complete
- [ ] QA testing passed
- [ ] Clinical review approved
- [ ] Performance validated
- [ ] Security review done
- [ ] Documentation reviewed
- [ ] Deployment plan ready