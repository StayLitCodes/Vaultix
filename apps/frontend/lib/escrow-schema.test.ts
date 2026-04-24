import { basicInfoSchema, partiesSchema, termsSchema } from './escrow-schema';

describe('Escrow Validation Schemas', () => {
  describe('basicInfoSchema', () => {
    it('should validate valid basic info', () => {
      const validData = {
        title: 'Project Development',
        description: 'Building a new web application using React and Next.js',
        category: 'service',
      };
      const result = basicInfoSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject short title', () => {
      const invalidData = {
        title: 'Proj',
        description: 'Building a new web application using React and Next.js',
        category: 'service',
      };
      const result = basicInfoSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.title).toContain('Title must be at least 5 characters');
      }
    });

    it('should reject short description', () => {
      const invalidData = {
        title: 'Project Development',
        description: 'Short desc',
        category: 'service',
      };
      const result = basicInfoSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.description).toContain('Description must be at least 10 characters');
      }
    });

    it('should reject invalid category', () => {
      const invalidData = {
        title: 'Project Development',
        description: 'Building a new web application using React and Next.js',
        category: 'invalid-category',
      };
      const result = basicInfoSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('partiesSchema', () => {
    it('should validate a correct Stellar address', () => {
      // GBAH... is a valid Stellar prefix
      const realValidAddress = 'GBAH4VETEJSTLXU7I6I7DTH2W57YI6XWUT2C7O7XWS6QW2LWSXUUT2C7'; 
      const result = partiesSchema.safeParse({ counterpartyAddress: realValidAddress });
      expect(result.success).toBe(true);
    });

    it('should reject an invalid Stellar address', () => {
      const result = partiesSchema.safeParse({ counterpartyAddress: 'invalid-address' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.counterpartyAddress).toContain('Invalid Stellar address');
      }
    });
  });

  describe('termsSchema', () => {
    it('should validate valid terms', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1); // Way in the future
      
      const validData = {
        amount: '100.5',
        asset: 'XLM',
        deadline: futureDate,
      };
      const result = termsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative amount', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const result = termsSchema.safeParse({
        amount: '-10',
        asset: 'XLM',
        deadline: futureDate,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.amount).toContain('Amount must be a positive number');
      }
    });

    it('should reject past deadline', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1); // Definitely in the past
      
      const result = termsSchema.safeParse({
        amount: '100',
        asset: 'XLM',
        deadline: pastDate,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.deadline).toContain('Deadline must be in the future');
      }
    });
  });
});
