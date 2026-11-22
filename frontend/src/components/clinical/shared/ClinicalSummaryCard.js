/**
 * ClinicalSummaryCard
 * Kept for its existing call sites; it now draws through the shared StatTile
 * (components/common/StatTile.jsx) so every headline number in the app looks
 * the same. New code should use StatTile directly.
 *
 * What changed from the old card: `severity` only colours the tile when the
 * value is non-zero, `accentColor` is ignored (colour is not a per-call-site
 * decision any more), and a `trend` with no value or label draws nothing —
 * a bare arrow claimed a trend the data did not have.
 */
import React from 'react';
import StatTile from '../../common/StatTile';

const SEVERITY_TONE = { critical: 'critical', high: 'critical', moderate: 'attention' };
const CHIP_TONE = { error: 'critical', warning: 'attention', success: 'positive', info: 'info', primary: 'info' };

const ClinicalSummaryCard = ({
  title,
  value,
  unit,
  icon,
  severity = 'normal',
  chips = [],
  trend,
  progress,
  progressLabel,
  onClick,
  accentColor: _accentColor,
  sx,
}) => {
  const trendText = trend && (trend.value || trend.label)
    ? [trend.value, trend.label].filter(Boolean).join(' ')
    : null;

  return (
    <StatTile
      label={title}
      value={value}
      unit={unit}
      icon={icon}
      tone={SEVERITY_TONE[severity] || 'neutral'}
      caption={trendText}
      chips={chips.map((chip) => ({ label: chip.label, count: chip.count, tone: CHIP_TONE[chip.color] || 'muted' }))}
      progress={progress}
      progressLabel={progressLabel}
      onClick={onClick}
      sx={sx}
    />
  );
};

export default ClinicalSummaryCard;
