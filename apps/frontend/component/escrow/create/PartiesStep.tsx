'use client';

import { useFormContext } from 'react-hook-form';
import { CreateEscrowFormData } from '@/lib/escrow-schema';
import Input from '../../ui/Input';

export default function PartiesStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CreateEscrowFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Parties Involved</h2>
        <p className="text-sm text-gray-500">
          Specify the counterparty for this escrow. This is the address that will receive the funds or provide the service.
        </p>

        {/* Counterparty Address Field */}
        <Input
          label="Counterparty Stellar Address"
          placeholder="G..."
          helperText="Enter the public key (starts with G) of the other party."
          error={errors.counterpartyAddress?.message}
          {...register('counterpartyAddress')}
        />
      </div>
    </div>
  );
}
