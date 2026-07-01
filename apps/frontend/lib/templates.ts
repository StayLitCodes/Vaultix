import { z } from 'zod';
import { CreateEscrowFormData, milestoneItemSchema, conditionItemSchema } from './escrow-schema';

// Template schema
export const escrowTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  isBuiltIn: z.boolean(),
  data: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.enum(['service', 'goods', 'milestone', 'other']).optional(),
    amount: z.string().optional(),
    asset: z.string().optional(),
    deadlineDays: z.number().optional(),
    milestones: z.array(milestoneItemSchema).optional(),
    conditions: z.array(conditionItemSchema).optional(),
  }),
});

export type EscrowTemplate = z.infer<typeof escrowTemplateSchema>;

// Built-in templates
export const BUILT_IN_TEMPLATES: EscrowTemplate[] = [
  {
    id: 'freelance-payment',
    name: 'Freelance Payment',
    description: 'Perfect for freelance projects with milestone-based payments',
    icon: 'Briefcase',
    isBuiltIn: true,
    data: {
      title: 'Freelance Project',
      description: 'Milestone-based payment agreement for freelance services',
      category: 'service',
      amount: '1000',
      asset: 'XLM',
      deadlineDays: 30,
      milestones: [
        { description: 'Project Kickoff & Initial Deliverables', amount: '300' },
        { description: 'Final Delivery & Approval', amount: '700' },
      ],
    },
  },
  {
    id: 'product-purchase',
    name: 'Product Purchase',
    description: 'Simple escrow for buying and selling physical or digital goods',
    icon: 'ShoppingCart',
    isBuiltIn: true,
    data: {
      title: 'Product Purchase',
      description: 'Secure payment for goods transaction',
      category: 'goods',
      amount: '500',
      asset: 'XLM',
      deadlineDays: 14,
      milestones: [
        { description: 'Delivery & Acceptance', amount: '500' },
      ],
    },
  },
  {
    id: 'service-agreement',
    name: 'Service Agreement',
    description: 'Multi-phase service contract with progressive payments',
    icon: 'Handshake',
    isBuiltIn: true,
    data: {
      title: 'Service Agreement',
      description: 'Escrow for ongoing service provision with multiple milestones',
      category: 'service',
      amount: '1500',
      asset: 'XLM',
      deadlineDays: 60,
      milestones: [
        { description: 'Phase 1 Completion', amount: '500' },
        { description: 'Phase 2 Completion', amount: '500' },
        { description: 'Final Sign-off', amount: '500' },
      ],
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Start with a blank template and configure everything yourself',
    icon: 'Settings',
    isBuiltIn: true,
    data: {},
  },
];

// Convert template data to form data
export function templateToFormData(template: EscrowTemplate): Partial<CreateEscrowFormData> {
  const data = template.data;
  const formData: Partial<CreateEscrowFormData> = {
    milestones: [],
    conditions: [],
    asset: 'XLM',
  };

  if (data.title) formData.title = data.title;
  if (data.description) formData.description = data.description;
  if (data.category) formData.category = data.category;
  if (data.amount) formData.amount = data.amount;
  if (data.asset) formData.asset = data.asset;
  if (data.deadlineDays) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + data.deadlineDays);
    formData.deadline = deadline;
  }
  if (data.milestones) formData.milestones = data.milestones;
  if (data.conditions) formData.conditions = data.conditions;

  return formData;
}

// Convert form data to template data
export function formDataToTemplateData(formData: CreateEscrowFormData) {
  return {
    title: formData.title,
    description: formData.description,
    category: formData.category,
    amount: formData.amount,
    asset: formData.asset,
    milestones: formData.milestones,
    conditions: formData.conditions,
  };
}
