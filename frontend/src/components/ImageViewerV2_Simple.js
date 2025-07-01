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
  NavigateNext as NextIcon
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
  console.log('ImageViewerV2Simple: Mounting with props:', { studyId, seriesId });
  
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageIds, setImageIds] = useState([]);
  const [windowWidth, setWindowWidth] = useState(400);
  const [windowCenter, setWindowCenter] = useState(40);
  const [zoom, setZoom] = useState(1);

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
      
      // Load first image
      if (imageIds.length > 0) {
        await loadAndDisplayImage(imageIds[0]);
      }
    } catch (err) {
      console.error('Error initializing viewer:', err);
      setError('Failed to initialize viewer');
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
          <IconButton onClick={() => handleZoomChange(zoom * 1.2)}>
            <ZoomInIcon />
          </IconButton>
          <IconButton onClick={() => handleZoomChange(zoom * 0.8)}>
            <ZoomOutIcon />
          </IconButton>
          <IconButton onClick={handleReset}>
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
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute'
          }}
        />
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