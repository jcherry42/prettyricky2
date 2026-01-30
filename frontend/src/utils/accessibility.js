/**
 * Enterprise Accessibility Constants
 * WCAG 2.1 AA compliant labels and descriptions
 */

export const ARIA_LABELS = {
  // Navigation
  navigation: {
    main: 'Main navigation',
    tabs: 'Tab navigation',
    breadcrumb: 'Breadcrumb navigation',
  },
  
  // Buttons
  buttons: {
    close: 'Close dialog',
    menu: 'Open menu',
    settings: 'Open settings',
    search: 'Search',
    filter: 'Filter results',
    sort: 'Sort results',
    refresh: 'Refresh data',
    save: 'Save changes',
    cancel: 'Cancel',
    delete: 'Delete item',
    edit: 'Edit item',
    add: 'Add new item',
    copy: 'Copy to clipboard',
    share: 'Share',
    print: 'Print',
    download: 'Download',
    upload: 'Upload file',
    send: 'Send message',
    play: 'Play audio',
    pause: 'Pause audio',
    stop: 'Stop audio',
    mute: 'Mute',
    unmute: 'Unmute',
    translate: 'Translate text',
    speak: 'Read aloud',
  },
  
  // Form fields
  fields: {
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email address',
    phone: 'Phone number',
    address: 'Street address',
    city: 'City',
    state: 'State',
    zip: 'ZIP code',
    notes: 'Notes',
    search: 'Search customers',
    message: 'Message content',
  },
  
  // Status
  status: {
    loading: 'Loading...',
    success: 'Operation successful',
    error: 'An error occurred',
    empty: 'No results found',
  },
  
  // Regions
  regions: {
    header: 'Page header',
    main: 'Main content',
    sidebar: 'Sidebar',
    footer: 'Page footer',
    modal: 'Dialog',
    alert: 'Alert message',
  },
};

// Screen reader announcements
export const announceToScreenReader = (message, priority = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('class', 'sr-only');
  announcement.textContent = message;
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Focus management
export const focusManagement = {
  // Trap focus within a container
  trapFocus: (container) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  },
  
  // Return focus to trigger element
  returnFocus: (triggerElement) => {
    if (triggerElement && typeof triggerElement.focus === 'function') {
      triggerElement.focus();
    }
  },
};

// Keyboard navigation helpers
export const keyboardNavigation = {
  isEnterOrSpace: (e) => e.key === 'Enter' || e.key === ' ',
  isEscape: (e) => e.key === 'Escape',
  isArrowKey: (e) => ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key),
};

export default ARIA_LABELS;
