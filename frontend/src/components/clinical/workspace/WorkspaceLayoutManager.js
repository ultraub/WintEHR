/**
 * WorkspaceLayoutManager Component
 * Provides flexible, resizable panel layout for clinical workflows
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ViewColumn as ViewColumnIcon,
  ViewStream as ViewStreamIcon,
  ViewSidebar as ViewSidebarIcon
} from '@mui/icons-material';

// Layout configurations
const LAYOUT_CONFIGS = {
  'single': {
    name: 'Single Panel',
    icon: <FullscreenIcon />,
    panels: ['main']
  },
  'split-vertical': {
    name: 'Split Vertical',
    icon: <ViewColumnIcon />,
    panels: ['left', 'right']
  },
  'split-horizontal': {
    name: 'Split Horizontal',
    icon: <ViewStreamIcon />,
    panels: ['top', 'bottom']
  },
  'sidebar': {
    name: 'Sidebar Layout',
    icon: <ViewSidebarIcon />,
    panels: ['sidebar', 'main']
  },
  'three-column': {
    name: 'Three Column',
    icon: <ViewColumnIcon />,
    panels: ['left', 'center', 'right']
  }
};

// Default panel sizes
const DEFAULT_SIZES = {
  'single': { main: 100 },
  'split-vertical': { left: 50, right: 50 },
  'split-horizontal': { top: 50, bottom: 50 },
  'sidebar': { sidebar: 30, main: 70 },
  'three-column': { left: 25, center: 50, right: 25 }
};

// Minimum panel sizes (percentage)
const MIN_PANEL_SIZE = 20;

const ResizablePanel = ({ 
  children, 
  panelId, 
  size, 
  onResize, 
  orientation = 'vertical',
  isLast = false,
  minSize = MIN_PANEL_SIZE
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(0);
  const [startSize, setStartSize] = useState(size);
  const panelRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPos(orientation === 'vertical' ? e.clientX : e.clientY);
    setStartSize(size);
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !panelRef.current) return;

      const containerSize = orientation === 'vertical' 
        ? panelRef.current.parentElement.offsetWidth
        : panelRef.current.parentElement.offsetHeight;
      
      const currentPos = orientation === 'vertical' ? e.clientX : e.clientY;
      const diff = currentPos - startPos;
      const percentDiff = (diff / containerSize) * 100;
      
      const newSize = Math.max(minSize, Math.min(100 - minSize, startSize + percentDiff));
      onResize(panelId, newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, startPos, startSize, orientation, panelId, onResize, minSize]);

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'relative',
        width: orientation === 'vertical' ? `${size}%` : '100%',
        height: orientation === 'horizontal' ? `${size}%` : '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {children}
      </Box>
      
      {!isLast && (
        <Box
          onMouseDown={handleMouseDown}
          sx={{
            position: 'absolute',
            [orientation === 'vertical' ? 'right' : 'bottom']: -6,
            [orientation === 'vertical' ? 'top' : 'left']: 0,
            [orientation === 'vertical' ? 'bottom' : 'right']: 0,
            [orientation === 'vertical' ? 'width' : 'height']: 12,
            cursor: orientation === 'vertical' ? 'col-resize' : 'row-resize',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&:hover': {
              backgroundColor: 'action.hover'
            },
            userSelect: 'none'
          }}
        >
          <DragIcon 
            sx={{ 
              color: 'text.secondary',
              transform: orientation === 'vertical' ? 'rotate(90deg)' : 'none'
            }} 
          />
        </Box>
      )}
    </Box>
  );
};

const WorkspaceLayoutManager = ({ 
  layout = 'split-vertical',
  onLayoutChange,
  children,
  persistKey = 'workspace-layout'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [currentLayout, setCurrentLayout] = useState(layout);
  const [panelSizes, setPanelSizes] = useState(DEFAULT_SIZES[layout]);
  const [fullscreenPanel, setFullscreenPanel] = useState(null);

  // Load saved layout preferences
  useEffect(() => {
    const savedLayout = localStorage.getItem(`${persistKey}-config`);
    const savedSizes = localStorage.getItem(`${persistKey}-sizes`);
    
    if (savedLayout && LAYOUT_CONFIGS[savedLayout]) {
      setCurrentLayout(savedLayout);
    }
    
    if (savedSizes) {
      try {
        setPanelSizes(JSON.parse(savedSizes));
      } catch (e) {
        console.error('Failed to load saved panel sizes:', e);
      }
    }
  }, [persistKey]);

  // Save layout preferences
  useEffect(() => {
    localStorage.setItem(`${persistKey}-config`, currentLayout);
    localStorage.setItem(`${persistKey}-sizes`, JSON.stringify(panelSizes));
  }, [currentLayout, panelSizes, persistKey]);

  // Handle layout change
  const handleLayoutChange = useCallback((newLayout) => {
    setCurrentLayout(newLayout);
    setPanelSizes(DEFAULT_SIZES[newLayout]);
    setFullscreenPanel(null);
    if (onLayoutChange) {
      onLayoutChange(newLayout);
    }
  }, [onLayoutChange]);

  // Handle panel resize
  const handlePanelResize = useCallback((panelId, newSize) => {
    setPanelSizes(prev => {
      const panels = LAYOUT_CONFIGS[currentLayout].panels;
      const otherPanels = panels.filter(p => p !== panelId);
      
      if (otherPanels.length === 1) {
        // Two panel layout - adjust the other panel
        return {
          [panelId]: newSize,
          [otherPanels[0]]: 100 - newSize
        };
      } else {
        // More complex layout - proportionally adjust other panels
        const totalOtherSize = 100 - newSize;
        const adjustment = totalOtherSize / otherPanels.length;
        const newSizes = { [panelId]: newSize };
        otherPanels.forEach(panel => {
          newSizes[panel] = adjustment;
        });
        return newSizes;
      }
    });
  }, [currentLayout]);

  // Toggle fullscreen for a panel
  const toggleFullscreen = useCallback((panelId) => {
    setFullscreenPanel(prev => prev === panelId ? null : panelId);
  }, []);

  // Force single panel layout on mobile
  const effectiveLayout = isMobile ? 'single' : currentLayout;
  const config = LAYOUT_CONFIGS[effectiveLayout];

  // Render panels based on layout
  const renderPanels = () => {
    const panels = config.panels;
    const childArray = React.Children.toArray(children);

    // If fullscreen is active, only show that panel
    if (fullscreenPanel) {
      const panelIndex = panels.indexOf(fullscreenPanel);
      return (
        <Paper 
          elevation={0} 
          sx={{ 
            width: '100%', 
            height: '100%', 
            p: 2,
            position: 'relative'
          }}
        >
          <IconButton
            size="small"
            onClick={() => toggleFullscreen(fullscreenPanel)}
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
          >
            <FullscreenExitIcon />
          </IconButton>
          {childArray[panelIndex] || childArray[0]}
        </Paper>
      );
    }

    const orientation = effectiveLayout === 'split-horizontal' ? 'horizontal' : 'vertical';

    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: orientation === 'vertical' ? 'row' : 'column',
          gap: 0
        }}
      >
        {panels.map((panelId, index) => (
          <ResizablePanel
            key={panelId}
            panelId={panelId}
            size={panelSizes[panelId] || DEFAULT_SIZES[effectiveLayout][panelId]}
            onResize={handlePanelResize}
            orientation={orientation}
            isLast={index === panels.length - 1}
          >
            <Paper 
              elevation={0} 
              sx={{ 
                width: '100%', 
                height: '100%', 
                p: 2,
                overflow: 'auto',
                position: 'relative'
              }}
            >
              {panels.length > 1 && (
                <IconButton
                  size="small"
                  onClick={() => toggleFullscreen(panelId)}
                  sx={{ 
                    position: 'absolute', 
                    top: 8, 
                    right: 8, 
                    zIndex: 10,
                    opacity: 0.6,
                    '&:hover': { opacity: 1 }
                  }}
                >
                  <Tooltip title="Fullscreen">
                    <FullscreenIcon fontSize="small" />
                  </Tooltip>
                </IconButton>
              )}
              {childArray[index] || childArray[0]}
            </Paper>
          </ResizablePanel>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Layout Controls */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end',
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper'
        }}
      >
        {!isMobile && Object.entries(LAYOUT_CONFIGS).map(([key, config]) => (
          <Tooltip key={key} title={config.name}>
            <IconButton
              size="small"
              onClick={() => handleLayoutChange(key)}
              color={currentLayout === key ? 'primary' : 'default'}
              sx={{ mx: 0.5 }}
            >
              {config.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Box>

      {/* Panel Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {renderPanels()}
      </Box>
    </Box>
  );
};

export default WorkspaceLayoutManager;