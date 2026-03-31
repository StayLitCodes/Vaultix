"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Scale, AlertTriangle, DollarSign } from 'lucide-react';
import { IDispute, IDisputeResolution } from '@/types/escrow';

interface ArbitratorResolutionModalProps {
  open: boolean;
  onClose: () => void;
  dispute: IDispute | null;
  escrowAmount: string;
  escrowAsset: string;
  onResolutionComplete?: () => void;
}

const resolutionOutcomes = [
  { value: 'RELEASED_TO_SELLER', label: 'Release to Seller', description: 'Full amount released to the seller' },
  { value: 'REFUNDED_TO_BUYER', label: 'Refund to Buyer', description: 'Full amount refunded to the buyer' },
  { value: 'SPLIT', label: 'Split Between Parties', description: 'Custom split between buyer and seller' },
];

export default function ArbitratorResolutionModal({
  open,
  onClose,
  dispute,
  escrowAmount,
  escrowAsset,
  onResolutionComplete,
}: ArbitratorResolutionModalProps) {
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [buyerPercentage, setBuyerPercentage] = useState('50');
  const [sellerPercentage, setSellerPercentage] = useState('50');
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const amount = parseFloat(escrowAmount) || 0;

  // Update percentages when outcome changes
  React.useEffect(() => {
    if (outcome === 'RELEASED_TO_SELLER') {
      setBuyerPercentage('0');
      setSellerPercentage('100');
    } else if (outcome === 'REFUNDED_TO_BUYER') {
      setBuyerPercentage('100');
      setSellerPercentage('0');
    } else if (outcome === 'SPLIT') {
      setBuyerPercentage('50');
      setSellerPercentage('50');
    }
  }, [outcome]);

  const handleBuyerPercentageChange = (value: string) => {
    const buyerPct = Math.max(0, Math.min(100, parseInt(value) || 0));
    setBuyerPercentage(buyerPct.toString());
    setSellerPercentage((100 - buyerPct).toString());
  };

  const handleSellerPercentageChange = (value: string) => {
    const sellerPct = Math.max(0, Math.min(100, parseInt(value) || 0));
    setSellerPercentage(sellerPct.toString());
    setBuyerPercentage((100 - sellerPct).toString());
  };

  const calculateDistribution = () => {
    const buyerAmount = (amount * parseInt(buyerPercentage)) / 100;
    const sellerAmount = (amount * parseInt(sellerPercentage)) / 100;
    return { buyerAmount, sellerAmount };
  };

  const handleSubmit = async () => {
    if (!outcome || !notes.trim()) {
      alert('Please select an outcome and provide resolution notes');
      return;
    }

    if (outcome === 'SPLIT' && (parseInt(buyerPercentage) + parseInt(sellerPercentage) !== 100)) {
      alert('Split percentages must total 100%');
      return;
    }

    setShowConfirmation(true);
  };

  const confirmResolution = async () => {
    if (!dispute) return;

    try {
      setLoading(true);

      const resolutionData = {
        outcome,
        notes: notes.trim(),
        ...(outcome === 'SPLIT' && {
          splitPercentage: {
            buyer: parseInt(buyerPercentage),
            seller: parseInt(sellerPercentage),
          },
        }),
      };

      const response = await fetch(`/api/escrows/${dispute.escrowId}/dispute/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resolutionData),
      });

      const result = await response.json();

      if (result.success) {
        alert('Dispute resolved successfully. Funds have been distributed according to your decision.');
        onResolutionComplete?.();
        onClose();
        // Reset form
        setOutcome('');
        setNotes('');
        setBuyerPercentage('50');
        setSellerPercentage('50');
        setShowConfirmation(false);
      } else {
        alert(result.message || 'Failed to resolve dispute.');
      }
    } catch (error: any) {
      console.error('Resolution error:', error);
      alert('Failed to resolve dispute. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { buyerAmount, sellerAmount } = calculateDistribution();

  if (!dispute) return null;

  return (
    <>
      <Dialog open={open && !showConfirmation} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Resolve Dispute
            </DialogTitle>
          </DialogHeader>

          {/* Dispute Summary */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-sm text-gray-700 mb-2">Dispute Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Reason:</span>
                <p className="font-medium">{dispute.reason.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-gray-600">Severity:</span>
                <Badge className="mt-1">
                  {dispute.severity}
                </Badge>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Description:</span>
                <p className="text-gray-700 mt-1">{dispute.description}</p>
              </div>
            </div>
          </div>

          {/* Resolution Outcome */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Resolution Outcome *</label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="Select resolution outcome" />
              </SelectTrigger>
              <SelectContent>
                {resolutionOutcomes.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Split Distribution (only for SPLIT outcome) */}
          {outcome === 'SPLIT' && (
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">Fund Distribution *</label>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-600">Buyer Percentage</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={buyerPercentage}
                        onChange={(e) => handleBuyerPercentageChange(e.target.value)}
                        className="w-20"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Seller Percentage</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={sellerPercentage}
                        onChange={(e) => handleSellerPercentageChange(e.target.value)}
                        className="w-20"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  </div>
                </div>
                
                {/* Distribution Preview */}
                <div className="border-t pt-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">Distribution Preview</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Buyer receives:</span>
                      <span className="font-medium">
                        {buyerAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} {escrowAsset}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Seller receives:</span>
                      <span className="font-medium">
                        {sellerAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} {escrowAsset}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t pt-2">
                      <span>Total:</span>
                      <span>{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} {escrowAsset}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resolution Notes */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Resolution Notes *</label>
            <Textarea
              placeholder="Provide detailed explanation for your resolution decision..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md text-sm mb-6">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div>
                <strong>Important:</strong> This action cannot be undone. Once submitted, the funds will be distributed immediately according to your decision.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !outcome || !notes.trim()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Resolution
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={() => setShowConfirmation(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Resolution</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 p-3 rounded-md text-sm">
              <strong>Final Confirmation:</strong> This action will permanently resolve the dispute and distribute funds.
            </div>
            
            <div className="text-sm space-y-2">
              <p><strong>Outcome:</strong> {resolutionOutcomes.find(o => o.value === outcome)?.label}</p>
              
              {outcome === 'SPLIT' && (
                <>
                  <p><strong>Buyer:</strong> {buyerPercentage}% ({buyerAmount.toLocaleString()} {escrowAsset})</p>
                  <p><strong>Seller:</strong> {sellerPercentage}% ({sellerAmount.toLocaleString()} {escrowAsset})</p>
                </>
              )}
              
              <p><strong>Notes:</strong> {notes}</p>
            </div>
            
            <p className="text-sm text-gray-600">
              Are you absolutely sure you want to proceed with this resolution?
            </p>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button onClick={confirmResolution} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Resolution
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
