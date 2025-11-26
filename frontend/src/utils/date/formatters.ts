/**
 * Date Formatting Utilities
 *
 * Centralized date formatting functions for clinical displays.
 * Provides consistent date formatting across the application.
 */

export type DateFormatType = 'short' | 'long' | 'relative' | 'iso' | 'time';

/**
 * Format date for clinical display
 * @param date - The date to format (string or Date)
 * @param format - Format type ('short', 'long', 'relative', 'iso', 'time')
 * @returns Formatted date string
 */
export const formatClinicalDate = (
  date: string | Date | null | undefined,
  format: DateFormatType = 'short'
): string => {
  if (!date) return 'Unknown';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid date';

  const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    iso: { year: 'numeric', month: '2-digit', day: '2-digit' },
    time: { hour: '2-digit', minute: '2-digit', second: '2-digit' }
  };

  if (format === 'relative') {
    return formatRelativeDate(dateObj);
  }

  return dateObj.toLocaleDateString('en-US', formatOptions[format] || formatOptions.short);
};

/**
 * Format date as relative time (e.g., "2 days ago")
 * @param date - The date to format
 * @returns Relative time string
 */
export const formatRelativeDate = (date: Date): string => {
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(Math.abs(diffTime) / (1000 * 60 * 60 * 24));
  const isFuture = diffTime < 0;

  if (diffDays === 0) {
    const diffHours = Math.floor(Math.abs(diffTime) / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(Math.abs(diffTime) / (1000 * 60));
      if (diffMinutes === 0) return 'Just now';
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ${isFuture ? 'from now' : 'ago'}`;
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ${isFuture ? 'from now' : 'ago'}`;
  }

  if (diffDays === 1) return isFuture ? 'Tomorrow' : 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ${isFuture ? 'from now' : 'ago'}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ${isFuture ? 'from now' : 'ago'}`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ${isFuture ? 'from now' : 'ago'}`;

  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) !== 1 ? 's' : ''} ${isFuture ? 'from now' : 'ago'}`;
};

/**
 * Format date and time for clinical displays
 * @param date - The date to format
 * @returns Formatted date-time string (e.g., "Jan 15, 2025 14:30")
 */
export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return 'Unknown';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid date';

  return dateObj.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

/**
 * Format time only
 * @param date - The date to extract time from
 * @returns Formatted time string (e.g., "14:30:00")
 */
export const formatTime = (date: string | Date | null | undefined): string => {
  if (!date) return 'Unknown';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid';

  return dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

/**
 * Alias for formatClinicalDate for backward compatibility
 * @deprecated Use formatClinicalDate instead
 * @param date - The date to format
 * @param format - Format type ('short', 'long', 'relative')
 * @returns Formatted date string
 */
export const formatDate = formatClinicalDate;
