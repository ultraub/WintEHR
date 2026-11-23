/**
 * The day in four phases. One mountain landscape, seen at sunrise, in
 * daytime, at sunset and at night, and everything in the shell shifts with
 * it: the page ground, the app bar, the navigation, the hero scene and how
 * cards are drawn.
 *
 *   sunrise  plum warming to peach; a sun just clearing the ridge
 *   day      a clear day out: warm sunlit ground and cards under a blue
 *            sky, deep-blue navigation, a shining sun, drifting clouds,
 *            snow-capped peaks over a pine ridge and a golden meadow
 *   sunset   indigo and violet under an orange sun on the horizon
 *   night    near-black navy, a moon and stars, the aurora glowing
 *
 * Day is the only light phase (MUI mode 'light'); the other three are dark.
 * `App.js` picks the phase from the clock, or the user pins one.
 *
 * Decorative only. Nothing here encodes status; status colour comes from
 * `utils/statusDisplay.js`.
 */
import { useTheme } from '@mui/material/styles';
import { shellPalette } from './shellPalette';

export const PHASES = ['sunrise', 'day', 'sunset', 'night'];
export const PHASE_LABELS = { sunrise: 'Sunrise', day: 'Daytime', sunset: 'Sunset', night: 'Night' };

/** Which phase an hour of the day (0-23) falls in. */
export const phaseForHour = (hour) => {
  if (hour >= 5 && hour < 8) return 'sunrise';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
};

/** MUI palette mode a phase renders in. */
export const modeForPhase = (phase) => (phase === 'day' ? 'light' : 'dark');

const lightOnGround = {
  onGround: shellPalette.textPrimary,
  onGroundSoft: shellPalette.textBright,
};

const sunrise = {
  name: 'sunrise',
  ground: '#4A2F55',
  wave: '#533660',
  bar: '#4A2F55',
  ...lightOnGround,
  onGroundMuted: '#F5C6D6',
  onGroundAccent: '#FDBA9A',
  groundBorder: '#6E4C7B',
  groundRaised: '#583A65',
  hero: '#2A1836',
  heroBorder: 'transparent',
  cardShadow: 'none',
  cardBorder: 'rgba(253, 186, 154, 0.22)',
  leadShadow: '#F28BA8',
  navGradient: 'linear-gradient(180deg, #1F1128 0%, #2B1837 50%, #1F1128 100%)',
  scene: {
    body: { cx: 430, cy: 246, r: 46, fill: '#FFD9A0' },
    haloScale: 1,
    halos: ['#33203F', '#4A2850', '#7A3560', '#B8506F', '#F08A6B'],
    ribbons: ['#F9A8D4', '#FDBA9A'],
    range: '#4A2850',
    ridge: '#3A2146',
    near: '#2A1836',
  },
  // overrides applied to the Standard theme for this phase
  navAccent: '#F28BA8',
  theme: {
    // every page sits on the phase's ground
    background: { default: '#4A2F55', paper: '#3A2446', surface: '#45294F' },
    divider: 'rgba(253, 186, 154, 0.18)',
    // rose for actions, peach beside it
    primary: { main: '#F7A8BC', light: '#FBCBD7', dark: '#E07A98', contrastText: '#2A1836' },
    secondary: { main: '#FDBA9A', light: '#FED7C3', dark: '#F08A6B', contrastText: '#2A1836' },
    action: { active: '#F7A8BC', hover: 'rgba(247, 168, 188, 0.08)', selected: 'rgba(247, 168, 188, 0.16)' },
  },
};

const day = {
  name: 'day',
  // warm, sunlit paper under a blue sky
  ground: '#F4EFE4',
  wave: '#EAE3D3',
  bar: '#245A9C',
  onGround: '#1B2A3F',
  onGroundSoft: '#33425A',
  onGroundMuted: '#4A5F80',
  onGroundAccent: '#1A66C2',
  groundBorder: '#D9D0BC',
  groundRaised: '#E6DFCE',
  hero: '#BFE0FA',
  heroBorder: '#A4CEF0',
  cardShadow: '0 1px 2px rgba(90, 65, 20, 0.08), 0 8px 22px rgba(90, 65, 20, 0.09)',
  cardBorder: '#E6DECB',
  // the sun's gold
  leadShadow: '#F2B632',
  navGradient: 'linear-gradient(180deg, #0F2A4D 0%, #163A69 50%, #0F2A4D 100%)',
  breeze: true,
  scene: {
    body: { cx: 462, cy: 66, r: 28, fill: '#FFD44D' },
    rays: '#FFE48A',
    haloScale: 0.42,
    // the sun warms the sky around it
    halos: ['#C9E3F6', '#D8E9F1', '#E9EFE3', '#F7F0D2', '#FFEBAE'],
    clouds: '#FFFFFF',
    // Colorado in summer: blue-violet granite peaks with snow, a pine-green
    // ridge below them, and a sunlit golden meadow in front
    range: '#8798CC',
    snow: '#FFFFFF',
    ridge: '#6E9F86',
    pines: '#3F7560',
    near: '#E3B75C',
  },
  navAccent: '#F2B632',
  theme: {
    background: { default: '#F4EFE4', paper: '#FFFDF8', surface: '#F1EBDD' },
    secondary: { main: '#C98A14', light: '#F2B632', dark: '#9A6808', contrastText: '#FFFFFF' },
    // two-series charts: the day's blue beside a warm orange (checked for
    // colour-vision separation and contrast on the card surface)
    chart: { series: ['#1A66C2', '#D9731A'] },
    divider: '#E6DECB',
    primary: { main: '#1A66C2', light: '#5B9BE3', dark: '#124A8F', contrastText: '#FFFFFF' },
    text: { primary: '#1B2A3F', secondary: '#5C6470', disabled: '#A29D92' },
    // hover and selection washes in the phase's blue, not the indigo default
    action: { active: '#1A66C2', hover: 'rgba(26, 102, 194, 0.06)', selected: 'rgba(26, 102, 194, 0.12)' },
  },
};

const sunset = {
  name: 'sunset',
  ground: '#3D2E78',
  wave: '#453580',
  bar: '#3D2E78',
  ...lightOnGround,
  onGroundMuted: '#E9D5FF',
  onGroundAccent: '#F6C76B',
  groundBorder: '#5D4DA0',
  groundRaised: '#4A3A88',
  hero: '#1D1638',
  heroBorder: 'transparent',
  cardShadow: 'none',
  cardBorder: 'rgba(246, 199, 107, 0.2)',
  leadShadow: '#F28B5B',
  navGradient: `linear-gradient(180deg, ${shellPalette.gradientTop} 0%, ${shellPalette.gradientMid} 50%, ${shellPalette.gradientBottom} 100%)`,
  scene: {
    body: { cx: 430, cy: 226, r: 48, fill: '#F6A76B' },
    haloScale: 1,
    halos: ['#241B45', '#3A2466', '#6B2F7A', '#B6477E', '#EE7B5E'],
    ribbons: ['#F9A8D4', '#FDBA74'],
    range: '#33266E',
    ridge: '#281D55',
    near: '#1D1638',
  },
  navAccent: '#F6A76B',
  theme: {
    background: { default: '#3D2E78', paper: '#2E2358', surface: '#372B66' },
    divider: 'rgba(246, 199, 107, 0.18)',
    // the sun's amber for actions, violet beside it
    primary: { main: '#F6B46B', light: '#FAD3A3', dark: '#E08A3C', contrastText: '#1D1638' },
    secondary: { main: '#C4B5FD', light: '#DDD6FE', dark: '#8B5CF6', contrastText: '#1D1638' },
    action: { active: '#F6B46B', hover: 'rgba(246, 180, 107, 0.08)', selected: 'rgba(246, 180, 107, 0.16)' },
  },
};

const night = {
  name: 'night',
  ground: '#121129',
  wave: '#17162F',
  bar: '#121129',
  ...lightOnGround,
  onGroundMuted: '#A5B4FC',
  onGroundAccent: '#7DE3CF',
  groundBorder: '#2B2A55',
  groundRaised: '#1D1C3D',
  hero: '#0B0A1E',
  heroBorder: '#2B2A55',
  // shadows do not show on a near-black ground: an outline instead
  cardShadow: 'none',
  cardBorder: 'rgba(165, 180, 252, 0.16)',
  leadShadow: '#5ED6BF',
  navGradient: 'linear-gradient(180deg, #08071A 0%, #0C0B21 50%, #08071A 100%)',
  scene: {
    body: { cx: 430, cy: 120, r: 30, fill: '#F1F0FA' },
    moonShade: '#C9C7E6',
    star: '#F1F0FA',
    haloScale: 0.62,
    halos: ['#0E0D25', '#12112E', '#171639', '#1D1C46', '#262557'],
    ribbons: ['#5EF0D2', '#A5B4FC'],
    glow: true,
    range: '#1B1A40',
    ridge: '#151433',
    near: '#0B0A1E',
  },
  navAccent: shellPalette.accent,
  // the dark theme as it is, on the night ground
  theme: {
    background: { default: '#121129' },
  },
};

export const auroraPalettes = { sunrise, day, sunset, night };

export const auroraFor = (phase) => auroraPalettes[phase] || night;

/**
 * The palette for the surrounding theme's phase. Do not call it inside the
 * app bar: the bar renders under its own dark theme with no phase.
 */
export const useAuroraPalette = () => {
  const theme = useTheme();
  return auroraFor(theme.phase || (theme.palette.mode === 'dark' ? 'night' : 'day'));
};

// Pastel fills for initials avatars, picked by hashing the name so one
// person keeps one colour everywhere. Dark text sits on all of them.
export const avatarFills = ['#C7D2FE', '#BFEDE4', '#F9D9BC', '#F6C5CC', '#DDD0FA', '#C9E4F8', '#E3EDBE'];
export const avatarInk = '#1C1917';
