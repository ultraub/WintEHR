# Themes

What is actually in this directory and how colour reaches the screen. The
conventions for using it are in `frontend/CLAUDE.md`; this file only describes
the theme code.

## Files

| File | What it holds |
|---|---|
| `medicalTheme.js` | The only `createTheme` call. `createMedicalTheme(name, mode)` builds the MUI theme; `themePresets` lists the themes a user can pick; `resolveThemeName` maps a stored name to an offered one. |
| `shellPalette.js` | Colours of the dark navigation shell (`LayoutV3`). |
| `categoricalAccents.js` | One accent hue per clinical domain / module, used for navigation and tab icons. |
| `chartColors.js` | Colour sets for the recharts-based charts. |
| `clinicalTheme.js`, `clinicalThemeUtils.js` | Older token and helper sets still imported by some components. |

## The aurora ground

`auroraPalette.js` holds the deep page ground, the colours for text set
directly on it, the hero illustration's colours and the avatar fills, for
four phases of the day: sunrise, daytime, sunset and night. Each phase also
carries the overrides it applies to the Standard theme (`theme` key). Read
it through `useAuroraPalette()`; `createMedicalTheme(name, mode, phase)`
applies the overrides. It is decoration built on `shellPalette.js`; it never
carries status. See "The
deep ground" in `frontend/CLAUDE.md` for when a page may use it.

## Themes offered

Two, each in light and dark mode: **Standard** (`professional`) and
**High contrast** (`accessible`). The choice is stored in `localStorage`
(`medicalTheme`, `medicalMode`) and applied in `App.js`. A stored name that is
no longer offered resolves to Standard.

Adding a theme means every screen has to be checked in it, in both modes.
Do not add one to `themePresets` without taking that on.

## Where a colour should come from

1. **Status** (active, stopped, failed…): never choose a colour at the call
   site. `utils/statusDisplay.js` maps status → tone → colour, and
   `StatusChip` / `StatTile` draw it.
2. **Everything else**: the MUI palette (`theme.palette.*`,
   `'text.secondary'`, `'divider'`, `'action.hover'`).
3. **Chart series**: `theme.palette.chart.series` holds two categorical
   colours per palette (used by `PopulationPyramid`). Each pair was checked
   for colour-vision separation and 3:1 contrast against the paper surface;
   re-check before changing one. A single-series chart uses `primary.main`.
4. **A hex literal** belongs only in this directory.
   `npm run lint:design` counts hex literals elsewhere and fails when the
   count rises.

## Known gaps

- `clinicalThemeUtils.js` has helpers that read `theme.clinical.*`, which
  `createMedicalTheme` does not populate (its clinical tokens live under
  `theme.palette.clinical`). Those helpers return their hardcoded fallbacks.
  Prefer the palette and `statusDisplay` over them.
- Contrast ratios have not been measured for either theme.
- About 500 hex literals remain outside this directory (the ratchet's
  baseline, `frontend/scripts/design-ratchet.json`).
