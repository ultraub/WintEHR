/**
 * AuroraHero
 * The panel that opens a page on the deep ground: a short line of context,
 * a title (with an optional highlighted second line) and one sentence saying
 * what matters, beside an illustration.
 *
 * The illustration is one mountain landscape in four states
 * (themes/auroraPalette): a sun clearing the ridge at sunrise; a shining sun
 * and drifting clouds over green slopes in daytime; an orange sun on the
 * horizon at sunset; a moon, stars and a glowing aurora at night. All four
 * are always drawn and cross-fade when the phase changes, so the switch
 * reads as the sky changing over the same place.
 *
 * It is decoration: hidden from assistive technology, kept to the trailing
 * side, with nothing laid over it. Its motion (ribbons and clouds drifting,
 * the sun's rays turning) is slow and stops under prefers-reduced-motion.
 *
 * Props: `eyebrow`, `title`, `highlight` (second line of the title),
 * `summary`, `actions` (node under the summary).
 */
import React from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@mui/system';
import { PHASES, auroraPalettes, useAuroraPalette } from '../../themes/auroraPalette';

const drift = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;
const breeze = keyframes`
  0% { transform: translateX(40px); }
  100% { transform: translateX(-60px); }
`;
const turn = keyframes`
  to { transform: rotate(360deg); }
`;

const still = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };
const ribbonSx = (delay) => ({ animation: `${drift} 11s ease-in-out infinite`, animationDelay: delay, ...still });
const cloudSx = (seconds, delay) => ({
  animation: `${breeze} ${seconds}s ease-in-out infinite alternate`,
  animationDelay: delay,
  ...still,
});

const fadeSx = (visible) => ({
  opacity: visible ? 1 : 0,
  transition: 'opacity 700ms ease',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});

const RADII = [250, 205, 162, 120, 82];
const RIBBON_NEAR = 'M150 138 C 230 78, 330 146, 420 100 S 540 62, 620 106 L620 132 C 540 94, 480 142, 420 132 S 250 112, 150 138 Z';
const RIBBON_FAR = 'M196 176 C 286 126, 370 184, 450 146 S 560 120, 620 150 L620 168 C 560 144, 500 176, 450 170 S 290 156, 196 176 Z';
// The same ridgelines in every phase: a far range with three peaks, a
// nearer ridge, and the slope in front.
const RANGE = 'M150 270 L236 186 L262 208 L330 138 L384 200 L420 174 L470 222 L540 150 L620 214 L620 270 Z';
const SNOW = [
  'M330 138 L306 163 L318 158 L326 170 L334 157 L344 168 L352 160 Z',
  'M540 150 L518 174 L530 168 L538 180 L546 166 L556 174 L562 168 Z',
  'M236 186 L221 201 L231 198 L238 206 L245 198 L251 201 Z',
  'M420 174 L409 185 L418 183 L423 190 L430 184 Z',
];
const RIDGE = 'M70 270 C 170 214, 250 250, 340 222 S 500 196, 620 232 L620 270 Z';
const NEAR = 'M20 270 C 150 240, 250 268, 360 248 S 520 232, 620 256 L620 270 Z';
// Pines standing along the ridge: [x, y of the base, height]
const PINES = [[318, 229, 13], [336, 224, 17], [352, 221, 12], [398, 213, 16], [414, 210, 12], [452, 207, 18], [468, 206, 13], [512, 209, 15], [548, 216, 17], [566, 220, 12], [592, 227, 15]];
const CLOUD = 'M0 14 a10 10 0 0 1 12 -9 a14 14 0 0 1 26 -2 a11 11 0 0 1 20 5 a8 8 0 0 1 4 15 H4 a7 7 0 0 1 -4 -9 Z';
const STARS = [[206, 40, 1.6], [262, 96, 1.1], [318, 30, 1.3], [352, 74, 1], [520, 28, 1.5], [566, 70, 1.1], [596, 22, 1.2], [470, 56, 1], [236, 150, 1], [300, 120, 1.2]];
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** One state of the sky and the land under it. */
const Scene = ({ palette, visible }) => {
  const { scene } = palette;
  const { cx, cy, r, fill } = scene.body;
  return (
    <Box component="g" sx={fadeSx(visible)}>
      {RADII.map((radius, index) => (
        <circle key={radius} cx={cx} cy={cy} r={radius * scene.haloScale} fill={scene.halos[index]} />
      ))}
      {scene.star && STARS.map(([x, y, size]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={size} fill={scene.star} />)}
      {scene.rays && (
        <Box
          component="g"
          sx={{ transformOrigin: `${cx}px ${cy}px`, animation: `${turn} 80s linear infinite`, ...still }}
          stroke={scene.rays}
          strokeWidth="4"
          strokeLinecap="round"
        >
          {RAY_ANGLES.map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={cx + Math.cos(rad) * (r + 9)}
                y1={cy + Math.sin(rad) * (r + 9)}
                x2={cx + Math.cos(rad) * (r + 22)}
                y2={cy + Math.sin(rad) * (r + 22)}
              />
            );
          })}
        </Box>
      )}
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      {scene.moonShade && (
        <>
          <circle cx={cx - 10} cy={cy - 8} r="6" fill={scene.moonShade} />
          <circle cx={cx + 10} cy={cy + 8} r="4" fill={scene.moonShade} />
          <circle cx={cx + 6} cy={cy - 14} r="2.5" fill={scene.moonShade} />
        </>
      )}
      {scene.ribbons && scene.glow && (
        <>
          <path d={RIBBON_NEAR} fill={scene.ribbons[0]} opacity="0.35" filter="url(#aurora-hero-glow)" />
          <path d={RIBBON_FAR} fill={scene.ribbons[1]} opacity="0.3" filter="url(#aurora-hero-glow)" />
        </>
      )}
      {scene.ribbons && (
        <>
          <Box component="path" sx={ribbonSx('0s')} d={RIBBON_NEAR} fill={scene.ribbons[0]} opacity={scene.glow ? 1 : 0.85} />
          <Box component="path" sx={ribbonSx('-4s')} d={RIBBON_FAR} fill={scene.ribbons[1]} opacity={scene.glow ? 1 : 0.8} />
        </>
      )}
      {scene.clouds && (
        <>
          {/* clouds carried on a breeze, each at its own pace */}
          <Box component="g" sx={cloudSx(26, '0s')}>
            <path d={CLOUD} fill={scene.clouds} transform="translate(250 54) scale(1.5)" />
          </Box>
          <Box component="g" sx={cloudSx(34, '-9s')}>
            <path d={CLOUD} fill={scene.clouds} transform="translate(360 104) scale(1.05)" opacity="0.9" />
          </Box>
          <Box component="g" sx={cloudSx(42, '-20s')}>
            <path d={CLOUD} fill={scene.clouds} transform="translate(520 30) scale(0.8)" opacity="0.85" />
          </Box>
        </>
      )}
      <path d={RANGE} fill={scene.range} />
      {scene.snow && SNOW.map((cap) => <path key={cap} d={cap} fill={scene.snow} />)}
      <path d={RIDGE} fill={scene.ridge} />
      {scene.pines && PINES.map(([x, y, height]) => (
        <path
          key={x}
          d={`M${x - height * 0.36} ${y + 3} L${x} ${y - height} L${x + height * 0.36} ${y + 3} Z`}
          fill={scene.pines}
        />
      ))}
      <path d={NEAR} fill={scene.near} />
    </Box>
  );
};

const AuroraHero = ({ eyebrow, title, highlight, summary, actions, sx }) => {
  const palette = useAuroraPalette();
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2.5,
        backgroundColor: palette.hero,
        border: '1px solid',
        borderColor: palette.heroBorder,
        minHeight: { xs: 0, md: 250 },
        display: 'flex',
        alignItems: 'stretch',
        ...sx,
      }}
    >
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, display: { xs: 'none', sm: 'block' } }}>
        {/* Drawn at its own proportions against the trailing edge, so the
            scene keeps its shape at any panel width. The gradient inside the
            drawing fades its leading side into the panel. */}
        <Box
          component="svg"
          viewBox="0 0 600 270"
          preserveAspectRatio="xMaxYMid slice"
          sx={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 'auto', aspectRatio: '600 / 270', maxWidth: '62%' }}
        >
          <defs>
            <linearGradient id="aurora-hero-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={palette.hero} />
              <stop offset="1" stopColor={palette.hero} stopOpacity="0" />
            </linearGradient>
            <filter id="aurora-hero-glow" x="-20%" y="-120%" width="140%" height="340%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          {PHASES.map((name) => (
            <Scene key={name} palette={auroraPalettes[name]} visible={palette.name === name} />
          ))}
          <rect x="0" y="0" width="260" height="270" fill="url(#aurora-hero-fade)" />
        </Box>
      </Box>

      <Box sx={{ position: 'relative', flex: '1 1 auto', minWidth: 0, maxWidth: 640, p: { xs: 2.5, md: 4 } }}>
        {eyebrow && (
          <Typography variant="body2" sx={{ color: palette.onGroundMuted, fontWeight: 500 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography
          component="h1"
          sx={{
            mt: 1,
            fontFamily: '"Bricolage Grotesque", Inter, sans-serif',
            fontWeight: 700,
            fontSize: { xs: '2rem', md: '2.875rem' },
            lineHeight: 1.04,
            letterSpacing: '-0.03em',
            color: palette.onGround,
          }}
        >
          {title}
          {highlight && (
            <Box component="span" sx={{ display: 'block', color: palette.onGroundAccent }}>
              {highlight}
            </Box>
          )}
        </Typography>
        {summary && (
          <Typography sx={{ mt: 1.75, fontSize: '1rem', color: palette.onGroundSoft, maxWidth: 460 }}>
            {summary}
          </Typography>
        )}
        {actions && <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>{actions}</Box>}
      </Box>
    </Box>
  );
};

export default AuroraHero;
