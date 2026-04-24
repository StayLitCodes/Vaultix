'use client';

import React, { useState, useEffect } from 'react';
import { TransactionService } from '@/services/transaction';
import { ITransaction, ITransactionFilters } from '@/types/transaction';
import { TransactionTable } from './components/TransactionTable';
import { TransactionFilters } from './components/TransactionFilters';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { toast } from 'sonner';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ITransactionFilters>({
    page: 1,
    pageSize: 20,
    sortBy: 'timestamp',
    sortOrder: 'DESC',
  });
  const [totalPages, setTotalPages] = useState(1);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await TransactionService.getTransactions(filters);
      setTransactions(response.data);
      setTotalPages(response.totalPages);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast.error(error.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setFilters(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleExport = () => {
    TransactionService.exportToCSV(transactions, `vaultix-transactions-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Transactions exported successfully');
  };

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      pageSize: 20,
      sortBy: 'timestamp',
      sortOrder: 'DESC',
    });
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <History className="h-8 w-8 text-blue-600" />
            Transaction History
          </h1>
          <p className="text-slate-500 mt-1">
            Track all your fund movements across deposits, releases, and refunds.
          </p>
        </div>
      </div>

      <TransactionFilters 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        onExport={handleExport}
        onClear={handleClearFilters}
      />

      <div className="bg-slate-50/50 p-1 rounded-2xl border border-slate-100">
        <TransactionTable transactions={transactions} isLoading={loading} />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">
            Showing page <span className="font-medium text-slate-900">{filters.page}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange((filters.page || 1) - 1)}
              disabled={filters.page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange((filters.page || 1) + 1)}
              disabled={filters.page === totalPages || loading}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
