import { useToast as useToastContext } from '@/app/contexts/ToastContext';

export const useToast = () => {
  const { addToast, removeToast } = useToastContext();

  return {
    success: (message: string, duration?: number) => addToast(message, 'success', duration),
    error: (message: string, duration?: number) => addToast(message, 'error', duration),
    warning: (message: string, duration?: number) => addToast(message, 'warning', duration),
    info: (message: string, duration?: number) => addToast(message, 'info', duration),
    dismiss: removeToast,
  };
};
