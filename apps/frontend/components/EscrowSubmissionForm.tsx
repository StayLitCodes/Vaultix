// frontend/src/components/EscrowSubmissionForm.tsx
import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { escrowSubmissionSchema, EscrowSubmissionFormValues } from '../schemas/escrow.schema';

export const EscrowSubmissionForm: React.FC = () => {
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<EscrowSubmissionFormValues>({
        resolver: zodResolver(escrowSubmissionSchema),
        defaultValues: {
            totalEscrowAmount: '',
            milestones: [{ title: '', amount: '' }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'milestones',
    });

    const onSubmit = (data: EscrowSubmissionFormValues) => {
        // Proceed with secure exact-amount escrow submission
        console.log('Validated Escrow Payload:', data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl mx-auto p-8 bg-white rounded-3xl shadow-xl border border-slate-200">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 mb-6">Create Escrow Contract</h2>

            {/* Total Escrow Amount */}
            <div className="mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                    Total Escrow Amount (XLM)
                </label>
                <input
                    {...register('totalEscrowAmount')}
                    type="text"
                    placeholder="e.g. 1000.50"
                    aria-invalid={errors.totalEscrowAmount ? 'true' : 'false'}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-xs focus:border-blue-600 focus:outline-none"
                />
                {errors.totalEscrowAmount && (
                    <p className="mt-1.5 text-xs text-rose-600 font-medium" role="alert">
                        {errors.totalEscrowAmount.message}
                    </p>
                )}
            </div>

            {/* Milestones Section */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Milestones</span>
                    <button
                        type="button"
                        onClick={() => append({ title: '', amount: '' })}
                        className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                    >
                        + Add Milestone
                    </button>
                </div>

                {errors.milestones?.root && (
                    <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium" role="alert">
                        {errors.milestones.root.message}
                    </div>
                )}

                <div className="space-y-4">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-3 items-start p-4 rounded-2xl bg-slate-50 border border-slate-200">
                            <div className="flex-1">
                                <input
                                    {...register(`milestones.${index}.title` as const)}
                                    placeholder="Milestone title"
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs mb-2 focus:border-blue-600 focus:outline-none bg-white"
                                />
                                {errors.milestones?.[index]?.title && (
                                    <p className="text-[11px] text-rose-600 font-medium" role="alert">
                                        {errors.milestones[index]?.title?.message}
                                    </p>
                                )}
                            </div>
                            <div className="w-32">
                                <input
                                    {...register(`milestones.${index}.amount` as const)}
                                    placeholder="Amount"
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs mb-2 focus:border-blue-600 focus:outline-none bg-white"
                                />
                                {errors.milestones?.[index]?.amount && (
                                    <p className="text-[11px] text-rose-600 font-medium" role="alert">
                                        {errors.milestones[index]?.amount?.message}
                                    </p>
                                )}
                            </div>
                            {fields.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    className="mt-1 text-slate-400 hover:text-rose-600 text-sm font-bold px-2 py-1"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
            >
                Submit Escrow for Validation
            </button>
        </form>
    );
};