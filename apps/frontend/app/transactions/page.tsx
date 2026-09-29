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
import { CanonicalEscrowStatus } from '@/utils/escrowStatus';
import { useLocale, useTranslations } from 'next-intl';
import { formatLocaleDate, type Locale } from '@/lib/i18n';

const EVENT_TYPES = [
  { value: "", label: "allEvents" },
  { value: "FUNDED", label: "funding" },
  { value: "COMPLETED", label: "release" },
  { value: "CANCELLED", label: "refund" },
  { value: "DISPUTED", label: "dispute" },
  { value: "DISPUTE_FILED", label: "disputeFiled" },
  { value: "DISPUTE_RESOLVED", label: "disputeResolved" },
  { value: "CREATED", label: "created" },
  { value: "EXPIRED", label: "expired" },
] as const;

const STATUS_MESSAGE_KEYS: Record<CanonicalEscrowStatus, string> = {
  [CanonicalEscrowStatus.CREATED]: 'pending',
  [CanonicalEscrowStatus.FUNDED]: 'funded',
  [CanonicalEscrowStatus.ACTIVE]: 'active',
  [CanonicalEscrowStatus.DISPUTED]: 'disputed',
  [CanonicalEscrowStatus.RESOLVED]: 'resolved',
  [CanonicalEscrowStatus.REFUNDED]: 'refunded',
  [CanonicalEscrowStatus.CANCELLED]: 'cancelled',
  [CanonicalEscrowStatus.COMPLETED]: 'completed',
  [CanonicalEscrowStatus.EXPIRED]: 'expired',
  [CanonicalEscrowStatus.UNKNOWN]: 'unknown',
};

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const t = useTranslations("transactions");
  const statusT = useTranslations('dashboardCards.status');
  const locale = useLocale() as Locale;
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
            success(t("exportedCsv", { count: response.data.length }));
          } else {
            const pdfDoc = convertEventsToPDF(response.data);
            downloadPDF(pdfDoc, filename);
            success(t("exportedPdf", { count: response.data.length }));
          }
        } catch (err) {
          error(t("exportFailed"));
          console.error("Export error:", err);
        } finally {
          setIsExporting(false);
        }
      }, 100);
    } catch (err) {
      error(t("fetchExportFailed"));
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
    const eventLabel = EVENT_TYPES.find((type) => type.value === eventType)?.label;
    return eventLabel ? t(eventLabel) : t("unknown");
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
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* Running Totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg shadow p-6 border-l-4 border-blue-500 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("totalFunded")}</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.totalFunded.toLocaleString(locale, {
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
                <p className="text-sm text-muted-foreground mb-1">{t("totalReleased")}</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.totalReleased.toLocaleString(locale, {
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
                <p className="text-sm text-muted-foreground mb-1">{t("totalInEscrow")}</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.totalInEscrow.toLocaleString(locale, {
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
              <label className="text-sm font-medium text-foreground mb-1 block">{t("eventType")}</label>
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
                    {t(type.label)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-foreground mb-1 block">{t("fromDate")}</label>
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
              <label className="text-sm font-medium text-foreground mb-1 block">{t("toDate")}</label>
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
              <label className="text-sm font-medium text-foreground mb-1 block">{t("sortBy")}</label>
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
                <option value="createdAt-DESC">{t("newestFirst")}</option>
                <option value="createdAt-ASC">{t("oldestFirst")}</option>
              </select>
            </div>

            {/* Clear Filters */}
            <Button variant="outline" onClick={clearFilters} className="flex items-center gap-1">
              <Filter className="w-4 h-4" />
              {t("clear")}
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
              <p className="text-foreground text-lg">{t("noTransactions")}</p>
              <p className="text-muted-foreground text-sm mt-1">{t("adjustFilters")}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("date")}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("escrow")}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("eventType")}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("amount")}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("status")}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("txHash")}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {events.map((event) => {
                      const txHash = event.data?.transactionHash || event.data?.stellarTxHash;

                      return (
                        <tr key={event.id} className="hover:bg-accent/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {formatLocaleDate(new Date(event.createdAt), locale)}
                            <div className="text-xs text-muted-foreground">{formatLocaleDate(new Date(event.createdAt), locale, { hour: "2-digit", minute: "2-digit" })}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-foreground">{event.escrow?.title || t("unknown")}</div>
                            <div className="text-xs text-muted-foreground font-mono">{event.escrowId.slice(0, 8)}...</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={getEventTypeColor(event.eventType)}>{formatEventType(event.eventType)}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {event.escrow ? (
                              <div>
                                <div className="font-medium">
                                  {Number(event.escrow.amount).toLocaleString(locale, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 7,
                                  })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {event.escrow.assetIssuer ? `${event.escrow.assetCode}:${event.escrow.assetIssuer.slice(0, 8)}...` : event.escrow.assetCode}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{t("notAvailable")}</span>
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
                              {event.escrow ? statusT(STATUS_MESSAGE_KEYS[event.escrow.status]) : t("notAvailable")}
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
                              <span className="text-muted-foreground">{t("notAvailable")}</span>
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
                    {t("showing")} <span className="font-medium">{((page - 1) * PAGE_SIZE + 1).toLocaleString(locale)}</span> {t("to")} <span className="font-medium">{Math.min(page * PAGE_SIZE, total).toLocaleString(locale)}</span>{" "}
                    {t("of")} <span className="font-medium">{total.toLocaleString(locale)}</span> {t("results")}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      {t("previous")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      {t("next")}
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
