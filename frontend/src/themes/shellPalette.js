/**
 * Warm Slate shell palette — single source of truth for the dark app shell.
 *
 * The `#1A1735` gradient and its companion text/accent constants were
 * copy-pasted across `components/LayoutV3.js`,
 * `components/clinical/navigation/ClinicalSidebar.js`, and `pages/Login.js`,
 * with a 45%-vs-50% gradient-midpoint drift between LayoutV3 and Login.
 * This module owns those tokens; the three shell surfaces import from here.
 *
 * Scope: the dark shell chrome only (nav drawer, clinical sidebar, login
 * branding panel). Clinical severity tokens live in `clinicalThemeUtils.js`;
 * categorical domain accents live in `categoricalAccents.js`.
 */

export const shellPalette = {
  // Vertical gradient stops for the shell background
  gradientTop: '#1A1735',
  gradientMid: '#252244',
  gradientBottom: '#1F1D2B',

  // Text on the dark shell
  textPrimary: '#FAFAF9', // brand headings
  textBright: '#EDEAF5', // nav item labels / hover text
  textMuted: '#A9A3C0', // secondary text, section headers
  iconMuted: '#9E98BA', // resting nav icon tint

  // Indigo accent on the shell
  accent: '#6366F1',
  hoverBg: 'rgba(99, 102, 241, 0.12)', // hover wash behind shell buttons
  divider: 'rgba(255, 255, 255, 0.08)',

  // Shell scrollbar
  scrollbarThumb: '#44403C',
  scrollbarThumbHover: '#57534E',
};

/**
 * The one shell gradient. Midpoint standardized at 50% (LayoutV3 and
 * ClinicalSidebar previously used 45%, Login used 50%).
 */
export const shellGradient = `linear-gradient(180deg, ${shellPalette.gradientTop} 0%, ${shellPalette.gradientMid} 50%, ${shellPalette.gradientBottom} 100%)`;

export default shellPalette;
