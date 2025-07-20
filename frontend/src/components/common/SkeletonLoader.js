/**
 * SkeletonLoader Component
 * Provides loading skeletons to prevent layout shifts
 */
import React from 'react';
import { Box, Card, CardContent, Skeleton, Stack } from '@mui/material';

// Order Card Skeleton
export const OrderCardSkeleton = () => (
  <Card sx={{ mb: 1 }}>
    <CardContent>
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton variant="text" width={200} height={24} />
          <Skeleton variant="circular" width={24} height={24} />
        </Box>
        <Skeleton variant="text" width={300} height={20} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

// Chart Review Item Skeleton  
export const ChartItemSkeleton = () => (
  <Box sx={{ mb: 2 }}>
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width={250} height={20} />
          <Skeleton variant="text" width={180} height={16} />
        </Box>
      </Box>
    </Stack>
  </Box>
);

// Results List Skeleton
export const ResultItemSkeleton = () => (
  <Card sx={{ mb: 1 }}>
    <CardContent>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton variant="text" width={180} height={20} />
          <Skeleton variant="text" width={100} height={20} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="100%" height={16} />
            <Skeleton variant="text" width="80%" height={16} />
          </Box>
          <Skeleton variant="rectangular" width={80} height={50} sx={{ borderRadius: 1 }} />
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

// Patient List Skeleton
export const PatientListSkeleton = ({ count = 10 }) => (
  <Box>
    {Array.from({ length: count }, (_, index) => (
      <Card key={index} sx={{ mb: 1 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Skeleton variant="circular" width={48} height={48} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={200} height={20} />
              <Skeleton variant="text" width={150} height={16} />
              <Skeleton variant="text" width={100} height={16} />
            </Box>
            <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} />
          </Box>
        </CardContent>
      </Card>
    ))}
  </Box>
);

// Generic List Skeleton
export const ListSkeleton = ({ 
  count = 5, 
  itemHeight = 80, 
  showAvatar = true, 
  showSecondary = true 
}) => (
  <Stack spacing={1}>
    {Array.from({ length: count }, (_, index) => (
      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
        {showAvatar && <Skeleton variant="circular" width={40} height={40} />}
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={20} />
          {showSecondary && <Skeleton variant="text" width="40%" height={16} />}
        </Box>
        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
      </Box>
    ))}
  </Stack>
);

// Tab Content Skeleton
export const TabContentSkeleton = () => (
  <Box sx={{ p: 3 }}>
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: 1 }} />
      </Box>
      
      {/* Filter Bar */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={100} height={40} sx={{ borderRadius: 1 }} />
      </Box>
      
      {/* Content List */}
      <ListSkeleton count={8} />
    </Stack>
  </Box>
);

export default {
  OrderCard: OrderCardSkeleton,
  ChartItem: ChartItemSkeleton,
  ResultItem: ResultItemSkeleton,
  PatientList: PatientListSkeleton,
  List: ListSkeleton,
  TabContent: TabContentSkeleton,
};