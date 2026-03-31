"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, User, Link as LinkIcon, FileText, Scale } from 'lucide-react';
import { IDispute, IDisputeTimeline } from '@/types/escrow';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DisputeSectionProps {
  escrowId: string;
  escrowStatus: string;
  userRole: 'creator' | 'counterparty' | 'arbitrator' | null;
  publicKey: string | null;
  onDisputeUpdate?: () => void;
}

const DisputeSection: React.FC<DisputeSectionProps> = ({
  escrowId,
  escrowStatus,
  userRole,
  publicKey,
  onDisputeUpdate,
}) => {
  const [dispute, setDispute] = useState<IDispute | null>(null);
  const [timeline, setTimeline] = useState<IDisputeTimeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (escrowStatus === 'DISPUTED') {
      fetchDisputeData();
    } else {
      setLoading(false);
    }
  }, [escrowId, escrowStatus]);

  const fetchDisputeData = async () => {
    try {
      setLoading(true);
      
      // Fetch dispute details
      const disputeResponse = await fetch(`/api/escrows/${escrowId}/dispute`);
      if (disputeResponse.ok) {
        const disputeData = await disputeResponse.json();
        setDispute(disputeData.dispute);
      }

      // Fetch dispute timeline
      const timelineResponse = await fetch(`/api/escrows/${escrowId}/dispute/timeline`);
      if (timelineResponse.ok) {
        const timelineData = await timelineResponse.json();
        setTimeline(timelineData.timeline || []);
      }
    } catch (error) {
      console.error('Error fetching dispute data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-yellow-100 text-yellow-800';
      case 'UNDER_REVIEW':
        return 'bg-blue-100 text-blue-800';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <AlertTriangle className="h-4 w-4" />;
      case 'UNDER_REVIEW':
        return <Clock className="h-4 w-4" />;
      case 'RESOLVED':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return 'bg-green-100 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOutcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'RELEASED_TO_SELLER':
        return 'Released to Seller';
      case 'REFUNDED_TO_BUYER':
        return 'Refunded to Buyer';
      case 'SPLIT':
        return 'Split Between Parties';
      default:
        return outcome;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!dispute) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Dispute Details
        </h2>
        <Badge className={getStatusColor(dispute.status)}>
          {getStatusIcon(dispute.status)}
          <span className="ml-1">{dispute.status.replace('_', ' ')}</span>
        </Badge>
      </div>

      {/* Dispute Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Dispute Information</h3>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">Filed by:</span>
              <div className="flex items-center gap-2 mt-1">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">
                  {dispute.filedBy === publicKey ? 'You' : dispute.filedBy.substring(0, 8) + '...'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Reason:</span>
              <p className="text-sm font-medium mt-1">{dispute.reason.replace('_', ' ')}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Severity:</span>
              <Badge className={`mt-1 ${getSeverityColor(dispute.severity)}`}>
                {dispute.severity}
              </Badge>
            </div>
            <div>
              <span className="text-sm text-gray-600">Filed on:</span>
              <p className="text-sm mt-1">{new Date(dispute.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
            {dispute.description}
          </p>
        </div>
      </div>

      {/* Evidence */}
      {dispute.evidenceUrls && dispute.evidenceUrls.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidence ({dispute.evidenceUrls.length})
          </h3>
          <div className="space-y-2">
            {dispute.evidenceUrls.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline bg-gray-50 p-2 rounded"
              >
                <LinkIcon className="h-4 w-4" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Resolution Information */}
      {dispute.resolution && (
        <div className="border-t pt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Resolution Details
          </h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-600">Outcome:</span>
                <p className="text-sm font-semibold text-green-800 mt-1">
                  {getOutcomeLabel(dispute.resolution.outcome)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Resolved by:</span>
                <p className="text-sm font-medium mt-1">
                  {dispute.resolution.resolvedBy === publicKey ? 'You' : dispute.resolution.resolvedBy.substring(0, 8) + '...'}
                </p>
              </div>
              {dispute.resolution.splitPercentage && (
                <div className="md:col-span-2">
                  <span className="text-sm text-gray-600">Split Distribution:</span>
                  <div className="flex gap-4 mt-1">
                    <span className="text-sm font-medium">Buyer: {dispute.resolution.splitPercentage.buyer}%</span>
                    <span className="text-sm font-medium">Seller: {dispute.resolution.splitPercentage.seller}%</span>
                  </div>
                </div>
              )}
              {dispute.resolution.notes && (
                <div className="md:col-span-2">
                  <span className="text-sm text-gray-600">Resolution Notes:</span>
                  <p className="text-sm text-gray-700 mt-1 bg-white p-2 rounded">
                    {dispute.resolution.notes}
                  </p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-600">Resolved on:</span>
                <p className="text-sm mt-1">{new Date(dispute.resolution.resolvedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Dispute Timeline</h3>
          <div className="space-y-3">
            {timeline.map((event, index) => (
              <div key={event.id} className="flex gap-3">
                <div className="shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{event.description}</p>
                    <span className="text-xs text-gray-500">
                      {new Date(event.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {event.action.replace('_', ' ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arbitrator Actions */}
      {userRole === 'arbitrator' && dispute.status === 'OPEN' && (
        <div className="border-t pt-6">
          <div className="flex justify-end">
            <Button onClick={() => {/* Will open resolution modal */}}>
              Resolve Dispute
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputeSection;
