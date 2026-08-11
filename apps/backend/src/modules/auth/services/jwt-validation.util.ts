export function validateJwtSecret(secret?: string): string {
  const isTest = process.env.NODE_ENV === 'test';
  if (!secret) {
    if (isTest) return 'test-jwt-secret-key-32-chars-long-minimum';
    throw new Error('JWT_SECRET environment variable is required and missing.');
  }

  const defaultValues = [
    'your-secret-key-change-in-production',
    'your-super-secret-jwt-key-change-in-production',
  ];
  if (defaultValues.includes(secret)) {
    throw new Error('JWT_SECRET must not use default placeholder value.');
  }

  if (!isTest && secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  return secret;
}
