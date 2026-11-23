/**
 * ColumnBars
 * A short row of vertical bars for an ORDERED set of groups (age bands,
 * "0 / 1–2 / 3–4 / 5–9 / 10+"), where the order is the point and a ranked
 * BarList would scramble it. Every column carries its value above and its
 * name below, so nothing is read from colour or an axis.
 *
 * Props
 *   items        [{ label, value, caption?, hint?, tone? }]
 *                caption: small line under the label ("5 of 5")
 *                tone: 'attention' | 'critical' … colours that one column
 *   max          scale maximum; defaults to the largest value
 *   formatValue  (value) => string
 *   height       height of the plot area in px (default 120)
 *   color        bar colour; defaults to the theme's primary
 */
import React from 'react';
import { Box, Tooltip, Typography, useTheme } from '@mui/material';
import { getToneColors } from '../../utils/statusDisplay';

const ColumnBars = ({
  items = [],
  max,
  formatValue = (value) => String(value),
  height = 120,
  color,
  emptyText = 'No data',
}) => {
  const theme = useTheme();
  const scaleMax = max ?? Math.max(0, ...items.map((item) => item.value || 0));

  if (items.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }

  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        columnGap: 0.75,
      }}
    >
      {items.map((item) => {
        const value = item.value || 0;
        const percent = scaleMax > 0 ? (value / scaleMax) * 100 : 0;
        const fill = item.tone ? getToneColors(theme, item.tone).border : (color || theme.palette.primary.main);
        return (
          <Tooltip key={item.label} title={item.hint || `${item.label}: ${formatValue(value)}`} placement="top" enterDelay={200}>
            <Box component="li" sx={{ minWidth: 0, textAlign: 'center', '&:hover .columnbars-fill': { opacity: 0.8 } }}>
              <Box sx={{ height, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Typography
                  variant="caption"
                  sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, lineHeight: 1.4, color: value > 0 ? 'text.primary' : 'text.disabled' }}
                >
                  {formatValue(value)}
                </Typography>
                <Box
                  className="columnbars-fill"
                  sx={{
                    width: '100%',
                    maxWidth: 44,
                    // leave room for the value label above the tallest bar
                    // an empty group is a hairline on the baseline, not a bar
                    height: value > 0 ? `calc((100% - 20px) * ${(percent / 100).toFixed(4)})` : '1px',
                    flexShrink: 0,
                    // strings: sx reads a bare 1 as 100%
                    minHeight: value > 0 ? '3px' : '1px',
                    borderRadius: '4px 4px 0 0',
                    backgroundColor: value > 0 ? fill : theme.palette.divider,
                  }}
                />
              </Box>
              <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {item.label}
                </Typography>
                {item.caption && (
                  <Typography variant="caption" color="text.disabled" noWrap component="div" sx={{ fontSize: '0.6875rem', fontVariantNumeric: 'tabular-nums' }}>
                    {item.caption}
                  </Typography>
                )}
              </Box>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default ColumnBars;
