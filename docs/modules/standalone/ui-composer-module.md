# UI Composer Module

**Status**: Complete  
**Type**: Experimental Feature  
**Dependencies**: Claude Code (window.claude.complete)  
**Location**: `/frontend/src/modules/ui-composer/`  
**Route**: `/ui-composer`  
**Menu**: Developer Tools → UI Composer

## Overview

The UI Composer is an experimental feature that allows users to dynamically generate clinical interfaces using natural language. It leverages Claude Code's local AI capabilities to design, build, and refine custom UIs without pre-built templates.

## Architecture

### Multi-Agent System

1. **Design Agent** (`agents/DesignAgent.js`)
   - Analyzes natural language requests
   - Creates UI specifications
   - Determines data requirements
   - No fallback mechanisms

2. **Builder Agent** (`agents/BuilderAgent.js`)
   - Converts specifications to React components
   - Generates code dynamically
   - Uses Material-UI and FHIR patterns
   - No template-based generation

3. **Refinement Agent** (`agents/RefinementAgent.js`)
   - Processes user feedback
   - Modifies UI specifications
   - Applies incremental changes
   - Maintains refinement history

### Core Components

- **UIComposerMain.js**: Entry point with stepper interface
- **NaturalLanguageInput.js**: User input with examples
- **PreviewCanvas.js**: Live preview with progressive loading
- **FeedbackInterface.js**: Human-in-the-loop refinement
- **DashboardManager.js**: Save/load functionality

### State Management

- **UIComposerContext.js**: Centralized state with useReducer
- Manages requests, specifications, and generation status
- Tracks conversation history and feedback

## Claude Integration

### Requirements

- Claude Code must be running on the user's machine
- `window.claude.complete` must be accessible
- No external API keys needed

### Status Monitoring

- **useClaudeStatus Hook**: Monitors Claude availability
- Visual indicators in UI (status banner, header indicator)
- Automatic retry mechanism
- Input disabled when Claude unavailable

### Error Handling

All agents check for Claude availability:
```javascript
if (!window.claude || !window.claude.complete) {
  throw new Error('Claude is not available...');
}
```

## Features

### Progressive Loading
1. **Skeleton**: Basic structure placeholders
2. **Layout**: Component arrangement
3. **Content**: Actual components
4. **Data**: FHIR data population

### Supported UI Types
- Charts (line, bar, pie, scatter, area)
- Grids (patient lists, results, medications)
- Summaries (statistics, counts)
- Timelines (chronological displays)
- Forms (data entry with validation)
- Containers (layout organization)

### Data Integration
- Direct FHIR API integration
- Real-time data binding
- Clinical data transformations
- Progressive data loading

## Usage

### Quick Test
1. Open `http://localhost:3000/test-ui-composer.html`
2. Verify Claude status
3. Run integration tests

### Creating UIs
1. Navigate to `/ui-composer`
2. Describe UI in natural language
3. Generate and preview
4. Refine with feedback
5. Save for future use

### Example Requests
- "Show all diabetic patients with recent HbA1c > 8"
- "Create a medication adherence dashboard"
- "Display lab results timeline for kidney function"
- "Build an order entry form with decision support"

## Implementation Details

### UI Specification Schema
```javascript
{
  version: "1.0",
  metadata: {
    name: "Dashboard name",
    clinicalContext: {
      scope: "population|patient|encounter",
      dataRequirements: ["FHIR resources"]
    }
  },
  layout: {
    type: "dashboard|report|focused-view",
    structure: { /* component tree */ }
  },
  dataSources: [ /* FHIR queries */ ]
}
```

### Component Generation
- Dynamic React component creation
- No pre-built templates
- Material-UI integration
- FHIR hooks usage
- Error boundaries

### Storage
- Local storage for dashboards
- UI specification serialization
- Component code caching
- Version management

## Quality Assurance

### Code Standards
- ✅ All console.log statements removed
- ✅ Proper error handling
- ✅ Loading states implemented
- ✅ Claude availability checks

### Testing
- Basic unit tests in `tests/UIComposer.test.js`
- Integration test page at `/test-ui-composer.html`
- Verification utility in `utils/verifyIntegration.js`

## Limitations

1. **Claude Dependency**: No fallback mechanisms
2. **Experimental**: Not production-ready
3. **Browser Only**: Requires browser with Claude injection
4. **Local Only**: No remote Claude API support

## Future Enhancements

1. **Enhanced Agents**: More sophisticated UI understanding
2. **Template Library**: Save generated components as templates
3. **Collaboration**: Share dashboards between users
4. **Export**: Generate standalone React components
5. **Testing**: Comprehensive E2E tests

## Recent Updates - 2025-01-08

- ✅ Complete implementation with all agents
- ✅ Removed all fallback mechanisms per user request
- ✅ Added Claude status monitoring
- ✅ Created test page for integration verification
- ✅ Removed all console.log statements
- ✅ Added comprehensive error handling
- ✅ Implemented progressive loading system
- ✅ Created module documentation

## Troubleshooting

### Claude Not Available
- Ensure Claude Code is running
- Check browser permissions
- Verify `window.claude.complete` in console
- Use test page to diagnose

### Generation Fails
- Simplify natural language request
- Check browser console for errors
- Verify FHIR backend is running
- Review Claude response format

### UI Not Updating
- Check component registry
- Verify specification changes
- Review error boundaries
- Check progressive loading phases