/**
 * ClinicalTabs Component
 * Clean horizontal tab navigation with underlined indicators
 * Professional medical UI design matching older system
 */
import React from 'react';
import {
  Tabs,
  Tab,
  Box,
  Badge,
  Typography,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  Dashboard as SummaryIcon,
  Assignment as ChartReviewIcon,
  Event as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as OrdersIcon,
  Medication as PharmacyIcon,
  CameraAlt as ImagingIcon,
  Description as DocumentationIcon,
  AccountTree as CarePlanIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';

// Navigation items configuration
const NAVIGATION_ITEMS = [
  {
    id: 'summary',
    label: 'Summary',
    icon: SummaryIcon,
    badge: null
  },
  {
    id: 'chart-review',
    label: 'Chart Review',
    icon: ChartReviewIcon,
    badge: null
  },
  {
    id: 'encounters',
    label: 'Encounters',
    icon: EncountersIcon,
    badge: null
  },
  {
    id: 'results',
    label: 'Results',
    icon: ResultsIcon,
    badge: 'new'
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: OrdersIcon,
    badge: 3
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: PharmacyIcon,
    badge: null
  },
  {
    id: 'imaging',
    label: 'Imaging',
    icon: ImagingIcon,
    badge: 2
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: DocumentationIcon,
    badge: null
  },
  {
    id: 'care-plan',
    label: 'Care Plan',
    icon: CarePlanIcon,
    badge: null
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: TimelineIcon,
    badge: null
  }
];

const ClinicalTabs = ({
  activeTab,
  onTabChange,
  orientation = 'horizontal',
  variant = 'scrollable',
  showIcons = true,
  dense = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const { notifications } = useClinicalWorkflow();

  // Get notification counts for badges
  const getNotificationCount = (moduleId) => {
    return notifications.filter(n => n.module === moduleId && !n.read).length;
  };

  // Update navigation items with dynamic badges
  const navItemsWithBadges = NAVIGATION_ITEMS.map(item => ({
    ...item,
    badge: getNotificationCount(item.id) || item.badge
  }));

  // Find active tab index
  const activeIndex = navItemsWithBadges.findIndex(item => item.id === activeTab);

  const handleChange = (event, newValue) => {
    const selectedItem = navItemsWithBadges[newValue];
    if (selectedItem) {
      onTabChange(selectedItem.id);
    }
  };

  // Custom tab label with badge
  const TabLabel = ({ item }) => {
    const hasBadge = item.badge !== null && item.badge !== 0;
    
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.5,
        position: 'relative'
      }}>
        {showIcons && !isSmall && (
          <item.icon sx={{ fontSize: dense ? 18 : 20 }} />
        )}
        <Typography 
          variant={dense ? "caption" : "body2"} 
          sx={{ 
            fontWeight: activeTab === item.id ? 600 : 400,
            textTransform: 'none'
          }}
        >
          {item.label}
        </Typography>
        {hasBadge && (
          <Badge
            badgeContent={
              typeof item.badge === 'number' ? item.badge :
              item.badge === 'new' ? '•' : 0
            }
            color={item.badge === 'new' ? 'primary' : 'error'}
            variant={item.badge === 'new' ? 'dot' : 'standard'}
            sx={{
              position: 'absolute',
              top: -8,
              right: -16,
              '& .MuiBadge-badge': {
                fontSize: '0.625rem',
                height: 16,
                minWidth: 16,
                padding: '0 4px'
              }
            }}
          />
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        position: 'sticky',
        top: 56, // Height of app bar
        zIndex: theme.zIndex.appBar - 1
      }}
    >
      <Tabs
        value={activeIndex}
        onChange={handleChange}
        orientation={orientation}
        variant={isMobile ? 'scrollable' : variant}
        scrollButtons={isMobile ? 'auto' : false}
        indicatorColor="primary"
        textColor="primary"
        aria-label="Clinical navigation tabs"
        sx={{
          minHeight: dense ? 40 : 48,
          '& .MuiTabs-indicator': {
            backgroundColor: '#2979FF',
            height: 3,
            borderRadius: '3px 3px 0 0'
          },
          '& .MuiTabs-scrollButtons': {
            color: '#6B7280',
            '&.Mui-disabled': {
              opacity: 0.3
            }
          }
        }}
      >
        {navItemsWithBadges.map((item, index) => (
          <Tab
            key={item.id}
            label={<TabLabel item={item} />}
            sx={{
              textTransform: 'none',
              minHeight: dense ? 40 : 48,
              paddingX: isSmall ? 1.5 : 2,
              paddingY: 1,
              color: '#6B7280',
              fontWeight: 400,
              fontSize: dense ? '0.75rem' : '0.875rem',
              minWidth: isSmall ? 'auto' : 120,
              '&.Mui-selected': {
                color: '#2979FF',
                fontWeight: 600
              },
              '&:hover': {
                backgroundColor: alpha('#2979FF', 0.04),
                color: '#2979FF'
              },
              // Professional medical UI - clean transitions
              transition: 'all 0.2s ease-in-out'
            }}
          />
        ))}
      </Tabs>
    </Box>
  );
};

export default ClinicalTabs;