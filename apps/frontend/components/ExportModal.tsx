"use client";

import React, { useState } from "react";
import { X, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dateFrom: string, dateTo: string) => void;
  isLoading?: boolean;
}

export function ExportModal({ isOpen, onClose, onConfirm, isLoading = false }: ExportModalProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(dateFrom, dateTo);
  };

  const handleClearDates = () => {
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Select Date Range
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full"
            />
          </div>

          <p className="text-xs text-gray-500">
            Leave both fields empty to export all transactions
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={handleClearDates}
            disabled={isLoading}
            className="flex-1"
          >
            Clear Dates
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              "Export"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
