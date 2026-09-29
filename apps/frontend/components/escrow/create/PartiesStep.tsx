"use client";

import { useFormContext } from "react-hook-form";
import { CreateEscrowFormData } from "@/lib/escrow-schema";
import Input from "@/components/ui/input";
import { useTranslations } from 'next-intl';

export default function PartiesStep() {
  const t = useTranslations('createEscrow');
  const {
    register,
    formState: { errors },
  } = useFormContext<CreateEscrowFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t('partiesTitle')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('partiesHelp')}
        </p>

        {/* Counterparty Address Field */}
        <Input
          label={t('counterpartyAddress')}
          placeholder={t('counterpartyPlaceholder')}
          helperText={t('counterpartyHelp')}
          error={errors.counterpartyAddress?.message}
          {...register("counterpartyAddress")}
        />
      </div>
    </div>
  );
}
