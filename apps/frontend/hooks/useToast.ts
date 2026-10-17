import { useToast as useToastContext } from '@/app/contexts/ToastContext';
import { ToastAction } from '@/app/contexts/ToastContext';
import { getFriendlyErrorMessage, isTransientError } from '@/lib/errorUtils';

export const useToast = () => {
  const { addToast, removeToast, removeAllToasts } = useToastContext();

  return {
    success: (message: string, duration?: number, action?: ToastAction) => 
      addToast(message, 'success', duration, action),
    error: (message: string, duration?: number, action?: ToastAction) => 
      addToast(message, 'error', duration, action),
    warning: (message: string, duration?: number, action?: ToastAction) => 
      addToast(message, 'warning', duration, action),
    info: (message: string, duration?: number, action?: ToastAction) => 
      addToast(message, 'info', duration, action),
    apiError: (error: unknown, retry?: () => void) =>
      addToast(
        getFriendlyErrorMessage(error),
        'error',
        undefined,
        retry && isTransientError(error) ? { label: 'Retry', onClick: retry } : undefined,
      ),
    dismiss: removeToast,
    dismissAll: removeAllToasts,
  };
};
