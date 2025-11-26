/**
 * Date Utilities - Barrel Export
 *
 * Centralized exports for all date-related utilities including
 * formatters and calculations.
 */

export {
  formatClinicalDate,
  formatRelativeDate,
  formatDateTime,
  formatTime,
  type DateFormatType,
} from './formatters';

export {
  calculateAge,
  daysBetween,
  isDateInRange,
  isToday,
  startOfDay,
  endOfDay,
  addDays,
} from './calculations';
