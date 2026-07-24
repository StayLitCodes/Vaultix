"use client";

import CreateEscrowWizard from '@/components/escrow/CreateEscrowWizard';
import { useTranslations } from 'next-intl';

export default function CreateEscrowPage() {
  const t = useTranslations('escrow.create');

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            {t('description')}
          </p>
        </div>

        <CreateEscrowWizard />
      </div>
    </div>
  );
}
