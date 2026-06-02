'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { CreateEscrowFormData } from '@/lib/escrow-schema';
import { PlusCircle, Trash2 } from 'lucide-react';

export default function MilestonesStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CreateEscrowFormData>();

  const { fields, append, remove } = useFieldArray({ control, name: 'milestones' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Milestones</h2>
        <p className="mt-1 text-sm text-gray-500">
          Break the escrow into milestones. Each milestone amount will be released when its condition is met.
        </p>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-gray-400 italic">No milestones added yet. Add one below, or skip to use a single-payment escrow.</p>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Milestone {index + 1}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                {...register(`milestones.${index}.description`)}
                placeholder="e.g. Initial design delivered"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.milestones?.[index]?.description && (
                <p className="mt-1 text-xs text-red-500">{errors.milestones[index]!.description!.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (XLM)</label>
              <input
                {...register(`milestones.${index}.amount`)}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.milestones?.[index]?.amount && (
                <p className="mt-1 text-xs text-red-500">{errors.milestones[index]!.amount!.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => append({ description: '', amount: '' })}
        className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Add Milestone</span>
      </button>
    </div>
  );
}
