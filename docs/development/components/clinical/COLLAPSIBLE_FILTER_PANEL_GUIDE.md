# CollapsibleFilterPanel Usage Guide

## Overview
The `CollapsibleFilterPanel` is a standardized filter component that provides a consistent filtering experience across all clinical tabs. It automatically collapses when scrolling to save screen space while showing active filters.

## Key Features
- **Auto-collapse on scroll**: Saves screen real estate
- **Persistent filter visibility**: Shows active filters even when collapsed
- **Standardized search**: Consistent search experience across tabs
- **Date range filtering**: Built-in date range options
- **View mode switching**: Integrated view mode controls
- **Custom filter support**: Extensible with additional filters via children

## Basic Usage

```javascript
import CollapsibleFilterPanel from '../../CollapsibleFilterPanel';

// In your component
const scrollContainerRef = useRef(null);

<CollapsibleFilterPanel
  searchQuery={searchTerm}
  onSearchChange={setSearchTerm}
  dateRange={filterPeriod}
  onDateRangeChange={setFilterPeriod}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  searchPlaceholder="Search..."
  dateRangeOptions={[
    { value: 'all', label: 'All Time' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' }
  ]}
  viewModeOptions={[
    { value: 'list', label: 'List', icon: <ListIcon /> },
    { value: 'cards', label: 'Cards', icon: <CardsIcon /> },
    { value: 'timeline', label: 'Timeline', icon: <TimelineIcon /> }
  ]}
  showCategories={false}
  showInactiveToggle={false}
  onRefresh={handleRefresh}
  onExport={handleExport}
  scrollContainerRef={scrollContainerRef}
>
  {/* Additional custom filters */}
</CollapsibleFilterPanel>
```

## Props

### Core Props
- `searchQuery` (string): Current search term
- `onSearchChange` (function): Callback when search changes
- `dateRange` (string): Selected date range value
- `onDateRangeChange` (function): Callback when date range changes
- `viewMode` (string): Current view mode
- `onViewModeChange` (function): Callback when view mode changes

### Customization Props
- `searchPlaceholder` (string): Placeholder text for search field
- `dateRangeOptions` (array): Array of {value, label} for date ranges
- `viewModeOptions` (array): Array of {value, label, icon} for view modes
- `showCategories` (boolean): Whether to show category filter
- `showInactiveToggle` (boolean): Whether to show inactive items toggle
- `collapseThreshold` (number): Scroll distance before collapse (default: 100)

### Action Props
- `onRefresh` (function): Refresh button callback
- `onExport` (function): Export button callback
- `scrollContainerRef` (ref): Reference to scroll container

### Additional Props
- `categories` (array): Category options if showCategories is true
- `selectedCategories` (array): Selected categories
- `onCategoriesChange` (function): Category change callback
- `showInactive` (boolean): Show inactive items state
- `onShowInactiveChange` (function): Inactive toggle callback
- `additionalFilters` (array): Additional filter states
- `children` (node): Custom filter controls

## Implementation Examples

### Results Tab
```javascript
<CollapsibleFilterPanel
  searchQuery={searchTerm}
  onSearchChange={setSearchTerm}
  dateRange={filterPeriod}
  onDateRangeChange={setFilterPeriod}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  searchPlaceholder="Search results..."
  dateRangeOptions={[
    { value: 'all', label: 'All Time' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' }
  ]}
  viewModeOptions={[
    { value: 'table', label: 'Table', icon: <TableIcon /> },
    { value: 'cards', label: 'Cards', icon: <CardsIcon /> },
    { value: 'trends', label: 'Trends', icon: <TrendsIcon /> }
  ]}
  scrollContainerRef={scrollContainerRef}
>
  {/* Custom status filter */}
  <FormControl size="small" sx={{ minWidth: 120 }}>
    <InputLabel>Status</InputLabel>
    <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Status">
      <MenuItem value="all">All</MenuItem>
      <MenuItem value="abnormal">Abnormal</MenuItem>
      <MenuItem value="normal">Normal</MenuItem>
    </Select>
  </FormControl>
</CollapsibleFilterPanel>
```

### Encounters Tab
```javascript
<CollapsibleFilterPanel
  searchQuery={searchTerm}
  onSearchChange={setSearchTerm}
  dateRange={filterPeriod}
  onDateRangeChange={setFilterPeriod}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  searchPlaceholder="Search encounters..."
  dateRangeOptions={[
    { value: 'all', label: 'All Time' },
    { value: '1m', label: 'Last Month' },
    { value: '3m', label: 'Last 3 Months' },
    { value: '6m', label: 'Last 6 Months' },
    { value: '1y', label: 'Last Year' }
  ]}
  viewModeOptions={[
    { value: 'cards', label: 'Cards', icon: <CalendarIcon /> },
    { value: 'timeline', label: 'Timeline', icon: <TimeIcon /> },
    { value: 'table', label: 'Table', icon: <AssignmentIcon /> }
  ]}
  onRefresh={() => fetchEncounters(patientId)}
  onExport={() => handleExportEncounters('csv')}
  scrollContainerRef={scrollContainerRef}
>
  {/* Custom encounter type filter */}
  <ToggleButtonGroup value={filterType} exclusive onChange={(e, value) => value && setFilterType(value)} size="small">
    <ToggleButton value="all">All Types</ToggleButton>
    <ToggleButton value="AMB">Ambulatory</ToggleButton>
    <ToggleButton value="IMP">Inpatient</ToggleButton>
    <ToggleButton value="EMER">Emergency</ToggleButton>
  </ToggleButtonGroup>
</CollapsibleFilterPanel>
```

### Imaging Tab
```javascript
<CollapsibleFilterPanel
  searchQuery={searchTerm}
  onSearchChange={setSearchTerm}
  dateRange={filterPeriod}
  onDateRangeChange={setFilterPeriod}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  searchPlaceholder="Search studies..."
  dateRangeOptions={[
    { value: 'all', label: 'All Time' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '3m', label: 'Last 3 Months' },
    { value: '6m', label: 'Last 6 Months' },
    { value: '1y', label: 'Last Year' }
  ]}
  viewModeOptions={[
    { value: 'timeline', label: 'Timeline', icon: <TimelineIcon /> },
    { value: 'gallery', label: 'Gallery', icon: <GalleryIcon /> },
    { value: 'cards', label: 'Cards', icon: <CollectionsIcon /> },
    { value: 'table', label: 'Table', icon: <ListIcon /> },
    { value: 'bodymap', label: 'Body Map', icon: <BodyMapIcon /> }
  ]}
  onRefresh={loadImagingStudies}
  scrollContainerRef={scrollContainerRef}
>
  {/* Custom imaging filters */}
  <Stack direction="row" spacing={2}>
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <InputLabel>Modality</InputLabel>
      <Select value={filterModality} onChange={(e) => setFilterModality(e.target.value)} label="Modality">
        <MenuItem value="all">All Modalities</MenuItem>
        <MenuItem value="CT">CT</MenuItem>
        <MenuItem value="MR">MRI</MenuItem>
        <MenuItem value="XR">X-Ray</MenuItem>
      </Select>
    </FormControl>
    
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <InputLabel>Status</InputLabel>
      <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Status">
        <MenuItem value="all">All Status</MenuItem>
        <MenuItem value="available">Available</MenuItem>
        <MenuItem value="pending">Pending</MenuItem>
      </Select>
    </FormControl>
  </Stack>
</CollapsibleFilterPanel>
```

## Best Practices

1. **Always provide a scrollContainerRef**: This enables the auto-collapse feature
2. **Use consistent date ranges**: Align date range options across similar tabs
3. **Provide meaningful placeholders**: Help users understand what they can search for
4. **Keep custom filters simple**: Use the children prop for 1-2 additional filters
5. **Handle empty states**: Ensure your filtered data handles empty results gracefully

## Migration Guide

### Before (Inline Filters)
```javascript
<Paper sx={{ p: 2, mb: 2 }}>
  <Stack direction="row" spacing={2}>
    <TextField
      placeholder="Search..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      InputProps={{
        startAdornment: <SearchIcon />
      }}
    />
    <FormControl>
      <InputLabel>Period</InputLabel>
      <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
        <MenuItem value="all">All Time</MenuItem>
        <MenuItem value="30d">Last 30 Days</MenuItem>
      </Select>
    </FormControl>
    <ToggleButtonGroup value={viewMode} onChange={setViewMode}>
      <ToggleButton value="list">List</ToggleButton>
      <ToggleButton value="grid">Grid</ToggleButton>
    </ToggleButtonGroup>
  </Stack>
</Paper>
```

### After (CollapsibleFilterPanel)
```javascript
<CollapsibleFilterPanel
  searchQuery={searchTerm}
  onSearchChange={setSearchTerm}
  dateRange={period}
  onDateRangeChange={setPeriod}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  searchPlaceholder="Search..."
  dateRangeOptions={[
    { value: 'all', label: 'All Time' },
    { value: '30d', label: 'Last 30 Days' }
  ]}
  viewModeOptions={[
    { value: 'list', label: 'List', icon: <ListIcon /> },
    { value: 'grid', label: 'Grid', icon: <GridIcon /> }
  ]}
  scrollContainerRef={scrollContainerRef}
/>
```

## Benefits

1. **Consistency**: Same filter experience across all tabs
2. **Space Efficiency**: Auto-collapse saves ~100px of vertical space
3. **User Context**: Active filters remain visible when collapsed
4. **Reduced Code**: ~40% less filter code per tab
5. **Maintainability**: Single component to update for all tabs
6. **Accessibility**: Built-in keyboard navigation and ARIA labels