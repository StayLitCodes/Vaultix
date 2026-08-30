"use client";

import React, { useState, useEffect } from "react";
import { Download, Filter, Calendar, ExternalLink, Loader2, TrendingUp, TrendingDown, Wallet, ArrowUpDown } from "lucide-react";
import { fetchEvents, IEventResponse } from "@/lib/escrow-api";
import { convertEventsToCSV, downloadCSV, generateTransactionFilename } from "@/lib/csv-export";
import { convertEventsToPDF, downloadPDF } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportDropdown, ExportFormat } from "@/components/ExportDropdown";
import { ExportModal } from "@/components/ExportModal";
import { useToast } from "@/hooks/useToast";
import { TransactionTableSkeleton } from "@/components/ui/TransactionTableSkeleton";

const EVENT_TYPES = [
  { value: "", label: "All Events" },
  { value: "FUNDED", label: "Funding" },
  { value: "COMPLETED", label: "Release" },
  { value: "CANCELLED", label: "Refund" },
  { value: "DISPUTED", label: "Dispute" },
  { value: "DISPUTE_FILED", label: "Dispute Filed" },
  { value: "DISPUTE_RESOLVED", label: "Dispute Resolved" },
  { value: "CREATED", label: "Created" },
  { value: "EXPIRED", label: "Expired" },
];

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const [events, setEvents] = useState<IEventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const { success, error } = useToast();

  // Filters
  const [eventType, setEventType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");

  // Running totals
  const [totals, setTotals] = useState({
    totalFunded: 0,
    totalReleased: 0,
    totalInEscrow: 0,
  });

  // Fetch events
  useEffect(() => {
    fetchTransactions();
  }, [page, eventType, dateFrom, dateTo, sortBy, sortOrder]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetchEvents({
        page,
        limit: PAGE_SIZE,
        eventType: eventType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      });

      setEvents(response.data);
      setTotal(response.total);

      // Calculate running totals from all events
      calculateTotals(response.data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (eventsData: IEventResponse[]) => {
    let funded = 0;
    let released = 0;

    eventsData.forEach((event) => {
      const amount = event.escrow?.amount || 0;

      if (event.eventType === "FUNDED") {
        funded += amount;
      } else if (event.eventType === "COMPLETED") {
        released += amount;
      }
    });

    setTotals({
      totalFunded: funded,
      totalReleased: released,
      totalInEscrow: funded - released,
    });
  };

  const handleExportClick = (format: ExportFormat) => {
    setExportFormat(format);
    setExportModalOpen(true);
  };

  const handleExportConfirm = async (exportDateFrom: string, exportDateTo: string) => {
    setIsExporting(true);
    setExportModalOpen(false);

    try {
      // Fetch all events with the selected date range (no pagination for export)
      const response = await fetchEvents({
        page: 1,
        limit: 10000, // Large limit to get all data
        eventType: eventType || undefined,
        dateFrom: exportDateFrom || undefined,
        dateTo: exportDateTo || undefined,
        sortBy,
        sortOrder,
      });

      // Use setTimeout to allow UI to update before heavy processing
      setTimeout(() => {
        try {
          const filename = generateTransactionFilename(exportFormat);

          if (exportFormat === "csv") {
            const csvContent = convertEventsToCSV(response.data);
            downloadCSV(csvContent, filename);
            success(`Successfully exported ${response.data.length} transactions to CSV`);
          } else {
            const pdfDoc = convertEventsToPDF(response.data);
            downloadPDF(pdfDoc, filename);
            success(`Successfully exported ${response.data.length} transactions to PDF`);
          }
        } catch (err) {
          error("Failed to generate export file");
          console.error("Export error:", err);
        } finally {
          setIsExporting(false);
        }
      }, 100);
    } catch (err) {
      error("Failed to fetch data for export");
      console.error("Fetch error:", err);
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setEventType("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case "FUNDED":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      case "DISPUTED":
      case "DISPUTE_FILED":
        return "bg-yellow-100 text-yellow-800";
      case "DISPUTE_RESOLVED":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType.replace(/_/g, " ").toLowerCase();
  };

  const getExplorerUrl = (txHash: string) => {
    if (!txHash) return "";
    return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Transaction History</h1>
          <p className="text-muted-foreground">View and export all your escrow-related transactions</p>
        </div>

        {/* Running Totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg shadow p-6 border-l-4 border-blue-500 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Funded</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.totalFunded.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 7,
                  })}{" "}
                  XLM
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6 border-l-4 border-green-500 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Released</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.totalReleased.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 7,
                  })}{" "}
                  XLM
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6 border-l-4 border-orange-500 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total In Escrow</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.totalInEscrow.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 7,
                  })}{" "}
                  XLM
                </p>
              </div>
              <Wallet className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-card rounded-lg shadow p-4 mb-6 border border-border">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Event Type Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-foreground mb-1 block">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="text-sm"
              />
            </div>

            {/* Date To */}
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-foreground mb-1 block">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="text-sm"
              />
            </div>

            {/* Sort Order */}
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Sort By</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split("-");
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder as "ASC" | "DESC");
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="createdAt-DESC">Newest First</option>
                <option value="createdAt-ASC">Oldest First</option>
              </select>
            </div>

            {/* Clear Filters */}
            <Button variant="outline" onClick={clearFilters} className="flex items-center gap-1">
              <Filter className="w-4 h-4" />
              Clear
            </Button>

            {/* Export */}
            <ExportDropdown onExport={handleExportClick} disabled={events.length === 0} isLoading={isExporting} />
          </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
          {loading ? (
            <TransactionTableSkeleton />
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-foreground text-lg">No transactions found</p>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters or date range</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Escrow</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Event Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {events.map((event) => {
                      const txHash = event.data?.transactionHash || event.data?.stellarTxHash;

                      return (
                        <tr key={event.id} className="hover:bg-accent/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {new Date(event.createdAt).toLocaleDateString()}
                            <div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleTimeString()}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-foreground">{event.escrow?.title || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground font-mono">{event.escrowId.slice(0, 8)}...</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={getEventTypeColor(event.eventType)}>{formatEventType(event.eventType)}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {event.escrow ? (
                              <div>
                                <div className="font-medium">
                                  {Number(event.escrow.amount).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 7,
                                  })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {event.escrow.assetIssuer ? `${event.escrow.assetCode}:${event.escrow.assetIssuer.slice(0, 8)}...` : event.escrow.assetCode}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              className={
                                event.escrow?.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : event.escrow?.status === "ACTIVE"
                                    ? "bg-blue-100 text-blue-800"
                                    : event.escrow?.status === "CANCELLED"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                              }
                            >
                              {event.escrow?.status || "N/A"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {txHash ? (
                              <a
                                href={getExplorerUrl(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <span className="font-mono text-xs">{txHash.slice(0, 8)}...</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-muted/50 px-6 py-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-foreground">
                    Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to <span className="font-medium">{Math.min(page * PAGE_SIZE, total)}</span>{" "}
                    of <span className="font-medium">{total}</span> results
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} onConfirm={handleExportConfirm} isLoading={isExporting} />
    </div>
  );
}
