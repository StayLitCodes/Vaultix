"use client";

import "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import axios from "axios";

interface FileDisputeModalProps {
  open: boolean;
  onClose: () => void;
  escrowId: string;
}

const disputeReasons = [
  { value: "DELIVERY_ISSUE", label: "Delivery Issue" },
  { value: "QUALITY_ISSUE", label: "Quality Issue" },
  { value: "NOT_AS_DESCRIBED", label: "Not As Described" },
  { value: "SCAM_SUSPECTED", label: "Suspected Scam" },
  { value: "OTHER", label: "Other" },
];

export default function FileDisputeModal({
  open,
  onClose,
  escrowId,
}: FileDisputeModalProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceLink, setEvidenceLink] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason || !description) return alert("Please fill all required fields");

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("reason", reason);
      formData.append("description", description);
      formData.append("escrowId", escrowId);

      if (evidenceFile) {
        formData.append("file", evidenceFile);
      }

      if (evidenceLink) {
        formData.append("evidenceLink", evidenceLink);
      }

      await axios.post("/disputes", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      alert("Dispute filed successfully.");
      onClose();
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to file dispute.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise a Dispute</DialogTitle>
        </DialogHeader>

        {/* Dispute Explanation */}
        <div className="bg-muted p-3 rounded-md text-sm">
          When you raise a dispute:
          <ul className="list-disc ml-4 mt-2 space-y-1">
            <li>Funds will be temporarily locked</li>
            <li>Both parties will be reviewed</li>
            <li>Admin will investigate the case</li>
            <li>Resolution may take 24-72 hours</li>
          </ul>
        </div>

        {/* Reason */}
        <div className="mt-4">
          <label className="text-sm font-medium">Dispute Reason *</label>
          <Select onValueChange={setReason}>
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

        {/* Description */}
        <div className="mt-4">
          <label className="text-sm font-medium">Description *</label>
          <Textarea
            placeholder="Provide detailed explanation..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Evidence Upload */}
        <div className="mt-4">
          <label className="text-sm font-medium">Upload Evidence (Optional)</label>
          <Input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
          />
        </div>

        {/* Evidence Link */}
        <div className="mt-4">
          <label className="text-sm font-medium">Or Provide Evidence Link</label>
          <Input
            type="url"
            placeholder="https://drive.google.com/..."
            value={evidenceLink}
            onChange={(e) => setEvidenceLink(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Dispute
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}