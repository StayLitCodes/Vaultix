'use client';

import { useFormContext } from 'react-hook-form';
import { CreateEscrowFormData } from '@/lib/escrow-schema';
import Input from '../../ui/Input';
import TextArea from '../../ui/TextArea';
import Select from '../../ui/Select';

export default function BasicInfoStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CreateEscrowFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
        <p className="text-sm text-gray-500">
          Start by providing the basic details about this escrow agreement.
        </p>

        {/* Title Field */}
        <Input
          label="Title"
          placeholder="e.g. Web Development Project"
          error={errors.title?.message}
          {...register('title')}
        />

        {/* Category Field */}
        <Select
          label="Category"
          error={errors.category?.message}
          {...register('category')}
        >
          <option value="">Select a category</option>
          <option value="service">Service</option>
          <option value="goods">Goods</option>
          <option value="milestone">Milestone-based</option>
          <option value="other">Other</option>
        </Select>

        {/* Description Field */}
        <TextArea
          label="Description"
          placeholder="Describe the agreement details..."
          rows={4}
          error={errors.description?.message}
          {...register('description')}
        />
      </div>
    </div>
  );
}
