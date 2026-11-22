/**
 * One vocabulary for every status shown in the app.
 *
 * A status maps to a TONE, and the tone alone decides colour. The rule the
 * mapping enforces: the normal state is quiet. "Active" is the expected state
 * of a problem, a prescription or an order, so it is never red; red is kept
 * for things that are wrong (failed, entered in error) and amber for things
 * that need a look (on hold, degraded).
 *
 * Covers the FHIR status value sets the UI shows (Condition clinical status,
 * MedicationRequest, ServiceRequest, Observation, DiagnosticReport,
 * Encounter, Appointment, Task, MedicationAdministration, CarePlan, Goal)
 * plus the Command Center's health and job states.
 */

export const STATUS_TONES = ['positive', 'info', 'attention', 'critical', 'neutral', 'muted'];

const TONE_BY_STATUS = {
  // the expected, healthy state
  positive: [
    'active', 'ok', 'healthy', 'up', 'running', 'connected', 'enabled', 'met', 'achieved',
    'booked', 'accepted', 'available', 'in-stock',
  ],
  // moving through a workflow
  info: [
    'in-progress', 'inprogress', 'arrived', 'checked-in', 'triaged', 'ready', 'received',
    'preliminary', 'partial', 'recurrence', 'relapse', 'improving', 'in-transit',
  ],
  // waiting on someone, or not yet real
  neutral: [
    'draft', 'planned', 'proposed', 'pending', 'requested', 'registered', 'scheduled',
    'queued', 'waitlist', 'not-started', 'due', 'upcoming', 'unsigned',
    'completed', 'complete', 'final', 'finished', 'fulfilled', 'resolved', 'remission',
    'administered', 'dispensed', 'succeeded', 'success', 'done', 'signed', 'discharged',
    'amended', 'corrected', 'appended',
  ],
  // needs a look
  attention: [
    'on-hold', 'onhold', 'suspended', 'degraded', 'warning', 'overdue', 'late', 'delayed',
    'not-met', 'in-error-pending-review', 'low-stock', 'expiring', 'missed', 'held',
    'sustaining', 'worsening', 'no-progress',
  ],
  // wrong
  critical: [
    'entered-in-error', 'error', 'failed', 'failure', 'rejected', 'down', 'critical',
    'disconnected', 'out-of-stock', 'expired', 'unavailable',
  ],
  // over, and not in a way that needs action
  muted: [
    'inactive', 'stopped', 'cancelled', 'canceled', 'revoked', 'ended', 'discontinued',
    'not-done', 'declined', 'noshow', 'no-show', 'refuted', 'unknown', 'disabled',
    'skipped', 'not-applicable', 'n/a', 'off',
  ],
};

const TONE_LOOKUP = Object.entries(TONE_BY_STATUS).reduce((acc, [tone, statuses]) => {
  statuses.forEach((status) => { acc[status] = tone; });
  return acc;
}, {});

const LABEL_OVERRIDES = {
  ok: 'OK',
  noshow: 'No show',
  'no-show': 'No show',
  inprogress: 'In progress',
  onhold: 'On hold',
  canceled: 'Cancelled',
  'n/a': 'N/A',
};

const normalize = (status) =>
  String(status ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-');

/** Tone for a status; anything unrecognised is 'muted', never a colour. */
export const getStatusTone = (status) => TONE_LOOKUP[normalize(status)] || 'muted';

/** "entered-in-error" → "Entered in error". Unknown values are still humanised. */
export const getStatusLabel = (status) => {
  const key = normalize(status);
  if (!key) return 'Unknown';
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const words = key.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Foreground / background / dot colours for a tone in the current theme.
 * Shared by StatusChip and StatTile so the two always agree.
 */
export const getToneColors = (theme, tone) => {
  const dark = theme.palette.mode === 'dark';
  const paletteKey = { positive: 'success', info: 'info', attention: 'warning', critical: 'error' }[tone];
  if (!paletteKey) {
    return {
      fg: tone === 'muted' ? theme.palette.text.secondary : theme.palette.text.primary,
      bg: theme.palette.action.hover,
      dot: tone === 'muted' ? theme.palette.text.disabled : theme.palette.text.secondary,
      border: theme.palette.divider,
    };
  }
  const color = theme.palette[paletteKey];
  return {
    fg: dark ? color.light : color.dark,
    bg: `color-mix(in srgb, ${color.main} ${dark ? 18 : 10}%, transparent)`,
    dot: color.main,
    border: color.main,
  };
};
