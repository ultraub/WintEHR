/**
 * TransitionWrapper Component
 * Fades page content in on route change.
 *
 * The content's resting opacity is always 1. The fade is a one-shot Web
 * Animation played on top of that, so nothing can leave the page invisible:
 * the previous version held opacity at 0 until a requestAnimationFrame
 * callback fired, and browsers pause those in background tabs, which left
 * pages blank for seconds. Skipped entirely under prefers-reduced-motion.
 *
 * @since 2025-01-21
 */
import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TransitionWrapper = ({ children, transition = 'fade', duration = 150 }) => {
  const location = useLocation();
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (transition !== 'fade' || !node || typeof node.animate !== 'function') return undefined;
    if (prefersReducedMotion()) return undefined;
    const animation = node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration,
      easing: 'ease-out',
    });
    return () => animation.cancel();
  }, [location.pathname, transition, duration]);

  if (transition !== 'fade') return children;

  return (
    <Box ref={ref} sx={{ width: '100%', height: '100%' }}>
      {children}
    </Box>
  );
};

export default TransitionWrapper;
