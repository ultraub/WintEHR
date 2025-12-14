/**
 * Status Display Utilities Tests
 *
 * Tests for standardized status color and label mapping
 * @since 2025-11-26
 */

import {
  getStatusColor,
  getStatusLabel,
  getStatusDisplay,
  getInterpretationDisplay,
  isCriticalInterpretation,
  isAbnormalInterpretation,
  getPriorityColor,
  getPriorityLabel,
  getPriorityDisplay,
  STATUS_COLORS,
  STATUS_LABELS,
  INTERPRETATION_DISPLAY
} from '../statusDisplayUtils';

describe('Status Display Utilities', () => {
  describe('getStatusColor', () => {
    test('should return success for active status', () => {
      expect(getStatusColor('active')).toBe('success');
    });

    test('should return primary for completed status', () => {
      expect(getStatusColor('completed')).toBe('primary');
    });

    test('should return error for cancelled status', () => {
      expect(getStatusColor('cancelled')).toBe('error');
    });

    test('should return warning for stopped status', () => {
      expect(getStatusColor('stopped')).toBe('warning');
    });

    test('should return warning for on-hold status', () => {
      expect(getStatusColor('on-hold')).toBe('warning');
    });

    test('should return default for unknown status', () => {
      expect(getStatusColor('unknown-status')).toBe('default');
    });

    test('should return default for null', () => {
      expect(getStatusColor(null)).toBe('default');
    });

    test('should handle case insensitivity', () => {
      expect(getStatusColor('ACTIVE')).toBe('success');
      expect(getStatusColor('Active')).toBe('success');
    });

    test('should handle resource-specific overrides', () => {
      expect(getStatusColor('resolved', 'Condition')).toBe('primary');
    });
  });

  describe('getStatusLabel', () => {
    test('should return human-readable label for active', () => {
      expect(getStatusLabel('active')).toBe('Active');
    });

    test('should return human-readable label for in-progress', () => {
      expect(getStatusLabel('in-progress')).toBe('In Progress');
    });

    test('should return human-readable label for entered-in-error', () => {
      expect(getStatusLabel('entered-in-error')).toBe('Error');
    });

    test('should convert unknown kebab-case to Title Case', () => {
      expect(getStatusLabel('some-custom-status')).toBe('Some Custom Status');
    });

    test('should return Unknown for null', () => {
      expect(getStatusLabel(null)).toBe('Unknown');
    });
  });

  describe('getStatusDisplay', () => {
    test('should return both color and label', () => {
      const result = getStatusDisplay('active');
      expect(result.color).toBe('success');
      expect(result.label).toBe('Active');
    });

    test('should accept resourceType', () => {
      const result = getStatusDisplay('resolved', 'Condition');
      expect(result.color).toBe('primary');
      expect(result.label).toBe('Resolved');
    });
  });

  describe('Interpretation Display', () => {
    describe('getInterpretationDisplay', () => {
      test('should handle H interpretation', () => {
        const result = getInterpretationDisplay('H');
        expect(result.color).toBe('error');
        expect(result.label).toBe('High');
        expect(result.severity).toBe('high');
      });

      test('should handle HH critical high', () => {
        const result = getInterpretationDisplay('HH');
        expect(result.label).toBe('Critical High');
        expect(result.severity).toBe('critical');
      });

      test('should handle HU significantly high', () => {
        const result = getInterpretationDisplay('HU');
        expect(result.label).toBe('Significantly High');
      });

      test('should handle L low', () => {
        const result = getInterpretationDisplay('L');
        expect(result.color).toBe('warning');
        expect(result.label).toBe('Low');
      });

      test('should handle LL critical low', () => {
        const result = getInterpretationDisplay('LL');
        expect(result.color).toBe('error');
        expect(result.severity).toBe('critical');
      });

      test('should handle LU significantly low', () => {
        const result = getInterpretationDisplay('LU');
        expect(result.label).toBe('Significantly Low');
      });

      test('should handle N normal', () => {
        const result = getInterpretationDisplay('N');
        expect(result.color).toBe('success');
        expect(result.label).toBe('Normal');
      });

      test('should handle POS positive', () => {
        const result = getInterpretationDisplay('POS');
        expect(result.label).toBe('Positive');
        expect(result.severity).toBe('abnormal');
      });

      test('should handle NEG negative', () => {
        const result = getInterpretationDisplay('NEG');
        expect(result.label).toBe('Negative');
        expect(result.severity).toBe('normal');
      });

      test('should handle CodeableConcept input', () => {
        const cc = { coding: [{ code: 'H', display: 'High' }] };
        const result = getInterpretationDisplay(cc);
        expect(result.label).toBe('High');
      });

      test('should use display from CodeableConcept if code unknown', () => {
        const cc = { coding: [{ code: 'CUSTOM', display: 'Custom Value' }] };
        const result = getInterpretationDisplay(cc);
        expect(result.label).toBe('Custom Value');
      });

      test('should handle text fallback', () => {
        const cc = { text: 'Some interpretation' };
        const result = getInterpretationDisplay(cc);
        expect(result.label).toBe('Some interpretation');
      });

      test('should return default for null', () => {
        const result = getInterpretationDisplay(null);
        expect(result.color).toBe('default');
        expect(result.label).toBe('');
      });

      test('should be case insensitive', () => {
        expect(getInterpretationDisplay('h').label).toBe('High');
        expect(getInterpretationDisplay('hh').label).toBe('Critical High');
      });
    });

    describe('isCriticalInterpretation', () => {
      test('should return true for HH', () => {
        expect(isCriticalInterpretation('HH')).toBe(true);
      });

      test('should return true for LL', () => {
        expect(isCriticalInterpretation('LL')).toBe(true);
      });

      test('should return true for AA', () => {
        expect(isCriticalInterpretation('AA')).toBe(true);
      });

      test('should return false for H', () => {
        expect(isCriticalInterpretation('H')).toBe(false);
      });

      test('should return false for N', () => {
        expect(isCriticalInterpretation('N')).toBe(false);
      });
    });

    describe('isAbnormalInterpretation', () => {
      test('should return true for H', () => {
        expect(isAbnormalInterpretation('H')).toBe(true);
      });

      test('should return true for L', () => {
        expect(isAbnormalInterpretation('L')).toBe(true);
      });

      test('should return true for HH', () => {
        expect(isAbnormalInterpretation('HH')).toBe(true);
      });

      test('should return true for A', () => {
        expect(isAbnormalInterpretation('A')).toBe(true);
      });

      test('should return false for N', () => {
        expect(isAbnormalInterpretation('N')).toBe(false);
      });

      test('should return false for NEG', () => {
        expect(isAbnormalInterpretation('NEG')).toBe(false);
      });
    });
  });

  describe('Priority Display', () => {
    describe('getPriorityColor', () => {
      test('should return error for stat', () => {
        expect(getPriorityColor('stat')).toBe('error');
      });

      test('should return warning for urgent', () => {
        expect(getPriorityColor('urgent')).toBe('warning');
      });

      test('should return warning for asap', () => {
        expect(getPriorityColor('asap')).toBe('warning');
      });

      test('should return default for routine', () => {
        expect(getPriorityColor('routine')).toBe('default');
      });

      test('should handle case insensitivity', () => {
        expect(getPriorityColor('STAT')).toBe('error');
      });
    });

    describe('getPriorityLabel', () => {
      test('should return STAT for stat', () => {
        expect(getPriorityLabel('stat')).toBe('STAT');
      });

      test('should return ASAP for asap', () => {
        expect(getPriorityLabel('asap')).toBe('ASAP');
      });

      test('should return Urgent for urgent', () => {
        expect(getPriorityLabel('urgent')).toBe('Urgent');
      });

      test('should return Routine for routine', () => {
        expect(getPriorityLabel('routine')).toBe('Routine');
      });

      test('should return original value for unknown', () => {
        expect(getPriorityLabel('custom')).toBe('custom');
      });

      test('should return Routine for null', () => {
        expect(getPriorityLabel(null)).toBe('Routine');
      });
    });

    describe('getPriorityDisplay', () => {
      test('should return both color and label', () => {
        const result = getPriorityDisplay('stat');
        expect(result.color).toBe('error');
        expect(result.label).toBe('STAT');
      });
    });
  });

  describe('Constants', () => {
    describe('STATUS_COLORS', () => {
      test('should have active as success', () => {
        expect(STATUS_COLORS.active).toBe('success');
      });

      test('should have completed as primary', () => {
        expect(STATUS_COLORS.completed).toBe('primary');
      });

      test('should have cancelled as error', () => {
        expect(STATUS_COLORS.cancelled).toBe('error');
      });
    });

    describe('STATUS_LABELS', () => {
      test('should have human-readable labels', () => {
        expect(STATUS_LABELS.active).toBe('Active');
        expect(STATUS_LABELS['in-progress']).toBe('In Progress');
      });
    });

    describe('INTERPRETATION_DISPLAY', () => {
      test('should have all common interpretation codes', () => {
        expect(INTERPRETATION_DISPLAY.H).toBeDefined();
        expect(INTERPRETATION_DISPLAY.L).toBeDefined();
        expect(INTERPRETATION_DISPLAY.N).toBeDefined();
        expect(INTERPRETATION_DISPLAY.HH).toBeDefined();
        expect(INTERPRETATION_DISPLAY.LL).toBeDefined();
        expect(INTERPRETATION_DISPLAY.HU).toBeDefined();
        expect(INTERPRETATION_DISPLAY.LU).toBeDefined();
      });
    });
  });
});
