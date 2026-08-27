import { useCallback, useEffect, useRef, useState } from 'react';

const DRAFT_KEY = 'create_escrow_wizard_draft';
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface WizardDraft {
  currentStep: number;
  formData: Record<string, unknown>;
  selectedTemplateId?: string;
  savedAt: number;
}

export function useWizardDraft<T extends Record<string, unknown>>() {
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const draftRef = useRef<WizardDraft | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExpired = useCallback((d: WizardDraft | null): boolean => {
    if (!d) return false;
    return Date.now() - d.savedAt > DRAFT_MAX_AGE_MS;
  }, []);

  const loadDraft = useCallback((): WizardDraft | null => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as WizardDraft;
      if (isExpired(parsed)) {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [isExpired]);

  const saveDraft = useCallback((currentStep: number, formData: T, selectedTemplateId?: string) => {
    const newDraft: WizardDraft = {
      currentStep,
      formData: formData as Record<string, unknown>,
      selectedTemplateId,
      savedAt: Date.now(),
    };
    draftRef.current = newDraft;
    setDraft(newDraft);
    setDraftSavedAt(newDraft.savedAt);
    setHasUnsavedChanges(false);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(newDraft));
    } catch {
      // storage full or unavailable
    }
  }, []);

  const debouncedSaveDraft = useCallback((currentStep: number, formData: T, selectedTemplateId?: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHasUnsavedChanges(true);
    timeoutRef.current = setTimeout(() => {
      saveDraft(currentStep, formData, selectedTemplateId);
    }, 1000);
  }, [saveDraft]);

  const clearDraft = useCallback(() => {
    draftRef.current = null;
    setDraft(null);
    setDraftSavedAt(null);
    setHasUnsavedChanges(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }, []);

  const discardDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  const checkExpiredOnMount = useCallback(() => {
    const existing = loadDraft();
    if (existing) {
      draftRef.current = existing;
      setDraft(existing);
      setDraftSavedAt(existing.savedAt);
      setShowResumePrompt(true);
    }
  }, [loadDraft]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    draft,
    showResumePrompt,
    setShowResumePrompt,
    draftSavedAt,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    saveDraft,
    debouncedSaveDraft,
    clearDraft,
    discardDraft,
    loadDraft,
    checkExpiredOnMount,
  };
}
