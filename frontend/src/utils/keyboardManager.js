/**
 * Keyboard Manager - Mobile-Friendly Input Handling
 * Ensures inputs are always visible when keyboard appears
 * Smooth scrolling and fluid menu interactions
 */

let activeInput = null;
let keyboardHeight = 0;
let isKeyboardOpen = false;

// Detect keyboard open/close on mobile
const detectKeyboard = () => {
  if (window.visualViewport) {
    // Modern approach using Visual Viewport API
    window.visualViewport.addEventListener('resize', () => {
      const viewportHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      
      const heightDiff = windowHeight - viewportHeight;
      
      if (heightDiff > 150) {
        // Keyboard is open
        keyboardHeight = heightDiff;
        isKeyboardOpen = true;
        document.body.classList.add('keyboard-open');
      } else {
        // Keyboard is closed
        keyboardHeight = 0;
        isKeyboardOpen = false;
        document.body.classList.remove('keyboard-open');
      }
    });
  } else {
    // Fallback for older browsers
    let lastHeight = window.innerHeight;
    
    window.addEventListener('resize', () => {
      const currentHeight = window.innerHeight;
      const heightDiff = lastHeight - currentHeight;
      
      if (heightDiff > 150) {
        isKeyboardOpen = true;
        keyboardHeight = heightDiff;
        document.body.classList.add('keyboard-open');
      } else if (heightDiff < -150) {
        isKeyboardOpen = false;
        keyboardHeight = 0;
        document.body.classList.remove('keyboard-open');
      }
      
      lastHeight = currentHeight;
    });
  }
};

// Smooth scroll to input when focused
const scrollToInput = (input, delay = 100) => {
  setTimeout(() => {
    if (!input) return;
    
    // Get the input's position
    const rect = input.getBoundingClientRect();
    const scrollContainer = input.closest('.cc-modal, .qa-modal, .import-modal') || window;
    
    // Calculate desired scroll position
    // Position input in upper third of visible area, accounting for keyboard
    const visibleHeight = window.visualViewport?.height || window.innerHeight;
    const targetY = visibleHeight / 3;
    
    // Smooth scroll to make input visible
    if (scrollContainer === window) {
      const scrollY = window.scrollY + rect.top - targetY;
      window.scrollTo({
        top: scrollY,
        behavior: 'smooth'
      });
    } else {
      // Scroll within modal
      const containerRect = scrollContainer.getBoundingClientRect();
      const relativeTop = rect.top - containerRect.top;
      const scrollTop = scrollContainer.scrollTop + relativeTop - targetY;
      
      scrollContainer.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  }, delay);
};

// Setup input focus handlers
const setupInputHandlers = () => {
  // Handle all input focus events
  document.addEventListener('focusin', (e) => {
    const input = e.target;
    
    if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
      activeInput = input;
      
      // Wait for keyboard to open, then scroll
      scrollToInput(input, 300);
      
      // Add focused class for styling
      input.classList.add('input-focused');
    }
  }, true);

  // Handle input blur
  document.addEventListener('focusout', (e) => {
    const input = e.target;
    
    if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
      input.classList.remove('input-focused');
      
      // Small delay before clearing activeInput
      setTimeout(() => {
        if (activeInput === input) {
          activeInput = null;
        }
      }, 100);
    }
  }, true);
};

// Prevent modal close when clicking on keyboard
const preventModalCloseOnKeyboard = () => {
  document.addEventListener('click', (e) => {
    // If keyboard is open and click is on an input, don't propagate
    if (isKeyboardOpen && activeInput) {
      const clickedInput = e.target.closest('input, textarea');
      if (clickedInput) {
        e.stopPropagation();
      }
    }
  }, true);
};

// Handle orientation change
const handleOrientationChange = () => {
  window.addEventListener('orientationchange', () => {
    // Close keyboard on orientation change
    if (activeInput) {
      activeInput.blur();
    }
    
    // Recalculate after orientation settles
    setTimeout(() => {
      keyboardHeight = 0;
      isKeyboardOpen = false;
    }, 500);
  });
};

// Initialize keyboard manager
export const initKeyboardManager = () => {
  // Only run on mobile devices
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isSmallScreen = window.innerWidth <= 768;
  
  if (isMobile || isSmallScreen) {
    detectKeyboard();
    setupInputHandlers();
    preventModalCloseOnKeyboard();
    handleOrientationChange();
    
    console.log('✅ Keyboard Manager initialized for mobile');
  }
};

// Manually scroll to input (useful for programmatic focus)
export const scrollToActiveInput = () => {
  if (activeInput) {
    scrollToInput(activeInput, 100);
  }
};

// Check if keyboard is currently open
export const isKeyboardVisible = () => isKeyboardOpen;

// Get keyboard height
export const getKeyboardHeight = () => keyboardHeight;

// Auto-initialize on import
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKeyboardManager);
  } else {
    initKeyboardManager();
  }
}

export default {
  initKeyboardManager,
  scrollToActiveInput,
  isKeyboardVisible,
  getKeyboardHeight
};
