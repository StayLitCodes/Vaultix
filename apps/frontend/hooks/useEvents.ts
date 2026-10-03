import { useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { IEscrowEventResponse } from '@/types/escrow';
import { EscrowService } from '@/services/escrow';
import { useWebSocket } from '@/app/contexts/WebSocketContext';
import { joinEscrowRoom, leaveEscrowRoom, storeEscrowCursor } from '@/lib/websocket';

interface UseEventsParams {
    escrowId?: string;
    eventType?: string;
    limit?: number;
    refetchInterval?: number | false;
}

export const useEvents = (params: UseEventsParams = {}) => {
    const queryClient = useQueryClient();
    const { socket, isConnected } = useWebSocket();
    const query = useInfiniteQuery<IEscrowEventResponse>({
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
        refetchInterval: params.refetchInterval ?? false,
    });

    useEffect(() => {
        const escrowId = params.escrowId;
        if (!escrowId || !socket || !isConnected) return;

        const handleEvent = (event: { cursor?: string }) => {
            storeEscrowCursor(escrowId, event.cursor);
            void queryClient.invalidateQueries({ queryKey: ['events', params] });
        };

        socket.on('escrow.event', handleEvent);
        joinEscrowRoom(socket, escrowId);

        return () => {
            socket.off('escrow.event', handleEvent);
            leaveEscrowRoom(socket, escrowId);
        };
    }, [params.escrowId, socket, isConnected, queryClient]);

    return query;
};
