# Clinical UI Composer

An experimental feature that allows users to dynamically generate clinical interfaces using natural language. The UI Composer leverages Claude Code's local Claude instance to design and build custom UIs on the fly.

## ⚠️ IMPORTANT: Claude Code Required

**This feature REQUIRES Claude Code to function. There are NO fallbacks.**

The UI Composer uses `window.claude.complete` to:
- Analyze natural language requests
- Generate React components
- Process user feedback for refinements

If Claude is not available, you will see error messages prompting you to ensure you're running in the Claude Code environment.

## 🚀 How to Use

### Prerequisites
- **MUST** be running in Claude Code environment
- `window.claude.complete` must be accessible
- No external Claude API keys needed - uses local instance

### Quick Test
1. **Verify Claude Integration**: Open `http://localhost:3000/test-ui-composer.html`
2. **Check Status**: The page will show if Claude is available
3. **Run Tests**: Use the test buttons to verify the integration

### Getting Started

1. **Navigate to UI Composer**
   - Go to `/ui-composer` in the application
   - Or select "UI Composer" from the Developer Tools menu

2. **Describe Your UI**
   - Use natural language to describe what you want
   - Be specific about data types and visualization preferences
   - Examples:
     - "Show all diabetic patients with recent HbA1c > 8"
     - "Create a medication adherence dashboard for hypertensive patients"
     - "Display a timeline of lab results for this patient focused on kidney function"

3. **Generate the UI**
   - Click "Generate UI" or press Enter
   - The system will use Claude Code's agents to:
     - Analyze your request
     - Design a UI specification
     - Generate React components
     - Load FHIR data progressively

4. **Review and Refine**
   - Preview the generated UI in real-time
   - Provide feedback to improve the UI:
     - "Make the chart bigger"
     - "Change to a bar chart"
     - "Add a date filter"
     - "Use blue colors"
   - The refinement agent will apply your changes

5. **Save Your Dashboard**
   - Click "Save Dashboard" when satisfied
   - Give it a name and description
   - Access saved dashboards later from the Dashboard Manager

## 🏗️ Architecture

### Multi-Agent System
The UI Composer uses three specialized Claude agents:

1. **Design Agent**: Analyzes natural language requests and creates UI specifications
2. **Builder Agent**: Converts specifications into React components
3. **Refinement Agent**: Modifies UI based on user feedback

All agents communicate through `window.claude.complete`, which accesses the local Claude instance in Claude Code.

### Component Structure
```
ui-composer/
├── UIComposerMain.js              # Main entry component
├── agents/                        # Claude-powered agents
│   ├── DesignAgent.js            
│   ├── BuilderAgent.js           
│   ├── RefinementAgent.js        
│   └── AgentOrchestrator.js      
├── components/                    # UI components
│   ├── NaturalLanguageInput.js   
│   ├── PreviewCanvas.js          
│   ├── FeedbackInterface.js      
│   └── DashboardManager.js       
├── services/                      # Core services
│   ├── ComponentGenerator.js      
│   ├── FHIRDataOrchestrator.js   
│   └── UISerializer.js           
└── utils/                         # Utilities
    ├── uiSpecSchema.js           
    ├── componentRegistry.js       
    └── clinicalDataHelpers.js    
```

## 🔧 Technical Details

### UI Specification Schema
```javascript
{
  version: "1.0",
  metadata: {
    name: "Dashboard name",
    description: "What this dashboard shows",
    clinicalContext: {
      scope: "population|patient|encounter",
      dataRequirements: ["FHIR resource types"]
    }
  },
  layout: {
    type: "dashboard|report|focused-view",
    structure: {
      // Hierarchical component tree
    }
  },
  dataSources: [
    // FHIR queries and data transformations
  ]
}
```

### Claude Integration
The system uses `window.claude.complete()` to:
- Analyze natural language requests
- Generate React component code
- Process user feedback

Example usage:
```javascript
const response = await window.claude.complete(prompt);
```

### Progressive Loading
Components load in phases:
1. **Skeleton**: Basic structure placeholders
2. **Layout**: Component arrangement
3. **Content**: Actual components
4. **Data**: FHIR data population

## 🎯 Supported Component Types

- **Charts**: Line, bar, pie, scatter, area
- **Grids**: Patient lists, result tables, medication lists
- **Summaries**: Statistical summaries, counts
- **Timelines**: Chronological data display
- **Forms**: Data entry with validation
- **Containers**: Layout organization

## 💡 Tips for Better Results

1. **Be Specific**: "Show diabetic patients" → "Show all patients with diabetes diagnosis in the last 2 years"
2. **Mention Visualization**: "Display as a bar chart" or "Show in a timeline"
3. **Include Filters**: "Filter by active patients only" or "Last 6 months"
4. **Specify Data**: "Include medication adherence rates" or "Show HbA1c values"

## 🚨 Important Notes

- This is an **experimental feature**
- Component generation relies on Claude Code's local instance
- Falls back to template-based generation if Claude is unavailable
- All data comes from FHIR APIs - no mock data
- Generated components follow WintEHR patterns

## 🔍 Troubleshooting

### Claude Not Available
If `window.claude.complete` is not available:
- **ERROR**: You will see "Claude is not available. Please ensure you are running in Claude Code environment with window.claude.complete accessible."
- **SOLUTION**: You MUST run this feature in Claude Code
- **NO FALLBACK**: This feature does not work without Claude

### Component Generation Fails
- Check the browser console for errors
- Try simplifying your request
- Use the feedback interface to refine

### Data Not Loading
- Verify FHIR backend is running
- Check patient context if needed
- Review data source specifications

## 🛠️ Development

### Adding New Component Types
1. Add to `COMPONENT_TYPES` in `uiSpecSchema.js`
2. Create template in `BuilderAgent.js`
3. Add skeleton in `ProgressiveContainer.js`
4. Implement renderer in `DynamicComponent.js`

### Extending Agent Capabilities
Agents use structured prompts that can be modified:
- Design Agent: `buildAnalysisPrompt()`
- Builder Agent: `buildComponentPrompt()`
- Refinement Agent: `buildFeedbackAnalysisPrompt()`

## 📚 Examples

### Population Health Dashboard
```
"Create a dashboard showing all hypertensive patients with their latest blood pressure readings and medication adherence rates"
```

### Patient-Specific Timeline
```
"Show a timeline of all lab results for this patient, focusing on kidney function markers like creatinine and eGFR"
```

### Clinical Form
```
"Build an order entry form for laboratory tests with decision support for common panels"
```

---

**Note**: The UI Composer is designed to work specifically with Claude Code's `window.claude.complete` API. It will not work with external Claude API endpoints.