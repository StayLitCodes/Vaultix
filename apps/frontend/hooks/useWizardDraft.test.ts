import { renderHook, act } from '@testing-library/react';
import { useWizardDraft, WizardDraft } from './useWizardDraft';

const DRAFT_KEY = 'create_escrow_wizard_draft';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function seedDraft(overrides: Partial<WizardDraft> = {}) {
  const draft: WizardDraft = {
    currentStep: 2,
    formData: { title: 'Existing draft' },
    selectedTemplateId: undefined,
    savedAt: Date.now(),
    ...overrides,
  };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

describe('useWizardDraft', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saveDraft writes the draft to localStorage and updates state', () => {
    const { result } = renderHook(() => useWizardDraft<Record<string, unknown>>());

    act(() => {
      result.current.saveDraft(3, { title: 'My escrow' }, 'template-1');
    });

    const stored = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
    expect(stored).toMatchObject({
      currentStep: 3,
      formData: { title: 'My escrow' },
      selectedTemplateId: 'template-1',
    });
    expect(result.current.draftSavedAt).toBe(stored.savedAt);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('debouncedSaveDraft marks changes as unsaved immediately and persists after 1s', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useWizardDraft<Record<string, unknown>>());

    act(() => {
      result.current.debouncedSaveDraft(1, { title: 'Draft in progress' });
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(999);
    });
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    const stored = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
    expect(stored.formData).toEqual({ title: 'Draft in progress' });
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('debouncedSaveDraft resets the timer on rapid successive calls', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useWizardDraft<Record<string, unknown>>());

    act(() => {
      result.current.debouncedSaveDraft(1, { title: 'A' });
    });
    act(() => {
      jest.advanceTimersByTime(700);
    });
    act(() => {
      result.current.debouncedSaveDraft(1, { title: 'AB' });
    });
    act(() => {
      jest.advanceTimersByTime(700);
    });
    // Original 1000ms window would have elapsed by now, but the second call reset it.
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    const stored = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
    expect(stored.formData).toEqual({ title: 'AB' });
  });

  it('checkExpiredOnMount restores a recent draft and prompts to resume', () => {
    const seeded = seedDraft({ savedAt: Date.now() - 60_000 });
    const { result } = renderHook(() => useWizardDraft<Record<string, unknown>>());

    act(() => {
      result.current.checkExpiredOnMount();
    });

    expect(result.current.showResumePrompt).toBe(true);
    expect(result.current.draft).toMatchObject({ formData: seeded.formData, currentStep: 2 });
    expect(result.current.draftSavedAt).toBe(seeded.savedAt);
  });

  it('checkExpiredOnMount clears drafts older than 7 days and does not prompt', () => {
    seedDraft({ savedAt: Date.now() - SEVEN_DAYS_MS - 1000 });
    const { result } = renderHook(() => useWizardDraft<Record<string, unknown>>());

    act(() => {
      result.current.checkExpiredOnMount();
    });

    expect(result.current.showResumePrompt).toBe(false);
    expect(result.current.draft).toBeNull();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('treats a draft saved exactly 7 days ago as still valid', () => {
    seedDraft({ savedAt: Date.now() - SEVEN_DAYS_MS + 1000 });
    const { result } = renderHook(() => useWizardDraft<Record<string, unknown>>());

    act(() => {
      result.current.checkExpiredOnMount();
    });

    expect(result.current.showResumePrompt).toBe(true);
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('loadDraft returns null and does not throw on corrupted localStorage data', () => {
    window.localStorage.setItem(DRAFT_KEY, '{not valid json');
    const { result } = renderHook(() => useWizardDraft<Record<string, unknown>>());

    let loaded: WizardDraft | null = null;
    act(() => {
      loaded = result.current.loadDraft();
    });

    expect(loaded).toBeNull();
  });

  it('clearDraft removes the stored draft and resets state', () => {
    seedDraft();
    const { result } = renderHook(() => useWizardDraft<Record<string, unknown>>());

    act(() => {
      result.current.checkExpiredOnMount();
    });
    expect(result.current.draft).not.toBeNull();

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.draft).toBeNull();
    expect(result.current.draftSavedAt).toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('discardDraft behaves the same as clearDraft', () => {
    seedDraft();
    const { result } = renderHook(() => useWizardDraft<Record<string, unknown>>());

    act(() => {
      result.current.checkExpiredOnMount();
      result.current.discardDraft();
    });

    expect(result.current.draft).toBeNull();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
