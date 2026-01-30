import React from 'react';
import { IEscrowExtended } from '@/types/escrow';

interface TimelineSectionProps {
  escrow: IEscrowExtended;
}

const getEventIcon = (eventType: string) => {
  switch (eventType.toUpperCase()) {
    case 'CREATED':
      return (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 ring-4 ring-white">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </span>
      );
    case 'FUNDED':
      return (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500 ring-4 ring-white">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    case 'CONDITION_MET':
      return (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-yellow-500 ring-4 ring-white">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500 ring-4 ring-white">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-500 ring-4 ring-white">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      );
    default:
      return (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-500 ring-4 ring-white">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
  }
};

const getEventColor = (eventType: string) => {
  switch (eventType.toUpperCase()) {
    case 'CREATED':
      return 'bg-blue-50 text-blue-700';
    case 'FUNDED':
      return 'bg-green-50 text-green-700';
    case 'CONDITION_MET':
      return 'bg-yellow-50 text-yellow-700';
    case 'COMPLETED':
      return 'bg-purple-50 text-purple-700';
    case 'CANCELLED':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-gray-50 text-gray-700';
  }
};

const TimelineSection: React.FC<TimelineSectionProps> = ({ escrow }: TimelineSectionProps) => {
  // Sort events by date, with the newest first
  const sortedEvents = [...escrow.events].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Timeline</h2>
      
      {sortedEvents.length === 0 ? (
        <p className="text-gray-500 italic">No events recorded yet.</p>
      ) : (
        <div className="flow-root">
          <ul className="-mb-8">
            {sortedEvents.map((event, index) => (
              <li key={event.id}>
                <div className="relative pb-8">
                  {index !== sortedEvents.length - 1 ? (
                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>{getEventIcon(event.eventType)}</div>
                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                      <div>
                        <p className="text-sm text-gray-700">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventColor(event.eventType)}`}>
                            {event.eventType.replace(/_/g, ' ').toLowerCase()}
                          </span>
                          <span className="ml-2">
                            {event.eventType === 'CREATED' && 'Escrow agreement created'}
                            {event.eventType === 'FUNDED' && 'Escrow funded'}
                            {event.eventType === 'CONDITION_MET' && 'Condition met'}
                            {event.eventType === 'COMPLETED' && 'Escrow completed'}
                            {event.eventType === 'CANCELLED' && 'Escrow cancelled'}
                            {event.eventType === 'PARTY_ACCEPTED' && 'Party accepted the agreement'}
                            {event.eventType === 'PARTY_REJECTED' && 'Party rejected the agreement'}
                            {event.eventType === 'PARTY_ADDED' && 'Party added to the agreement'}
                            {event.eventType === 'DISPUTED' && 'Dispute raised'}
                            {event.eventType === 'STATUS_CHANGED' && 'Status changed'}
                            {event.eventType === 'UPDATED' && 'Agreement updated'}
                          </span>
                        </p>
                        {event.data && Object.keys(event.data).length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(event.data, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                      <div className="whitespace-nowrap text-right text-sm text-gray-500">
                        {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TimelineSection;