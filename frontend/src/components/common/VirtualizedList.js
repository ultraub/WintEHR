/**
 * VirtualizedList Component
 * High-performance virtual scrolling for large lists
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box } from '@mui/material';

const VirtualizedList = ({
  items = [],
  renderItem,
  itemHeight = 120,
  containerHeight = 600,
  overscan = 5,
  onScroll,
  ...props
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef(null);

  const totalHeight = items.length * itemHeight;
  
  // Calculate which items should be visible
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index,
      key: item.id || startIndex + index,
    }));
  }, [items, visibleRange]);

  const handleScroll = (e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(e);
  };

  const offsetY = visibleRange.startIndex * itemHeight;

  return (
    <Box
      ref={scrollElementRef}
      onScroll={handleScroll}
      sx={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
        ...props.sx
      }}
      {...props}
    >
      {/* Virtual container to maintain scroll height */}
      <Box sx={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items container */}
        <Box
          sx={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map(({ item, index, key }) =>
            renderItem(item, index, key)
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(VirtualizedList);