import { useInfiniteQuery } from '@tanstack/react-query';
import { IEscrowResponse } from '@/types/escrow';
import { EscrowService } from '@/services/escrow';

interface UseEscrowsParams {
  status?: 'all' | 'active' | 'pending' | 'completed' | 'disputed';
  search?: string;
  sortBy?: 'date' | 'amount' | 'deadline';
  sortOrder?: 'asc' | 'desc';
  enabled?: boolean;
}

export const useEscrows = (params: UseEscrowsParams = {}) => {
  return useInfiniteQuery<IEscrowResponse>({
    queryKey: ['escrows', params],
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