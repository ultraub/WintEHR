# Unified CQL Quality Measures Component

## Overview

The `UnifiedCQLMeasures` component is a comprehensive, consolidated solution that combines the functionality of both `QualityMeasures.js` and `CQLMeasures.js` into a single, enhanced interface with advanced CQL translation capabilities.

## Key Features

### 1. **Unified Dashboard**
- Single interface for all quality measures (traditional and CQL-based)
- Combined analytics and performance tracking
- Integrated reporting across all measure types

### 2. **Enhanced CQL Support**
- Import and manage CQL (Clinical Quality Language) measures
- Real-time CQL analysis and validation
- Support for QICore profiles and FHIR resources

### 3. **CQL to FHIRPath Translator**
- AI-powered translation engine
- Converts CQL expressions to FHIRPath queries
- Syntax validation and error detection
- Code analysis with suggestions

### 4. **Advanced Analytics**
- Performance tracking by category
- Trend analysis and visualization
- Comprehensive reporting capabilities
- Real-time measure execution

### 5. **Developer Tools**
- CQL validator
- AI assistant for CQL development
- Quick reference guides
- Pattern library

## Component Structure

```javascript
// Main imports and dependencies
import React, { useState, useEffect, useCallback } from 'react';
import { /* Material-UI components */ } from '@mui/material';
import { /* Icons */ } from '@mui/icons-material';
import { format } from 'date-fns';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import api from '../services/api';

// Key utilities
- cqlToFhirPathTranslator: Translates CQL to FHIRPath
- cqlAnalyzer: Analyzes CQL content for structure and validity
```

## Integration Instructions

### 1. **Add the Component**
The component has already been created at:
```
/frontend/src/pages/UnifiedCQLMeasures.js
```

### 2. **Update Routes**
Add the following route to `/frontend/src/App.js`:

```javascript
import UnifiedCQLMeasures from './pages/UnifiedCQLMeasures';

// In the Routes section, add:
<Route path="/unified-quality" element={
  <ProtectedRoute>
    <Layout>
      <UnifiedCQLMeasures />
    </Layout>
  </ProtectedRoute>
} />
```

### 3. **Update Navigation Menu**
In `/frontend/src/components/Layout.js`, replace the existing quality measure menu items with:

```javascript
const menuItems = [
  // ... existing items ...
  { text: 'Quality & CQL Measures', icon: <AssessmentIcon />, emoji: '📊', path: '/unified-quality' },
  // Remove or comment out the old items:
  // { text: 'Quality Measures', icon: <AssessmentIcon />, emoji: '✅', path: '/quality' },
  // { text: 'CQL Measures', icon: <ScienceIcon />, emoji: '🧪', path: '/cql-measures' },
];
```

### 4. **Install Additional Dependencies**
Add these to your `package.json` if not already present:

```json
{
  "dependencies": {
    "react-syntax-highlighter": "^15.5.0"
  }
}
```

Then run:
```bash
npm install
```

## Usage Guide

### Viewing Quality Measures
1. Navigate to "Quality & CQL Measures" from the main menu
2. The first tab shows all quality measures with their current scores
3. Click the play button to execute a measure
4. View trends and performance indicators

### Managing CQL Measures
1. Click on the "CQL Measures" tab
2. Use "Import CQL" to upload new CQL files
3. The system will analyze and validate the CQL content
4. View execution results and manage CQL libraries

### Using the CQL Translator
1. Click "CQL Translator" button in the header
2. Enter CQL code in the left panel
3. Click "Translate" to convert to FHIRPath
4. View analysis results and suggestions below

### Generating Reports
1. Click "Generate Report" button
2. Select reporting period and measures to include
3. Toggle "Include CQL measures" option
4. Download or view the generated report

## CQL Translation Examples

### Example 1: Age Calculation
**CQL Input:**
```cql
define "Adult Patients":
  Patient where AgeInYears() >= 18
```

**FHIRPath Output:**
```
Patient where (today() - birthDate).years >= 18
```

### Example 2: Value Set Membership
**CQL Input:**
```cql
define "Diabetic Patients":
  [Condition] C where C.code in "Diabetes Diagnosis Codes"
```

**FHIRPath Output:**
```
Condition where code.memberOf('Diabetes Diagnosis Codes')
```

## API Integration

The component integrates with these backend endpoints:

### Quality Measures
- `GET /api/quality/measures` - List all measures
- `POST /api/quality/measures/{id}/calculate` - Execute a measure
- `POST /api/quality/reports/generate` - Generate report

### CQL Processing
- `POST /api/cql/import` - Import CQL measure
- `POST /api/cql/execute` - Execute CQL logic
- `POST /api/cql/translate` - Translate CQL to FHIRPath

## Features Comparison

| Feature | Original QualityMeasures | Original CQLMeasures | UnifiedCQLMeasures |
|---------|-------------------------|---------------------|-------------------|
| Traditional Measures | ✅ | ❌ | ✅ |
| CQL Import | ❌ | ✅ | ✅ |
| Performance Dashboard | ✅ | Limited | ✅ Enhanced |
| CQL Translation | ❌ | ❌ | ✅ |
| AI Analysis | ❌ | ❌ | ✅ |
| Unified Reporting | ❌ | ❌ | ✅ |
| Developer Tools | ❌ | ❌ | ✅ |

## Advanced Features

### CQL Analyzer
The built-in analyzer detects:
- Library declarations and versions
- FHIR resource usage
- Value set references
- Measure populations
- Code complexity
- Common issues and suggestions

### Translation Modes
Currently supported:
- CQL to FHIRPath ✅
- FHIRPath to CQL (Coming soon)
- CQL to SQL (Coming soon)

### Performance Optimization
- Lazy loading of measure data
- Memoized translation results
- Efficient re-rendering with React hooks
- Batch API calls for better performance

## Troubleshooting

### Common Issues

1. **Translation errors**: Check for unsupported CQL constructs
2. **Import failures**: Ensure CQL syntax is valid
3. **Performance issues**: Check browser console for errors

### Debug Mode
Enable debug logging by adding to the component:
```javascript
const DEBUG = true; // Set to false in production
```

## Future Enhancements

1. **Advanced Translation**
   - Support for more CQL constructs
   - Bi-directional translation
   - SQL query generation

2. **AI Features**
   - Auto-generate CQL from natural language
   - Intelligent measure recommendations
   - Automated optimization suggestions

3. **Integration**
   - Direct VSAC integration
   - HL7 FHIR server connectivity
   - Real-time collaboration features

## Migration Guide

To migrate from separate components:

1. **Data Migration**: No data migration needed - uses same API endpoints
2. **Route Updates**: Update bookmarks and links to use `/unified-quality`
3. **User Training**: The interface is intuitive but includes more features
4. **Deprecation**: Keep old components for 30 days before removal

## Support

For issues or questions:
1. Check the in-app help tooltips
2. Review the CQL pattern library in the Tools tab
3. Use the AI Assistant for CQL writing help
4. Contact the development team for advanced support