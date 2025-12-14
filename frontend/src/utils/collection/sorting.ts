/**
 * Collection Sorting Utilities
 *
 * Functions for sorting arrays of clinical data with type safety.
 */

export type SortDirection = 'asc' | 'desc';

/**
 * Sort array by a date field
 * @param items - Array to sort
 * @param dateField - Name of the date field
 * @param direction - Sort direction ('asc' or 'desc')
 * @returns New sorted array
 */
export const sortByDate = <T extends Record<string, unknown>>(
  items: T[],
  dateField: string,
  direction: SortDirection = 'desc'
): T[] => {
  return [...items].sort((a, b) => {
    const dateA = new Date(getNestedValue(a, dateField) as string);
    const dateB = new Date(getNestedValue(b, dateField) as string);

    if (isNaN(dateA.getTime())) return 1;
    if (isNaN(dateB.getTime())) return -1;

    return direction === 'desc'
      ? dateB.getTime() - dateA.getTime()
      : dateA.getTime() - dateB.getTime();
  });
};

/**
 * Sort array by a string field
 * @param items - Array to sort
 * @param field - Name of the field
 * @param direction - Sort direction
 * @returns New sorted array
 */
export const sortByField = <T extends Record<string, unknown>>(
  items: T[],
  field: string,
  direction: SortDirection = 'asc'
): T[] => {
  return [...items].sort((a, b) => {
    const valA = String(getNestedValue(a, field) ?? '').toLowerCase();
    const valB = String(getNestedValue(b, field) ?? '').toLowerCase();

    const comparison = valA.localeCompare(valB);
    return direction === 'desc' ? -comparison : comparison;
  });
};

/**
 * Sort array by priority
 * @param items - Array to sort
 * @param priorityField - Name of the priority field
 * @param priorityOrder - Custom priority order (highest first)
 * @returns New sorted array
 */
export const sortByPriority = <T extends Record<string, unknown>>(
  items: T[],
  priorityField: string = 'priority',
  priorityOrder: string[] = ['stat', 'asap', 'urgent', 'high', 'routine', 'normal', 'low']
): T[] => {
  return [...items].sort((a, b) => {
    const priorityA = String(getNestedValue(a, priorityField) ?? '').toLowerCase();
    const priorityB = String(getNestedValue(b, priorityField) ?? '').toLowerCase();

    const indexA = priorityOrder.indexOf(priorityA);
    const indexB = priorityOrder.indexOf(priorityB);

    // Items not in the priority order go to the end
    const orderA = indexA === -1 ? priorityOrder.length : indexA;
    const orderB = indexB === -1 ? priorityOrder.length : indexB;

    return orderA - orderB;
  });
};

/**
 * Sort by multiple fields
 * @param items - Array to sort
 * @param sortKeys - Array of { field, direction } objects
 * @returns New sorted array
 */
export const sortByMultiple = <T extends Record<string, unknown>>(
  items: T[],
  sortKeys: Array<{ field: string; direction: SortDirection }>
): T[] => {
  return [...items].sort((a, b) => {
    for (const { field, direction } of sortKeys) {
      const valA = getNestedValue(a, field);
      const valB = getNestedValue(b, field);

      let comparison = 0;

      if (valA === valB) continue;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

      if (comparison !== 0) {
        return direction === 'desc' ? -comparison : comparison;
      }
    }

    return 0;
  });
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
