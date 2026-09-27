# Accessible Dialog Migration Guide

## Problem

Several components use hand-rolled modal patterns (e.g. a `<div>` with
`position: fixed` and a manual backdrop) that lack proper ARIA semantics,
focus trapping, and keyboard dismissal.

## Solution

The project already has `components/ui/dialog.tsx` built on **Radix UI**
`Dialog.Root` which provides:

- `role="dialog"` and `aria-modal="true"` automatically
- Focus trap when open
- `Escape` key dismissal
- Screen reader announcement via `DialogTitle` and `DialogDescription`

## Migration pattern

**Before (hand-rolled):**
```tsx
{isOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="bg-white rounded p-6">
      <h2>My Modal</h2>
      ...
    </div>
  </div>
)}
```

**After (accessible Dialog):**
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>My Modal</DialogTitle>
    </DialogHeader>
    ...
  </DialogContent>
</Dialog>
```

## Components to migrate

Audit `components/escrow/modals/` and `components/settings/` for any
components that render a fixed overlay manually rather than using `Dialog`.