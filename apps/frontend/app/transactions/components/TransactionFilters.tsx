'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Download, Search, X } from 'lucide-react';

interface TransactionFiltersProps {
  filters: any;
  onFilterChange: (key: string, value: any) => void;
  onExport: () => void;
  onClear: () => void;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({ 
  filters, 
  onFilterChange, 
  onExport,
  onClear
}) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Type</label>
          <Select 
            value={filters.type || 'all'} 
            onValueChange={(val) => onFilterChange('type', val === 'all' ? '' : val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="funding">Funding</SelectItem>
              <SelectItem value="milestone_release">Milestone Release</SelectItem>
              <SelectItem value="completion">Completion</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
              <SelectItem value="dispute_resolution">Dispute Resolution</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">From Date</label>
          <Input 
            type="date" 
            value={filters.fromDate || ''} 
            onChange={(e) => onFilterChange('fromDate', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">To Date</label>
          <Input 
            type="date" 
            value={filters.toDate || ''} 
            onChange={(e) => onFilterChange('toDate', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sort By</label>
          <Select 
            value={filters.sortBy || 'timestamp'} 
            onValueChange={(val) => onFilterChange('sortBy', val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timestamp">Date</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search amount range..." 
              className="pl-10"
              type="text"
              onChange={(e) => {
                // Simple parser for amount range search if needed
              }}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} className="text-slate-500">
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={onExport} className="w-full md:w-auto">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
};
