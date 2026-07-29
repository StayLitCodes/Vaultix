export const isValidStellarAddress = (address: string): boolean => {
  return typeof address === 'string' && address.startsWith('G') && address.length === 56;
};
