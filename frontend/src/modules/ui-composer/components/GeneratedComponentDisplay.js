/**
 * Generated Component Display
 * Displays the generated component code or a preview based on the specification
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Alert,
  LinearProgress,
  Chip,
  Stack
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

const GeneratedComponentDisplay = ({ componentSpec, componentCode }) => {
  // If we have the actual code, show it in a code block for now
  if (componentCode && typeof componentCode === 'string') {
    // Clean up markdown if present
    let cleanCode = componentCode;
    if (cleanCode.includes('```')) {
      const codeBlockRegex = /```(?:jsx?|javascript|typescript|tsx?)?\n?([\s\S]*?)```/g;
      const matches = [...cleanCode.matchAll(codeBlockRegex)];
      if (matches.length > 0) {
        cleanCode = matches[0][1].trim();
      }
    }
    
    // For now, render a preview based on component type
    return <ComponentPreview spec={componentSpec} code={cleanCode} />;
  }
  
  // Fallback to spec-based preview
  return <ComponentPreview spec={componentSpec} />;
};

// Component preview based on type
const ComponentPreview = ({ spec, code }) => {
  const { type, props = {}, dataBinding } = spec || {};
  
  switch (type) {
    case 'grid':
      return <GridPreview props={props} dataBinding={dataBinding} />;
    case 'chart':
      return <ChartPreview props={props} dataBinding={dataBinding} />;
    case 'stat':
      return <StatPreview props={props} dataBinding={dataBinding} />;
    case 'summary':
      return <SummaryPreview props={props} dataBinding={dataBinding} />;
    case 'form':
      return <FormPreview props={props} />;
    case 'timeline':
      return <TimelinePreview props={props} />;
    case 'container':
      return <ContainerPreview props={props} />;
    default:
      return <DefaultPreview type={type} props={props} />;
  }
};

// Grid Preview Component
const GridPreview = ({ props, dataBinding }) => {
  const { title = 'Data Grid', columns = [], gridType } = props;
  
  // Sample data for preview
  const sampleData = [
    { id: 1, name: 'Patient A', value: '8.5%', date: '2024-01-15', status: 'High' },
    { id: 2, name: 'Patient B', value: '9.2%', date: '2024-01-14', status: 'Critical' },
    { id: 3, name: 'Patient C', value: '8.1%', date: '2024-01-13', status: 'High' }
  ];
  
  return (
    <Paper elevation={1} sx={{ width: '100%' }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {dataBinding && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Data: {dataBinding.resourceType} • Filters: {dataBinding.filters?.join(', ') || 'None'}
          </Typography>
        )}
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Patient Name</TableCell>
              <TableCell>A1C Value</TableCell>
              <TableCell>Test Date</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sampleData.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  <Typography color={parseFloat(row.value) > 8.5 ? 'error' : 'inherit'}>
                    {row.value}
                  </Typography>
                </TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>
                  <Chip 
                    label={row.status} 
                    size="small" 
                    color={row.status === 'Critical' ? 'error' : 'warning'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

// Chart Preview Component
const ChartPreview = ({ props, dataBinding }) => {
  const { title = 'Chart', chartType = 'bar' } = props;
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {dataBinding && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Chart Type: {chartType} • Data: {dataBinding.resourceType}
          </Typography>
        )}
        <Box sx={{ height: 300, position: 'relative', bgcolor: 'grey.50', borderRadius: 1 }}>
          {/* Placeholder chart visualization */}
          <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="flex-end" justifyContent="space-around">
              <Box sx={{ width: 40, height: 80, bgcolor: 'primary.main', borderRadius: 1 }} />
              <Box sx={{ width: 40, height: 120, bgcolor: 'primary.main', borderRadius: 1 }} />
              <Box sx={{ width: 40, height: 60, bgcolor: 'primary.main', borderRadius: 1 }} />
              <Box sx={{ width: 40, height: 100, bgcolor: 'primary.main', borderRadius: 1 }} />
              <Box sx={{ width: 40, height: 90, bgcolor: 'primary.main', borderRadius: 1 }} />
            </Stack>
          </Box>
          <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
            <Chip label={chartType} size="small" />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Stat Preview Component
const StatPreview = ({ props, dataBinding }) => {
  const { title = 'Statistics', metrics = [] } = props;
  
  const sampleStats = [
    { label: 'Total Patients', value: '142', trend: '+12%', positive: true },
    { label: 'Average A1C', value: '8.7%', trend: '+0.3%', positive: false },
    { label: 'Highest A1C', value: '11.2%', trend: 'Critical', positive: false }
  ];
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Grid container spacing={2}>
          {sampleStats.map((stat, index) => (
            <Grid item xs={12} sm={4} key={index}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
                <Typography variant="h4" sx={{ my: 1 }}>
                  {stat.value}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {stat.positive ? (
                    <TrendingUpIcon fontSize="small" color="success" />
                  ) : (
                    <WarningIcon fontSize="small" color="warning" />
                  )}
                  <Typography variant="caption" color={stat.positive ? 'success.main' : 'warning.main'}>
                    {stat.trend}
                  </Typography>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

// Summary Preview
const SummaryPreview = ({ props }) => {
  const { title = 'Summary' } = props;
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Stack spacing={1}>
          <Alert severity="warning">3 patients require immediate attention</Alert>
          <Alert severity="info">5 patients due for follow-up this week</Alert>
          <Alert severity="success">85% of patients showing improvement</Alert>
        </Stack>
      </CardContent>
    </Card>
  );
};

// Form Preview
const FormPreview = ({ props }) => {
  const { title = 'Form' } = props;
  
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Stack spacing={2}>
        <Skeleton variant="rectangular" height={56} />
        <Skeleton variant="rectangular" height={56} />
        <Skeleton variant="rectangular" height={120} />
        <Skeleton variant="rectangular" height={40} width={120} />
      </Stack>
    </Paper>
  );
};

// Timeline Preview
const TimelinePreview = ({ props }) => {
  const { title = 'Timeline' } = props;
  
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ position: 'relative', pl: 3 }}>
        <Box sx={{ 
          position: 'absolute', 
          left: 8, 
          top: 30, 
          bottom: 30, 
          width: 2, 
          bgcolor: 'primary.main' 
        }} />
        <Stack spacing={2}>
          {[1, 2, 3].map(i => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{
                position: 'absolute',
                left: 4,
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: 'primary.main'
              }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">Event {i}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date().toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    </Paper>
  );
};

// Container Preview
const ContainerPreview = ({ props }) => {
  return (
    <Box sx={{ border: '2px dashed', borderColor: 'divider', p: 2, borderRadius: 1 }}>
      <Typography variant="body2" color="text.secondary" align="center">
        Container Component
      </Typography>
    </Box>
  );
};

// Default Preview
const DefaultPreview = ({ type, props }) => {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Alert severity="info">
        Component Type: {type || 'Unknown'}
      </Alert>
    </Paper>
  );
};

export default GeneratedComponentDisplay;