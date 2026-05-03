"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import StatusTabs from "@/component/dashboard/StatusTabs";
import EscrowList from "@/component/dashboard/EscrowList";
import EscrowFilters from "@/component/dashboard/EscrowFilters";
import { useEscrows } from "../../hooks/useEscrows";
import ActivityFeed from "@/components/common/ActivityFeed";
import Link from "next/link";
import { PlusCircle, Activity, X } from "lucide-react";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [showActivity, setShowActivity] = useState(false);

  const activeStatuses = searchParams.get("status")?.split(",").filter(Boolean) || [];
  const searchQuery = searchParams.get("search") || "";
  const sortBy = (searchParams.get("sort") as "date" | "amount" | "deadline") || "date";
  const sortOrder = (searchParams.get("order") as "asc" | "desc") || "desc";
  const minAmount = searchParams.get("minAmount") || "";
  const maxAmount = searchParams.get("maxAmount") || "";
  const fromDate = searchParams.get("fromDate") || "";
  const toDate = searchParams.get("toDate") || "";

  const hasActiveFilters = activeStatuses.length > 0 || searchQuery || minAmount || maxAmount || fromDate || toDate;

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([key, value]) => {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      });
      return params.toString();
    },
    [searchParams]
  );

  const handleToggleStatus = (status: string) => {
    let nextStatuses: string[];
    if (status === "all") {
      nextStatuses = [];
    } else {
      nextStatuses = activeStatuses.includes(status)
        ? activeStatuses.filter((s) => s !== status)
        : [...activeStatuses, status];
    }
    router.push(`${pathname}?${createQueryString({ status: nextStatuses.length ? nextStatuses.join(",") : null })}`);
  };

  const handleSearch = (query: string) => router.push(`${pathname}?${createQueryString({ search: query })}`);
  const handleSortChange = (field: "date" | "amount" | "deadline", order: "asc" | "desc") =>
    router.push(`${pathname}?${createQueryString({ sort: field, order })}`);
  const handleAmountChange = (min: string, max: string) =>
    router.push(`${pathname}?${createQueryString({ minAmount: min, maxAmount: max })}`);
  const handleDateChange = (from: string, to: string) =>
    router.push(`${pathname}?${createQueryString({ fromDate: from, toDate: to })}`);

  const { data: escrowsData, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useEscrows({
    status: activeStatuses.join(","),
    search: searchQuery,
    sortBy,
    sortOrder,
    minAmount,
    maxAmount,
    fromDate,
    toDate,
  });

  const flatEscrows = escrowsData?.pages.flatMap((page: any) => page.escrows) || [];

  return (
    <>
      {/* Mobile Activity Drawer */}
      {showActivity && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowActivity(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Activity Feed</h2>
              <button
                onClick={() => setShowActivity(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ActivityFeed />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 h-fit">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-800">Your Escrows</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowActivity(true)}
                className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 px-3"
              >
                <Activity className="w-4 h-4" />
                <span className="text-xs font-medium">Activity</span>
              </button>
              <Link
                href="/escrow/create"
                className="min-h-[44px] flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium px-3 hover:bg-blue-700 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">New Escrow</span>
              </Link>
              {hasActiveFilters && (
                <button
                  onClick={() => router.push(pathname)}
                  className="min-h-[44px] flex items-center gap-1 text-sm text-red-600 hover:text-red-800 font-medium px-2"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear filters</span>
                </button>
              )}
            </div>
          </div>

          <StatusTabs activeStatuses={activeStatuses} onToggleStatus={handleToggleStatus} />
          <EscrowFilters
            searchQuery={searchQuery}
            onSearchChange={handleSearch}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            minAmount={minAmount}
            maxAmount={maxAmount}
            onAmountChange={handleAmountChange}
            fromDate={fromDate}
            toDate={toDate}
            onDateChange={handleDateChange}
          />
          <EscrowList
            escrows={flatEscrows}
            isLoading={isLoading}
            isError={isError}
            activeTab={activeStatuses[0] || "all"}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
            isFetchingNextPage={isFetchingNextPage}
          />
        </div>

        <div className="hidden lg:block lg:col-span-1">
          <ActivityFeed className="h-[calc(100vh-12rem)] sticky top-8" />
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Escrow Dashboard
          </h1>
          <p className="mt-2 sm:mt-4 text-base sm:text-lg text-gray-500">
            Manage all your escrow agreements in one place
          </p>
        </div>
        <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading Dashboard...</div>}>
          <DashboardContent />
        </Suspense>
      </div>
    </div>
  );
}
