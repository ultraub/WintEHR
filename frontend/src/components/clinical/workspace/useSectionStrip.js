/**
 * useSectionStrip(tabId, defaultId) — a tab whose sections are a sub-tab
 * strip (Results, Pharmacy, Care Plan) rather than stacked panels.
 *
 * Same policy as Chart Review (`useEffectiveSections`): hidden sections
 * leave the strip, the policy's order is the strip's order, and a hostable
 * section the policy added to this tab becomes one more sub-tab whose
 * body is `HostedSectionBody`. The selected id follows the user's click;
 * if that section is not visible (hidden by policy, or not yet chosen),
 * the first visible one is active, so a strip is never left with nothing
 * selected.
 */

import { useState } from 'react';
import { useEffectiveSections } from './useEffectiveSections';

export function useSectionStrip(tabId, defaultId, options) {
  const { sections, ready } = useEffectiveSections(tabId, options);
  const [requested, select] = useState(defaultId);
  const active = sections.find((s) => s.id === requested) || sections[0] || null;
  return { sections, active, activeId: active ? active.id : null, select, ready };
}
