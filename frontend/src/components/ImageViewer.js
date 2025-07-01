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
cornerstoneTools.init();

// Configure image loader
cornerstoneWADOImageLoader.configure({
  beforeSend: function(xhr) {
    // Add authorization headers if needed
    const token = localStorage.getItem('token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
  }
});

const ImageViewer = ({ studyId, seriesId, onClose }) => {
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
          cornerstone.disable(viewerRef.current);
        } catch (err) {
          console.warn('Error disabling cornerstone:', err);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, seriesId]);

  const initializeViewer = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Enable the viewer element
      const element = viewerRef.current;
      if (!element) {
        console.error('Viewer element not ready');
        setError('Viewer is initializing, please try again');
        setLoading(false);
        return;
      }
      
      // Check element dimensions
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.error('Viewer element has no dimensions', rect);
        setError('Viewer container not properly sized');
        setLoading(false);
        return;
      }
      
      // For now, since we're using mock data, let's display a placeholder
      // In production, this would load actual DICOM files
      
      try {
        cornerstone.enable(element);
      } catch (err) {
        console.warn('Cornerstone already enabled:', err);
      }

      // Create a simple canvas with demo image
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      // Create a gradient background
      const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      gradient.addColorStop(0, '#444');
      gradient.addColorStop(1, '#000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
      
      // Add some text
      ctx.fillStyle = '#fff';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('DICOM Viewer Demo', 256, 256);
      ctx.font = '16px Arial';
      ctx.fillText('Study: ' + studyId, 256, 290);
      ctx.fillText('Series: ' + seriesId, 256, 310);
      
      // Convert canvas to image
      const imageDataUrl = canvas.toDataURL();
      
      // Create a simple image object that cornerstone can display
      const image = {
        imageId: 'demo:image1',
        minPixelValue: 0,
        maxPixelValue: 255,
        rows: 512,
        columns: 512,
        height: 512,
        width: 512,
        color: false,
        columnPixelSpacing: 1,
        rowPixelSpacing: 1,
        sizeInBytes: 512 * 512 * 2,
        getPixelData: function() {
          // Create pixel data from canvas
          const imageData = ctx.getImageData(0, 0, 512, 512);
          const pixelData = new Uint16Array(512 * 512);
          for (let i = 0; i < imageData.data.length; i += 4) {
            pixelData[i / 4] = imageData.data[i]; // Use red channel
          }
          return pixelData;
        }
      };
      
      // Display the image
      cornerstone.displayImage(element, image);
      
      setImageInfo({
        studyUID: studyId,
        seriesUID: seriesId,
        rows: 512,
        columns: 512,
        pixelSpacing: '1.0\\1.0'
      });
      
      setLoading(false);

      // Add tools
      const WwwcTool = cornerstoneTools.WwwcTool;
      const PanTool = cornerstoneTools.PanTool;
      const ZoomTool = cornerstoneTools.ZoomTool;
      const LengthTool = cornerstoneTools.LengthTool;
      const AngleTool = cornerstoneTools.AngleTool;
      const EllipticalRoiTool = cornerstoneTools.EllipticalRoiTool;
      const RectangleRoiTool = cornerstoneTools.RectangleRoiTool;

      cornerstoneTools.addTool(WwwcTool);
      cornerstoneTools.addTool(PanTool);
      cornerstoneTools.addTool(ZoomTool);
      cornerstoneTools.addTool(LengthTool);
      cornerstoneTools.addTool(AngleTool);
      cornerstoneTools.addTool(EllipticalRoiTool);
      cornerstoneTools.addTool(RectangleRoiTool);

      // Set initial tool
      cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 });
      
    } catch (err) {
      console.error('Error initializing viewer:', err);
      setError(err.message || 'Failed to initialize image viewer');
      setLoading(false);
    }
  };

  const loadAndDisplayImage = async (imageId) => {
    try {
      const element = viewerRef.current;
      const image = await cornerstone.loadImage(imageId);
      
      cornerstone.displayImage(element, image);
      
      // Set default viewport
      const viewport = cornerstone.getDefaultViewportForImage(element, image);
      cornerstone.setViewport(element, viewport);
      
      // Update state
      setViewport(viewport);
      setWindowWidth(viewport.voi.windowWidth);
      setWindowCenter(viewport.voi.windowCenter);
      setZoom(viewport.scale);
      
      // Set image info
      setImageInfo({
        width: image.width,
        height: image.height,
        pixelSpacing: image.rowPixelSpacing ? 
          `${image.rowPixelSpacing.toFixed(2)} x ${image.columnPixelSpacing.toFixed(2)} mm` : 
          'N/A',
        sliceThickness: image.sliceThickness ? `${image.sliceThickness.toFixed(2)} mm` : 'N/A'
      });
    } catch (err) {
      console.error('Error loading image:', err);
      setError('Failed to load image');
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
            pointerEvents: 'none'
          }}
        >
          <div>Size: {imageInfo.width} x {imageInfo.height}</div>
          <div>Pixel Spacing: {imageInfo.pixelSpacing}</div>
          <div>Slice Thickness: {imageInfo.sliceThickness}</div>
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
            pointerEvents: 'none'
          }}
        >
          <div>W: {Math.round(windowWidth)} L: {Math.round(windowCenter)}</div>
          <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
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

export default ImageViewer;