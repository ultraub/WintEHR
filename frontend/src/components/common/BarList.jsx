/**
 * BarList
 * Ranked horizontal bars for "how many in each category" — the right form
 * when categories are named, can overlap (a patient may have several
 * conditions) and a reader wants to compare lengths. A pie or donut is wrong
 * for that data: it implies the slices are parts of one whole.
 *
 * One hue (the bars encode magnitude; the label carries identity), every row
 * labelled with its name and its value, so nothing depends on colour.
 *
 * Props
 *   items        [{ label, value, hint? }]
 *   sort         'desc' (default) | 'none' to keep the given order
 *   max          scale maximum; defaults to the largest value
 *   formatValue  (value) => string
 *   color        bar colour; defaults to the theme's primary
 *   emptyText    shown when there is nothing to draw
 *   onSelect     (row) => void; makes each row a button
 *   selected     label of the selected row (shown with a tinted background)
 */
import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

const BarList = ({
  items = [],
  sort = 'desc',
  max,
  formatValue = (value) => String(value),
  color,
  emptyText = 'No data',
  labelWidth = '38%',
  onSelect,
  selected,
}) => {
  const rows = sort === 'desc' ? [...items].sort((a, b) => (b.value || 0) - (a.value || 0)) : items;
  const scaleMax = max ?? Math.max(0, ...rows.map((row) => row.value || 0));

  if (rows.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }

  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', rowGap: onSelect ? 0 : 1 }}>
      {rows.map((row) => {
        const value = row.value || 0;
        const percent = scaleMax > 0 ? (value / scaleMax) * 100 : 0;
        return (
          <Tooltip
            key={row.label}
            title={row.hint || `${row.label}: ${formatValue(value)}`}
            placement="top-start"
            enterDelay={300}
          >
            <Box
              component="li"
              {...(onSelect ? {
                role: 'button',
                tabIndex: 0,
                'aria-pressed': selected === row.label,
                onClick: () => onSelect(row),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(row);
                  }
                },
              } : {})}
              sx={{
                display: 'grid',
                gridTemplateColumns: `minmax(0, ${labelWidth}) minmax(0, 1fr) auto`,
                alignItems: 'center',
                columnGap: 1.5,
                '&:hover .barlist-fill': { opacity: 0.8 },
                ...(onSelect && {
                  cursor: 'pointer',
                  mx: -1,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  backgroundColor: selected === row.label ? 'action.selected' : 'transparent',
                  '&:hover': { backgroundColor: selected === row.label ? 'action.selected' : 'action.hover' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                }),
              }}
            >
              <Typography variant="body2" noWrap sx={{ fontWeight: onSelect && selected === row.label ? 600 : 400 }}>{row.label}</Typography>
              <Box sx={{ height: 10, borderRadius: 1, backgroundColor: 'action.hover', overflow: 'hidden' }}>
                <Box
                  className="barlist-fill"
                  sx={{
                    height: '100%',
                    width: `${percent}%`,
                    // a non-zero value always shows at least a sliver
                    minWidth: value > 0 ? 3 : 0,
                    borderRadius: 1,
                    backgroundColor: color || 'primary.main',
                  }}
                />
              </Box>
              <Typography
                variant="body2"
                sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 28, textAlign: 'right' }}
              >
                {formatValue(value)}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default BarList;
