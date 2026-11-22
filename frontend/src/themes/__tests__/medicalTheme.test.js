import { createMedicalTheme, themePresets, resolveThemeName, DEFAULT_THEME } from '../medicalTheme';

describe('medical theme', () => {
  test('two themes are offered', () => {
    expect(Object.keys(themePresets)).toEqual(['professional', 'accessible']);
  });

  test('a retired or unknown stored theme resolves to the default', () => {
    expect(resolveThemeName('ocean')).toBe(DEFAULT_THEME);
    expect(resolveThemeName(null)).toBe(DEFAULT_THEME);
    expect(resolveThemeName('accessible')).toBe('accessible');
  });

  test('every offered theme builds in both modes', () => {
    for (const name of Object.keys(themePresets)) {
      for (const mode of ['light', 'dark']) {
        const theme = createMedicalTheme(name, mode);
        expect(theme.palette.mode).toBe(mode);
        expect(theme.palette.primary.main).toMatch(/^#/);
      }
    }
  });

  test('a retired theme name builds as Standard', () => {
    expect(createMedicalTheme('ocean', 'light').palette.primary.main)
      .toBe(createMedicalTheme('professional', 'light').palette.primary.main);
  });

  test('high-contrast dark does not leak into standard dark', () => {
    const before = createMedicalTheme('professional', 'dark').palette.primary.main;
    const highContrast = createMedicalTheme('accessible', 'dark').palette.primary.main;
    const after = createMedicalTheme('professional', 'dark').palette.primary.main;
    expect(highContrast).not.toBe(before);
    expect(after).toBe(before);
  });
});
