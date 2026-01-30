/**
 * Keyboard Manager
 * Handles mobile keyboard interactions for better UX
 */

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isSmallScreen = window.innerWidth < 768;

let keyboardVisible = false;
let originalViewportHeight = window.innerHeight;

const scrollToInput = (input, delay = 100) => {
  setTimeout(() => {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, delay);
};

const detectKeyboard = () => {
  if (!isMobile) return;
  
  const threshold = 150;
  
  window.visualViewport?.addEventListener('resize', () => {
    const heightDiff = originalViewportHeight - window.visualViewport.height;
    const wasVisible = keyboardVisible;
    keyboardVisible = heightDiff > threshold;
    
    if (keyboardVisible !== wasVisible) {
      document.body.classList.toggle('keyboard-open', keyboardVisible);
    }
  });
};

const setupInputHandlers = () => {
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      scrollToInput(e.target);
    }
  });
};

const preventModalCloseOnKeyboard = () => {
  document.addEventListener('touchstart', (e) => {
    if (keyboardVisible && e.target.closest('.modal-overlay')) {
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        e.preventDefault();
      }
    }
  }, { passive: false });
};

const handleOrientationChange = () => {
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      originalViewportHeight = window.innerHeight;
    }, 100);
  });
};

export const initKeyboardManager = () => {
  if (isMobile || isSmallScreen) {
    detectKeyboard();
    setupInputHandlers();
    preventModalCloseOnKeyboard();
    handleOrientationChange();
  }
};

// Auto-init
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKeyboardManager);
  } else {
    initKeyboardManager();
  }
}

export default {
  initKeyboardManager,
  isKeyboardVisible: () => keyboardVisible
};
