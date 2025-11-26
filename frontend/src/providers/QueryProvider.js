/**
 * QueryProvider - React Query Provider Wrapper
 *
 * Provides React Query context to the application with development tools
 * and healthcare-optimized configuration.
 *
 * @module providers/QueryProvider
 */

import React from 'react';
import PropTypes from 'prop-types';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '../lib/queryClient';

/**
 * QueryProvider component
 *
 * Wraps children with React Query's QueryClientProvider and optionally
 * includes development tools for debugging queries.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} [props.showDevtools=true] - Whether to show React Query devtools in development
 *
 * @example
 * // In App.js or index.js
 * <QueryProvider>
 *   <App />
 * </QueryProvider>
 */
function QueryProvider({ children, showDevtools = true }) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {isDevelopment && showDevtools && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom-right"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

QueryProvider.propTypes = {
  children: PropTypes.node.isRequired,
  showDevtools: PropTypes.bool,
};

export default QueryProvider;
