/**
 * SafeBadge Component
 * A wrapper around MUI Badge that handles theme color access errors gracefully
 */
import React from 'react';
import { Badge as MuiBadge, useTheme } from '@mui/material';

const SafeBadge = ({ color = 'default', children, ...props }) => {
  const theme = useTheme();
  
  // Validate that the color exists in the theme before passing it
  const validColors = ['default', 'primary', 'secondary', 'error', 'info', 'success', 'warning'];
  const safeColor = validColors.includes(color) ? color : 'default';
  
  // Additional check to ensure theme palette is loaded
  const isThemeReady = theme && theme.palette && theme.palette.primary;
  
  if (!isThemeReady) {
    // Return children without badge if theme isn't ready
    return <>{children}</>;
  }
  
  try {
    return (
      <MuiBadge color={safeColor} {...props}>
        {children}
      </MuiBadge>
    );
  } catch (error) {
    console.warn('Badge rendering error:', error);
    // Fallback to rendering children without badge
    return <>{children}</>;
  }
};

export default SafeBadge;