import { useInfiniteQuery } from '@tanstack/react-query';
import { IEscrowEventResponse } from '@/types/escrow';
import { EscrowService } from '@/services/escrow';

interface UseEventsParams {
    escrowId?: string;
    eventType?: string;
    limit?: number;
    refetchInterval?: number | false;
}

export const useEvents = (params: UseEventsParams = {}) => {
    return useInfiniteQuery<IEscrowEventResponse>({
        queryKey: ['events', params],
        queryFn: async ({ pageParam = 1 }) => {
            // We will need to implement getEvents in EscrowService
            const response = await EscrowService.getEvents({
                ...params,
                page: pageParam as number,
            });
            return response;
        },
        getNextPageParam: (lastPage, pages) => {
            return lastPage.hasNextPage ? pages.length + 1 : undefined;
        },
        initialPageParam: 1,
        refetchInterval: params.refetchInterval || false,
    });
};
