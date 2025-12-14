/**
 * Collection Utilities - Barrel Export
 *
 * Centralized exports for all collection manipulation utilities
 * including sorting, filtering, and grouping.
 */

export {
  sortByDate,
  sortByField,
  sortByPriority,
  sortByMultiple,
  type SortDirection,
} from './sorting';

export {
  filterBySearch,
  filterByDateRange,
  filterByField,
  filterByStatus,
  filterActive,
  filterByMultiple,
} from './filtering';

export {
  groupByField,
  groupByDate,
  groupByCategory,
  countByField,
  paginate,
} from './grouping';
