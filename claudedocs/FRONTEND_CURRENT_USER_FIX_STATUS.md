# Frontend "current-user" Hardcoded Reference Fix Status

**Date**: 2025-10-12
**Issue**: Frontend code was using hardcoded `'Practitioner/current-user'` instead of actual user.id from AuthContext
**Impact**: HAPI FHIR validation fails because `Practitioner/current-user` doesn't exist

---

## ✅ Files Fixed (Complete)

### Dialog Components
1. **MedicationDialogEnhanced.js** (line 676)
   - Added: `import { useAuth } from '../../../../contexts/AuthContext';`
   - Added: `const { user } = useAuth();` in component
   - Changed: `reference: 'Practitioner/current-user'` → `reference: \`Practitioner/${user?.id || 'unknown'}\``

2. **ConditionDialogEnhanced.js** (line 429)
   - Added: `import { useAuth } from '../../../../contexts/AuthContext';`
   - Added: `const { user } = useAuth();` in component
   - Changed: `reference: 'Practitioner/current-user'` → `reference: \`Practitioner/${user?.id || 'unknown'}\``

3. **AllergyDialogEnhanced.js** (line 541)
   - Added: `import { useAuth } from '../../../../contexts/AuthContext';`
   - Added: `const { user } = useAuth();` in component
   - Changed: `reference: 'Practitioner/current-user'` → `reference: \`Practitioner/${user?.id || 'unknown'}\``

4. **OrderSigningDialog.js** (line 85)
   - Added: `import { useAuth } from '../../../../contexts/AuthContext';`
   - Added: `const { user } = useAuth();` in component
   - Changed: `userId: 'current-user'` → `userId: user?.id || 'unknown'`

### Context Files
5. **CDSContext.js** (line 330)
   - Added: `import { useAuth } from './AuthContext';`
   - Added: `const { user } = useAuth();` in provider
   - Changed: `userId: 'current-user'` → `userId: user?.id || 'unknown'`

---

## 🔄 Files Still Needing Fix (11 remaining)

### Tab Components
6. **PharmacyTab.js** (2 occurrences)
   - Pattern: Add useAuth import and hook call, replace references

7. **EnhancedOrdersTab.js**
   - Pattern: Add useAuth import and hook call, replace references

8. **CDSHooksTab.js**
   - Pattern: Add useAuth import and hook call, replace references

### Dialog Components
9. **ImagingReportDialog.js** (2 occurrences)
   - Pattern: Add useAuth import and hook call, replace references

### Documentation Components
10. **ComprehensiveNoteCreator.js**
    - Pattern: Add useAuth import and hook call, replace references

### Service Files
11. **resultDocumentationService.js**
    - Note: Service file - may need different approach (pass user as parameter)

12. **clinicalCDSService.js**
    - Note: Service file - may need different approach (pass user as parameter)

13. **clinicalDocumentationLinkingService.js** (2 occurrences)
    - Note: Service file - may need different approach (pass user as parameter)

### CDS Component Files
14. **CDSAlertBanner.js**
    - Pattern: Add useAuth import and hook call, replace references

15. **CDSHookManager.js**
    - Pattern: Add useAuth import and hook call, replace references

16. **CDSAlertsPanel.js** (4 occurrences)
    - Pattern: Add useAuth import and hook call, replace references

---

## 📋 Fix Pattern

### For React Components
```javascript
// 1. Add import
import { useAuth } from '@/contexts/AuthContext';

// 2. Add hook call in component
const { user } = useAuth();

// 3. Replace hardcoded reference
// Before:
reference: 'Practitioner/current-user'
userId: 'current-user'

// After:
reference: `Practitioner/${user?.id || 'unknown'}`
userId: user?.id || 'unknown'
```

### For Service Files
Service files can't use hooks. Options:
1. Pass user as parameter to service functions
2. Import from localStorage where auth stores user data
3. Refactor to accept userId as parameter

---

## 🧪 Testing Plan

### After Frontend Rebuild
1. Login as demo user (demo/password)
2. Select a patient
3. Navigate to Orders tab
4. Create a new medication order
5. Verify no "Practitioner/current-user not found" error
6. Verify order is created successfully in HAPI FHIR

### Verification Queries
```bash
# Check created order has valid practitioner reference
curl "http://localhost:8888/fhir/MedicationRequest?_count=1&_sort=-_lastUpdated" | jq '.entry[0].resource.requester.reference'

# Should return: "Practitioner/demo-physician" (not "Practitioner/current-user")
```

---

## 🚀 Next Steps

1. **Complete remaining fixes** - Fix the 11 remaining files
2. **Rebuild frontend** - `docker-compose build frontend`
3. **Restart frontend** - `docker-compose restart frontend`
4. **Test UI flow** - Verify medication ordering works
5. **Update documentation** - Document the Practitioner authentication changes

---

## 📝 Notes

- AuthContext provides `user.id` which matches Practitioner ID (e.g., "demo-physician")
- Backend creates demo Practitioners during deployment
- HAPI FHIR validates all resource references
- Frontend was created before Practitioner auth was implemented
- This fix ensures frontend and backend are in sync
