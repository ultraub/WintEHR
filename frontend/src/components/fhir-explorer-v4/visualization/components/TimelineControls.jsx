/**
 * Timeline Controls Component
 * Reusable controls for timeline visualization with zoom, pan, and export features
 */

import React, { useState } from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Slider,
  ButtonGroup,
  IconButton,
  Switch,
  FormControlLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  NavigateBefore as PanLeftIcon,
  NavigateNext as PanRightIcon,
  ExpandLess as PanUpIcon,
  ExpandMore as PanDownIcon,
  CenterFocusStrong as CenterIcon,
  NotificationsActive as LiveIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Code as SvgIcon
} from '@mui/icons-material';

const TimelineControls = ({
  timeRange,
  onTimeRangeChange,
  scale,
  onScaleChange,
  filters,
  onFiltersChange,
  onRefresh,
  onExport,
  onPan,
  onReset,
  onToggleLive,
  isLive,
  timeScaleConfig
}) => {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const handleExport = (format) => {
    onExport(format);
    setExportDialogOpen(false);
  };

  const zoomPresets = [
    { label: 'Hour', value: 0.042 },
    { label: 'Day', value: 1 },
    { label: 'Week', value: 7 },
    { label: 'Month', value: 30 },
    { label: 'Year', value: 365 }
  ];

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        {/* Time Range Selector */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="1d">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
              <MenuItem value="180d">Last 6 Months</MenuItem>
              <MenuItem value="365d">Last Year</MenuItem>
              <MenuItem value="all">All Time</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Zoom Controls */}
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ minWidth: 50 }}>Zoom:</Typography>
            <Slider
              value={Math.log10(scale)}
              onChange={(e, value) => onScaleChange(Math.pow(10, value))}
              min={Math.log10(timeScaleConfig.min)}
              max={Math.log10(timeScaleConfig.max)}
              step={0.1}
              marks={zoomPresets.map(preset => ({
                value: Math.log10(preset.value),
                label: preset.label
              }))}
              sx={{ flex: 1, mx: 2 }}
            />
            <ButtonGroup size="small">
              <IconButton onClick={() => onScaleChange(scale * 0.8)} size="small">
                <ZoomOutIcon />
              </IconButton>
              <IconButton onClick={() => onScaleChange(scale * 1.2)} size="small">
                <ZoomInIcon />
              </IconButton>
            </ButtonGroup>
          </Box>
        </Grid>

        {/* Pan Controls */}
        {onPan && (
          <Grid item xs={12} sm={6} md={2}>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
              <IconButton onClick={() => onPan('left')} size="small">
                <PanLeftIcon />
              </IconButton>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <IconButton onClick={() => onPan('up')} size="small">
                  <PanUpIcon />
                </IconButton>
                <IconButton onClick={() => onPan('down')} size="small">
                  <PanDownIcon />
                </IconButton>
              </Box>
              <IconButton onClick={() => onPan('right')} size="small">
                <PanRightIcon />
              </IconButton>
              <IconButton onClick={onReset} size="small" color="primary">
                <CenterIcon />
              </IconButton>
            </Box>
          </Grid>
        )}

        {/* Actions */}
        <Grid item xs={12} sm={6} md={onPan ? 4 : 6}>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            {onToggleLive && (
              <FormControlLabel
                control={
                  <Switch
                    checked={isLive}
                    onChange={(e) => onToggleLive(e.target.checked)}
                    color="error"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LiveIcon sx={{ fontSize: 16, color: isLive ? 'error.main' : 'text.secondary' }} />
                    Live
                  </Box>
                }
              />
            )}
            <IconButton onClick={onRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={() => setExportDialogOpen(true)}>
              <DownloadIcon />
            </IconButton>
          </Box>
        </Grid>
      </Grid>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Timeline</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 2 }}>
            <Grid item xs={4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ImageIcon />}
                onClick={() => handleExport('png')}
              >
                PNG
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PdfIcon />}
                onClick={() => handleExport('pdf')}
              >
                PDF
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SvgIcon />}
                onClick={() => handleExport('json')}
              >
                JSON
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TimelineControls;