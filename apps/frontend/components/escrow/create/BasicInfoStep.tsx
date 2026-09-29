"use client";

import { useFormContext } from "react-hook-form";
import { CreateEscrowFormData } from "@/lib/escrow-schema";
import Input from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import TextArea from "@/components/ui/textarea";
import { useTranslations } from 'next-intl';

export default function BasicInfoStep() {
  const t = useTranslations('createEscrow');
  const {
    register,
    formState: { errors },
  } = useFormContext<CreateEscrowFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t('basicTitle')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('basicHelp')}
        </p>

        {/* Title Field */}
        <Input
          label={t('title')}
          placeholder={t('titlePlaceholder')}
          error={errors.title?.message}
          {...register("title")}
        />

        {/* Category Field */}
        <Select
          label={t('category')}
          error={errors.category?.message}
          {...register("category")}
        >
          <option value="">{t('selectCategory')}</option>
          <option value="service">{t('service')}</option>
          <option value="goods">{t('goods')}</option>
          <option value="milestone">{t('milestoneBased')}</option>
          <option value="other">{t('other')}</option>
        </Select>

        {/* Description Field */}
        <TextArea
          label={t('description')}
          placeholder={t('descriptionPlaceholder')}
          rows={4}
          error={errors.description?.message}
          {...register("description")}
        />
      </div>
    </div>
  );
}
