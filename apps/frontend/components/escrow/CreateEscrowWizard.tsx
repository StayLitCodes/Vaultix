'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
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
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, AlertCircle, Save } from 'lucide-react';
import { useWallet } from '@/app/contexts/WalletContext';
import { CreateEscrowPayload, prepareEscrowCreation, submitEscrowCreation } from '@/services/escrow-creation';
import { useTemplates } from '@/hooks/useTemplates';
import { formDataToTemplateData } from '@/lib/templates';
import { useToast } from '@/hooks/useToast';

const STEPS = [
  { id: 'template', title: 'Template', shortTitle: 'Template', fields: [] },
  { id: 'basic', title: 'Basic Info', shortTitle: 'Info', fields: ['title', 'description', 'category'] },
  { id: 'parties', title: 'Parties', shortTitle: 'Parties', fields: ['counterpartyAddress'] },
  { id: 'terms', title: 'Terms', shortTitle: 'Terms', fields: ['amount', 'deadline', 'asset'] },
  { id: 'milestones', title: 'Milestones', shortTitle: 'Miles.', fields: [] },
  { id: 'conditions', title: 'Conditions', shortTitle: 'Conds.', fields: [] },
  { id: 'review', title: 'Review', shortTitle: 'Review', fields: [] },
];

export default function CreateEscrowWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSignedIntent, setHasSignedIntent] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [createdEscrowId, setCreatedEscrowId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const creationIntent = useRef<{ id: string; payload: CreateEscrowPayload; signedXdr?: string } | null>(null);

  const { addCustomTemplate } = useTemplates();
  const { success } = useToast();
  const { activeAccount, signTransaction } = useWallet();

  const methods = useForm<CreateEscrowFormData>({
    resolver: zodResolver(createEscrowSchema),
    mode: 'onChange',
    defaultValues: { asset: 'XLM', milestones: [], conditions: [] },
  });

  const { trigger, handleSubmit, reset, watch } = methods;

  const handleTemplateSelect = (formData: Partial<CreateEscrowFormData>) => {
    reset({
      asset: 'XLM',
      milestones: [],
      conditions: [],
      ...formData,
    });
  };

  const nextStep = async () => {
    if (currentStep === 0) {
      setCurrentStep((prev) => prev + 1);
      return;
    }
    const fields = STEPS[currentStep].fields as any[];
    const isValid = await trigger(fields);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
      setSubmitError(null);
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    setSubmitError(null);
  };

  const onSubmit = async (data: CreateEscrowFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (!activeAccount) {
        throw new Error('Connect a Stellar wallet before creating an escrow.');
      }

      const payload: CreateEscrowPayload = {
        title: data.title,
        description: data.description,
        category: data.category,
        amount: data.amount,
        asset: data.asset,
        counterpartyAddress: data.counterpartyAddress,
        deadline: data.deadline.toISOString(),
        milestones: data.milestones ?? [],
        conditions: data.conditions ?? [],
      };
      const fingerprint = JSON.stringify(payload);
      if (!creationIntent.current || (!creationIntent.current.signedXdr && JSON.stringify(creationIntent.current.payload) !== fingerprint)) {
        const intentId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        creationIntent.current = { id: intentId, payload };
      }

      const intent = creationIntent.current;
      let signedXdr = intent.signedXdr;
      if (!signedXdr) {
        const prepared = await prepareEscrowCreation(intent.id, intent.payload);
        if (prepared.intentId !== intent.id || !prepared.unsignedXdr) {
          throw new Error('The API returned an invalid escrow transaction.');
        }
        signedXdr = await signTransaction(prepared.unsignedXdr);
        if (!signedXdr) throw new Error('The wallet did not return a signed transaction.');
        intent.signedXdr = signedXdr;
        setHasSignedIntent(true);
      }

      const settled = await submitEscrowCreation(intent.id, signedXdr);
      if (settled.status !== 'confirmed' || !settled.escrowId || !settled.transactionHash) {
        throw new Error('The network has not confirmed this escrow yet. Retry to check the same submission.');
      }
      setCreatedEscrowId(settled.escrowId);
      setTxHash(settled.transactionHash);
      success('Escrow creation confirmed on Stellar.');
    } catch (error: any) {
      const message = error?.message || 'Failed to create escrow. Please try again.';
      if (/transaction failed on stellar|rpc rejected the signed transaction/i.test(message)) {
        // The network reported a terminal result, so a new attempt needs a new sequence and intent.
        creationIntent.current = null;
        setHasSignedIntent(false);
      }
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
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

  if (txHash) {
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-card border border-border rounded-xl shadow-sm text-center space-y-5">
        <div className="flex justify-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold">Escrow Created Successfully!</h2>
        <p className="text-muted-foreground text-sm sm:text-base">Your escrow agreement has been confirmed on Stellar.</p>
        <div className="bg-muted/50 border border-border p-4 rounded-lg break-all text-left">
          <p className="text-xs text-muted-foreground uppercase mb-1 font-mono">Escrow ID</p>
          <p className="font-mono text-sm mb-4">{createdEscrowId}</p>
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
                <label className="block text-sm font-medium text-muted-foreground mb-1">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="My Custom Template"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Description (Optional)</label>
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
                      <div className={`h-0.5 w-full transition-colors duration-300 ${idx < currentStep ? 'bg-primary' : 'bg-border'}`} />
                    </div>
                  )}
                  <div className="relative flex flex-col items-center">
                    <span className="flex items-center h-10 bg-card px-2 rounded-full z-10" aria-hidden="true">
                      {idx < currentStep ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      ) : idx === currentStep ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-card" aria-current="step">
                          <div className="h-3 w-3 rounded-full bg-primary" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-card" />
                      )}
                    </span>
                    <span className={`absolute -bottom-6 w-max text-center text-xs font-medium ${idx <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}>
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
            <fieldset disabled={hasSignedIntent} className="contents">
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
            </fieldset>

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
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" /> Create Escrow</>
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
    </div>
  );
}
