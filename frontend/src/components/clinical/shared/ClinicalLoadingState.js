/**
 * ClinicalLoadingState Component
 * Consistent skeleton loaders for clinical components
 * Prevents layout shift and provides visual feedback during data loading
 */
import React from 'react';
import {
  Box,
  Skeleton,
  Stack,
  Card,
  CardContent,
  Fade,
  useTheme,
  alpha
} from '@mui/material';
import { getSmoothTransition } from '../../../themes/clinicalThemeUtils';

/**
 * Resource card skeleton loader
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards to show
 * @param {boolean} props.showIcon - Show icon skeleton
 */
const ResourceCardSkeleton = ({ count = 1, showIcon = true }) => {
  const theme = useTheme();
  
  return (
    <Stack spacing={1}>
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={index}
          sx={{
            p: 2,
            // borderRadius inherited from theme (12px)
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300],
            backgroundColor: index % 2 === 1 
              ? theme.palette.mode === 'dark'
                ? alpha(theme.palette.action.hover, 0.08)
                : alpha(theme.palette.action.hover, 0.04) 
              : theme.palette.background.paper
          }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            {showIcon && (
              <Skeleton variant="circular" width={24} height={24} />
            )}
            <Box flex={1}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Skeleton variant="text" width={200} height={24} />
                <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: '4px' }} />
              </Stack>
              <Stack spacing={0.5}>
                <Skeleton variant="text" width="60%" height={16} />
                <Skeleton variant="text" width="40%" height={16} />
              </Stack>
            </Box>
            <Skeleton variant="circular" width={32} height={32} />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

/**
 * Summary card skeleton loader
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards to show
 */
const SummaryCardSkeleton = ({ count = 1 }) => {
  const theme = useTheme();
  
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          sx={{
            height: '100%',
            // borderRadius inherited from MuiCard theme override (12px)
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300]
          }}
        >
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box flex={1}>
                <Skeleton variant="text" width={80} height={16} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={60} height={48} />
                <Skeleton variant="rectangular" width={80} height={20} sx={{ mt: 1, borderRadius: '4px' }} />
              </Box>
              <Skeleton variant="circular" width={48} height={48} />
            </Stack>
          </CardContent>
        </Card>
      ))}
    </>
  );
};

/**
 * Data table skeleton loader
 * @param {Object} props
 * @param {number} props.rows - Number of rows
 * @param {number} props.columns - Number of columns
 * @param {boolean} props.showHeader - Show header row
 */
const TableSkeleton = ({ rows = 5, columns = 4, showHeader = true }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ width: '100%' }}>
      {showHeader && (
        <Stack 
          direction="row" 
          spacing={2} 
          sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            backgroundColor: 'background.paper'
          }}
        >
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton 
              key={index} 
              variant="text" 
              width={index === 0 ? 200 : 100} 
              height={20} 
            />
          ))}
        </Stack>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Stack 
          key={rowIndex}
          direction="row" 
          spacing={2} 
          sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            backgroundColor: rowIndex % 2 === 1 
              ? theme.palette.mode === 'dark'
                ? alpha(theme.palette.action.hover, 0.08)
                : alpha('#000', 0.02) 
              : theme.palette.background.paper
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              variant="text" 
              width={colIndex === 0 ? 200 : 100} 
              height={20} 
            />
          ))}
        </Stack>
      ))}
    </Box>
  );
};

/**
 * Filter panel skeleton loader
 */
const FilterPanelSkeleton = () => {
  return (
    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2}>
          <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
          <Skeleton variant="rounded" width={120} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
        </Stack>
        <Stack direction="row" spacing={1}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              width={100}
              height={32}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};

/**
 * Timeline skeleton loader
 * @param {Object} props
 * @param {number} props.events - Number of timeline events
 */
const TimelineSkeleton = ({ events = 5 }) => {
  return (
    <Stack spacing={2}>
      {Array.from({ length: events }).map((_, index) => (
        <Stack key={index} direction="row" spacing={2} alignItems="flex-start">
          <Stack alignItems="center">
            <Skeleton variant="circular" width={40} height={40} />
            {index < events - 1 && (
              <Skeleton variant="rectangular" width={2} height={60} sx={{ mt: 1 }} />
            )}
          </Stack>
          <Box flex={1}>
            <Skeleton variant="text" width={120} height={16} sx={{ mb: 1 }} />
            <Skeleton variant="rounded" width="100%" height={60} />
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

/**
 * Full page skeleton loader
 * Combines multiple skeleton components for complete page loading state
 */
const PageSkeleton = () => {
  return (
    <Stack spacing={3}>
      <FilterPanelSkeleton />
      <Box sx={{ px: 3 }}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={3}>
            <Box flex={1}><SummaryCardSkeleton /></Box>
            <Box flex={1}><SummaryCardSkeleton /></Box>
            <Box flex={1}><SummaryCardSkeleton /></Box>
            <Box flex={1}><SummaryCardSkeleton /></Box>
          </Stack>
          <ResourceCardSkeleton count={5} />
        </Stack>
      </Box>
    </Stack>
  );
};

/**
 * Shimmer card skeleton with configurable content lines
 * @param {Object} props
 * @param {number} props.lines - Number of content lines
 * @param {boolean} props.showAvatar - Show leading avatar skeleton
 * @param {boolean} props.showChips - Show a trailing chip skeleton
 * @param {number|string} props.height - Card height
 * @param {boolean} props.animate - Enable shimmer sweep
 * @param {boolean} props.isAlternate - Alternate-row background tint
 */
const CardSkeleton = ({
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
 * Grid of shimmer card skeletons
 * @param {Object} props
 * @param {number} props.count - Number of skeleton cards
 * @param {number} props.columns - Grid columns
 * @param {Object} props.cardProps - Props forwarded to each CardSkeleton
 */
const GridSkeleton = ({ count = 6, columns = 2, cardProps = {} }) => (
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

/**
 * Fade-in container for smooth content transitions
 */
const FadeInContainer = ({ children, delay = 0, duration = 300, direction = 'up' }) => {
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
 * Staggered fade-in for lists of children
 */
const StaggeredFadeIn = ({ children, staggerDelay = 100, initialDelay = 0 }) => (
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

// Inject shimmer keyframes once (used by CardSkeleton / GridSkeleton)
if (typeof document !== 'undefined' && !document.getElementById('clinical-loading-shimmer')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'clinical-loading-shimmer';
  styleSheet.textContent = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`;
  document.head.appendChild(styleSheet);
}

// Export all skeleton components
const ClinicalLoadingState = {
  ResourceCard: ResourceCardSkeleton,
  SummaryCard: SummaryCardSkeleton,
  Table: TableSkeleton,
  FilterPanel: FilterPanelSkeleton,
  Timeline: TimelineSkeleton,
  Page: PageSkeleton,
  Card: CardSkeleton,
  Grid: GridSkeleton,
  FadeIn: FadeInContainer,
  StaggeredFadeIn: StaggeredFadeIn
};

export default ClinicalLoadingState;