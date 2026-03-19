'use client';

import { normaliseInputs } from '@/engine/constants';
import type { FeasibilityInputs } from '@/engine/types';

/**
 * Draft persistence for the New Report wizard.
 *
 * The client's requirement is that a user can move between the New Report page
 * and the calculation page without losing anything. Report state lives in the
 * database once it is generated; before that it only lives in the browser, so
 * it is written to localStorage on every change and read back on mount.
 *
 * Kept deliberately dumb - a single key, a version stamp, and a merge against
 * the current blank inputs so a draft saved before a field existed still loads.
 */
const KEY = 'asmita.wizard.draft.v1';

export interface WizardDraft {
  inputs: FeasibilityInputs;
  step: number;
  furthest: number;
  /** Set when the draft was opened from an existing report, for the return link. */
  sourceReportId?: string | null;
  savedAt: string;
}

export function loadDraft(): WizardDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WizardDraft>;
    if (!parsed?.inputs) return null;

    // Merge over a fresh blank so fields added since the draft was written are
    // present with their defaults rather than undefined.
    return {
      inputs: normaliseInputs(parsed.inputs),
      step: typeof parsed.step === 'number' ? parsed.step : 0,
      furthest: typeof parsed.furthest === 'number' ? parsed.furthest : 0,
      sourceReportId: parsed.sourceReportId ?? null,
      savedAt: parsed.savedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<WizardDraft, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    // A full or blocked storage quota must not break the form.
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
