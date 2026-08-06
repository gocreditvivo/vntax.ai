/**
 * Simple front-end-only auth guard for the demo app.
 * In production this would be replaced by a real session/JWT check.
 * The token is set on login and on onboarding completion so both flows work.
 */

import posthog from '../posthog';

const TOKEN_KEY = 'vntax_session';
const DEMO_OWNER_ID = 'u_owner_rest';

function identifyUser(userId: string): void {
  posthog.identify(userId);
}

function readSessionUserId(): string | null {
  try {
    const userId = localStorage.getItem(TOKEN_KEY);
    return userId === 'demo_session' ? DEMO_OWNER_ID : userId;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return readSessionUserId() !== null;
}

/** Restores the known user's identity once when the browser app reloads. */
export function restoreSession(): void {
  const userId = readSessionUserId();
  if (userId) identifyUser(userId);
}

export function setSession(userId = DEMO_OWNER_ID): void {
  const previousUserId = readSessionUserId();

  if (previousUserId && previousUserId !== userId) posthog.reset();

  try {
    localStorage.setItem(TOKEN_KEY, userId);
  } catch {
    /* localStorage may be unavailable in some contexts */
  }

  if (previousUserId !== userId) identifyUser(userId);
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }

  posthog.reset();
}
