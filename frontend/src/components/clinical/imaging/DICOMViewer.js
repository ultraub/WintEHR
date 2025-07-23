/**
 * Functional DICOM Viewer Component
 * Loads and displays real DICOM images with windowing, zooming, and navigation
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Grid,
  Paper,
  Stack,
  Tooltip,
  CircularProgress,
  Alert,
  ButtonGroup,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  ZoomOutMap as ResetZoomIcon,
  RotateRight as RotateIcon,
  Brightness6 as WindowIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipPrevious as PrevIcon,
  SkipNext as NextIcon,
  Fullscreen as FullscreenIcon,
  GetApp as DownloadIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import api from '../../../services/api';

const DICOMViewer = ({ study, onClose }) => {
  const theme = useTheme();
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [instances, setInstances] = useState([]);
  const [currentInstanceIndex, setCurrentInstanceIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState(null);
  const [viewerConfig, setViewerConfig] = useState(null);
  
  // Viewer state
  const [windowCenter, setWindowCenter] = useState(128);
  const [windowWidth, setWindowWidth] = useState(256);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(200);
  const [showInfo, setShowInfo] = useState(false);
  
  // Animation ref
  const animationRef = useRef(null);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  // Load DICOM study data
  useEffect(() => {
    if (study) {
      loadStudyData();
    }
  }, [study]); // Remove loadStudyData from dependencies to prevent infinite loops

  // Auto-play animation
  useEffect(() => {
    if (isPlaying && instances.length > 1) {
      animationRef.current = setInterval(() => {
        setCurrentInstanceIndex(prev => (prev + 1) % instances.length);
      }, playSpeed);
    } else {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isPlaying, instances.length, playSpeed]);

  // Load current instance image
  useEffect(() => {
    if (instances.length > 0 && currentInstanceIndex < instances.length && !error) {
      loadInstanceImage(instances[currentInstanceIndex]);
    }
  }, [currentInstanceIndex, windowCenter, windowWidth, error]);

  // Render current image
  useEffect(() => {
    if (currentImage && canvasRef.current) {
      renderImage();
    }
  }, [currentImage, zoom, pan, rotation]);

  const loadStudyData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Extract study directory from study object
      const studyDir = extractStudyDirectory(study);
      
      if (!studyDir) {
        throw new Error('Unable to determine study directory');
      }

      // Load study metadata
      const metadataResponse = await api.get(`/api/dicom/studies/${studyDir}/metadata`);
      const instancesData = metadataResponse.data.instances;
      
      if (!instancesData || instancesData.length === 0) {
        throw new Error('No DICOM instances found in study');
      }

      setInstances(instancesData);
      
      // Load viewer config
      const configResponse = await api.get(`/api/dicom/studies/${studyDir}/viewer-config`);
      setViewerConfig(configResponse.data);
      
      // Set initial window/level from first instance
      const firstInstance = instancesData[0];
      setWindowCenter(firstInstance.windowCenter || 128);
      setWindowWidth(firstInstance.windowWidth || 256);
      
      setCurrentInstanceIndex(0);
      
    } catch (err) {
      const errorMessage = err.response?.status === 404 
        ? 'DICOM study not found. This study may not have imaging data available.'
        : err.message || 'Failed to load DICOM study';
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const extractStudyDirectory = (studyObj) => {
    // Try to extract study directory from various possible sources
    if (studyObj.studyDirectory) {
      return studyObj.studyDirectory;
    }
    
    // Check for DICOM directory in extensions
    if (studyObj.extension) {
      const dicomDirExt = studyObj.extension.find(
        ext => ext.url === 'http://example.org/fhir/StructureDefinition/dicom-directory'
      );
      if (dicomDirExt && dicomDirExt.valueString) {
        return dicomDirExt.valueString;
      }
    }
    
    // Try to derive from study ID - this is the new format we're using
    if (studyObj.id) {
      // Determine study type from modality or description
      let studyType = 'CT_CHEST'; // Default
      
      if (studyObj.modality && studyObj.modality.length > 0) {
        const modalityCode = studyObj.modality[0].code;
        if (modalityCode === 'CT') {
          studyType = studyObj.description?.toLowerCase().includes('head') ? 'CT_HEAD' : 'CT_CHEST';
        } else if (modalityCode === 'MR') {
          studyType = 'MR_BRAIN';
        } else if (modalityCode === 'US') {
          studyType = 'US_ABDOMEN';
        } else if (modalityCode === 'CR' || modalityCode === 'DX') {
          studyType = 'XR_CHEST';
        }
      }
      
      // Generate directory name based on our convention
      return `${studyType}_${studyObj.id.replace(/-/g, '')}`;
    }
    
    // Should not reach here
    
    return null;
  };

  const loadInstanceImage = async (instance) => {
    try {
      const studyDir = extractStudyDirectory(study);
      const url = `/api/dicom/studies/${studyDir}/instances/${instance.instanceNumber}/image?window_center=${windowCenter}&window_width=${windowWidth}`;
      
      const response = await api.get(url, { responseType: 'blob' });
      const imageBlob = response.data;
      const imageUrl = URL.createObjectURL(imageBlob);
      
      const img = new Image();
      img.onload = () => {
        setCurrentImage({
          element: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
          metadata: instance
        });
        URL.revokeObjectURL(imageUrl);
      };
      img.onerror = () => {
        setError('Failed to load DICOM image');
        URL.revokeObjectURL(imageUrl);
      };
      img.src = imageUrl;
      
    } catch (err) {
      const errorMessage = err.response?.status === 404 
        ? 'DICOM image not found'
        : 'Failed to load DICOM image';
      
      setError(errorMessage);
    }
  };

  const renderImage = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!currentImage || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context
    ctx.save();
    
    // Apply transformations
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Translate to center
    ctx.translate(centerX + pan.x, centerY + pan.y);
    
    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);
    
    // Apply zoom
    ctx.scale(zoom, zoom);
    
    // Draw image centered
    const imgWidth = currentImage.width;
    const imgHeight = currentImage.height;
    
    ctx.drawImage(
      currentImage.element,
      -imgWidth / 2,
      -imgHeight / 2,
      imgWidth,
      imgHeight
    );
    
    // Restore context
    ctx.restore();
    
    // Draw overlay information
    drawOverlay(ctx);
  };

  const drawOverlay = (ctx) => {
    if (!showInfo || !currentImage) return;
    
    ctx.save();
    ctx.font = '14px Arial';
    ctx.fillStyle = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    
    const metadata = currentImage.metadata;
    const overlayText = [
      `Patient: ${metadata.patientName || 'Unknown'}`,
      `Study: ${metadata.studyDescription || 'Unknown'}`,
      `Series: ${metadata.seriesDescription || 'Unknown'}`,
      `Instance: ${metadata.instanceNumber} / ${instances.length}`,
      `WC: ${windowCenter} WW: ${windowWidth}`,
      `Zoom: ${(zoom * 100).toFixed(0)}%`
    ];
    
    overlayText.forEach((text, index) => {
      const y = 20 + index * 20;
      ctx.strokeText(text, 10, y);
      ctx.fillText(text, 10, y);
    });
    
    ctx.restore();
  };

  // Event handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 10));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1));
  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };
  
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  
  const handlePrevious = () => {
    setCurrentInstanceIndex(prev => prev > 0 ? prev - 1 : instances.length - 1);
  };
  
  const handleNext = () => {
    setCurrentInstanceIndex(prev => (prev + 1) % instances.length);
  };
  
  const handlePlayPause = () => setIsPlaying(prev => !prev);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    isDragging.current = true;
    lastPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    
    setPan({
      x: e.clientX - lastPanRef.current.x,
      y: e.clientY - lastPanRef.current.y
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
  }, []);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'r':
          e.preventDefault();
          handleRotate();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          // Ignore other keys
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress size={60} sx={{ mb: 2 }} />
        <Typography>Loading DICOM images...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6">Error Loading DICOM Study</Typography>
        <Typography>{error}</Typography>
      </Alert>
    );
  }

  const currentInstance = instances[currentInstanceIndex];

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1300,
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.9)',
      overflow: 'hidden'
    }}>
      {/* Close button */}
      <IconButton 
        onClick={onClose}
        sx={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          color: 'white',
          zIndex: 1301,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.5)',
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.7)'
          }
        }}
      >
        <CloseIcon />
      </IconButton>
      
      {/* Controls */}
      <Paper sx={{ p: 1, mb: 1, mx: 2, mt: 2, backgroundColor: theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Navigation Controls */}
          <Grid item>
            <ButtonGroup variant="outlined" size="small">
              <Tooltip title="Previous (← ↓)">
                <IconButton onClick={handlePrevious} disabled={instances.length <= 1}>
                  <PrevIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Play/Pause (Space)">
                <IconButton onClick={handlePlayPause} disabled={instances.length <= 1}>
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Next (→ ↑)">
                <IconButton onClick={handleNext} disabled={instances.length <= 1}>
                  <NextIcon />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
          </Grid>

          {/* Instance Counter */}
          <Grid item>
            <Typography variant="body2">
              {currentInstanceIndex + 1} / {instances.length}
            </Typography>
          </Grid>

          {/* Zoom Controls */}
          <Grid item>
            <ButtonGroup variant="outlined" size="small">
              <Tooltip title="Zoom In">
                <IconButton onClick={handleZoomIn}>
                  <ZoomInIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out">
                <IconButton onClick={handleZoomOut}>
                  <ZoomOutIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset (R)">
                <IconButton onClick={handleResetZoom}>
                  <ResetZoomIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Rotate (R)">
                <IconButton onClick={handleRotate}>
                  <RotateIcon />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
          </Grid>

          {/* Window/Level */}
          <Grid item xs>
            <Stack direction="row" spacing={2} alignItems="center">
              <WindowIcon />
              <Typography variant="caption" sx={{ minWidth: 30 }}>WC:</Typography>
              <Slider
                size="small"
                value={windowCenter}
                onChange={(e, value) => setWindowCenter(value)}
                min={-1000}
                max={1000}
                sx={{ width: 100 }}
              />
              <Typography variant="caption" sx={{ minWidth: 30 }}>WW:</Typography>
              <Slider
                size="small"
                value={windowWidth}
                onChange={(e, value) => setWindowWidth(value)}
                min={1}
                max={2000}
                sx={{ width: 100 }}
              />
            </Stack>
          </Grid>

          {/* Play Speed */}
          {instances.length > 1 && (
            <Grid item>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel>Speed</InputLabel>
                <Select
                  value={playSpeed}
                  onChange={(e) => setPlaySpeed(e.target.value)}
                  label="Speed"
                >
                  <MenuItem value={50}>Fast</MenuItem>
                  <MenuItem value={200}>Normal</MenuItem>
                  <MenuItem value={500}>Slow</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}

          {/* Info Toggle */}
          <Grid item>
            <Tooltip title="Show Info">
              <IconButton 
                onClick={() => setShowInfo(!showInfo)}
                color={showInfo ? "primary" : "default"}
              >
                <InfoIcon />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>

      {/* DICOM Canvas */}
      <Box sx={{ 
        flex: 1, 
        position: 'relative', 
        backgroundColor: theme.palette.mode === 'dark' ? '#000' : '#000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}>
        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          style={{
            maxWidth: '90%',
            maxHeight: '90%',
            objectFit: 'contain',
            cursor: isDragging.current ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Instance slider overlay */}
        {instances.length > 1 && (
          <Box sx={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(50, 50, 50, 0.8)' : 'rgba(0, 0, 0, 0.7)',
            borderRadius: 1,
            p: 2,
            minWidth: 200
          }}>
            <Slider
              value={currentInstanceIndex}
              onChange={(e, value) => setCurrentInstanceIndex(value)}
              min={0}
              max={instances.length - 1}
              step={1}
              marks
              valueLabelDisplay="auto"
              sx={{ color: 'white' }}
            />
          </Box>
        )}
      </Box>

      {/* Keyboard shortcuts help */}
      <Typography variant="caption" sx={{ p: 1, color: 'text.secondary' }}>
        Shortcuts: ← → (navigate), Space (play/pause), R (rotate), Mouse wheel (zoom), Drag (pan), Esc (close)
      </Typography>
    </Box>
  );
};

export default DICOMViewer;