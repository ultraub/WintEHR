/**
 * Chart Type Selector Component
 * Allows users to switch between different chart visualizations
 */

import React from 'react';
import {
  ToggleButtonGroup,
  ToggleButton,
  Box,
  Tooltip
} from '@mui/material';
import {
  BarChart as BarIcon,
  PieChart as PieIcon,
  ShowChart as LineIcon,
  ScatterPlot as ScatterIcon,
  DonutLarge as DonutIcon,
  Leaderboard as AreaIcon,
  BubbleChart as BubbleIcon,
  Insights as RadarIcon
} from '@mui/icons-material';

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: <BarIcon /> },
  { value: 'line', label: 'Line Chart', icon: <LineIcon /> },
  { value: 'pie', label: 'Pie Chart', icon: <PieIcon /> },
  { value: 'donut', label: 'Donut Chart', icon: <DonutIcon /> },
  { value: 'area', label: 'Area Chart', icon: <AreaIcon /> },
  { value: 'scatter', label: 'Scatter Plot', icon: <ScatterIcon /> },
  { value: 'bubble', label: 'Bubble Chart', icon: <BubbleIcon /> },
  { value: 'radar', label: 'Radar Chart', icon: <RadarIcon /> }
];

const ChartTypeSelector = ({ value, onChange, availableTypes = CHART_TYPES.map(t => t.value) }) => {
  const filteredTypes = CHART_TYPES.filter(type => availableTypes.includes(type.value));

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={(e, newValue) => newValue && onChange(newValue)}
        size="small"
      >
        {filteredTypes.map(type => (
          <Tooltip key={type.value} title={type.label}>
            <ToggleButton value={type.value}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {type.icon || <span />}
              </Box>
            </ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

export default ChartTypeSelector;