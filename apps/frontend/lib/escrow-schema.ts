import { z } from 'zod';
import { StrKey } from 'stellar-sdk';

export const basicInfoSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Description is too long'),
  category: z.enum(['service', 'goods', 'milestone', 'other'], {
    message: 'Please select a category',
  }),
});

export const partiesSchema = z.object({
  counterpartyAddress: z.string().refine((val) => {
    try {
      return StrKey.isValidEd25519PublicKey(val);
    } catch {
      return false;
    }
  }, {
    message: 'Invalid Stellar address',
  }),
});

export const termsSchema = z.object({
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, {
    message: 'Amount must be a positive number',
  }),
  asset: z.string().min(1, 'Asset is required'),
  deadline: z.date().refine((date) => date > new Date(), {
    message: 'Deadline must be in the future',
  }),
});

export const milestoneItemSchema = z.object({
  description: z.string().min(3, 'Description must be at least 3 characters'),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, { message: 'Amount must be a positive number' }),
});

export const milestonesSchema = z.object({
  milestones: z.array(milestoneItemSchema),
});

export const conditionItemSchema = z.object({
  type: z.enum(['manual', 'time', 'oracle']),
  description: z.string().optional(),
  releaseDate: z.string().optional(),
});

export const conditionsSchema = z.object({
  conditions: z.array(conditionItemSchema),
});

// Combined schema for the full form state
export const createEscrowSchema = basicInfoSchema
  .merge(partiesSchema)
  .merge(termsSchema)
  .merge(milestonesSchema)
  .merge(conditionsSchema);

export type CreateEscrowFormData = z.infer<typeof createEscrowSchema>;
export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
export type PartiesFormData = z.infer<typeof partiesSchema>;
export type TermsFormData = z.infer<typeof termsSchema>;
export type MilestoneItem = z.infer<typeof milestoneItemSchema>;
export type ConditionItem = z.infer<typeof conditionItemSchema>;
