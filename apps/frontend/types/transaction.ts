export interface ITransaction {
  id: string;
  date: string;
  type: string;
  escrowId?: string;
  escrowTitle?: string;
  amount: number;
  asset: string;
  counterpartyAddress: string;
  txHash: string;
}

export interface ITransactionFilters {
  page?: number;
  pageSize?: number;
  type?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'timestamp' | 'amount';
  sortOrder?: 'ASC' | 'DESC';
}

export interface ITransactionResponse {
  data: ITransaction[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
}
