/**
 * Accessibility Utilities
 * Enterprise-grade a11y helpers for keyboard navigation, screen readers, and focus management
 */

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export const announceToScreenReader = (message, priority = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement is read
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Focus trap for modals and dialogs
 * Returns cleanup function
 */
export const createFocusTrap = (containerRef) => {
  if (!containerRef?.current) return () => {};
  
  const container = containerRef.current;
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  // Store the element that had focus before opening
  const previouslyFocused = document.activeElement;
  
  // Focus first element
  firstFocusable?.focus();
  
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    previouslyFocused?.focus();
  };
};

/**
 * Handle Escape key to close modal
 */
export const useEscapeKey = (onClose, enabled = true) => {
  if (typeof window === 'undefined') return;
  
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && enabled) {
      onClose();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Skip link component styles
 */
export const skipLinkStyles = `
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    padding: 8px 16px;
    background: #FFBF00;
    color: #000;
    font-weight: 600;
    z-index: 10000;
    text-decoration: none;
    border-radius: 0 0 8px 0;
    transition: top 0.2s;
  }
  
  .skip-link:focus {
    top: 0;
  }
`;

/**
 * Generate unique IDs for form elements
 */
let idCounter = 0;
export const generateId = (prefix = 'id') => {
  return `${prefix}-${++idCounter}`;
};

/**
 * ARIA attributes helper
 */
export const ariaProps = {
  // For expandable sections
  expandable: (expanded, controlsId) => ({
    'aria-expanded': expanded,
    'aria-controls': controlsId,
  }),
  
  // For toggle buttons
  toggle: (pressed) => ({
    'aria-pressed': pressed,
  }),
  
  // For loading buttons
  loading: (isLoading, loadingText = 'Loading') => ({
    'aria-busy': isLoading,
    'aria-disabled': isLoading,
    'aria-label': isLoading ? loadingText : undefined,
  }),
  
  // For required form fields
  required: (hasError, errorId) => ({
    'aria-required': true,
    'aria-invalid': hasError || undefined,
    'aria-describedby': hasError ? errorId : undefined,
  }),
  
  // For modal dialogs
  modal: (titleId, descId) => ({
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': titleId,
    'aria-describedby': descId,
  }),
  
  // For tabs
  tab: (selected, tabPanelId) => ({
    role: 'tab',
    'aria-selected': selected,
    'aria-controls': tabPanelId,
    tabIndex: selected ? 0 : -1,
  }),
  
  // For tab panels
  tabPanel: (tabId, hidden) => ({
    role: 'tabpanel',
    'aria-labelledby': tabId,
    hidden: hidden,
    tabIndex: 0,
  }),
};

/**
 * Keyboard navigation helper for lists
 */
export const handleListKeyboard = (e, items, currentIndex, onSelect) => {
  let newIndex = currentIndex;
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      newIndex = Math.min(currentIndex + 1, items.length - 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      newIndex = Math.max(currentIndex - 1, 0);
      break;
    case 'Home':
      e.preventDefault();
      newIndex = 0;
      break;
    case 'End':
      e.preventDefault();
      newIndex = items.length - 1;
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (currentIndex >= 0 && currentIndex < items.length) {
        onSelect(items[currentIndex]);
      }
      return;
    default:
      return;
  }
  
  if (newIndex !== currentIndex) {
    const element = document.querySelector(`[data-index="${newIndex}"]`);
    element?.focus();
  }
};

/**
 * Reduced motion preference check
 */
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * High contrast mode check
 */
export const prefersHighContrast = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
};

export default {
  announceToScreenReader,
  createFocusTrap,
  useEscapeKey,
  generateId,
  ariaProps,
  handleListKeyboard,
  prefersReducedMotion,
  prefersHighContrast,
};
