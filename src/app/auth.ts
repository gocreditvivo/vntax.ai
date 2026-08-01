/**
 * Simple front-end-only auth guard for the demo app.
 * In production this would be replaced by a real session/JWT check.
 * The token is set on login and on onboarding completion so both flows work.
 */

const TOKEN_KEY = 'vntax_session';

export function isAuthenticated(): boolean {
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

export function setSession(): void {
  try {
    localStorage.setItem(TOKEN_KEY, 'demo_session');
  } catch {
    /* localStorage may be unavailable in some contexts */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}
