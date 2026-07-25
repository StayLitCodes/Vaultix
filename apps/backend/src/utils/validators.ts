import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Custom validator for Stellar public key addresses
 * Stellar public keys are 56 characters long, start with 'G', and contain only uppercase letters and numbers
 * Format: G[A-Z0-9]{55}
 */
export function IsStellarAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStellarAddress',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }
          // Stellar public key format: G followed by 55 alphanumeric characters (base32)
          return /^G[A-Z0-9]{55}$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Stellar public key address (56 characters starting with 'G')`;
        },
      },
    });
  };
}
