/**
 * Layout constants — pure leaf module. NEVER import from any other app module.
 *
 * Extracted from RootNavigator.tsx to eliminate require cycles:
 *   RootNavigator → HomeScreen → RootNavigator  (was 6 such cycles)
 *
 * When a module in a cycle is evaluated mid-cycle, its exports can be
 * undefined at the reader site. `TAB_BAR_CONTENT_HEIGHT` was being read
 * during layout math BEFORE RootNavigator finished evaluating — silently
 * producing NaN paddings on cold-start reloads.
 */

// Tab bar content height (icons + labels, no safe area)
export const TAB_BAR_CONTENT_HEIGHT = 52;
