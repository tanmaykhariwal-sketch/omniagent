const STORAGE_KEY = 'omniagent-theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures (private browsing, etc.)
  }
}

export function initTheme() {
  const stored = getStoredTheme();
  const theme = stored || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}
