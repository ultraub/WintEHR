/**
 * WorkspaceContent Component
 * Renders custom layouts with components arranged according to saved configurations
 */
import React from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Import all available components
import SummaryTab from './tabs/SummaryTab';
import ChartReviewTab from './tabs/ChartReviewTab';
import EncountersTab from './tabs/EncountersTab';
import ResultsTab from './tabs/ResultsTab';
import OrdersTab from './tabs/OrdersTab';
import DocumentationTab from './tabs/DocumentationTab';
import CarePlanTab from './tabs/CarePlanTab';
import TimelineTab from './tabs/TimelineTab';

// Component registry
const COMPONENT_REGISTRY = {
  'summary': { component: SummaryTab, name: 'Summary Dashboard' },
  'chart': { component: ChartReviewTab, name: 'Chart Review' },
  'encounters': { component: EncountersTab, name: 'Encounters' },
  'results': { component: ResultsTab, name: 'Results' },
  'orders': { component: OrdersTab, name: 'Orders' },
  'documentation': { component: DocumentationTab, name: 'Documentation' },
  'careplan': { component: CarePlanTab, name: 'Care Plan' },
  'timeline': { component: TimelineTab, name: 'Timeline' }
};

const WorkspaceContent = ({ layout, patientId, onLayoutChange }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [layout]);

  const handleLayoutChange = (newLayout) => {
    if (onLayoutChange) {
      onLayoutChange(newLayout);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error loading layout: {error}</Typography>
      </Box>
    );
  }

  if (!layout || !layout.items) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>No layout configuration found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <GridLayout
        className="layout"
        layout={layout.items}
        cols={12}
        rowHeight={60}
        width={1200}
        isDraggable={layout.editable}
        isResizable={layout.editable}
        onLayoutChange={handleLayoutChange}
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {layout.items.map((item) => {
          const componentConfig = COMPONENT_REGISTRY[item.component];
          if (!componentConfig) {
            return (
              <Paper
                key={item.i}
                sx={{ 
                  p: 2, 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <Typography color="error">
                  Unknown component: {item.component}
                </Typography>
              </Paper>
            );
          }

          const Component = componentConfig.component;
          return (
            <Paper
              key={item.i}
              sx={{ 
                height: '100%', 
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
              }}
              elevation={2}
            >
              <Box sx={{ 
                p: 1, 
                borderBottom: 1, 
                borderColor: 'divider',
                backgroundColor: 'grey.50'
              }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {componentConfig.name}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <Component 
                  patientId={patientId} 
                  compact={true}
                  {...item.props}
                />
              </Box>
            </Paper>
          );
        })}
      </GridLayout>
    </Box>
  );
};

export default WorkspaceContent;