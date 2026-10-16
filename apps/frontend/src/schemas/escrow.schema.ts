// frontend/src/schemas/escrow.schema.ts
import { z } from 'zod';

// Exact decimal string validator preventing floating-point drift and trailing non-numeric characters
const exactDecimalStringSchema = z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,8})?$/, 'Must be a valid positive decimal number with up to 8 decimal places')
    .refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num <= 1_000_000_000;
    }, 'Amount must be greater than zero and within permitted mainnet limits');

export const escrowMilestoneSchema = z.object({
    title: z.string().min(3, 'Milestone title must be at least 3 characters'),
    amount: exactDecimalStringSchema,
});

export const escrowSubmissionSchema = z
    .object({
        totalEscrowAmount: exactDecimalStringSchema,
        milestones: z
            .array(escrowMilestoneSchema)
            .min(1, 'Escrow must contain at least one milestone'),
    })
    .refine(
        (data) => {
            // Convert exact decimal strings to BigInt integer units (scaled by 10^8) to avoid IEEE 754 floating-point errors
            const scaleFactor = 100_000_000n;
            
            try {
                const totalBigInt = BigInt(Math.round(parseFloat(data.totalEscrowAmount) * Number(scaleFactor)));
                
                const milestoneSumBigInt = data.milestones.reduce((sum, m) => {
                    const mBigInt = BigInt(Math.round(parseFloat(m.amount) * Number(scaleFactor)));
                    return sum + mBigInt;
                }, 0n);

                return totalBigInt === milestoneSumBigInt;
            } catch {
                return false;
            }
        },
        {
            message: 'Sum of all milestone amounts must exactly equal the total escrow amount without floating-point drift',
            path: ['milestones'],
        }
    );

export type EscrowSubmissionFormValues = z.infer<typeof escrowSubmissionSchema>;