import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
let seq = 0;

const STYLES = {
  success: { icon: CheckCircle2, cls: 'text-brand-700' },
  error: { icon: AlertCircle, cls: 'text-red-700' },
  info: { icon: Info, cls: 'text-ink-600' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((type, message) => {
    const id = ++seq;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[2000] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type];
          return (
            <div key={t.id} className="card flex items-start gap-3 px-4 py-3 shadow-pop">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
              <p className="flex-1 text-[13px] text-ink-800">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-700" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
