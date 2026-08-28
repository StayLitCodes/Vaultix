// Closes #479: URL query param persistence for transaction history filters
// (date range + escrow + type), so filtered views are shareable. Starter
// serialize/parse helpers; wiring these into the transactions page filter
// bar, CSV/PDF export, and a filter-count badge is a follow-up.

export interface TransactionFilters {
  from?: string;
  to?: string;
  escrowId?: string;
  type?: 'funding' | 'release' | 'refund' | 'fee';
}

export function filtersToSearchParams(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.escrowId) params.set('escrowId', filters.escrowId);
  if (filters.type) params.set('type', filters.type);
  return params;
}

export function searchParamsToFilters(params: URLSearchParams): TransactionFilters {
  const type = params.get('type');
  return {
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    escrowId: params.get('escrowId') ?? undefined,
    type: type === 'funding' || type === 'release' || type === 'refund' || type === 'fee' ? type : undefined,
  };
}

export function countActiveFilters(filters: TransactionFilters): number {
  return Object.values(filters).filter(Boolean).length;
}
