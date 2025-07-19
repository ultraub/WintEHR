/**
 * TrendSparkline Component
 * Lightweight inline chart for showing trends in clinical data
 * Used throughout the clinical workspace for at-a-glance trend visualization
 */
import React, { useRef, useEffect, useMemo } from 'react';
import { Box, Typography, useTheme, Tooltip } from '@mui/material';
import { scaleLinear, line, area, curveCardinal } from 'd3';

const TrendSparkline = ({
  data = [],
  width = 100,
  height = 30,
  color = 'primary',
  showLastValue = false,
  showReferenceRange = false,
  referenceRange = null,
  strokeWidth = 2,
  showArea = false,
  showDots = false,
  interactive = true,
  formatValue = (v) => v,
  formatTooltip = (v, i) => `Value: ${v}`,
  margin = { top: 2, right: 2, bottom: 2, left: 2 }
}) => {
  const theme = useTheme();
  const svgRef = useRef(null);
  const [hoveredIndex, setHoveredIndex] = React.useState(null);

  // Get color from theme
  const lineColor = useMemo(() => {
    if (typeof color === 'string' && color in theme.palette) {
      return theme.palette[color].main;
    }
    return color || theme.palette.primary.main;
  }, [color, theme]);

  // Calculate dimensions
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Process data
  const processedData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    
    // Handle different data formats
    if (typeof data[0] === 'number') {
      return data.map((value, index) => ({ x: index, y: value }));
    } else if (data[0].value !== undefined) {
      return data.map((item, index) => ({ 
        x: item.x || index, 
        y: item.value || item.y || 0 
      }));
    }
    return data.map((item, index) => ({ 
      x: item.x || index, 
      y: item.y || 0 
    }));
  }, [data]);

  // Calculate scales
  const { xScale, yScale } = useMemo(() => {
    if (processedData.length === 0) {
      return { xScale: null, yScale: null };
    }

    const xExtent = [0, processedData.length - 1];
    const yExtent = [
      Math.min(...processedData.map(d => d.y)),
      Math.max(...processedData.map(d => d.y))
    ];

    // Add padding to y extent
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1 || 1;
    yExtent[0] -= yPadding;
    yExtent[1] += yPadding;

    // Include reference range in scale if provided
    if (referenceRange) {
      yExtent[0] = Math.min(yExtent[0], referenceRange[0]);
      yExtent[1] = Math.max(yExtent[1], referenceRange[1]);
    }

    return {
      xScale: scaleLinear()
        .domain(xExtent)
        .range([0, innerWidth]),
      yScale: scaleLinear()
        .domain(yExtent)
        .range([innerHeight, 0])
    };
  }, [processedData, innerWidth, innerHeight, referenceRange]);

  // Generate line path
  const linePath = useMemo(() => {
    if (!xScale || !yScale || processedData.length === 0) return '';
    
    const lineGenerator = line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(curveCardinal.tension(0.5));
    
    return lineGenerator(processedData);
  }, [processedData, xScale, yScale]);

  // Generate area path
  const areaPath = useMemo(() => {
    if (!xScale || !yScale || processedData.length === 0 || !showArea) return '';
    
    const areaGenerator = area()
      .x(d => xScale(d.x))
      .y0(innerHeight)
      .y1(d => yScale(d.y))
      .curve(curveCardinal.tension(0.5));
    
    return areaGenerator(processedData);
  }, [processedData, xScale, yScale, innerHeight, showArea]);

  // Draw the sparkline
  useEffect(() => {
    if (!svgRef.current || !xScale || !yScale) return;

    const svg = svgRef.current;
    
    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Create main group
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
    svg.appendChild(g);

    // Draw reference range if provided
    if (showReferenceRange && referenceRange) {
      const refRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      refRect.setAttribute('x', '0');
      refRect.setAttribute('y', yScale(referenceRange[1]));
      refRect.setAttribute('width', innerWidth);
      refRect.setAttribute('height', yScale(referenceRange[0]) - yScale(referenceRange[1]));
      refRect.setAttribute('fill', theme.palette.success.main);
      refRect.setAttribute('opacity', '0.1');
      g.appendChild(refRect);
    }

    // Draw area if enabled
    if (showArea && areaPath) {
      const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      areaElement.setAttribute('d', areaPath);
      areaElement.setAttribute('fill', lineColor);
      areaElement.setAttribute('opacity', '0.2');
      g.appendChild(areaElement);
    }

    // Draw line
    if (linePath) {
      const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      lineElement.setAttribute('d', linePath);
      lineElement.setAttribute('fill', 'none');
      lineElement.setAttribute('stroke', lineColor);
      lineElement.setAttribute('stroke-width', strokeWidth);
      lineElement.setAttribute('stroke-linejoin', 'round');
      lineElement.setAttribute('stroke-linecap', 'round');
      g.appendChild(lineElement);
    }

    // Draw dots if enabled
    if (showDots) {
      processedData.forEach((d, i) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', xScale(d.x));
        circle.setAttribute('cy', yScale(d.y));
        circle.setAttribute('r', i === hoveredIndex ? 3 : 2);
        circle.setAttribute('fill', lineColor);
        g.appendChild(circle);
      });
    }

    // Add invisible interaction overlay
    if (interactive) {
      processedData.forEach((d, i) => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', xScale(d.x) - innerWidth / processedData.length / 2);
        rect.setAttribute('y', 0);
        rect.setAttribute('width', innerWidth / processedData.length);
        rect.setAttribute('height', innerHeight);
        rect.setAttribute('fill', 'transparent');
        rect.style.cursor = 'pointer';
        rect.addEventListener('mouseenter', () => setHoveredIndex(i));
        rect.addEventListener('mouseleave', () => setHoveredIndex(null));
        g.appendChild(rect);
      });
    }
  }, [
    processedData,
    xScale,
    yScale,
    linePath,
    areaPath,
    lineColor,
    strokeWidth,
    showDots,
    showArea,
    interactive,
    hoveredIndex,
    innerWidth,
    innerHeight,
    margin,
    theme,
    showReferenceRange,
    referenceRange
  ]);

  // Get last value for display
  const lastValue = processedData.length > 0 
    ? processedData[processedData.length - 1].y 
    : null;

  const content = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5
      }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: 'block' }}
      />
      {showLastValue && lastValue !== null && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: lineColor,
            minWidth: '3ch'
          }}
        >
          {formatValue(lastValue)}
        </Typography>
      )}
    </Box>
  );

  if (interactive && hoveredIndex !== null && processedData[hoveredIndex]) {
    return (
      <Tooltip
        title={formatTooltip(processedData[hoveredIndex].y, hoveredIndex)}
        placement="top"
        arrow
      >
        {content}
      </Tooltip>
    );
  }

  return content;
};

// Preset configurations for common use cases
export const SparklinePresets = {
  vitals: {
    showReferenceRange: true,
    showArea: true,
    showDots: false,
    strokeWidth: 2
  },
  labs: {
    showReferenceRange: true,
    showArea: false,
    showDots: true,
    strokeWidth: 1.5
  },
  medications: {
    showReferenceRange: false,
    showArea: true,
    showDots: false,
    strokeWidth: 2
  },
  minimal: {
    showReferenceRange: false,
    showArea: false,
    showDots: false,
    strokeWidth: 1
  }
};

export default TrendSparkline;