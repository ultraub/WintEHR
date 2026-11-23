/**
 * What on the dashboard deserves a second look, worst first, and the one
 * sentence that sums it up. Built only from figures the dashboard already
 * loaded; an empty list means nothing is off, and the dashboard says so.
 */

export const CARE_TARGET = 80; // percent of eligible patients
export const FAR_BELOW = 50; // under this a measure is listed, not just drawn
export const FREQUENT_VISITS = 3; // encounters in the recent window

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Patients with several encounters in the recent window.
 * @param encounters [{ patientId, patientName, date, classCode }]
 * @returns [{ patientId, name, visits, spanDays, emergency }] most visits first
 */
export const findFrequentVisitors = (encounters = [], minVisits = FREQUENT_VISITS) => {
  const byPatient = new Map();
  encounters.forEach((encounter) => {
    if (!encounter.patientId) return;
    const entry = byPatient.get(encounter.patientId)
      || { patientId: encounter.patientId, name: encounter.patientName, visits: 0, emergency: 0, times: [] };
    entry.visits += 1;
    if (encounter.classCode === 'EMER') entry.emergency += 1;
    const time = encounter.date ? new Date(encounter.date).getTime() : NaN;
    if (!Number.isNaN(time)) entry.times.push(time);
    byPatient.set(encounter.patientId, entry);
  });
  return [...byPatient.values()]
    .filter((entry) => entry.visits >= minVisits)
    .map(({ times, ...entry }) => ({
      ...entry,
      spanDays: times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / DAY_MS) + 1 : 1,
    }))
    .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
};

export const buildAttentionItems = ({ careGaps, medicationSafety, recentEncounters } = {}) => {
  const items = [];

  (careGaps?.gaps || [])
    .filter((gap) => gap.eligible > 0 && gap.percentage < FAR_BELOW)
    .sort((a, b) => a.percentage - b.percentage)
    .forEach((gap) => {
      const outstanding = Math.max(0, gap.eligible - gap.completed);
      items.push({
        id: `gap-${gap.measure}`,
        tone: 'critical',
        badge: `${gap.percentage}%`,
        title: `${gap.measure} at ${gap.percentage}%`,
        detail: `${outstanding} of ${plural(gap.eligible, 'eligible patient')} outstanding`,
        to: '/care-gaps',
      });
    });

  findFrequentVisitors(recentEncounters?.encounters).forEach((visitor) => {
    const emergency = visitor.emergency > 0
      ? `, including ${plural(visitor.emergency, 'emergency admission')}`
      : '';
    items.push({
      id: `visits-${visitor.patientId}`,
      tone: 'attention',
      badge: `${visitor.visits}×`,
      title: visitor.name,
      detail: `${visitor.visits} visits in ${plural(visitor.spanDays, 'day')}${emergency}`,
      to: `/patients/${encodeURIComponent(visitor.patientId)}`,
    });
  });

  const polypharmacy = medicationSafety?.polypharmacy?.count || 0;
  if (polypharmacy > 0) {
    const threshold = medicationSafety.polypharmacy.threshold || 5;
    items.push({
      id: 'polypharmacy',
      tone: 'attention',
      badge: String(polypharmacy),
      title: `${plural(polypharmacy, 'patient')} on ${threshold} or more medications`,
      detail: 'Higher risk of interactions and duplicate therapy',
      to: '/analytics',
    });
  }

  return items;
};

/** One sentence for the top of the dashboard, from the same inputs. */
export const describeToday = ({ careGaps, recentEncounters } = {}) => {
  const measured = (careGaps?.gaps || []).filter((gap) => gap.eligible > 0);
  const below = measured.filter((gap) => gap.percentage < CARE_TARGET).length;
  const visitors = findFrequentVisitors(recentEncounters?.encounters);
  const parts = [];

  if (below > 0) {
    parts.push(`${plural(below, 'care measure')} ${below === 1 ? 'is' : 'are'} below target`);
  }
  if (visitors.length === 1) {
    parts.push(`1 patient has been seen ${visitors[0].visits} times in ${plural(visitors[0].spanDays, 'day')}`);
  } else if (visitors.length > 1) {
    parts.push(`${visitors.length} patients have each been seen ${FREQUENT_VISITS} or more times recently`);
  }

  if (parts.length === 0) {
    return measured.length > 0
      ? 'Every care measure is on target and nothing else needs attention.'
      : 'Nothing needs attention right now.';
  }
  const sentence = parts.join(', and ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
};

/** "Good morning" before noon, "Good afternoon" until 6pm, then "Good evening". */
export const greetingFor = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};
