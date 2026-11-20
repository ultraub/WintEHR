/**
 * Chart tab policy resolver (Command Center slice 7, docs/COMMAND_CENTER.md).
 *
 * Pure: takes the tab catalog (what exists in this build) and the policy
 * document from `/api/command-center/ui-policy`, returns what THIS user
 * sees. No imports from the registry, so the Command Center module can
 * use it through the SDK without a dependency cycle.
 *
 * Layers narrow or reorder the layer above them, in this order:
 *   org (whole deployment) → role → context (inpatient, surgical, …)
 * Each layer: { hidden: [ids], order: [ids], default: id|null }.
 *
 * Rules:
 *  - hidden is the union of every applicable layer's hidden list
 *  - `summary` can never be hidden (ALWAYS_VISIBLE)
 *  - the most specific layer with a non-empty `order` wins; ids it does not
 *    mention keep their catalog order after the ones it does
 *  - the most specific layer with a visible `default` wins, else the first
 *    visible tab
 *  - unknown ids are ignored and reported in `warnings`, never thrown: a
 *    typo in a policy must not blank the workspace (same stance as
 *    `insertAfter` in the registry)
 */

export const ALWAYS_VISIBLE = ['summary'];

export const EMPTY_TAB_POLICY = Object.freeze({
  org: { hidden: [], order: [], default: null },
  roles: {},
  contexts: {},
});

const layerOf = (value) => ({
  hidden: Array.isArray(value?.hidden) ? value.hidden : [],
  order: Array.isArray(value?.order) ? value.order : [],
  default: typeof value?.default === 'string' && value.default ? value.default : null,
  sections: value?.sections && typeof value.sections === 'object' ? value.sections : {},
});

/** The layers that apply to {role, context}, least to most specific. */
export const applicableLayers = (policy, { role, context } = {}) => {
  const p = policy || EMPTY_TAB_POLICY;
  const layers = [layerOf(p.org)];
  if (role && p.roles && p.roles[role]) layers.push(layerOf(p.roles[role]));
  if (context && p.contexts && p.contexts[context]) layers.push(layerOf(p.contexts[context]));
  return layers;
};

export function resolveEffectiveTabs(tabs, policy, { role, context } = {}) {
  const catalog = Array.isArray(tabs) ? tabs : [];
  const known = new Set(catalog.map((t) => t.id));
  const warnings = [];
  const hidden = new Set();
  let order = [];
  let defaultTab = null;

  for (const layer of applicableLayers(policy, { role, context })) {
    for (const id of layer.hidden) {
      if (!known.has(id)) warnings.push(`unknown tab id in hidden: ${id}`);
      else if (ALWAYS_VISIBLE.includes(id)) warnings.push(`${id} cannot be hidden; ignored`);
      else hidden.add(id);
    }
    const knownOrder = layer.order.filter((id) => {
      if (known.has(id)) return true;
      warnings.push(`unknown tab id in order: ${id}`);
      return false;
    });
    if (knownOrder.length) order = knownOrder;
    if (layer.default) {
      if (known.has(layer.default)) defaultTab = layer.default;
      else warnings.push(`unknown default tab: ${layer.default}`);
    }
  }

  const visible = catalog.filter((t) => !hidden.has(t.id));
  const byId = new Map(visible.map((t) => [t.id, t]));
  const ordered = [
    ...order.filter((id) => byId.has(id)).map((id) => byId.get(id)),
    ...visible.filter((t) => !order.includes(t.id)),
  ];

  if (!defaultTab || hidden.has(defaultTab)) {
    if (defaultTab) warnings.push(`default tab ${defaultTab} is hidden; using the first visible tab`);
    defaultTab = ordered[0]?.id ?? null;
  }

  return { tabs: ordered, hiddenIds: [...hidden], defaultTab, warnings };
}

/**
 * The sections shown on ONE tab for {role, context}: the tab's own
 * sections plus any hostable sections a layer `added`, minus `hidden`,
 * in the most specific non-empty `order`. Layer shape per tab:
 *   policy.<layer>.sections[tabId] = { hidden: [], order: [], added: [] }
 *
 * `catalog` is the section catalog (sectionRegistry.sectionCatalog() or
 * the full registry); entries need { id, host, hostable }.
 */
export function resolveEffectiveSections(tabId, catalog, policy, { role, context } = {}) {
  const all = Array.isArray(catalog) ? catalog : [];
  const byId = new Map(all.map((s) => [s.id, s]));
  const warnings = [];
  const hidden = new Set();
  const added = [];
  let order = [];

  for (const layer of applicableLayers(policy, { role, context })) {
    const spec = layer.sections?.[tabId];
    if (!spec) continue;
    for (const id of spec.added || []) {
      const s = byId.get(id);
      if (!s) warnings.push(`unknown section id in added: ${id}`);
      else if (!s.hostable && s.host !== tabId) warnings.push(`section ${id} is not hostable; ignored`);
      else if (!added.includes(id)) added.push(id);
    }
    for (const id of spec.hidden || []) {
      if (!byId.has(id)) warnings.push(`unknown section id in hidden: ${id}`);
      else hidden.add(id);
    }
    const knownOrder = (spec.order || []).filter((id) => {
      if (byId.has(id)) return true;
      warnings.push(`unknown section id in order: ${id}`);
      return false;
    });
    if (knownOrder.length) order = knownOrder;
  }

  const own = all.filter((s) => s.host === tabId);
  const candidates = [...own, ...added.filter((id) => !own.some((s) => s.id === id)).map((id) => byId.get(id))];
  const visible = candidates.filter((s) => !hidden.has(s.id));
  const visibleById = new Map(visible.map((s) => [s.id, s]));
  const ordered = [
    ...order.filter((id) => visibleById.has(id)).map((id) => visibleById.get(id)),
    ...visible.filter((s) => !order.includes(s.id)),
  ];
  return { sections: ordered, hiddenIds: [...hidden], addedIds: added, warnings };
}
