'use client';

import { useFormContext } from 'react-hook-form';
import { CreateEscrowFormData } from '@/lib/escrow-schema';
import Input from '../../ui/Input';
import Select from '../../ui/Select';

export default function TermsStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CreateEscrowFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Escrow Terms</h2>
        <p className="text-sm text-gray-500">
          Define the financial terms and deadlines for this agreement.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Amount Field */}
          <div className="relative">
             <Input
                label="Amount"
                placeholder="0.00"
                error={errors.amount?.message}
                {...register('amount')}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pt-6 pointer-events-none">
                <span className="text-gray-500 sm:text-sm">XLM</span>
              </div>
          </div>

          {/* Asset Selector (Placeholder for now) */}
          <Select
            label="Asset"
            disabled
            {...register('asset')}
          >
             <option value="XLM">Stellar Lumens (XLM)</option>
              {/* Future: Add USDC, etc. */}
          </Select>
        </div>

        {/* Deadline Field */}
        <Input
          label="Deadline"
          type="datetime-local"
          helperText="The date and time by which the terms must be met."
          error={errors.deadline?.message}
          {...register('deadline', { valueAsDate: true })}
        />
      </div>
    </div>
  );
}
