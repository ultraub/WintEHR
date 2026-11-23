import { PHASES, auroraFor, auroraPalettes, modeForPhase, phaseForHour } from '../auroraPalette';

describe('phaseForHour', () => {
  it('covers every hour with one of the four phases', () => {
    const phases = Array.from({ length: 24 }, (_, hour) => phaseForHour(hour));
    expect(phases.every((phase) => PHASES.includes(phase))).toBe(true);
    expect([4, 5, 7, 8, 16, 17, 19, 20].map(phaseForHour))
      .toEqual(['night', 'sunrise', 'sunrise', 'day', 'day', 'sunset', 'sunset', 'night']);
  });
});

describe('phase palettes', () => {
  it('only daytime is a light phase', () => {
    expect(PHASES.map(modeForPhase)).toEqual(['dark', 'light', 'dark', 'dark']);
  });

  it('every phase defines every shell surface, so none falls back to another', () => {
    const keys = ['ground', 'wave', 'bar', 'onGround', 'onGroundSoft', 'onGroundMuted', 'onGroundAccent',
      'groundBorder', 'groundRaised', 'hero', 'heroBorder', 'cardShadow', 'cardBorder', 'leadShadow', 'navGradient', 'navAccent', 'scene', 'theme'];
    PHASES.forEach((phase) => {
      keys.forEach((key) => expect(auroraPalettes[phase][key], `${phase}.${key}`).toBeDefined());
      expect(auroraPalettes[phase].scene.halos).toHaveLength(5);
    });
  });

  it('falls back to night for an unknown phase', () => {
    expect(auroraFor('noon').name).toBe('night');
  });
});

describe('phase themes', () => {
  it('put every page on the phase ground', () => {
    PHASES.forEach((phase) => {
      expect(auroraPalettes[phase].theme.background.default, phase).toBe(auroraPalettes[phase].ground);
    });
  });
});
