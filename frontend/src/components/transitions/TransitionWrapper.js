/**
 * TransitionWrapper Component
 * Wraps page content with transition animations
 * 
 * @since 2025-01-21
 */
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Fade } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const TransitionWrapper = ({ children, transition = 'fade', duration = 300 }) => {
  const location = useLocation();
  const theme = useTheme();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(false);
    const timer = setTimeout(() => {
      setShow(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Apply transition based on type
  if (transition === 'fade') {
    return (
      <Fade in={show} timeout={duration}>
        <Box sx={{ width: '100%', height: '100%' }}>
          {children}
        </Box>
      </Fade>
    );
  }

  // Default to no transition
  return children;
};

export default TransitionWrapper;