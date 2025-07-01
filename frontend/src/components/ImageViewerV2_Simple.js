import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Paper,
  Toolbar,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Brightness6 as BrightnessIcon,
  RestartAlt as ResetIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  PanTool as PanIcon,
  TouchApp as WindowLevelIcon
} from '@mui/icons-material';
import api from '../services/api';

import cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';

// Initialize Cornerstone
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// Configure image loader
cornerstoneWADOImageLoader.configure({
  beforeSend: function(xhr) {
    const token = localStorage.getItem('token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
  }
});


const ImageViewerV2Simple = ({ studyId, seriesId, onClose }) => {
  // Remove console log to reduce noise
  // console.log('ImageViewerV2Simple: Mounting with props:', { studyId, seriesId });
  
  const viewerRef = useRef(null);
  const activeToolRef = useRef('Wwwc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageIds, setImageIds] = useState([]);
  const [windowWidth, setWindowWidth] = useState(400);
  const [windowCenter, setWindowCenter] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState('Wwwc'); // Default to window/level tool
  
  // Update ref when activeTool changes
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // Fetch image data
  useEffect(() => {
    fetchImageData();
  }, [studyId, seriesId]);

  // Initialize viewer when element is ready
  useEffect(() => {
    if (!loading && imageIds.length > 0 && viewerRef.current) {
      initializeViewer();
    }
  }, [loading, imageIds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const element = viewerRef.current;
      if (element) {
        try {
          // Remove custom mouse handlers
          if (element._mouseHandlers) {
            Object.entries(element._mouseHandlers).forEach(([event, handler]) => {
              element.removeEventListener(event, handler);
            });
          }
          
          // Remove event listeners
          element.removeEventListener('cornerstoneimagerendered', onImageRendered);
          element.removeEventListener('cornerstonenewimage', onNewImage);
          
          // Disable cornerstone
          cornerstone.disable(element);
        } catch (err) {
          console.warn('Error during cleanup:', err);
        }
      }
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!viewerRef.current) return;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          handleImageNavigation(-1);
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          handleImageNavigation(1);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleReset();
          break;
        default:
          break;
      }
    };

    if (!loading) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [loading, currentImageIndex, imageIds.length]);

  const fetchImageData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch series data
      const seriesResponse = await api.get(`/api/imaging/wado/studies/${studyId}/series`);
      const seriesResult = seriesResponse.data;
      
      if (!seriesResult.success || !seriesResult.data || seriesResult.data.length === 0) {
        throw new Error('No series found');
      }

      // Get first series or matching series
      let targetSeries = seriesResult.data[0];
      if (seriesId) {
        const found = seriesResult.data.find(s => s.series_instance_uid === seriesId);
        if (found) targetSeries = found;
      }

      if (!targetSeries.instances || targetSeries.instances.length === 0) {
        throw new Error('No images found');
      }

      // Create image IDs
      const baseUrl = window.location.origin;
      const imageIdArray = targetSeries.instances.map(inst => 
        `wadouri:${baseUrl}/api/imaging/wado/instances/${inst.id}`
      );
      
      setImageIds(imageIdArray);
      setLoading(false);
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const initializeViewer = async () => {
    try {
      const element = viewerRef.current;
      cornerstone.enable(element);
      
      // Setup mouse tools
      setupMouseTools(element);
      
      // Load first image
      if (imageIds.length > 0) {
        await loadAndDisplayImage(imageIds[0]);
      }
    } catch (err) {
      console.error('Error initializing viewer:', err);
      setError('Failed to initialize viewer');
    }
  };

  const setupMouseTools = (element) => {
    try {
      // Skip cornerstone-tools to avoid errors - implement custom mouse handling
      // Track mouse state
      let mouseDown = false;
      let lastX = 0;
      let lastY = 0;
      let startX = 0;
      let startY = 0;
      let mouseButton = 0;
      
      // Get reference to handleImageNavigation from parent scope
      const navigateImage = handleImageNavigation;
      
      // Mouse down handler
      const handleMouseDown = (e) => {
        if (!element) return;
        
        mouseDown = true;
        mouseButton = e.button;
        startX = lastX = e.pageX;
        startY = lastY = e.pageY;
        
        // Change cursor based on button
        if (mouseButton === 0) element.style.cursor = 'grabbing';
        else if (mouseButton === 2) element.style.cursor = 'zoom-in';
        
        e.preventDefault();
      };
      
      // Mouse move handler
      const handleMouseMove = (e) => {
        if (!mouseDown || !element) return;
        
        const deltaX = e.pageX - lastX;
        const deltaY = e.pageY - lastY;
        
        try {
          const viewport = cornerstone.getViewport(element);
          const currentTool = activeToolRef.current;
          
          if (mouseButton === 0 && currentTool === 'Wwwc') {
            // Window/Level adjustment
            viewport.voi.windowWidth = Math.max(1, viewport.voi.windowWidth + (deltaX * 2));
            viewport.voi.windowCenter = viewport.voi.windowCenter + (deltaY * 2);
            cornerstone.setViewport(element, viewport);
          } else if (mouseButton === 0 && currentTool === 'Pan') {
            // Pan
            viewport.translation.x += deltaX / viewport.scale;
            viewport.translation.y += deltaY / viewport.scale;
            cornerstone.setViewport(element, viewport);
          } else if (mouseButton === 2) {
            // Zoom
            const zoomSpeed = 0.01;
            const zoomDelta = deltaY * zoomSpeed;
            viewport.scale = Math.max(0.1, Math.min(5, viewport.scale - zoomDelta));
            cornerstone.setViewport(element, viewport);
          } else if (mouseButton === 1) {
            // Middle button - Pan
            viewport.translation.x += deltaX / viewport.scale;
            viewport.translation.y += deltaY / viewport.scale;
            cornerstone.setViewport(element, viewport);
          }
        } catch (err) {
          console.warn('Error handling mouse move:', err);
        }
        
        lastX = e.pageX;
        lastY = e.pageY;
        e.preventDefault();
      };
      
      // Mouse up handler
      const handleMouseUp = (e) => {
        mouseDown = false;
        const currentTool = activeToolRef.current;
        element.style.cursor = currentTool === 'Pan' ? 'grab' : currentTool === 'Wwwc' ? 'crosshair' : 'default';
        e.preventDefault();
      };
      
      // Prevent context menu on right click
      const handleContextMenu = (e) => {
        e.preventDefault();
        return false;
      };
      
      // Wheel handler for image navigation
      const handleWheel = (e) => {
        if (imageIds.length <= 1) return;
        
        e.preventDefault();
        const direction = e.deltaY > 0 ? 1 : -1;
        navigateImage(direction);
      };
      
      // Add mouse event listeners
      element.addEventListener('mousedown', handleMouseDown);
      element.addEventListener('mousemove', handleMouseMove);
      element.addEventListener('mouseup', handleMouseUp);
      element.addEventListener('mouseleave', handleMouseUp);
      element.addEventListener('contextmenu', handleContextMenu);
      // Add wheel event with passive: false to allow preventDefault
      element.addEventListener('wheel', handleWheel, { passive: false });
      
      // Store handlers for cleanup
      element._mouseHandlers = {
        mousedown: handleMouseDown,
        mousemove: handleMouseMove,
        mouseup: handleMouseUp,
        mouseleave: handleMouseUp,
        contextmenu: handleContextMenu,
        wheel: handleWheel
      };
      
      // Add viewport update listeners
      element.addEventListener('cornerstoneimagerendered', onImageRendered);
      element.addEventListener('cornerstonenewimage', onNewImage);

    } catch (error) {
      console.warn('Error setting up mouse tools:', error);
    }
  };

  const onImageRendered = (e) => {
    const viewport = cornerstone.getViewport(e.target);
    if (viewport) {
      setWindowWidth(Math.round(viewport.voi.windowWidth));
      setWindowCenter(Math.round(viewport.voi.windowCenter));
      setZoom(parseFloat(viewport.scale.toFixed(2)));
    }
  };

  const onNewImage = (e) => {
    const viewport = cornerstone.getViewport(e.target);
    if (viewport) {
      setWindowWidth(Math.round(viewport.voi.windowWidth));
      setWindowCenter(Math.round(viewport.voi.windowCenter));
      setZoom(parseFloat(viewport.scale.toFixed(2)));
    }
  };

  const loadAndDisplayImage = async (imageId) => {
    try {
      const element = viewerRef.current;
      if (!element) return;

      const image = await cornerstone.loadImage(imageId);
      cornerstone.displayImage(element, image);
      
      const viewport = cornerstone.getDefaultViewportForImage(element, image);
      cornerstone.setViewport(element, viewport);
      cornerstone.resize(element);
      
      setWindowWidth(viewport.voi.windowWidth);
      setWindowCenter(viewport.voi.windowCenter);
      setZoom(viewport.scale);
    } catch (err) {
      console.error('Error loading image:', err);
    }
  };

  const handleWindowingChange = (width, center) => {
    const element = viewerRef.current;
    if (!element) return;

    const viewport = cornerstone.getViewport(element);
    viewport.voi.windowWidth = width;
    viewport.voi.windowCenter = center;
    cornerstone.setViewport(element, viewport);
    
    setWindowWidth(width);
    setWindowCenter(center);
  };

  const handleZoomChange = (newZoom) => {
    const element = viewerRef.current;
    if (!element) return;

    const viewport = cornerstone.getViewport(element);
    viewport.scale = newZoom;
    cornerstone.setViewport(element, viewport);
    
    setZoom(newZoom);
  };

  const handleReset = () => {
    const element = viewerRef.current;
    if (!element) return;

    cornerstone.reset(element);
    const viewport = cornerstone.getViewport(element);
    setWindowWidth(viewport.voi.windowWidth);
    setWindowCenter(viewport.voi.windowCenter);
    setZoom(viewport.scale);
  };

  const handleImageNavigation = (direction) => {
    const newIndex = currentImageIndex + direction;
    if (newIndex >= 0 && newIndex < imageIds.length) {
      setCurrentImageIndex(newIndex);
      loadAndDisplayImage(imageIds[newIndex]);
    }
  };

  // Handle scroll wheel navigation when multiple images
  const handleMouseWheel = (e) => {
    if (imageIds.length <= 1) return;
    
    const direction = e.deltaY > 0 ? 1 : -1;
    handleImageNavigation(direction);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={600}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper elevation={3} sx={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Toolbar sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Mouse Tool Selection */}
          <IconButton 
            onClick={() => setActiveTool('Wwwc')}
            color={activeTool === 'Wwwc' ? 'primary' : 'default'}
            title="Window/Level (Left Click + Drag)"
          >
            <WindowLevelIcon />
          </IconButton>
          <IconButton 
            onClick={() => setActiveTool('Pan')}
            color={activeTool === 'Pan' ? 'primary' : 'default'}
            title="Pan (Middle Click + Drag)"
          >
            <PanIcon />
          </IconButton>
          
          {/* Manual Controls */}
          <IconButton onClick={() => handleZoomChange(zoom * 1.2)} title="Zoom In">
            <ZoomInIcon />
          </IconButton>
          <IconButton onClick={() => handleZoomChange(zoom * 0.8)} title="Zoom Out">
            <ZoomOutIcon />
          </IconButton>
          <IconButton onClick={handleReset} title="Reset View">
            <ResetIcon />
          </IconButton>
          
          {imageIds.length > 1 && (
            <>
              <IconButton 
                onClick={() => handleImageNavigation(-1)}
                disabled={currentImageIndex === 0}
              >
                <PrevIcon />
              </IconButton>
              <Typography>{currentImageIndex + 1} / {imageIds.length}</Typography>
              <IconButton 
                onClick={() => handleImageNavigation(1)}
                disabled={currentImageIndex === imageIds.length - 1}
              >
                <NextIcon />
              </IconButton>
            </>
          )}
        </Stack>
      </Toolbar>

      {/* Viewer */}
      <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: 'black' }}>
        <div 
          ref={viewerRef}
          tabIndex={0}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            outline: 'none',
            cursor: activeTool === 'Pan' ? 'grab' : activeTool === 'Wwwc' ? 'crosshair' : 'default'
          }}
        />
        
        {/* Instructions overlay */}
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 10, 
            left: 10, 
            color: 'white', 
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: 1,
            borderRadius: 1,
            fontSize: '0.75rem',
            pointerEvents: 'none'
          }}
        >
          <div>Left Click: Window/Level</div>
          <div>Middle Click: Pan</div>
          <div>Right Click: Zoom</div>
          {imageIds.length > 1 && (
            <div>Mouse Wheel: Navigate Images</div>
          )}
          <div>Arrow Keys: Navigate</div>
          <div>R: Reset View</div>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={4}>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="caption">Window Width</Typography>
            <Slider
              value={windowWidth}
              onChange={(e, value) => handleWindowingChange(value, windowCenter)}
              min={1}
              max={4000}
              valueLabelDisplay="auto"
            />
          </Box>
          
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="caption">Window Center</Typography>
            <Slider
              value={windowCenter}
              onChange={(e, value) => handleWindowingChange(windowWidth, value)}
              min={-1000}
              max={3000}
              valueLabelDisplay="auto"
            />
          </Box>
          
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="caption">Zoom</Typography>
            <Slider
              value={zoom}
              onChange={(e, value) => handleZoomChange(value)}
              min={0.1}
              max={5}
              step={0.1}
              valueLabelDisplay="auto"
            />
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
};

export default ImageViewerV2Simple;