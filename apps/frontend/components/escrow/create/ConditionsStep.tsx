'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { CreateEscrowFormData } from '@/lib/escrow-schema';
import { PlusCircle, Trash2 } from 'lucide-react';

const CONDITION_TYPES = [
  { value: 'manual', label: 'Manual — a party manually confirms completion' },
  { value: 'time', label: 'Time-based — releases after a specific date/time' },
  { value: 'oracle', label: 'Oracle — an external oracle signals completion' },
];

export default function ConditionsStep() {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<CreateEscrowFormData>();

  const { fields, append, remove } = useFieldArray({ control, name: 'conditions' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Release Conditions</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define the conditions that must be met before funds are released. Leave empty for a fully manual escrow.
        </p>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-gray-400 italic">No conditions added. Funds will be released manually by the parties.</p>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => {
          const conditionType = watch(`conditions.${index}.type`);
          return (
            <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Condition {index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  {...register(`conditions.${index}.type`)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {CONDITION_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  {...register(`conditions.${index}.description`)}
                  placeholder="Describe the condition"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {conditionType === 'time' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Release Date</label>
                  <input
                    {...register(`conditions.${index}.releaseDate`)}
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => append({ type: 'manual', description: '', releaseDate: '' })}
        className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Add Condition</span>
      </button>
    </div>
  );
}
