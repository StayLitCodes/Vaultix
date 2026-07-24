"use client";

import React, { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Download,
  Filter,
  Calendar,
  ExternalLink,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpDown,
} from "lucide-react";
import { fetchEvents, IEventResponse } from "@/lib/escrow-api";
import {
  convertEventsToCSV,
  downloadCSV,
  generateTransactionFilename,
} from "@/lib/csv-export";
import { convertEventsToPDF, downloadPDF } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportDropdown, ExportFormat } from "@/components/ExportDropdown";
import { ExportModal } from "@/components/ExportModal";
import { useToast } from "@/hooks/useToast";
import { formatDate, formatNumber } from "@/lib/locale";

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
  const locale = useLocale();
  const t = useTranslations("transactions");

  const EVENT_TYPES = [
    { value: "", label: t("filters.allEvents") },
    { value: "FUNDED", label: t("filters.funding") },
    { value: "COMPLETED", label: t("filters.release") },
    { value: "CANCELLED", label: t("filters.refund") },
    { value: "DISPUTED", label: t("filters.dispute") },
    { value: "DISPUTE_FILED", label: t("filters.disputeFiled") },
    { value: "DISPUTE_RESOLVED", label: t("filters.disputeResolved") },
    { value: "CREATED", label: t("filters.created") },
    { value: "EXPIRED", label: t("filters.expired") },
  ];

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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t("title")}
          </h1>
          <p className="text-gray-600">
            {t("description")}
          </p>
        </div>

        {/* Running Totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t("totals.funded")}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(totals.totalFunded, locale)}{" "}
                  XLM
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t("totals.released")}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(totals.totalReleased, locale)}{" "}
                  XLM
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t("totals.inEscrow")}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(totals.totalInEscrow, locale)}{" "}
                  XLM
                </p>
              </div>
              <Wallet className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Event Type Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {t("filters.eventType")}
              </label>
              <select
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {t("filters.fromDate")}
              </label>
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {t("filters.toDate")}
              </label>
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {t("filters.sortBy")}
              </label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split("-");
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder as "ASC" | "DESC");
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="createdAt-DESC">{t("filters.newestFirst")}</option>
                <option value="createdAt-ASC">{t("filters.oldestFirst")}</option>
              </select>
            </div>

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={clearFilters}
              className="flex items-center gap-1"
            >
              <Filter className="w-4 h-4" />
              {t("filters.clear")}
            </Button>

            {/* Export */}
            <ExportDropdown
              onExport={handleExportClick}
              disabled={events.length === 0}
              isLoading={isExporting}
            />
          </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">{t("empty.title")}</p>
              <p className="text-gray-400 text-sm mt-1">
                {t("empty.description")}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("table.date")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("table.escrow")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("table.eventType")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("table.amount")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("table.status")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("table.txHash")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {events.map((event) => {
                      const txHash =
                        event.data?.transactionHash ||
                        event.data?.stellarTxHash;

                      return (
                        <tr key={event.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(new Date(event.createdAt), locale)}
                            <div className="text-xs text-gray-500">
                              {new Date(event.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {event.escrow?.title || t("unknown")}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {event.escrowId.slice(0, 8)}...
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              className={getEventTypeColor(event.eventType)}
                            >
                              {formatEventType(event.eventType)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {event.escrow ? (
                              <div>
                                <div className="font-medium">
                                  {formatNumber(Number(event.escrow.amount), locale)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {event.escrow.assetIssuer
                                    ? `${event.escrow.assetCode}:${event.escrow.assetIssuer.slice(0, 8)}...`
                                    : event.escrow.assetCode}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">{t("na")}</span>
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
                              {event.escrow?.status || t("na")}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {txHash ? (
                              <a
                                href={getExplorerUrl(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              >
                                <span className="font-mono text-xs">
                                  {txHash.slice(0, 8)}...
                                </span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-gray-400">{t("na")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    {t("pagination.showing")}{" "}
                    <span className="font-medium">
                      {(page - 1) * PAGE_SIZE + 1}
                    </span>{" "}
                    {t("pagination.to")}{" "}
                    <span className="font-medium">
                      {Math.min(page * PAGE_SIZE, total)}
                    </span>{" "}
                    {t("pagination.of")} <span className="font-medium">{total}</span> {t("pagination.results")}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      {t("pagination.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onConfirm={handleExportConfirm}
        isLoading={isExporting}
      />
    </div>
  );
}
