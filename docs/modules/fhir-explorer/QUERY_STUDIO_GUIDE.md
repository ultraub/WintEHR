# FHIR Explorer Query Studio Guide

**Last Updated**: 2025-01-26  
**Version**: 1.0

## Overview

Query Studio is a unified FHIR query building experience that combines the best features of the Visual Query Builder and Query Playground into a single, powerful interface. It provides multiple modes for building queries, comprehensive dark mode support, and enhanced productivity features.

## Key Features

### 🎯 Unified Interface
- **Single Entry Point**: Access all query building capabilities from one location
- **Mode Switching**: Seamlessly switch between Visual, Code, and Split views
- **State Preservation**: Your query is maintained when switching between modes
- **Consistent Experience**: Same results viewer and execution engine across all modes

### 🌓 Full Dark Mode Support
- **Theme-Aware Components**: All UI elements respect the application's theme settings
- **Optimized Contrast**: Carefully tuned colors for both light and dark modes
- **Syntax Highlighting**: Code editor with theme-appropriate syntax colors
- **Reduced Eye Strain**: Dark backgrounds with proper text contrast

### 🚀 Enhanced Productivity
- **Split View**: See visual builder and generated code side-by-side
- **Real-Time Sync**: Changes in visual mode automatically update the code view
- **Export Options**: Export queries as cURL, JavaScript, Python, Postman, or OpenAPI
- **Query Templates**: Quick access to common query patterns
- **Performance Insights**: Execution time tracking and optimization suggestions

## Usage Modes

### Visual Mode
Perfect for users who prefer a graphical interface:
- Drag-and-drop query building
- Resource type browser with categories
- Search parameter autocomplete
- Advanced features (includes, chaining, etc.)

### Code Mode
For users comfortable with FHIR query syntax:
- Direct query editing with syntax validation
- Auto-complete suggestions
- Real-time error checking
- Query history access

### Split Mode
Best of both worlds:
- Visual builder on the left
- Generated code on the right
- Automatic synchronization
- Toggle sync on/off as needed

## Quick Start

1. **Access Query Studio**:
   - Navigate to FHIR Explorer
   - Click on "Query Builder" in the navigation
   - Select "Query Studio" from the submenu

2. **Choose Your Mode**:
   - Click the mode toggle buttons in the header
   - Visual (📊), Code (</›), or Split (⟷)

3. **Build Your Query**:
   - **Visual**: Select resource type, add search parameters
   - **Code**: Type your query directly (e.g., `/Patient?name=Smith`)

4. **Execute**:
   - Click the green "Execute" button
   - View results in the right panel
   - Check performance metrics

5. **Export or Save**:
   - Use the export button to get code snippets
   - Save queries to your workspace for later use

## Advanced Features

### Query Export Formats

#### cURL
```bash
curl -X GET "https://your-server/api/fhir/R4/Patient?name=Smith" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### JavaScript (Fetch API)
```javascript
fetch('https://your-server/api/fhir/R4/Patient?name=Smith', {
  method: 'GET',
  headers: {
    'Accept': 'application/fhir+json',
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

#### Python (Requests)
```python
import requests

url = "https://your-server/api/fhir/R4/Patient?name=Smith"
headers = {
    "Accept": "application/fhir+json",
    "Authorization": "Bearer YOUR_TOKEN"
}

response = requests.get(url, headers=headers)
data = response.json()
```

### Performance Optimization

Query Studio provides real-time performance insights:
- **Execution Time**: Displayed in milliseconds
- **Resource Count**: Number of resources returned vs total available
- **Optimization Tips**: Suggestions when queries take >1 second

### Template Library

Access pre-built queries for common scenarios:
- Recent lab results
- Active patients
- Current medications
- Critical conditions
- Custom saved queries

## Dark Mode Implementation

### Theme Integration
Query Studio fully integrates with the WintEHR medical theme system:
- Automatic theme detection
- Manual theme override available
- Consistent with clinical context themes

### Component Styling
All components use Material-UI theme palette:
```javascript
backgroundColor: theme.palette.mode === 'dark' 
  ? theme.palette.grey[900] 
  : theme.palette.grey[50]
```

### Accessibility
- WCAG AA compliant contrast ratios
- Clear focus indicators
- Keyboard navigation support
- Screen reader friendly

## Migration from Legacy Components

### From Query Playground
- All features preserved
- Enhanced with visual building capabilities
- Same query execution engine
- Improved results viewer

### From Visual Query Builder
- All drag-and-drop functionality retained
- Added code preview and editing
- Better error messages
- More export options

## Best Practices

1. **Start Visual, Refine in Code**: Use visual mode to build the base query, then switch to code mode for fine-tuning

2. **Use Templates**: Start from templates for common queries to save time

3. **Monitor Performance**: Pay attention to execution times and optimize queries that take >1 second

4. **Export for Integration**: Use the export feature to integrate queries into your applications

5. **Save Frequently Used Queries**: Build a library of queries in the Workspace for quick access

## Troubleshooting

### Query Not Executing
- Verify resource type is capitalized (e.g., `Patient` not `patient`)
- Check parameter names match FHIR specification
- Ensure proper date formats (YYYY-MM-DD)

### Dark Mode Issues
- Clear browser cache if themes don't update
- Check theme toggle in the main navigation
- Verify no browser extensions are overriding styles

### Performance Issues
- Add `_count` parameter to limit results
- Use more specific search criteria
- Consider using `_summary=true` for large datasets

## Future Enhancements

Planned improvements for Query Studio:
- GraphQL query support
- Batch query execution
- Query performance analytics
- AI-powered query suggestions
- Collaborative query building
- Query version control

## Conclusion

Query Studio represents a significant improvement in the FHIR Explorer experience, combining the best of visual and code-based query building with full dark mode support and enhanced productivity features. Whether you're a FHIR expert or just getting started, Query Studio provides the tools you need to efficiently explore and query FHIR data.