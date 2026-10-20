import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Toast from './Toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) {
        window.clearTimeout(timer);
      }
    },
    [],
  );

  function removeToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);

    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }

  function addToast(message, type = 'success', duration) {
    const id = nextId.current + 1;
    nextId.current = id;
    setToasts((current) => [...current, { id, message, type }]);

    const timer = window.setTimeout(
      () => removeToast(id),
      duration || (type === 'error' ? 7000 : 4500),
    );
    timers.current.set(id, timer);
  }

  const value = useMemo(
    () => ({
      success: (message, duration) => addToast(message, 'success', duration),
      error: (message, duration) => addToast(message, 'error', duration),
      info: (message, duration) => addToast(message, 'info', duration),
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-full sm:max-w-sm"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }

  return context;
}
