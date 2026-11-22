/**
 * MetricCard
 * Kept for its existing call sites; it now draws through the shared StatTile
 * (components/common/StatTile.jsx). New code should use StatTile directly.
 *
 * `color` and `severity` only tint the tile for error/warning-level values,
 * and only when the value is non-zero. `variant`, `clinicalContext`,
 * `department`, `urgency`, `onMenuClick`, `showInfo` and `infoTooltip` from
 * the previous implementation are accepted and ignored.
 */
import React from 'react';
import StatTile from '../../../common/StatTile';

const TONE = {
  error: 'critical', critical: 'critical', high: 'critical', severe: 'critical',
  warning: 'attention', moderate: 'attention',
};
const TREND_WORD = { up: 'up', down: 'down', flat: 'no change' };

const MetricCard = ({
  title,
  value,
  unit,
  trend,
  trendValue,
  icon,
  color = 'primary',
  loading = false,
  subtitle,
  onClick,
  severity,
  sx,
}) => {
  // Only a named direction with a real figure is a trend worth printing.
  const trendText = TREND_WORD[trend] && trendValue !== undefined && trendValue !== null
    ? `${trendValue > 0 ? '+' : ''}${trendValue}${unit ? ` ${unit}` : ''} ${TREND_WORD[trend]}`
    : null;
  const caption = [subtitle, trendText].filter(Boolean).join(' · ') || null;

  return (
    <StatTile
      label={title}
      value={value}
      unit={unit}
      icon={icon}
      tone={TONE[severity] || TONE[color] || 'neutral'}
      caption={caption}
      loading={loading}
      onClick={onClick}
      sx={sx}
    />
  );
};

export default MetricCard;
