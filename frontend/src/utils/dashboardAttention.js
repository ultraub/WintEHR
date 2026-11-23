/**
 * What on the dashboard deserves a second look, worst first.
 * Built only from figures the dashboard already loaded; an empty list means
 * nothing is below its line, and the dashboard says so.
 */

export const CARE_TARGET = 80; // percent of eligible patients

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export const buildAttentionItems = ({ careGaps, medicationSafety } = {}) => {
  const items = [];

  (careGaps?.gaps || [])
    .filter((gap) => gap.eligible > 0 && gap.percentage < CARE_TARGET)
    .sort((a, b) => a.percentage - b.percentage)
    .forEach((gap) => {
      const outstanding = Math.max(0, gap.eligible - gap.completed);
      items.push({
        id: `gap-${gap.measure}`,
        tone: gap.percentage < 50 ? 'critical' : 'attention',
        title: `${gap.measure} at ${gap.percentage}%`,
        detail: `${outstanding} of ${plural(gap.eligible, 'eligible patient')} outstanding · target ${CARE_TARGET}%`,
        to: '/care-gaps',
      });
    });

  const polypharmacy = medicationSafety?.polypharmacy?.count || 0;
  if (polypharmacy > 0) {
    const threshold = medicationSafety.polypharmacy.threshold || 5;
    items.push({
      id: 'polypharmacy',
      tone: 'attention',
      title: `${plural(polypharmacy, 'patient')} on ${threshold} or more medications`,
      detail: 'Higher risk of interactions and duplicate therapy',
      to: '/analytics',
    });
  }

  return items;
};

/** "Good morning" before noon, "Good afternoon" until 6pm, then "Good evening". */
export const greetingFor = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};
