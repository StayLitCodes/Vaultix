"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import StatusTabs from "@/component/dashboard/StatusTabs";
import EscrowList from "@/component/dashboard/EscrowList";
import EscrowFilters from "@/component/dashboard/EscrowFilters";
import { useEscrows } from "../../hooks/useEscrows";
import ActivityFeed from "@/components/common/ActivityFeed";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // URL State Extraction
  const activeStatuses = searchParams.get("status")?.split(",").filter(Boolean) || [];
  const searchQuery = searchParams.get("search") || "";
  const sortBy = (searchParams.get("sort") as "date" | "amount" | "deadline") || "date";
  const sortOrder = (searchParams.get("order") as "asc" | "desc") || "desc";
  const minAmount = searchParams.get("minAmount") || "";
  const maxAmount = searchParams.get("maxAmount") || "";
  const fromDate = searchParams.get("fromDate") || "";
  const toDate = searchParams.get("toDate") || "";

  // Helper to sync state with URL
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

  // Action Handlers
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

  const handleSearch = (query: string) => {
    router.push(`${pathname}?${createQueryString({ search: query })}`);
  };

  const handleSortChange = (field: "date" | "amount" | "deadline", order: "asc" | "desc") => {
    router.push(`${pathname}?${createQueryString({ sort: field, order: order })}`);
  };

  const handleAmountChange = (min: string, max: string) => {
    router.push(`${pathname}?${createQueryString({ minAmount: min, maxAmount: max })}`);
  };

  const handleDateChange = (from: string, to: string) => {
    router.push(`${pathname}?${createQueryString({ fromDate: from, toDate: to })}`);
  };

  // Data Fetching
  const {
    data: escrowsData,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useEscrows({
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6 h-fit">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Your Escrows</h2>
          {(activeStatuses.length > 0 || searchQuery || minAmount || maxAmount || fromDate || toDate) && (
            <button
              onClick={() => router.push(pathname)}
              className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              ✕ Clear all filters
            </button>
          )}
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
      
      <div className="lg:col-span-1">
        <ActivityFeed className="h-[calc(100vh-12rem)] sticky top-8" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Escrow Dashboard
          </h1>
          <p className="mt-4 text-lg text-gray-500">
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