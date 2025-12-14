/**
 * Date Format Utilities Tests
 *
 * Tests for standardized clinical date formatting
 * @since 2025-11-26
 */

import {
  parseFhirDate,
  formatClinicalDate,
  formatRelativeDate,
  formatPeriod,
  formatSmartDateTime,
  getAgeDisplay,
  compareFhirDatesDescending,
  compareFhirDatesAscending,
  isFhirDateInPast,
  isFhirDateInFuture,
  getMostRecentDate,
  DATE_PRESETS
} from '../dateFormatUtils';

describe('Date Format Utilities', () => {
  describe('parseFhirDate', () => {
    test('should parse full ISO datetime', () => {
      const result = parseFhirDate('2025-01-15T14:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });

    test('should parse date only', () => {
      const result = parseFhirDate('2025-01-15');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
    });

    test('should parse year-month partial date', () => {
      const result = parseFhirDate('2025-01');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0);
    });

    test('should parse year only', () => {
      const result = parseFhirDate('2025');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
    });

    test('should return null for null/undefined', () => {
      expect(parseFhirDate(null)).toBeNull();
      expect(parseFhirDate(undefined)).toBeNull();
      expect(parseFhirDate('')).toBeNull();
    });

    test('should handle Date object input', () => {
      const date = new Date('2025-01-15');
      const result = parseFhirDate(date);
      expect(result).toBeInstanceOf(Date);
    });

    test('should return null for invalid date strings', () => {
      expect(parseFhirDate('not-a-date')).toBeNull();
      expect(parseFhirDate('2025-99-99')).toBeNull();
    });
  });

  describe('formatClinicalDate', () => {
    test('should format with standard preset', () => {
      const result = formatClinicalDate('2025-01-15');
      expect(result).toBe('Jan 15, 2025');
    });

    test('should format with withTime preset', () => {
      const result = formatClinicalDate('2025-01-15T14:30:00', 'withTime');
      expect(result).toMatch(/Jan 15, 2025 \d+:\d+ [AP]M/);
    });

    test('should format with short preset', () => {
      const result = formatClinicalDate('2025-01-15', 'short');
      expect(result).toBe('01/15/2025');
    });

    test('should format with verbose preset', () => {
      const result = formatClinicalDate('2025-01-15', 'verbose');
      expect(result).toBe('January 15, 2025');
    });

    test('should return default value for null', () => {
      expect(formatClinicalDate(null)).toBe('');
      expect(formatClinicalDate(null, 'standard', 'N/A')).toBe('N/A');
    });

    test('should handle relative preset', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatClinicalDate(yesterday.toISOString(), 'relative');
      expect(result).toMatch(/day|hour|ago/i);
    });
  });

  describe('formatPeriod', () => {
    test('should format period with start and end', () => {
      const period = {
        start: '2024-01-01',
        end: '2025-01-01'
      };
      const result = formatPeriod(period);
      expect(result).toBe('Jan 1, 2024 - Jan 1, 2025');
    });

    test('should format period with only start', () => {
      const period = { start: '2024-01-01' };
      const result = formatPeriod(period);
      expect(result).toBe('Jan 1, 2024 - Present');
    });

    test('should use custom separator', () => {
      const period = { start: '2024-01-01', end: '2025-01-01' };
      const result = formatPeriod(period, 'standard', ' to ');
      expect(result).toBe('Jan 1, 2024 to Jan 1, 2025');
    });

    test('should return empty for null period', () => {
      expect(formatPeriod(null)).toBe('');
    });
  });

  describe('formatSmartDateTime', () => {
    test('should include time for recent dates with meaningful time', () => {
      const now = new Date();
      now.setHours(14, 30, 0);
      const result = formatSmartDateTime(now.toISOString());
      expect(result).toMatch(/2:30 PM/);
    });

    test('should exclude midnight time by default', () => {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const result = formatSmartDateTime(midnight.toISOString());
      expect(result).not.toMatch(/12:00 AM/);
    });

    test('should include midnight time when forced', () => {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const result = formatSmartDateTime(midnight.toISOString(), true);
      expect(result).toMatch(/12:00 AM/);
    });
  });

  describe('getAgeDisplay', () => {
    test('should display years for adults', () => {
      const birthYear = new Date().getFullYear() - 45;
      const result = getAgeDisplay(`${birthYear}-01-15`);
      expect(result).toMatch(/45 years|44 years/);
    });

    test('should display months for infants', () => {
      const birthDate = new Date();
      birthDate.setMonth(birthDate.getMonth() - 6);
      const result = getAgeDisplay(birthDate.toISOString());
      expect(result).toMatch(/months?/);
    });

    test('should return empty for null', () => {
      expect(getAgeDisplay(null)).toBe('');
    });
  });

  describe('compareFhirDatesDescending', () => {
    test('should sort dates newest first', () => {
      const dates = ['2024-01-01', '2025-01-01', '2023-01-01'];
      dates.sort(compareFhirDatesDescending);
      expect(dates[0]).toBe('2025-01-01');
      expect(dates[2]).toBe('2023-01-01');
    });

    test('should handle null dates', () => {
      const dates = ['2024-01-01', null, '2025-01-01'];
      dates.sort(compareFhirDatesDescending);
      expect(dates[0]).toBe('2025-01-01');
      expect(dates[2]).toBeNull();
    });
  });

  describe('compareFhirDatesAscending', () => {
    test('should sort dates oldest first', () => {
      const dates = ['2024-01-01', '2025-01-01', '2023-01-01'];
      dates.sort(compareFhirDatesAscending);
      expect(dates[0]).toBe('2023-01-01');
      expect(dates[2]).toBe('2025-01-01');
    });
  });

  describe('isFhirDateInPast', () => {
    test('should return true for past dates', () => {
      expect(isFhirDateInPast('2020-01-01')).toBe(true);
    });

    test('should return false for future dates', () => {
      expect(isFhirDateInPast('2099-01-01')).toBe(false);
    });

    test('should return false for null', () => {
      expect(isFhirDateInPast(null)).toBe(false);
    });
  });

  describe('isFhirDateInFuture', () => {
    test('should return true for future dates', () => {
      expect(isFhirDateInFuture('2099-01-01')).toBe(true);
    });

    test('should return false for past dates', () => {
      expect(isFhirDateInFuture('2020-01-01')).toBe(false);
    });

    test('should return false for null', () => {
      expect(isFhirDateInFuture(null)).toBe(false);
    });
  });

  describe('getMostRecentDate', () => {
    test('should return most recent date', () => {
      const dates = ['2024-01-01', '2025-06-15', '2023-12-31'];
      expect(getMostRecentDate(dates)).toBe('2025-06-15');
    });

    test('should return null for empty array', () => {
      expect(getMostRecentDate([])).toBeNull();
      expect(getMostRecentDate(null)).toBeNull();
    });

    test('should filter out invalid dates', () => {
      const dates = ['2024-01-01', 'invalid', '2025-01-01'];
      expect(getMostRecentDate(dates)).toBe('2025-01-01');
    });
  });

  describe('DATE_PRESETS', () => {
    test('should have standard preset', () => {
      expect(DATE_PRESETS.standard).toBe('MMM d, yyyy');
    });

    test('should have withTime preset', () => {
      expect(DATE_PRESETS.withTime).toBe('MMM d, yyyy h:mm a');
    });

    test('should have short preset', () => {
      expect(DATE_PRESETS.short).toBe('MM/dd/yyyy');
    });
  });
});
