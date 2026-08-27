import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateEscrowWizard from './CreateEscrowWizard';
import { ToastProvider } from '@/app/contexts/ToastProvider';

jest.mock('@stellar/freighter-api', () => ({
  isConnected: jest.fn(),
  getAddress: jest.fn(),
  signTransaction: jest.fn(),
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const DRAFT_KEY = 'create_escrow_wizard_draft';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function renderWizard() {
  return render(
    <ToastProvider>
      <CreateEscrowWizard />
    </ToastProvider>
  );
}

function seedDraft(overrides: Record<string, unknown> = {}) {
  const draft = {
    currentStep: 1,
    formData: { asset: 'XLM', milestones: [], conditions: [], title: 'Saved Escrow Title' },
    selectedTemplateId: undefined,
    savedAt: Date.now(),
    ...overrides,
  };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

async function goToBasicInfo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(screen.getByText('Basic Information')).toBeInTheDocument());
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, '', '/escrow/create');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CreateEscrowWizard', () => {
  it('renders the template step by default', () => {
    renderWizard();
    expect(screen.getByText('Choose a Template')).toBeInTheDocument();
  });

  it('moves from the template step to basic info without requiring a template', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToBasicInfo(user);
  });

  it('validates the current step before moving to the next one', async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToBasicInfo(user);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Title must be at least 5 characters')).toBeInTheDocument();
    });
  });
});

describe('CreateEscrowWizard - step navigation (URL + back button)', () => {
  it('reflects the current step in the ?step= URL query parameter', async () => {
    const user = userEvent.setup();
    renderWizard();
    expect(window.location.search).toBe('');

    await goToBasicInfo(user);
    expect(window.location.search).toBe('?step=1');
  });

  it('lets the browser back button navigate to the previous wizard step instead of leaving the page', async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToBasicInfo(user);
    expect(window.location.search).toBe('?step=1');

    await act(async () => {
      window.history.back();
    });

    await waitFor(() => expect(screen.getByText('Choose a Template')).toBeInTheDocument());
    expect(window.location.search).toBe('');
  });
});

describe('CreateEscrowWizard - draft autosave', () => {
  it('auto-saves the wizard state to localStorage 1s after a change and shows the draft indicator', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWizard();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByText('Basic Information')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/Title/i), 'My new escrow');

    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const stored = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
    expect(stored.formData.title).toBe('My new escrow');
    expect(stored.currentStep).toBe(1);
    expect(screen.getByText(/Draft saved at/i)).toBeInTheDocument();
  });

  it('lets the user manually save the draft immediately via the Save draft button', async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToBasicInfo(user);
    await user.type(screen.getByLabelText(/Title/i), 'Manual save test');

    await user.click(screen.getByRole('button', { name: /Save draft/i }));

    const stored = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
    expect(stored.formData.title).toBe('Manual save test');
    expect(screen.getByText(/Draft saved at/i)).toBeInTheDocument();
  });

  it('warns before unload when there are unsaved changes past the first step', async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToBasicInfo(user);

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not warn before unload while still on the first (template) step', () => {
    renderWizard();

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});

describe('CreateEscrowWizard - draft restore', () => {
  it('shows a Resume draft? prompt on mount when a saved draft exists, and resumes it', async () => {
    seedDraft();
    const user = userEvent.setup();
    renderWizard();

    expect(await screen.findByText('Resume draft?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resume' }));

    await waitFor(() => expect(screen.getByText('Basic Information')).toBeInTheDocument());
    expect(screen.getByLabelText(/Title/i)).toHaveValue('Saved Escrow Title');
    expect(window.location.search).toBe('?step=1');
  });

  it('discards the saved draft when Discard is clicked in the resume prompt', async () => {
    seedDraft();
    const user = userEvent.setup();
    renderWizard();

    expect(await screen.findByText('Resume draft?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.queryByText('Resume draft?')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.getByText('Choose a Template')).toBeInTheDocument();
  });

  it('clears drafts older than 7 days and does not prompt to resume', async () => {
    seedDraft({ savedAt: Date.now() - SEVEN_DAYS_MS - 1000 });
    renderWizard();

    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull());
    expect(screen.queryByText('Resume draft?')).not.toBeInTheDocument();
  });
});

describe('CreateEscrowWizard - cancel / discard-on-navigate', () => {
  it('shows a Discard draft? confirmation when canceling mid-wizard with unsaved changes', async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToBasicInfo(user);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Discard draft?')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Discard draft' }));

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('lets the user back out of the discard confirmation and keep working', async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToBasicInfo(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const heading = screen.getByText('Discard draft?');
    expect(heading).toBeInTheDocument();

    const modal = heading.closest('div')!.parentElement as HTMLElement;
    await user.click(within(modal).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Discard draft?')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
  });

  it('cancels immediately without a confirmation when there are no unsaved changes', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(screen.queryByText('Discard draft?')).not.toBeInTheDocument();
  });
});
