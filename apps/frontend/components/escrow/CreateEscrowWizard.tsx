'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEscrowSchema, CreateEscrowFormData } from '@/lib/escrow-schema';
import BasicInfoStep from './create/BasicInfoStep';
import PartiesStep from './create/PartiesStep';
import TermsStep from './create/TermsStep';
import MilestonesStep from './create/MilestonesStep';
import ConditionsStep from './create/ConditionsStep';
import ReviewStep from './create/ReviewStep';
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { isConnected, getAddress } from '@stellar/freighter-api';

const STEPS = [
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
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const methods = useForm<CreateEscrowFormData>({
    resolver: zodResolver(createEscrowSchema),
    mode: 'onChange',
    defaultValues: { asset: 'XLM', milestones: [], conditions: [] },
  });

  const { trigger, handleSubmit } = methods;

  const nextStep = async () => {
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
      const connected = await isConnected();
      if (!connected) throw new Error('Freighter wallet not connected. Please install and connect Freighter.');
      const { address } = await getAddress();
      if (!address) throw new Error('Could not retrieve address from Freighter.');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setTxHash('7a8b9c...mock_hash...1d2e3f');
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to create escrow. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (txHash) {
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white rounded-xl shadow-sm border border-gray-100 text-center space-y-5">
        <div className="flex justify-center">
          <CheckCircle2 className="h-14 w-14 text-green-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Escrow Created Successfully!</h2>
        <p className="text-gray-600 text-sm sm:text-base">Your escrow agreement has been deployed to the network.</p>
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg break-all text-left">
          <p className="text-xs text-gray-500 uppercase mb-1">Transaction Hash</p>
          <p className="font-mono text-sm text-gray-700">{txHash}</p>
        </div>
        <Link
          href="/dashboard"
          className="min-h-[44px] inline-flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
        {/* Progress bar — compact on mobile */}
        <div className="px-4 sm:px-8 pt-6 pb-2 border-b border-gray-100">
          {/* Step number indicator for mobile */}
          <div className="flex items-center justify-between mb-3 sm:hidden">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span className="text-sm font-semibold text-blue-600">{STEPS[currentStep].title}</span>
          </div>

          {/* Mobile: simple progress bar */}
          <div className="sm:hidden mb-4">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Desktop: dot stepper */}
          <nav aria-label="Progress" className="hidden sm:block mb-6">
            <ol role="list" className="flex items-center w-full">
              {STEPS.map((step, idx) => (
                <li key={step.id} className="relative flex-1">
                  {idx !== STEPS.length - 1 && (
                    <div className="absolute top-5 left-1/2 w-full flex items-center" aria-hidden="true">
                      <div className={`h-0.5 w-full transition-colors duration-300 ${idx < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    </div>
                  )}
                  <div className="relative flex flex-col items-center">
                    <span className="flex items-center h-10 bg-white px-2 rounded-full z-10" aria-hidden="true">
                      {idx < currentStep ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                      ) : idx === currentStep ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-600 bg-white" aria-current="step">
                          <div className="h-3 w-3 rounded-full bg-blue-600" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-300 bg-white" />
                      )}
                    </span>
                    <span className={`absolute -bottom-6 w-max text-center text-xs font-medium ${idx <= currentStep ? 'text-blue-600' : 'text-gray-400'}`}>
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
              {currentStep === 0 && <BasicInfoStep />}
              {currentStep === 1 && <PartiesStep />}
              {currentStep === 2 && <TermsStep />}
              {currentStep === 3 && <MilestonesStep />}
              {currentStep === 4 && <ConditionsStep />}
              {currentStep === 5 && <ReviewStep />}
            </div>

            {submitError && (
              <div className="mx-4 sm:mx-8 mb-4 p-3 sm:p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Nav buttons */}
            <div className="px-4 sm:px-8 py-4 border-t border-gray-100 flex justify-between gap-3">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 0 || isSubmitting}
                className={`min-h-[44px] flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 ${currentStep === 0 ? 'invisible' : ''}`}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              {currentStep === STEPS.length - 1 ? (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] flex items-center gap-1.5 px-5 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
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
                  className="min-h-[44px] flex items-center gap-1.5 px-5 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
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
