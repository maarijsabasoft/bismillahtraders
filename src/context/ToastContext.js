import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import './ToastContext.css';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      toastError: () => {},
      toastSuccess: () => {},
    };
  }
  return ctx;
};

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hide = useCallback(() => {
    clearTimer();
    setToast(null);
  }, []);

  const show = useCallback(
    (message, variant = 'info', durationMs = 5000) => {
      if (!message) return;
      clearTimer();
      setToast({ message: String(message), variant, id: Date.now() });
      if (durationMs > 0) {
        timerRef.current = setTimeout(hide, durationMs);
      }
    },
    [hide]
  );

  useEffect(() => () => clearTimer(), []);

  const value = {
    toast: show,
    toastError: (msg, ms = 8000) => show(msg, 'error', ms),
    toastSuccess: (msg, ms = 4000) => show(msg, 'success', ms),
    toastInfo: (msg, ms = 5000) => show(msg, 'info', ms),
    hideToast: hide,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          className={`app-toast app-toast--${toast.variant}`}
          role="alert"
          onClick={hide}
        >
          <div className="app-toast__body">{toast.message}</div>
          <button type="button" className="app-toast__close" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
};
