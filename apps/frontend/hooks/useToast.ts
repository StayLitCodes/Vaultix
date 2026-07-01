import { useToast as useToastContext } from '@/app/contexts/ToastContext';
import { ToastAction } from '@/app/contexts/ToastContext';

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
    dismiss: removeToast,
    dismissAll: removeAllToasts,
  };
};
