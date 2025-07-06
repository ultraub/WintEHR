# Project Integrity Guide - Quick Reference

**Purpose**: Error patterns, fixes, and development standards  
**Updated**: 2025-01-05

## 🔥 Top 10 Errors & Fixes

### 1. Icon Import Error
```javascript
// ❌ WRONG
import { Warning } from '@mui/material';

// ✅ FIX
import { Warning } from '@mui/icons-material';
```

### 2. React Object Rendering
```javascript
// ❌ WRONG - Renders object
<Typography>{allergy.category}</Typography>

// ✅ FIX - Extract string
<Typography>{allergy.category?.[0]?.text || 'Unknown'}</Typography>
```

### 3. Hook Return Type
```javascript
// ❌ WRONG
conditions.filter(c => c.active)

// ✅ FIX
conditions.activeConditions
```

### 4. FHIR Data Format
```javascript
// ❌ WRONG
result.entry?.map(e => e.resource)

// ✅ FIX
result.resources || []
```

### 5. Promise Handling
```javascript
// ❌ WRONG - Fails on any 404
await Promise.all([...requests])

// ✅ FIX - Continues on failure
await Promise.allSettled([...requests])
```

### 6. Icon Name Case
```javascript
// ❌ WRONG
import { BloodType } from '@mui/icons-material';

// ✅ FIX
import { Bloodtype } from '@mui/icons-material';
```

### 7. Stack in ListItemText
```javascript
// ❌ WRONG
secondary={<Stack>...</Stack>}

// ✅ FIX
secondary={<React.Fragment>...</React.Fragment>}
```

### 8. Missing Dependencies
```javascript
// ❌ WRONG
useEffect(() => { loadData(); });

// ✅ FIX
useEffect(() => { loadData(); }, [patientId]);
```

### 9. FHIR Reference Format
```javascript
// ❌ WRONG - Expects standard format
if (reference.startsWith('Patient/'))

// ✅ FIX - Handle Synthea format
if (reference.startsWith('urn:uuid:'))
```

### 10. Null Patient Context
```javascript
// ❌ WRONG
setCurrentPatient(patient)

// ✅ FIX
setCurrentPatient(patientId)  // Pass ID string
```

## 🛡️ Safe FHIR Rendering

### CodeableConcept
```javascript
const display = concept?.text || 
                concept?.coding?.[0]?.display || 
                concept?.coding?.[0]?.code || 
                'Unknown';
```

### Reference
```javascript
const display = ref?.display || 
                ref?.reference?.split('/')?.pop() || 
                'Unknown';
```

### Quantity
```javascript
const display = quantity ? 
                `${quantity.value} ${quantity.unit}` : 
                'N/A';
```

## 🔍 Debug Checklist

**Data Not Showing?**
- [ ] Check browser console for errors
- [ ] Verify API response: `console.log(result)`
- [ ] Check data format: `resources` not `entry`
- [ ] Verify patient ID format matches data
- [ ] Check if resource type returns 404

**Rendering Error?**
- [ ] Find the exact component in error stack
- [ ] Check for object being rendered as child
- [ ] Look for missing `?.text` or `?.display`
- [ ] Verify all array access has null checks

## 💡 Component Template

```javascript
import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useFHIRResource } from '../contexts/FHIRResourceContext';
import { fhirClient } from '../services/fhirClient';

const NewComponent = ({ patientId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!patientId) return;
      
      try {
        const result = await fhirClient.search('ResourceType', {
          patient: patientId
        });
        setData(result.resources || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [patientId]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data?.length) return <Alert>No data found</Alert>;

  return (
    <Box>
      {data.map(item => (
        <div key={item.id}>
          {item.code?.text || item.code?.coding?.[0]?.display || 'Unknown'}
        </div>
      ))}
    </Box>
  );
};
```

## 🏗️ Architecture

```
frontend/
├── src/contexts/FHIRResourceContext.js    # State management
├── src/hooks/useFHIRResources.js         # Custom hooks
├── src/services/fhirClient.js            # API client
└── src/components/clinical/               # Components

backend/
├── fhir_api/                              # FHIR endpoints
├── core/fhir/                             # Core operations
└── scripts/synthea_workflow.py            # Data generation
```

## 🔗 Quick Links

- **Hooks Reference**: `/src/hooks/useFHIRResources.js`
- **FHIR Client**: `/src/services/fhirClient.js`
- **API Docs**: `/docs/API_ENDPOINTS.md`
- **Frontend Tracker**: `/docs/FRONTEND_REDESIGN_TRACKER.md`