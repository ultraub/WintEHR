/**
 * useKeyboardNavigation Hook
 * Comprehensive keyboard navigation for Clinical Workspace
 * Part of the Clinical UI Improvements Initiative
 */

import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useClinicalWorkflow } from '../contexts/ClinicalWorkflowContext';

// Define keyboard shortcuts for the clinical workspace
const KEYBOARD_SHORTCUTS = {
  // Tab navigation
  'ctrl+1, cmd+1': { tab: 'summary', description: 'Go to Summary' },
  'ctrl+2, cmd+2': { tab: 'chart-review', description: 'Go to Chart Review' },
  'ctrl+3, cmd+3': { tab: 'encounters', description: 'Go to Encounters' },
  'ctrl+4, cmd+4': { tab: 'results', description: 'Go to Results' },
  'ctrl+5, cmd+5': { tab: 'orders', description: 'Go to Orders' },
  'ctrl+6, cmd+6': { tab: 'pharmacy', description: 'Go to Pharmacy' },
  'ctrl+7, cmd+7': { tab: 'imaging', description: 'Go to Imaging' },
  'ctrl+8, cmd+8': { tab: 'documentation', description: 'Go to Documentation' },
  'ctrl+9, cmd+9': { tab: 'care-plan', description: 'Go to Care Plan' },
  'ctrl+0, cmd+0': { tab: 'timeline', description: 'Go to Timeline' },
  
  // Quick actions
  'ctrl+n, cmd+n': { action: 'new', description: 'Create new (context-aware)' },
  'ctrl+e, cmd+e': { action: 'edit', description: 'Edit selected item' },
  'ctrl+s, cmd+s': { action: 'save', description: 'Save current work' },
  'ctrl+p, cmd+p': { action: 'print', description: 'Print current view' },
  'ctrl+f, cmd+f': { action: 'search', description: 'Focus search' },
  'ctrl+r, cmd+r': { action: 'refresh', description: 'Refresh data' },
  
  // Navigation
  'alt+left': { action: 'back', description: 'Go back' },
  'alt+right': { action: 'forward', description: 'Go forward' },
  'ctrl+shift+tab': { action: 'prevTab', description: 'Previous tab' },
  'ctrl+tab': { action: 'nextTab', description: 'Next tab' },
  
  // Density controls
  'ctrl+shift+1': { density: 'compact', description: 'Compact view' },
  'ctrl+shift+2': { density: 'comfortable', description: 'Comfortable view' },
  'ctrl+shift+3': { density: 'spacious', description: 'Spacious view' },
  
  // Help
  'ctrl+/, cmd+/': { action: 'help', description: 'Show keyboard shortcuts' },
  'esc': { action: 'escape', description: 'Close dialogs/Cancel' }
};

// Tab order for cycling
const TAB_ORDER = [
  'summary',
  'chart-review',
  'encounters',
  'results',
  'orders',
  'pharmacy',
  'imaging',
  'documentation',
  'care-plan',
  'timeline'
];

export const useKeyboardNavigation = ({
  activeTab,
  onTabChange,
  onAction,
  onDensityChange,
  enabled = true
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { publish } = useClinicalWorkflow();
  const [showHelp, setShowHelp] = useState(false);
  
  // Handle tab navigation
  const handleTabNavigation = useCallback((targetTab) => {
    if (onTabChange && targetTab !== activeTab) {
      onTabChange(targetTab);
      publish('clinical.navigation.keyboard', {
        action: 'tab_change',
        from: activeTab,
        to: targetTab,
        timestamp: new Date().toISOString()
      });
    }
  }, [activeTab, onTabChange, publish]);
  
  // Handle cycling through tabs
  const cycleTab = useCallback((direction) => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    let newIndex;
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % TAB_ORDER.length;
    } else {
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = TAB_ORDER.length - 1;
    }
    
    handleTabNavigation(TAB_ORDER[newIndex]);
  }, [activeTab, handleTabNavigation]);
  
  // Handle actions
  const handleAction = useCallback((action) => {
    switch (action) {
      case 'back':
        navigate(-1);
        break;
      case 'forward':
        navigate(1);
        break;
      case 'prevTab':
        cycleTab('prev');
        break;
      case 'nextTab':
        cycleTab('next');
        break;
      case 'help':
        setShowHelp(true);
        break;
      case 'escape':
        setShowHelp(false);
        if (onAction) onAction('escape');
        break;
      default:
        if (onAction) onAction(action);
    }
    
    publish('clinical.navigation.keyboard', {
      action: action,
      tab: activeTab,
      timestamp: new Date().toISOString()
    });
  }, [navigate, cycleTab, activeTab, onAction, publish]);
  
  // Register all hotkeys
  Object.entries(KEYBOARD_SHORTCUTS).forEach(([keys, config]) => {
    useHotkeys(
      keys,
      (e) => {
        if (!enabled) return;
        
        e.preventDefault();
        
        if (config.tab) {
          handleTabNavigation(config.tab);
        } else if (config.action) {
          handleAction(config.action);
        } else if (config.density && onDensityChange) {
          onDensityChange(config.density);
        }
      },
      {
        enabled: enabled,
        enableOnFormTags: ['INPUT', 'TEXTAREA', 'SELECT']
      },
      [enabled, activeTab, handleTabNavigation, handleAction, onDensityChange]
    );
  });
  
  // Focus management for accessibility
  useEffect(() => {
    // Set focus to main content area when tab changes
    const mainContent = document.querySelector('[role="main"]');
    if (mainContent) {
      mainContent.focus();
    }
  }, [activeTab]);
  
  // Announce tab changes for screen readers
  useEffect(() => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    
    document.body.appendChild(announcement);
    
    return () => {
      document.body.removeChild(announcement);
    };
  }, []);
  
  return {
    showHelp,
    setShowHelp,
    shortcuts: KEYBOARD_SHORTCUTS,
    handleAction,
    cycleTab
  };
};

// Keyboard shortcut help dialog component
export const KeyboardShortcutHelp = ({ open, onClose }) => {
  const shortcuts = Object.entries(KEYBOARD_SHORTCUTS).map(([keys, config]) => ({
    keys: keys.split(', ').map(k => k.replace('cmd', '⌘').replace('ctrl', 'Ctrl')),
    description: config.description,
    category: config.tab ? 'Navigation' : config.density ? 'View' : 'Actions'
  }));
  
  const categories = {
    Navigation: shortcuts.filter(s => s.category === 'Navigation'),
    Actions: shortcuts.filter(s => s.category === 'Actions'),
    View: shortcuts.filter(s => s.category === 'View')
  };
  
  return {
    open,
    onClose,
    categories,
    shortcuts
  };
};

// Hook for individual components to register local shortcuts
export const useComponentKeyboard = (shortcuts, deps = []) => {
  const [localShortcuts] = useState(shortcuts);
  
  Object.entries(localShortcuts).forEach(([keys, handler]) => {
    useHotkeys(
      keys,
      (e) => {
        e.preventDefault();
        handler(e);
      },
      {
        enabled: true,
        enableOnFormTags: false
      },
      deps
    );
  });
};

// Focus trap hook for modals and dialogs
export const useFocusTrap = (ref, enabled = true) => {
  useEffect(() => {
    if (!enabled || !ref.current) return;
    
    const focusableElements = ref.current.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };
    
    ref.current.addEventListener('keydown', handleKeyDown);
    firstFocusable?.focus();
    
    return () => {
      ref.current?.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, enabled]);
};

export default useKeyboardNavigation;