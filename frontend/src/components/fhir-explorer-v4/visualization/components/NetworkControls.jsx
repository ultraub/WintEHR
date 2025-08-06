/**
 * Network Controls Component
 * Controls for network diagram visualization
 */

import React from 'react';
import {
  Box,
  Paper,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
  Typography,
  Tooltip,
  FormControlLabel,
  Switch,
  Divider,
  Button,
  ButtonGroup
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Filter as FilterIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  PhotoCamera as ScreenshotIcon,
  Grain as ClusterIcon,
  ScatterPlot as ScatterIcon
} from '@mui/icons-material';

const NetworkControls = ({
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleSimulation,
  isSimulationRunning,
  onRefresh,
  onExport,
  onToggleFullscreen,
  isFullscreen,
  onToggleClustering,
  isClustering,
  linkDistance,
  onLinkDistanceChange,
  chargeStrength,
  onChargeStrengthChange,
  onLayoutChange,
  currentLayout
}) => {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        {/* Zoom Controls */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            Zoom
          </Typography>
          <ButtonGroup size="small">
            <Tooltip title="Zoom In">
              <IconButton onClick={onZoomIn} size="small">
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset Zoom">
              <IconButton onClick={onResetZoom} size="small">
                <CenterIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out">
              <IconButton onClick={onZoomOut} size="small">
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
          </ButtonGroup>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Simulation Controls */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            Simulation
          </Typography>
          <ButtonGroup size="small">
            <Tooltip title={isSimulationRunning ? 'Pause' : 'Play'}>
              <IconButton onClick={onToggleSimulation} size="small">
                {isSimulationRunning ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Restart">
              <IconButton onClick={onRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </ButtonGroup>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Layout Options */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            Layout
          </Typography>
          <ToggleButtonGroup
            value={currentLayout}
            exclusive
            onChange={(e, value) => value && onLayoutChange(value)}
            size="small"
          >
            <ToggleButton value="force">
              <Tooltip title="Force Layout">
                <ScatterIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="cluster">
              <Tooltip title="Cluster Layout">
                <ClusterIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Force Parameters */}
        <Box sx={{ minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">
            Link Distance: {linkDistance}
          </Typography>
          <Slider
            value={linkDistance}
            onChange={(e, value) => onLinkDistanceChange(value)}
            min={20}
            max={200}
            size="small"
          />
          <Typography variant="caption" color="text.secondary">
            Charge Strength: {chargeStrength}
          </Typography>
          <Slider
            value={Math.abs(chargeStrength)}
            onChange={(e, value) => onChargeStrengthChange(-value)}
            min={0}
            max={1000}
            size="small"
          />
        </Box>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {/* Toggle Clustering */}
          <FormControlLabel
            control={
              <Switch
                checked={isClustering}
                onChange={(e) => onToggleClustering(e.target.checked)}
                size="small"
              />
            }
            label="Clustering"
          />

          {/* Export & Fullscreen */}
          <Tooltip title="Export">
            <IconButton onClick={onExport} size="small">
              <ScreenshotIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <IconButton onClick={onToggleFullscreen} size="small">
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
};

export default NetworkControls;