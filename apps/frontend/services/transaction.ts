import { ITransactionFilters, ITransactionResponse } from '@/types/transaction';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';

const buildApiUrl = (path: string) => {
  if (apiBaseUrl) {
    return `${apiBaseUrl}${path}`;
  }
  return `/api${path}`;
};

export class TransactionService {
  static async getTransactions(filters: ITransactionFilters = {}): Promise<ITransactionResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(buildApiUrl(`/transactions?${params.toString()}`), {
      headers: {
        'Content-Type': 'application/json',
        // Auth token should be handled by a global fetch wrapper or interceptor
        // If not, we'd need to get it from local storage or context here
        'Authorization': `Bearer ${localStorage.getItem('token')}`, 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch transactions');
    }

    return response.json();
  }

  static exportToCSV(data: any[], filename: string = 'transactions.csv') {
    if (data.length === 0) return;

    const headers = ['Date', 'Type', 'Escrow Title', 'Amount', 'Asset', 'Counterparty', 'Transaction Hash'];
    const csvRows = [
      headers.join(','),
      ...data.map(row => [
        new Date(row.date).toLocaleString(),
        row.type,
        `"${row.escrowTitle || ''}"`,
        row.amount,
        row.asset,
        row.counterpartyAddress,
        row.txHash
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
