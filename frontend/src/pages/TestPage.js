import React from 'react';
import { Typography, Box } from '@mui/material';

const TestPage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Test Page</Typography>
      <Typography>This is a simple test page to verify routing works.</Typography>
    </Box>
  );
};

export default TestPage;