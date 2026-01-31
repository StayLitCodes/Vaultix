export function truncateAddress(address: string, length: number = 8): string {
  if (!address) return '';
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function isStellarAddress(address: string): boolean {
  const stellarAddressRegex = /^G[A-Z0-9]{55}$/;
  return stellarAddressRegex.test(address);
}