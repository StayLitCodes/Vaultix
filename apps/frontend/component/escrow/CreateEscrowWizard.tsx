'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEscrowSchema, CreateEscrowFormData } from '@/lib/escrow-schema';
import BasicInfoStep from './create/BasicInfoStep';
import PartiesStep from './create/PartiesStep';
import TermsStep from './create/TermsStep';
import ReviewStep from './create/ReviewStep';
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { getAddress, isConnected, signTransaction } from '@stellar/freighter-api';
import { apiRequest, explorerTxUrl } from '@/lib/api-client';
import { useWalletConnection } from '@/app/hooks/useWallet';

const STEPS = [
  { id: 'basic', title: 'Basic Info', fields: ['title', 'description', 'category'] },
  { id: 'parties', title: 'Parties', fields: ['counterpartyAddress'] },
  { id: 'terms', title: 'Terms', fields: ['amount', 'deadline', 'asset'] },
  { id: 'review', title: 'Review', fields: [] },
];

export default function CreateEscrowWizard() {
  const router = useRouter();
  const { network: connectedNetwork } = useWalletConnection();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [createdEscrowId, setCreatedEscrowId] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [isWalletSigning, setIsWalletSigning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const methods = useForm<CreateEscrowFormData>({
    resolver: zodResolver(createEscrowSchema),
    mode: 'onChange',
    defaultValues: {
      asset: 'XLM',
    }
  });

  const { trigger, handleSubmit } = methods;

  const parseErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: string }).message;
      if (message) return message;
    }
    return 'Failed to create escrow. Please try again.';
  };

  useEffect(() => {
    if (!txHash || !createdEscrowId) return;
    const timer = window.setTimeout(() => {
      router.push(`/escrow/${createdEscrowId}`);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [txHash, createdEscrowId, router]);

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
    setIsWalletSigning(false);
    setSubmitError(null);

    try {
      // 1) Wallet connection check
      const connected = await isConnected();
      if (!connected) {
        throw new Error('Freighter wallet not connected. Please install and connect Freighter.');
      }

      const { address } = await getAddress();
      if (!address) {
        throw new Error('Could not retrieve address from Freighter.');
      }

      // 2) Resolve counterparty to an existing Vaultix user
      const counterparty = await apiRequest<{ id: string }>(
        `/auth/wallet/${data.counterpartyAddress}`,
      );

      // 3) Create escrow record
      const createdEscrow = await apiRequest<{ id: string; amount: number }>(
        '/escrows',
        {
          method: 'POST',
          body: JSON.stringify({
            title: data.title,
            description: data.description,
            amount: Number(data.amount),
            asset: data.asset,
            expiresAt: data.deadline.toISOString(),
            parties: [{ userId: counterparty.id, role: 'seller' }],
          }),
        },
      );

      setCreatedEscrowId(createdEscrow.id);

      // 4) Request unsigned funding tx XDR
      const prepared = await apiRequest<{ transactionXdr: string }>(
        `/escrows/${createdEscrow.id}/fund/prepare`,
      );

      // 5) Ask wallet to sign
      setIsWalletSigning(true);
      const freighterNetwork = connectedNetwork === 'public' ? 'PUBLIC' : 'TESTNET';
      const signedXdrResult = await signTransaction(prepared.transactionXdr, {
        network: freighterNetwork,
      });
      setIsWalletSigning(false);

      const signedXdr =
        typeof signedXdrResult === 'string'
          ? signedXdrResult
          : (signedXdrResult as { signedTxXdr?: string; signedEnvelopeXdr?: string });
      const signedEnvelope =
        typeof signedXdr === 'string'
          ? signedXdr
          : signedXdr.signedTxXdr || signedXdr.signedEnvelopeXdr;

      if (!signedEnvelope) {
        throw new Error('Wallet did not return a signed transaction.');
      }

      // 6) Submit signed tx via backend fund endpoint
      const funded = await apiRequest<{ id: string; stellarTxHash?: string }>(
        `/escrows/${createdEscrow.id}/fund`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: Number(data.amount),
            signedTransactionXdr: signedEnvelope,
          }),
        },
      );

      if (!funded.stellarTxHash) {
        throw new Error('Funding succeeded but transaction hash is missing.');
      }

      const network = connectedNetwork === 'public' ? 'public' : 'testnet';
      setTxHash(funded.stellarTxHash);
      setExplorerUrl(explorerTxUrl(funded.stellarTxHash, network));
    } catch (error) {
      const message = parseErrorMessage(error);
      if (/reject|denied|declined|cancelled|canceled/i.test(message)) {
        setSubmitError('Transaction signing was canceled in wallet.');
      } else if (/insufficient/i.test(message)) {
        setSubmitError('Insufficient balance to fund this escrow.');
      } else if (/network/i.test(message)) {
        setSubmitError('Network error while creating or funding escrow.');
      } else {
        setSubmitError(message);
      }
    } finally {
      setIsWalletSigning(false);
      setIsSubmitting(false);
    }
  };

  if (txHash) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Escrow Created Successfully!</h2>
        <p className="text-gray-600">
          Your escrow agreement has been deployed to the network.
        </p>
        <div className="bg-gray-100 p-4 rounded-md break-all">
          <p className="text-xs text-gray-500 uppercase">Transaction Hash</p>
          <p className="font-mono text-sm text-gray-700">{txHash}</p>
        </div>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-blue-600 hover:text-blue-700 font-medium"
          >
            View on Stellar Explorer
          </a>
        )}
        <div className="pt-4">
          <button
            type="button"
            onClick={() => router.push(createdEscrowId ? `/escrow/${createdEscrowId}` : '/dashboard')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to Escrow Details
          </button>
          <p className="mt-2 text-xs text-gray-500">Redirecting automatically...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white lg:p-8 shadow rounded-lg border border-gray-100 min-h-[400px]">
        {/* Progress Indicator */}
        <nav aria-label="Progress" className="mb-12 lg:mb-20">
          <ol role="list" className="flex items-center w-full">
            {STEPS.map((step, stepIdx) => (
              <li
                key={step.id}
                className="relative flex-1"
              >
                {/* Connector Line */}
                {stepIdx !== STEPS.length - 1 && (
                  <div className="absolute top-5 left-1/2 w-full flex items-center" aria-hidden="true">
                    <div className={`h-0.5 w-full ${stepIdx < currentStep ? 'bg-blue-600' : 'bg-gray-200'} transition-colors duration-300 ease-in-out`} />
                  </div>
                )}

                <div className="relative flex flex-col items-center group">
                  <span className="flex items-center h-10 bg-white px-2 rounded-full z-10" aria-hidden="true">
                    {stepIdx < currentStep ? (
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 transition-colors duration-200">
                        <CheckCircle2 className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                    ) : stepIdx === currentStep ? (
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-600 bg-white" aria-current="step">
                        <div className="h-3 w-3 rounded-full bg-blue-600" aria-hidden="true" />
                      </div>
                    ) : (
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-300 bg-white group-hover:border-gray-400 transition-colors duration-200">
                        <div className="h-3 w-3 rounded-full bg-transparent group-hover:bg-gray-200" aria-hidden="true" />
                      </div>
                    )}
                  </span>
                  <span className={`absolute -bottom-8 w-max text-center text-sm font-medium transition-colors duration-200 ${stepIdx <= currentStep ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                    {step.title}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </nav>

        {/* Main Content */}
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>

            {/* Steps */}
            <div className="mt-4">
              {currentStep === 0 && <BasicInfoStep />}
              {currentStep === 1 && <PartiesStep />}
              {currentStep === 2 && <TermsStep />}
              {currentStep === 3 && <ReviewStep />}
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="mt-6 p-4 rounded-md bg-red-50 flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                <p className="text-sm text-red-500">{submitError}</p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 0 || isSubmitting}
                className={`flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${currentStep === 0 ? 'invisible' : ''
                  }`}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </button>

              {currentStep === STEPS.length - 1 ? (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center px-6 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isWalletSigning ? 'Awaiting wallet signature...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      Create Escrow
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
