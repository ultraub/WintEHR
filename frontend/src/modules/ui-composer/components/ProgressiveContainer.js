/**
 * Progressive Container Component
 * Wrapper for progressive loading with component-specific skeletons
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Skeleton,
  Paper,
  Stack,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { COMPONENT_TYPES } from '../utils/uiSpecSchema';

const ProgressiveContainer = ({ componentType, props, loadingPhase = 'skeleton' }) => {
  const [currentPhase, setCurrentPhase] = useState('skeleton');
  
  useEffect(() => {
    const phases = ['skeleton', 'layout', 'content', 'data'];
    const phaseIndex = phases.indexOf(loadingPhase);
    
    if (phaseIndex >= 0) {
      setCurrentPhase(phases[phaseIndex]);
    }
  }, [loadingPhase]);
  
  // Render loading skeleton based on component type
  const renderSkeleton = () => {
    switch (componentType) {
      case COMPONENT_TYPES.CHART:
        return <ChartSkeleton props={props} />;
      case COMPONENT_TYPES.GRID:
        return <GridSkeleton props={props} />;
      case COMPONENT_TYPES.SUMMARY:
        return <SummarySkeleton props={props} />;
      case COMPONENT_TYPES.TIMELINE:
        return <TimelineSkeleton props={props} />;
      case COMPONENT_TYPES.FORM:
        return <FormSkeleton props={props} />;
      case COMPONENT_TYPES.CONTAINER:
        return <ContainerSkeleton props={props} />;
      case COMPONENT_TYPES.TEXT:
        return <TextSkeleton props={props} />;
      default:
        return <DefaultSkeleton props={props} />;
    }
  };
  
  // Render layout phase
  const renderLayout = () => {
    return (
      <Box sx={{ border: '1px dashed', borderColor: 'grey.300', p: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Loading {componentType} component...
        </Typography>
        <LinearProgress />
      </Box>
    );
  };
  
  // Render content phase
  const renderContent = () => {
    return (
      <Box sx={{ opacity: 0.6 }}>
        {renderSkeleton()}
      </Box>
    );
  };
  
  // Main render function
  switch (currentPhase) {
    case 'layout':
      return renderLayout();
    case 'content':
      return renderContent();
    case 'data':
      return (
        <Box sx={{ position: 'relative' }}>
          {renderSkeleton()}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Loading data...
            </Typography>
          </Box>
        </Box>
      );
    default:
      return renderSkeleton();
  }
};

// Chart skeleton component
const ChartSkeleton = ({ props }) => {
  const title = props?.title || 'Chart';
  const height = props?.height || 300;
  
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'end', gap: 1 }}>
          {[...Array(8)].map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width={40}
              height={Math.random() * 150 + 50}
              sx={{ bgcolor: 'grey.200' }}
            />
          ))}
        </Box>
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton variant="text" width={80} />
          <Skeleton variant="text" width={80} />
        </Box>
      </Box>
    </Paper>
  );
};

// Grid skeleton component
const GridSkeleton = ({ props }) => {
  const title = props?.title || 'Data Grid';
  const columns = props?.columns || ['Column 1', 'Column 2', 'Column 3'];
  const rows = props?.rows || 5;
  
  return (
    <Paper elevation={1}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((col, index) => (
                <TableCell key={index}>
                  <Skeleton variant="text" width={100} />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {[...Array(rows)].map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <Skeleton variant="text" width={Math.random() * 100 + 50} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

// Summary skeleton component
const SummarySkeleton = ({ props }) => {
  const title = props?.title || 'Summary';
  
  return (
    <Card elevation={1}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Skeleton variant="text" width={120} height={60} />
        <Skeleton variant="text" width={80} />
      </CardContent>
    </Card>
  );
};

// Timeline skeleton component
const TimelineSkeleton = ({ props }) => {
  const title = props?.title || 'Timeline';
  const items = props?.items || 4;
  
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Stack spacing={2}>
        {[...Array(items)].map((_, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Skeleton variant="circular" width={24} height={24} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={200} />
              <Skeleton variant="text" width={120} />
            </Box>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};

// Form skeleton component
const FormSkeleton = ({ props }) => {
  const title = props?.title || 'Form';
  const fields = props?.fields || 4;
  
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Stack spacing={2}>
        {[...Array(fields)].map((_, index) => (
          <Box key={index}>
            <Skeleton variant="text" width={100} height={20} />
            <Skeleton variant="rectangular" width="100%" height={40} />
          </Box>
        ))}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Skeleton variant="rectangular" width={80} height={36} />
          <Skeleton variant="rectangular" width={80} height={36} />
        </Box>
      </Stack>
    </Paper>
  );
};

// Container skeleton component
const ContainerSkeleton = ({ props }) => {
  const direction = props?.direction || 'column';
  const children = props?.children || 2;
  
  return (
    <Stack
      direction={direction}
      spacing={2}
      sx={{ p: 1, border: '1px dashed', borderColor: 'grey.300' }}
    >
      {[...Array(children)].map((_, index) => (
        <Skeleton
          key={index}
          variant="rectangular"
          width="100%"
          height={direction === 'row' ? 100 : 60}
        />
      ))}
    </Stack>
  );
};

// Text skeleton component
const TextSkeleton = ({ props }) => {
  const variant = props?.variant || 'body1';
  const lines = props?.lines || 1;
  
  return (
    <Box>
      {[...Array(lines)].map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={`${Math.random() * 40 + 60}%`}
          height={variant === 'h1' ? 60 : variant === 'h2' ? 50 : 24}
        />
      ))}
    </Box>
  );
};

// Default skeleton component
const DefaultSkeleton = ({ props }) => {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Skeleton variant="text" width={200} height={30} />
      <Skeleton variant="rectangular" width="100%" height={100} sx={{ mt: 1 }} />
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Skeleton variant="rectangular" width={80} height={30} />
        <Skeleton variant="rectangular" width={80} height={30} />
      </Stack>
    </Paper>
  );
};

export default ProgressiveContainer;