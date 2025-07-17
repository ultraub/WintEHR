/**
 * Schema Explorer Component for FHIR Explorer v4
 * 
 * Interactive FHIR resource documentation and schema exploration
 * (Placeholder implementation for Phase 1)
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  Schema as SchemaIcon,
  Construction as ConstructionIcon
} from '@mui/icons-material';

function SchemaExplorer({ onNavigate }) {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Schema Explorer
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Coming in Phase 3: Advanced Schema Exploration
        </Typography>
        This interactive FHIR documentation and schema explorer will provide:
        <ul>
          <li>Interactive field-level exploration</li>
          <li>Real-time schema validation</li>
          <li>Resource structure visualization</li>
          <li>Example data for each field</li>
          <li>Validation rules and constraints</li>
        </ul>
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <SchemaIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Interactive Documentation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Explore FHIR resource schemas with interactive field documentation,
                data types, and validation rules.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <ConstructionIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Under Development
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This feature is currently being developed as part of Phase 3.
                It will provide comprehensive schema exploration capabilities.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default SchemaExplorer;