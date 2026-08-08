/**
 * Onboarding draft, persisted in sessionStorage.
 *
 * The wizard spans several routes, and each step is a separate render of a
 * separate screen. Holding the answers in component state would lose them the
 * moment the user pressed back, refreshed, or followed a link — and an owner
 * who has just typed their legal name, address and entity type is not going to
 * type it a second time.
 *
 * sessionStorage rather than localStorage: a half-finished business profile is
 * scoped to the tab it was started in and should not outlive it. Nothing
 * sensitive goes in here — no password, no SSN, no EIN.
 */

import type { EntityType, Industry } from '../../types';

export interface OnboardingDraft {
  ownerName: string;
  ownerPhone: string;
  legalName: string;
  dbaName: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  industry: Industry;
  entityType: EntityType;
}

const KEY = 'vntax.onboarding.draft';

export const emptyDraft: OnboardingDraft = {
  ownerName: '',
  ownerPhone: '',
  legalName: '',
  dbaName: '',
  line1: '',
  city: '',
  state: '',
  postalCode: '',
  industry: 'restaurant',
  entityType: 'single_member_llc',
};

export function readDraft(): OnboardingDraft {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return { ...emptyDraft };
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    // Spread over the empty draft rather than trusting the parsed object: a
    // draft written by an older build may be missing keys added since.
    return { ...emptyDraft, ...parsed };
  } catch {
    return { ...emptyDraft };
  }
}

export function writeDraft(patch: Partial<OnboardingDraft>): OnboardingDraft {
  const next = { ...readDraft(), ...patch };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private browsing: the wizard still works within a single step */
  }
  return next;
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
