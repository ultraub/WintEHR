/**
 * Collection Filtering Utilities
 *
 * Functions for filtering arrays of clinical data with type safety.
 */

/**
 * Filter items by a search term across multiple fields
 * @param items - Array to filter
 * @param searchTerm - Search term
 * @param searchFields - Array of field names to search in (supports dot notation)
 * @returns Filtered array
 */
export const filterBySearch = <T extends Record<string, unknown>>(
  items: T[],
  searchTerm: string | null | undefined,
  searchFields: string[]
): T[] => {
  if (!searchTerm) return items;

  const lowerSearch = searchTerm.toLowerCase();

  return items.filter(item =>
    searchFields.some(field => {
      const value = getNestedValue(item, field);
      return value?.toString().toLowerCase().includes(lowerSearch);
    })
  );
};

/**
 * Filter items by date range
 * @param items - Array to filter
 * @param dateField - Name of the date field
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Filtered array
 */
export const filterByDateRange = <T extends Record<string, unknown>>(
  items: T[],
  dateField: string,
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): T[] => {
  if (!startDate && !endDate) return items;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  return items.filter(item => {
    const itemDate = new Date(getNestedValue(item, dateField) as string);
    if (isNaN(itemDate.getTime())) return false;

    if (start && itemDate < start) return false;
    if (end && itemDate > end) return false;

    return true;
  });
};

/**
 * Filter items by a specific field value
 * @param items - Array to filter
 * @param field - Field name to check
 * @param value - Value to match
 * @returns Filtered array
 */
export const filterByField = <T extends Record<string, unknown>>(
  items: T[],
  field: string,
  value: unknown
): T[] => {
  return items.filter(item => {
    const itemValue = getNestedValue(item, field);
    return itemValue === value;
  });
};

/**
 * Filter items by status
 * @param items - Array to filter
 * @param statusField - Name of the status field
 * @param allowedStatuses - Array of allowed status values
 * @returns Filtered array
 */
export const filterByStatus = <T extends Record<string, unknown>>(
  items: T[],
  statusField: string = 'status',
  allowedStatuses: string[]
): T[] => {
  const lowerStatuses = allowedStatuses.map(s => s.toLowerCase());

  return items.filter(item => {
    const status = String(getNestedValue(item, statusField) ?? '').toLowerCase();
    return lowerStatuses.includes(status);
  });
};

/**
 * Filter to only active items (common clinical pattern)
 * @param items - Array to filter
 * @param statusField - Name of the status field
 * @returns Filtered array with only active items
 */
export const filterActive = <T extends Record<string, unknown>>(
  items: T[],
  statusField: string = 'status'
): T[] => {
  return filterByStatus(items, statusField, ['active', 'in-progress', 'current']);
};

/**
 * Filter items by multiple criteria
 * @param items - Array to filter
 * @param filters - Object mapping field names to values
 * @returns Filtered array
 */
export const filterByMultiple = <T extends Record<string, unknown>>(
  items: T[],
  filters: Record<string, unknown>
): T[] => {
  return items.filter(item =>
    Object.entries(filters).every(([field, value]) => {
      if (value === null || value === undefined) return true;
      const itemValue = getNestedValue(item, field);
      return itemValue === value;
    })
  );
};

/**
 * Helper to get nested object value using dot notation
 */
const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  return path.split('.').reduce<unknown>(
    (current, key) => (current as Record<string, unknown>)?.[key],
    obj
  );
};
