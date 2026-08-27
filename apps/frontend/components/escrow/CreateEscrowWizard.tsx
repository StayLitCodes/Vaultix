'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEscrowSchema, CreateEscrowFormData } from '@/lib/escrow-schema';
import TemplateSelector from './create/TemplateSelector';
import BasicInfoStep from './create/BasicInfoStep';
import PartiesStep from './create/PartiesStep';
import TermsStep from './create/TermsStep';
import MilestonesStep from './create/MilestonesStep';
import ConditionsStep from './create/ConditionsStep';
import ReviewStep from './create/ReviewStep';
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Save,
  X,
} from 'lucide-react';
import { WalletServiceFactory, WalletType } from '@/app/services/wallet';
import { useTemplates } from '@/hooks/useTemplates';
import { formDataToTemplateData } from '@/lib/templates';
import { useToast } from '@/hooks/useToast';
import { useWizardDraft, WizardDraft } from '@/hooks/useWizardDraft';

const STEPS = [
  { id: 'template', title: 'Template', shortTitle: 'Template', fields: [] },
  { id: 'basic', title: 'Basic Info', shortTitle: 'Info', fields: ['title', 'description', 'category'] },
  { id: 'parties', title: 'Parties', shortTitle: 'Parties', fields: ['counterpartyAddress'] },
  { id: 'terms', title: 'Terms', shortTitle: 'Terms', fields: ['amount', 'deadline', 'asset'] },
  { id: 'milestones', title: 'Milestones', shortTitle: 'Miles.', fields: [] },
  { id: 'conditions', title: 'Conditions', shortTitle: 'Conds.', fields: [] },
  { id: 'review', title: 'Review', shortTitle: 'Review', fields: [] },
];

const DRAFT_STORAGE_KEY = 'create_escrow_wizard_draft';

function parseStepFromUrl(): number {
  if (typeof window === 'undefined') return 0;
  const params = new URLSearchParams(window.location.search);
  const step = parseInt(params.get('step') || '0', 10);
  return isNaN(step) ? 0 : Math.max(0, Math.min(step, STEPS.length - 1));
}

function updateUrlStep(step: number) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (step === 0) {
    url.searchParams.delete('step');
  } else {
    url.searchParams.set('step', String(step));
  }
  window.history.pushState({ step }, '', url.toString());
}

function convertDatesToStrings(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };
  if (result.deadline instanceof Date) {
    result.deadline = result.deadline.toISOString();
  }
  return result;
}

function convertStringsToDates(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };
  if (typeof result.deadline === 'string') {
    result.deadline = new Date(result.deadline);
  }
  return result;
}

export default function CreateEscrowWizard() {
  const [currentStep, setCurrentStep] = useState(() => parseStepFromUrl());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const { addCustomTemplate } = useTemplates();
  const { success } = useToast();
  const router = useRouter();

  const {
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
  } = useWizardDraft<CreateEscrowFormData>();

  const isPopStateRef = useRef(false);
  const isNavigatingRef = useRef(false);

  const methods = useForm<CreateEscrowFormData>({
    resolver: zodResolver(createEscrowSchema),
    mode: 'onChange',
    defaultValues: { asset: 'XLM', milestones: [], conditions: [] },
  });

  const { trigger, handleSubmit, reset, watch } = methods;

  const watchedValues = watch();

  useEffect(() => {
    checkExpiredOnMount();
    setIsInitialized(true);
  }, [checkExpiredOnMount]);

  useEffect(() => {
    if (!isInitialized) return;
    debouncedSaveDraft(currentStep, watchedValues, selectedTemplateId);
  }, [currentStep, watchedValues, selectedTemplateId, debouncedSaveDraft, isInitialized]);

  useEffect(() => {
    const handlePopState = () => {
      isPopStateRef.current = true;
      const step = parseStepFromUrl();
      setCurrentStep(step);
      setTimeout(() => {
        isPopStateRef.current = false;
      }, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && currentStep > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, currentStep]);

  const navigateToStep = useCallback(
    (step: number) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      setCurrentStep(step);
      if (!isPopStateRef.current) {
        updateUrlStep(step);
      }
      setSubmitError(null);
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 0);
    },
    []
  );

  const nextStep = async () => {
    if (currentStep === 0) {
      navigateToStep(1);
      return;
    }
    const fields = STEPS[currentStep].fields as string[];
    const isValid = await trigger(fields);
    if (isValid) {
      navigateToStep(Math.min(currentStep + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      window.history.back();
    }
  };

  const handleResume = () => {
    setShowResumePrompt(false);
    if (draft) {
      const restoredData = convertStringsToDates(draft.formData);
      reset(restoredData as CreateEscrowFormData);
      setSelectedTemplateId(draft.selectedTemplateId);
      navigateToStep(draft.currentStep);
    }
  };

  const handleDiscardResume = () => {
    discardDraft();
    setShowResumePrompt(false);
  };

  const handleManualSave = () => {
    saveDraft(currentStep, watchedValues, selectedTemplateId);
    success('Draft saved successfully!');
  };

  const handleDiscardConfirm = () => {
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
    setShowDiscardModal(false);
    clearDraft();
  };

  const handleDiscardCancel = () => {
    setPendingNavigation(null);
    setShowDiscardModal(false);
  };

  const tryNavigateAway = (callback: () => void) => {
    if (hasUnsavedChanges && currentStep > 0) {
      setPendingNavigation(() => callback);
      setShowDiscardModal(true);
    } else {
      callback();
    }
  };

  const handleCancel = () => {
    tryNavigateAway(() => router.push('/dashboard'));
  };

  const onSubmit = async (data: CreateEscrowFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const walletService = WalletServiceFactory.getService(WalletType.FREIGHTER);

      const isInstalled = await walletService.isInstalled?.();
      if (!isInstalled) {
        throw new Error('Freighter wallet extension not detected. Please install Freighter.');
      }

      const address = await walletService.connect();
      if (!address) {
        throw new Error('Could not retrieve address from Freighter wallet.');
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      setTxHash('7a8b9c...mock_hash...1d2e3f');
      clearDraft();
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to create escrow. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateSelect = (formData: Partial<CreateEscrowFormData>) => {
    reset({
      asset: 'XLM',
      milestones: [],
      conditions: [],
      ...formData,
    });
  };

  const handleSaveAsTemplate = () => {
    const formData = watch();
    addCustomTemplate({
      name: templateName,
      description: templateDescription,
      icon: 'Settings',
      data: formDataToTemplateData(formData),
    });
    success('Template saved successfully!');
    setShowSaveTemplate(false);
    setTemplateName('');
    setTemplateDescription('');
  };

  const formatTimestamp = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true,
    }).format(new Date(timestamp));
  };

  if (txHash) {
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-card border border-border rounded-xl shadow-sm text-center space-y-5">
        <div className="flex justify-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold">Escrow Created Successfully!</h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Your escrow agreement has been deployed to the network.
        </p>
        <div className="bg-muted/50 border border-border p-4 rounded-lg break-all text-left">
          <p className="text-xs text-muted-foreground uppercase mb-1 font-mono">Transaction Hash</p>
          <p className="font-mono text-sm">{txHash}</p>
        </div>

        {!showSaveTemplate ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowSaveTemplate(true)}
              className="min-h-[44px] inline-flex items-center gap-2 px-6 py-2.5 border border-border rounded-lg hover:bg-muted text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              Save as Template
            </button>
            <br />
            <Link
              href="/dashboard"
              className="min-h-[44px] inline-flex items-center px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 text-left">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="My Custom Template"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                  placeholder="Describe what this template is for..."
                />
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="min-h-[44px] px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={!templateName}
                className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        {/* Draft indicator */}
        <div className="px-4 sm:px-8 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            {draftSavedAt && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Draft saved at {formatTimestamp(draftSavedAt)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleManualSave}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save draft
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 sm:px-8 pt-6 pb-2 border-b border-border">
          <div className="flex items-center justify-between mb-3 sm:hidden">
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span className="text-sm font-semibold text-primary">{STEPS[currentStep].title}</span>
          </div>

          <div className="sm:hidden mb-4">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <nav aria-label="Progress" className="hidden sm:block mb-6">
            <ol role="list" className="flex items-center w-full">
              {STEPS.map((step, idx) => (
                <li key={step.id} className="relative flex-1">
                  {idx !== STEPS.length - 1 && (
                    <div className="absolute top-5 left-1/2 w-full flex items-center" aria-hidden="true">
                      <div
                        className={`h-0.5 w-full transition-colors duration-300 ${idx < currentStep ? 'bg-primary' : 'bg-border'}`}
                      />
                    </div>
                  )}
                  <div className="relative flex flex-col items-center">
                    <span className="flex items-center h-10 bg-card px-2 rounded-full z-10" aria-hidden="true">
                      {idx < currentStep ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      ) : idx === currentStep ? (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-card"
                          aria-current="step"
                        >
                          <div className="h-3 w-3 rounded-full bg-primary" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-card" />
                      )}
                    </span>
                    <span
                      className={`absolute -bottom-6 w-max text-center text-xs font-medium ${idx <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {step.title}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Step content */}
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="p-4 sm:p-8 mt-0 sm:mt-4">
              {currentStep === 0 && (
                <TemplateSelector
                  onSelect={handleTemplateSelect}
                  selectedTemplateId={selectedTemplateId}
                />
              )}
              {currentStep === 1 && <BasicInfoStep />}
              {currentStep === 2 && <PartiesStep />}
              {currentStep === 3 && <TermsStep />}
              {currentStep === 4 && <MilestonesStep />}
              {currentStep === 5 && <ConditionsStep />}
              {currentStep === 6 && <ReviewStep />}
            </div>

            {submitError && (
              <div className="mx-4 sm:mx-8 mb-4 p-3 sm:p-4 rounded-lg bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-rose-700 dark:text-rose-400">{submitError}</p>
              </div>
            )}

            {/* Nav buttons */}
            <div className="px-4 sm:px-8 py-4 border-t border-border flex justify-between gap-3">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 0 || isSubmitting}
                className={`min-h-[44px] flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 ${currentStep === 0 ? 'invisible' : ''}`}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              {currentStep === STEPS.length - 1 ? (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] flex items-center gap-1.5 px-5 py-2 border border-transparent rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Create Escrow
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextStep}
                  className="min-h-[44px] flex items-center gap-1.5 px-5 py-2 border border-transparent rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>

      {/* Resume draft modal */}
      {showResumePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Resume draft?</h3>
              <button
                onClick={handleDiscardResume}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              You have a saved draft from{' '}
              {draftSavedAt ? formatTimestamp(draftSavedAt) : 'earlier'}. Would you like to resume where
              you left off?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDiscardResume}
                className="min-h-[44px] px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm font-medium transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleResume}
                className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium transition-colors"
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard draft confirmation modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Discard draft?</h3>
              <button
                onClick={handleDiscardCancel}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              You have unsaved changes in your draft. If you leave now, your progress will be lost.
              Are you sure you want to discard your draft?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDiscardCancel}
                className="min-h-[44px] px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscardConfirm}
                className="min-h-[44px] px-4 py-2 bg-rose-600 text-white rounded-lg hover:opacity-90 text-sm font-medium transition-colors"
              >
                Discard draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
