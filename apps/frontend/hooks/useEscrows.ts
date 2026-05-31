import { useInfiniteQuery } from "@tanstack/react-query";
import { IEscrowResponse } from "@/types/escrow";
import { EscrowService } from "@/services/escrow";

interface UseEscrowsParams {
  status?: string;
  search?: string;
  sortBy?: "date" | "amount" | "deadline";
  sortOrder?: "asc" | "desc";
  enabled?: boolean;
  minAmount?: string;
  maxAmount?: string;
  fromDate?: string;
  toDate?: string;
}

export const useEscrows = (params: UseEscrowsParams = {}) => {
  return useInfiniteQuery<IEscrowResponse>({
    queryKey: ["escrows", params],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await EscrowService.getEscrows({
        ...params,
        page: pageParam as number,
        limit: 10,
      });
      return response;
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasNextPage ? pages.length + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: params.enabled !== false,
  });
};
