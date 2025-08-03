/**
 * Enhanced Loading States for Clinical Workspace
 * Provides smooth loading transitions, skeleton effects, and improved UX
 */
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Fade,
  LinearProgress,
  Typography,
  useTheme,
  alpha
} from '@mui/material';
import { getSkeletonEffect, getSmoothTransition } from '../../../../../themes/clinicalThemeUtils';

/**
 * Enhanced Card Skeleton with shimmer effect
 */
export const CardSkeleton = ({ 
  lines = 3, 
  showAvatar = false, 
  showChips = false,
  height = 'auto',
  animate = true,
  isAlternate = false 
}) => {
  const theme = useTheme();
  
  return (
    <Card 
      sx={{
        borderRadius: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: alpha(theme.palette.grey[400], 0.3),
        backgroundColor: isAlternate ? alpha(theme.palette.action.hover, 0.02) : theme.palette.background.paper,
        height,
        overflow: 'hidden',
        position: 'relative',
        ...getSmoothTransition(['opacity', 'transform']),
        ...(animate && {
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            animation: 'shimmer 1.5s infinite',
            zIndex: 1
          }
        })
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1}>
          {/* Header row with avatar/icon and title */}
          <Stack direction="row" alignItems="center" spacing={1}>
            {showAvatar && (
              <Skeleton 
                variant="circular" 
                width={24} 
                height={24}
                sx={{ 
                  bgcolor: alpha(theme.palette.grey[300], 0.3),
                  ...getSmoothTransition(['opacity'])
                }}
              />
            )}
            <Skeleton 
              variant="text" 
              width="60%" 
              height={24}
              sx={{ 
                bgcolor: alpha(theme.palette.grey[300], 0.4),
                ...getSmoothTransition(['opacity'])
              }}
            />
            {showChips && (
              <Skeleton 
                variant="rounded" 
                width={60} 
                height={20}
                sx={{ 
                  bgcolor: alpha(theme.palette.grey[300], 0.2),
                  borderRadius: 0,
                  ...getSmoothTransition(['opacity'])
                }}
              />
            )}
          </Stack>
          
          {/* Content lines */}
          {Array.from({ length: lines }).map((_, index) => (
            <Skeleton 
              key={index}
              variant="text" 
              width={index === lines - 1 ? '40%' : '90%'} 
              height={16}
              sx={{ 
                bgcolor: alpha(theme.palette.grey[300], 0.2),
                ...getSmoothTransition(['opacity'])
              }}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

/**
 * Enhanced Grid Skeleton for multiple cards
 */
export const GridSkeleton = ({ 
  count = 6, 
  columns = 2, 
  cardProps = {} 
}) => {
  return (
    <Box 
      display="grid" 
      gridTemplateColumns={`repeat(${columns}, 1fr)`} 
      gap={2}
      sx={getSmoothTransition(['opacity'])}
    >
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton 
          key={index} 
          isAlternate={index % 2 === 1}
          {...cardProps}
        />
      ))}
    </Box>
  );
};

/**
 * Enhanced Linear Progress with smooth transitions
 */
export const SmoothProgress = ({ 
  value, 
  color = 'primary', 
  height = 4,
  showValue = false,
  label
}) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ width: '100%' }}>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          {label}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinearProgress
          variant={value !== undefined ? "determinate" : "indeterminate"}
          value={value}
          color={color}
          sx={{
            flexGrow: 1,
            height,
            borderRadius: height / 2,
            backgroundColor: alpha(theme.palette[color].main, 0.1),
            '& .MuiLinearProgress-bar': {
              borderRadius: height / 2,
              ...getSmoothTransition(['transform', 'background-color'])
            }
          }}
        />
        {showValue && value !== undefined && (
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 35 }}>
            {`${Math.round(value)}%`}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

/**
 * Fade-in container for smooth content transitions
 */
export const FadeInContainer = ({ 
  children, 
  delay = 0, 
  duration = 300,
  direction = 'up' 
}) => {
  const getTransform = () => {
    switch (direction) {
      case 'up': return 'translateY(20px)';
      case 'down': return 'translateY(-20px)';
      case 'left': return 'translateX(20px)';
      case 'right': return 'translateX(-20px)';
      default: return 'translateY(20px)';
    }
  };

  return (
    <Fade 
      in={true} 
      timeout={duration}
      style={{ 
        transitionDelay: `${delay}ms`,
        transform: getTransform()
      }}
    >
      <Box
        sx={{
          ...getSmoothTransition(['opacity', 'transform'], 'normal'),
          '&.Mui-enter': {
            opacity: 0,
            transform: getTransform()
          },
          '&.Mui-enter-active': {
            opacity: 1,
            transform: 'translate(0)'
          }
        }}
      >
        {children}
      </Box>
    </Fade>
  );
};

/**
 * Loading overlay with backdrop blur
 */
export const LoadingOverlay = ({ 
  loading, 
  children, 
  message = "Loading...",
  blur = true 
}) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {children}
      <Fade in={loading} timeout={200}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            ...(blur && {
              backdropFilter: 'blur(4px)'
            }),
            zIndex: 10,
            ...getSmoothTransition(['opacity', 'backdrop-filter'])
          }}
        >
          <Stack alignItems="center" spacing={2}>
            <SmoothProgress color="primary" />
            <Typography variant="body2" color="text.secondary">
              {message}
            </Typography>
          </Stack>
        </Box>
      </Fade>
    </Box>
  );
};

/**
 * Staggered fade-in for lists
 */
export const StaggeredFadeIn = ({ 
  children, 
  staggerDelay = 100,
  initialDelay = 0 
}) => {
  return (
    <>
      {React.Children.map(children, (child, index) => (
        <FadeInContainer 
          key={index} 
          delay={initialDelay + (index * staggerDelay)}
        >
          {child}
        </FadeInContainer>
      ))}
    </>
  );
};

// CSS keyframes for shimmer effect
const shimmerStyles = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = shimmerStyles;
  document.head.appendChild(styleSheet);
}

export default {
  CardSkeleton,
  GridSkeleton,
  SmoothProgress,
  FadeInContainer,
  LoadingOverlay,
  StaggeredFadeIn
};