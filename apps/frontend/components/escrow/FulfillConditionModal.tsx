import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileText, Loader2, UploadCloud } from 'lucide-react';
import { fulfillCondition } from '@/lib/escrow-api';
import { ICondition } from '@/types/escrow';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  escrowId: string;
  condition: ICondition;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}

const FulfillConditionModal: React.FC<Props> = ({
  escrowId,
  condition,
  isOpen,
  onClose,
  onSubmitted,
}) => {
  const [notes, setNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const evidenceValue = useMemo(() => {
    if (evidenceUrl.trim()) {
      return evidenceUrl.trim();
    }

    if (file) {
      return `Uploaded file: ${file.name}`;
    }

    return undefined;
  }, [evidenceUrl, file]);

  const resetAndClose = () => {
    setNotes('');
    setEvidenceUrl('');
    setFile(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await fulfillCondition(escrowId, condition.id, {
        notes: notes.trim() || undefined,
        evidence: evidenceValue,
      });
      await onSubmitted();
      resetAndClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fulfill this condition. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Fulfill Condition</DialogTitle>
          <DialogDescription>
            Share fulfillment notes and supporting evidence for{' '}
            <span className="font-medium text-gray-900">{condition.description}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">Condition</p>
            <p className="mt-1 text-sm text-gray-600">{condition.description}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="fulfillment-notes">
              Fulfillment notes
            </label>
            <Textarea
              id="fulfillment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Summarize what you delivered, shipped, or completed."
              className="min-h-28"
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="evidence-url">
              Evidence URL or reference
            </label>
            <Input
              id="evidence-url"
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              placeholder="https://tracking.example.com/... or delivery reference"
              maxLength={500}
            />
            <p className="text-xs text-gray-500">
              The current API stores evidence as text, so uploaded files are submitted as a file
              reference unless you provide a public URL.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="evidence-file">
              Upload supporting file
            </label>
            <Input
              id="evidence-file"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <FileText className="h-4 w-4" />
                <span className="truncate">{file.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
                <UploadCloud className="h-4 w-4" />
                <span>Attach a file if you want its name recorded with the fulfillment.</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={resetAndClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting
              </>
            ) : (
              'Mark as fulfilled'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FulfillConditionModal;
