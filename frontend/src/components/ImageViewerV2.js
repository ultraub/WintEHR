import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Paper,
  Toolbar,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  Stack,
  TextField
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Brightness6 as BrightnessIcon,
  Contrast as ContrastIcon,
  RestartAlt as ResetIcon,
  Straighten as RulerIcon,
  RadioButtonUnchecked as CircleIcon,
  CropFree as RectangleIcon,
  Timeline as AngleIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  GridView as GridViewIcon,
  ViewModule as SingleViewIcon
} from '@mui/icons-material';

import cornerstone from 'cornerstone-core';
import cornerstoneTools from 'cornerstone-tools';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import Hammer from 'hammerjs';

// Initialize Cornerstone
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.Hammer = Hammer;

// Initialize cornerstone tools safely
try {
  cornerstoneTools.init({
    mouseEnabled: true,
    touchEnabled: false,
    globalToolSyncEnabled: false,
    showSVGCursors: false
  });
} catch (e) {
  console.warn('Cornerstone tools initialization warning:', e);
  // Try basic init if advanced options fail
  try {
    cornerstoneTools.init();
  } catch (e2) {
    console.error('Cornerstone tools initialization failed:', e2);
  }
}

// Configure image loader for WADO-URI
cornerstoneWADOImageLoader.configure({
  beforeSend: function(xhr) {
    // Add any custom headers if needed
    const token = localStorage.getItem('token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
  },
  errorInterceptor: function(error) {
    console.error('WADO Image Loader Error:', error);
  }
});

const ImageViewerV2 = ({ studyId, seriesId, onClose }) => {
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageIds, setImageIds] = useState([]);
  const [viewport, setViewport] = useState(null);
  const [windowWidth, setWindowWidth] = useState(400);
  const [windowCenter, setWindowCenter] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState('Pan');
  const [imageInfo, setImageInfo] = useState({});
  const [studyInfo, setStudyInfo] = useState(null);

  useEffect(() => {
    // Delay initialization to ensure DOM is ready
    const timer = setTimeout(() => {
      if (viewerRef.current) {
        initializeViewer();
      }
    }, 100);
    
    return () => {
      clearTimeout(timer);
      if (viewerRef.current) {
        try {
          // Disable all tools
          const toolStateManager = cornerstoneTools.globalImageIdSpecificToolStateManager;
          toolStateManager.clear();
          cornerstone.disable(viewerRef.current);
        } catch (err) {
          console.warn('Error disabling cornerstone:', err);
        }
      }
    };
  }, [studyId, seriesId]);

  const initializeViewer = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const element = viewerRef.current;
      if (!element) {
        setError('Viewer element not ready');
        setLoading(false);
        return;
      }
      
      // Check element dimensions
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setError('Viewer container not properly sized');
        setLoading(false);
        return;
      }
      
      // Enable the element
      try {
        cornerstone.enable(element);
      } catch (err) {
        console.warn('Cornerstone already enabled:', err);
      }

      // Add and configure tools
      setupTools();
      
      // Initialize mouse input safely
      try {
        if (element && element.addEventListener) {
          cornerstoneTools.mouseInput.enable(element);
        }
      } catch (e) {
        console.warn('Failed to enable mouse input:', e);
      }

      // Fetch study and series information
      try {
        // studyId is the numeric study ID directly
        // Fetch series information
        const seriesResponse = await fetch(`/api/imaging/wado/studies/${studyId}/series`);
        const seriesResult = await seriesResponse.json();
        
        if (!seriesResult.success || !seriesResult.data || seriesResult.data.length === 0) {
          throw new Error('No series found for this study');
        }

        // Find the target series
        let targetSeries = seriesResult.data[0];
        if (seriesId) {
          const found = seriesResult.data.find(s => s.series_instance_uid === seriesId);
          if (found) targetSeries = found;
        }

        if (!targetSeries.instances || targetSeries.instances.length === 0) {
          throw new Error('No images found in this series');
        }

        // Create image IDs for all instances
        const instances = targetSeries.instances;
        const imageIdArray = instances.map(inst => {
          // Use the full URL for WADO-URI
          const baseUrl = window.location.origin;
          return `wadouri:${baseUrl}/api/imaging/wado/instances/${inst.id}`;
        });
        
        setImageIds(imageIdArray);
        setImageInfo({
          studyUID: studyId,
          seriesUID: targetSeries.series_instance_uid,
          studyDescription: targetSeries.series_description || 'Unknown Series',
          seriesDescription: targetSeries.series_description || 'Unknown Series',
          modality: targetSeries.modality,
          instanceCount: instances.length,
          studyDate: new Date().toISOString()
        });

        // Load and display the first image
        if (imageIdArray.length > 0) {
          await loadAndDisplayImage(imageIdArray[0]);
          setCurrentImageIndex(0);
        }
        
      } catch (err) {
        console.error('Error loading DICOM data:', err);
        // Create a demo fallback
        const demoImage = createDemoImage();
        cornerstone.displayImage(element, demoImage);
        setImageInfo({
          studyUID: studyId,
          seriesUID: seriesId,
          demo: true,
          error: err.message
        });
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error('Error initializing viewer:', err);
      setError(err.message || 'Failed to initialize image viewer');
      setLoading(false);
    }
  };

  const setupTools = () => {
    try {
      // Add tools with safety checks
      const tools = [
        { tool: cornerstoneTools.WwwcTool, name: 'Wwwc' },
        { tool: cornerstoneTools.PanTool, name: 'Pan' },
        { tool: cornerstoneTools.ZoomTool, name: 'Zoom' },
        { tool: cornerstoneTools.LengthTool, name: 'Length' },
        { tool: cornerstoneTools.AngleTool, name: 'Angle' },
        { tool: cornerstoneTools.EllipticalRoiTool, name: 'EllipticalRoi' },
        { tool: cornerstoneTools.RectangleRoiTool, name: 'RectangleRoi' }
      ];

      tools.forEach(({ tool, name }) => {
        try {
          if (tool) {
            cornerstoneTools.addTool(tool);
          }
        } catch (e) {
          console.warn(`Failed to add tool ${name}:`, e);
        }
      });

      // Set initial tool safely
      try {
        cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 });
      } catch (e) {
        console.warn('Failed to set initial tool:', e);
      }
    } catch (e) {
      console.error('Error in setupTools:', e);
    }
  };

  const createDemoImage = () => {
    // Create a demo image as fallback
    const width = 512;
    const height = 512;
    const pixelData = new Uint16Array(width * height);
    
    // Create a gradient pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const value = Math.floor(((x + y) / (width + height)) * 255);
        pixelData[idx] = value;
      }
    }
    
    return {
      imageId: 'demo:fallback',
      minPixelValue: 0,
      maxPixelValue: 255,
      rows: height,
      columns: width,
      height: height,
      width: width,
      color: false,
      columnPixelSpacing: 1,
      rowPixelSpacing: 1,
      invert: false,
      windowCenter: 127,
      windowWidth: 256,
      sizeInBytes: width * height * 2,
      getPixelData: () => pixelData,
      getCanvas: undefined,
      getImage: undefined,
      numFrames: 1,
      frameIndex: 0
    };
  };

  const loadAndDisplayImage = async (imageId) => {
    try {
      const element = viewerRef.current;
      if (!element) return;

      // Load the image
      const image = await cornerstone.loadImage(imageId);
      
      // Display the image
      cornerstone.displayImage(element, image);
      
      // Get default viewport for the image
      const viewport = cornerstone.getDefaultViewportForImage(element, image);
      cornerstone.setViewport(element, viewport);
      
      // Update state
      setViewport(viewport);
      setWindowWidth(viewport.voi.windowWidth);
      setWindowCenter(viewport.voi.windowCenter);
      setZoom(viewport.scale);
      
      // Update image info
      if (image) {
        setImageInfo(prev => ({
          ...prev,
          width: image.width,
          height: image.height,
          pixelSpacing: image.rowPixelSpacing ? 
            `${image.rowPixelSpacing.toFixed(2)} x ${image.columnPixelSpacing.toFixed(2)} mm` : 
            'N/A',
          sliceThickness: image.sliceThickness ? `${image.sliceThickness.toFixed(2)} mm` : 'N/A',
          currentInstance: currentImageIndex + 1
        }));
      }
    } catch (err) {
      console.error('Error loading image:', err);
      // Try to display a fallback
      const demoImage = createDemoImage();
      cornerstone.displayImage(viewerRef.current, demoImage);
    }
  };

  const handleToolChange = (toolName) => {
    const element = viewerRef.current;
    if (!element) return;

    // Disable all tools
    cornerstoneTools.setToolPassive('Wwwc');
    cornerstoneTools.setToolPassive('Pan');
    cornerstoneTools.setToolPassive('Zoom');
    cornerstoneTools.setToolPassive('Length');
    cornerstoneTools.setToolPassive('Angle');
    cornerstoneTools.setToolPassive('EllipticalRoi');
    cornerstoneTools.setToolPassive('RectangleRoi');

    // Enable selected tool
    cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 });
    setActiveTool(toolName);
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
    <Paper elevation={3} sx={{ height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Toolbar sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
          {/* Tool Selection */}
          <Tooltip title="Pan">
            <IconButton 
              onClick={() => handleToolChange('Pan')}
              color={activeTool === 'Pan' ? 'primary' : 'default'}
            >
              <GridViewIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Window/Level">
            <IconButton 
              onClick={() => handleToolChange('Wwwc')}
              color={activeTool === 'Wwwc' ? 'primary' : 'default'}
            >
              <BrightnessIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Zoom">
            <IconButton 
              onClick={() => handleToolChange('Zoom')}
              color={activeTool === 'Zoom' ? 'primary' : 'default'}
            >
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          {/* Measurement Tools */}
          <Tooltip title="Length">
            <IconButton 
              onClick={() => handleToolChange('Length')}
              color={activeTool === 'Length' ? 'primary' : 'default'}
            >
              <RulerIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Angle">
            <IconButton 
              onClick={() => handleToolChange('Angle')}
              color={activeTool === 'Angle' ? 'primary' : 'default'}
            >
              <AngleIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Ellipse ROI">
            <IconButton 
              onClick={() => handleToolChange('EllipticalRoi')}
              color={activeTool === 'EllipticalRoi' ? 'primary' : 'default'}
            >
              <CircleIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Rectangle ROI">
            <IconButton 
              onClick={() => handleToolChange('RectangleRoi')}
              color={activeTool === 'RectangleRoi' ? 'primary' : 'default'}
            >
              <RectangleIcon />
            </IconButton>
          </Tooltip>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          {/* Reset */}
          <Tooltip title="Reset">
            <IconButton onClick={handleReset}>
              <ResetIcon />
            </IconButton>
          </Tooltip>
          
          {/* Image Navigation */}
          {imageIds.length > 1 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <IconButton 
                onClick={() => handleImageNavigation(-1)}
                disabled={currentImageIndex === 0}
              >
                <PrevIcon />
              </IconButton>
              <Typography variant="body2">
                {currentImageIndex + 1} / {imageIds.length}
              </Typography>
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

      {/* Main Viewer */}
      <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: 'black', minHeight: '400px', height: '100%' }}>
        <div 
          ref={viewerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: '400px',
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'block'
          }}
        />
        
        {/* Image Info Overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            left: 10,
            color: 'white',
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          <div>{imageInfo.studyDescription}</div>
          <div>{imageInfo.seriesDescription}</div>
          <div>Size: {imageInfo.width} x {imageInfo.height}</div>
          <div>Pixel Spacing: {imageInfo.pixelSpacing}</div>
          {imageInfo.sliceThickness && <div>Slice Thickness: {imageInfo.sliceThickness}</div>}
          {imageInfo.demo && <div style={{ color: '#ff9800' }}>Demo Mode</div>}
        </Box>
        
        {/* Window/Level Display */}
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            color: 'white',
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          <div>W: {Math.round(windowWidth)} L: {Math.round(windowCenter)}</div>
          <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
          <div>{imageInfo.modality}</div>
        </Box>
      </Box>

      {/* Controls Panel */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={4} alignItems="center">
          {/* Window Width */}
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
          
          {/* Window Center */}
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
          
          {/* Zoom */}
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="caption">Zoom</Typography>
            <Slider
              value={zoom}
              onChange={(e, value) => handleZoomChange(value)}
              min={0.1}
              max={5}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
            />
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
};

export default ImageViewerV2;