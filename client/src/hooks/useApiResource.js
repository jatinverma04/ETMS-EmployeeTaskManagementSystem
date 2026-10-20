import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiError, isCanceled } from '../api/client';

export function useApiResource(loader, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [reloadToken, setReloadToken] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;

    setState({ data: null, loading: true, error: null });

    Promise.resolve()
      .then(() => loader({ signal: controller.signal }))
      .then((data) => {
        if (requestId.current === currentRequest) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (isCanceled(error)) {
          return;
        }

        if (requestId.current === currentRequest) {
          setState({ data: null, loading: false, error: getApiError(error) });
        }
      });

    return () => controller.abort();
  }, [...dependencies, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return { ...state, reload };
}
