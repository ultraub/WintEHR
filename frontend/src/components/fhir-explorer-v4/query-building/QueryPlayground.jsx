/**
 * Enhanced Query Playground Component for FHIR Explorer v4
 * 
 * Advanced query testing environment with enhanced features
 * (Enhanced version building on existing QueryPlayground)
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  Tabs,
  Tab,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Code as CodeIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Share as ShareIcon,
  History as HistoryIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';

// Import the existing QueryPlayground component
import ExistingQueryPlayground from '../../fhir-explorer/QueryPlayground';

function QueryPlayground({ onNavigate }) {
  const [enhancedMode, setEnhancedMode] = useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Query Playground
        </Typography>
        
        <Tabs 
          value={enhancedMode ? 1 : 0} 
          onChange={(e, value) => setEnhancedMode(value === 1)}
        >
          <Tab label="Standard Mode" />
          <Tab label="Enhanced Mode" />
        </Tabs>
      </Box>

      {enhancedMode ? (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Enhanced Query Playground - Coming in Phase 2
            </Typography>
            Enhanced features will include:
            <ul>
              <li>Advanced query templates and snippets</li>
              <li>Real-time query validation and suggestions</li>
              <li>Collaborative query sharing and commenting</li>
              <li>Performance profiling and optimization tips</li>
              <li>Query version control and history</li>
              <li>Custom dashboard creation from query results</li>
            </ul>
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <CodeIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Advanced Editor
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Syntax highlighting, auto-completion, and real-time
                    validation for FHIR queries.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <SpeedIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Performance Insights
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Detailed performance analysis and optimization
                    suggestions for your queries.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <ShareIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Collaboration Tools
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Share queries with your team and collaborate
                    on complex data exploration tasks.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <ExistingQueryPlayground />
      )}
    </Box>
  );
}

export default QueryPlayground;