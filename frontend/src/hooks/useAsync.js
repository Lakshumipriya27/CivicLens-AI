import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/api';

/** Run an async loader on mount / when deps change. Returns { data, loading, error, reload, setData }. */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const mounted = useRef(true);
  const ticket = useRef(0);

  const run = useCallback(async (silent = false) => {
    const t = ++ticket.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (mounted.current && t === ticket.current) setState({ data, loading: false, error: null });
      return data;
    } catch (e) {
      if (mounted.current && t === ticket.current) setState((s) => ({ ...s, loading: false, error: errorMessage(e) }));
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => { mounted.current = false; };
  }, [run]);

  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);
  return { ...state, reload: run, setData };
}

export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
