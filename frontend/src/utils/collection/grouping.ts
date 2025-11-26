/**
 * Collection Grouping Utilities
 *
 * Functions for grouping arrays of clinical data by various criteria.
 */

/**
 * Group items by a field value
 * @param items - Array to group
 * @param groupField - Field name to group by (supports dot notation)
 * @returns Object with keys as group values and arrays as values
 */
export const groupByField = <T extends Record<string, unknown>>(
  items: T[],
  groupField: string
): Record<string, T[]> => {
  return items.reduce((groups, item) => {
    const key = String(getNestedValue(item, groupField) ?? 'Unknown');

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

/**
 * Group items by date (day, week, month, year)
 * @param items - Array to group
 * @param dateField - Field name containing date
 * @param groupBy - Grouping period
 * @returns Object with date keys and arrays as values
 */
export const groupByDate = <T extends Record<string, unknown>>(
  items: T[],
  dateField: string,
  groupBy: 'day' | 'week' | 'month' | 'year' = 'day'
): Record<string, T[]> => {
  return items.reduce((groups, item) => {
    const dateValue = getNestedValue(item, dateField);
    if (!dateValue) {
      const key = 'Unknown';
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    }

    const date = new Date(dateValue as string);
    if (isNaN(date.getTime())) {
      const key = 'Invalid Date';
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    }

    let key: string;
    switch (groupBy) {
      case 'year':
        key = String(date.getFullYear());
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'week': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      }
      case 'day':
      default:
        key = date.toISOString().split('T')[0];
    }

    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

/**
 * Group items by category with optional ordering
 * @param items - Array to group
 * @param categoryField - Field name containing category
 * @param categoryOrder - Optional order for categories
 * @returns Ordered array of { category, items } objects
 */
export const groupByCategory = <T extends Record<string, unknown>>(
  items: T[],
  categoryField: string,
  categoryOrder?: string[]
): Array<{ category: string; items: T[] }> => {
  const grouped = groupByField(items, categoryField);

  const categories = categoryOrder
    ? [...categoryOrder, ...Object.keys(grouped).filter(k => !categoryOrder.includes(k))]
    : Object.keys(grouped).sort();

  return categories
    .filter(category => grouped[category]?.length > 0)
    .map(category => ({
      category,
      items: grouped[category] || []
    }));
};

/**
 * Count items by a field value
 * @param items - Array to count
 * @param field - Field name to count by
 * @returns Object with counts
 */
export const countByField = <T extends Record<string, unknown>>(
  items: T[],
  field: string
): Record<string, number> => {
  return items.reduce((counts, item) => {
    const key = String(getNestedValue(item, field) ?? 'Unknown');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
};

/**
 * Paginate an array
 * @param items - Array to paginate
 * @param page - Page number (0-indexed)
 * @param pageSize - Items per page
 * @returns Paginated subset
 */
export const paginate = <T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; totalPages: number; totalItems: number; currentPage: number } => {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = page * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    totalPages,
    totalItems,
    currentPage: page
  };
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
