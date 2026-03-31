"use client";

import "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { IDispute } from "@/types/escrow";

interface FileDisputeModalProps {
  open: boolean;
  onClose: () => void;
  escrowId: string;
  userRole: 'creator' | 'counterparty' | 'arbitrator' | null;
  escrowStatus: string;
}

const disputeReasons = [
  { value: "DELIVERY_ISSUE", label: "Delivery Issue" },
  { value: "QUALITY_ISSUE", label: "Quality Issue" },
  { value: "NOT_AS_DESCRIBED", label: "Not As Described" },
  { value: "SCAM_SUSPECTED", label: "Suspected Scam" },
  { value: "OTHER", label: "Other" },
];

const severityLevels = [
  { value: "LOW", label: "Low - Minor Issue" },
  { value: "MEDIUM", label: "Medium - Significant Issue" },
  { value: "HIGH", label: "High - Critical Issue" },
];

export default function FileDisputeModal({
  open,
  onClose,
  escrowId,
  userRole,
  escrowStatus,
}: FileDisputeModalProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [evidenceLink, setEvidenceLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const canFileDispute = userRole && ['creator', 'counterparty'].includes(userRole) && escrowStatus === 'ACTIVE';

  const handleAddEvidenceLink = () => {
    if (evidenceLink.trim()) {
      setEvidenceUrls([...evidenceUrls, evidenceLink.trim()]);
      setEvidenceLink("");
    }
  };

  const handleRemoveEvidenceLink = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reason || !description || !severity) {
      alert("Please fill all required fields");
      return;
    }

    if (!canFileDispute) {
      alert("You cannot file a dispute on this escrow");
      return;
    }

    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    try {
      setLoading(true);

      const disputeData = {
        escrowId,
        reason,
        description,
        severity,
        evidenceUrls,
      };

      const response = await fetch(`/api/escrows/${escrowId}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(disputeData),
      });

      const result = await response.json();

      if (result.success) {
        alert("Dispute filed successfully. The escrow funds are now frozen pending resolution.");
        onClose();
        // Reset form
        setReason("");
        setDescription("");
        setSeverity("");
        setEvidenceUrls([]);
        setShowConfirmation(false);
      } else {
        alert(result.message || "Failed to file dispute.");
      }
    } catch (error: any) {
      console.error("Dispute filing error:", error);
      alert("Failed to file dispute. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showConfirmation} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Raise a Dispute</DialogTitle>
          </DialogHeader>

          {!canFileDispute && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-md text-sm text-red-800">
              You cannot file a dispute on this escrow. Disputes can only be filed by the buyer or seller on active escrows.
            </div>
          )}

          {/* Dispute Explanation */}
          <div className="bg-muted p-3 rounded-md text-sm">
            When you raise a dispute:
            <ul className="list-disc ml-4 mt-2 space-y-1">
              <li>Funds will be temporarily locked</li>
              <li>Both parties will be reviewed</li>
              <li>An arbitrator will investigate the case</li>
              <li>Resolution may take 24-72 hours</li>
            </ul>
          </div>

          {/* Reason */}
          <div className="mt-4">
            <label className="text-sm font-medium">Dispute Reason *</label>
            <Select value={reason} onValueChange={setReason} disabled={!canFileDispute}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {disputeReasons.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="mt-4">
            <label className="text-sm font-medium">Severity Level *</label>
            <Select value={severity} onValueChange={setSeverity} disabled={!canFileDispute}>
              <SelectTrigger>
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                {severityLevels.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="mt-4">
            <label className="text-sm font-medium">Description *</label>
            <Textarea
              placeholder="Provide detailed explanation of the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canFileDispute}
              rows={4}
            />
          </div>

          {/* Evidence Links */}
          <div className="mt-4">
            <label className="text-sm font-medium">Evidence Links (Optional)</label>
            <div className="flex gap-2 mt-2">
              <Input
                type="url"
                placeholder="https://drive.google.com/..."
                value={evidenceLink}
                onChange={(e) => setEvidenceLink(e.target.value)}
                disabled={!canFileDispute}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddEvidenceLink}
                disabled={!canFileDispute || !evidenceLink.trim()}
              >
                Add
              </Button>
            </div>
            
            {evidenceUrls.length > 0 && (
              <div className="mt-2 space-y-2">
                {evidenceUrls.map((url, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate flex-1">
                      {url}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEvidenceLink(index)}
                      disabled={!canFileDispute}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !canFileDispute || !reason || !description || !severity}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Dispute
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={() => setShowConfirmation(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Dispute Filing</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md text-sm">
              <strong>Warning:</strong> Filing a dispute will immediately freeze the escrow funds until resolution.
            </div>
            
            <div className="text-sm space-y-2">
              <p><strong>Reason:</strong> {disputeReasons.find(r => r.value === reason)?.label}</p>
              <p><strong>Severity:</strong> {severityLevels.find(s => s.value === severity)?.label}</p>
              <p><strong>Description:</strong> {description}</p>
              {evidenceUrls.length > 0 && (
                <p><strong>Evidence:</strong> {evidenceUrls.length} link(s) provided</p>
              )}
            </div>
            
            <p className="text-sm text-gray-600">
              Are you sure you want to proceed with filing this dispute?
            </p>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & File Dispute
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}