import { useCallback, useRef, useState } from 'react';
import { errorMessage } from '../errorMessage';

export function useMutation<TArgs extends any[]>(
  refresh: (...args: TArgs) => Promise<void>
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const lockRef = useRef(Promise.resolve());

  const wrappedRefresh = useCallback(
    async (...args: TArgs) => {
      const seq = ++seqRef.current;
      setBusy(true);
      setError(null);

      const promise = lockRef.current.then(async () => {
        if (seq !== seqRef.current) return;
        await refresh(...args);
      });
      lockRef.current = promise.catch(() => {});

      try {
        await promise;
      } catch (err: unknown) {
        if (seq === seqRef.current) {
          setError(errorMessage(err));
          throw err;
        }
      } finally {
        if (seq === seqRef.current) {
          setBusy(false);
        }
      }
    },
    [refresh]
  );

  const mutate = useCallback(
    async (action: () => Promise<void>, ...args: TArgs) => {
      const seq = ++seqRef.current;
      setBusy(true);
      setError(null);
      let actionFailed = false;
      try {
        await action();
      } catch (err: unknown) {
        if (seq === seqRef.current) {
          setError(errorMessage(err));
          actionFailed = true;
        }
      }

      if (!actionFailed) {
        const refreshSeq = ++seqRef.current;
        const promise = lockRef.current.then(async () => {
          if (refreshSeq !== seqRef.current) return;
          await refresh(...args);
        });
        lockRef.current = promise.catch(() => {});

        try {
          await promise;
        } catch (err: unknown) {
          if (refreshSeq === seqRef.current) {
            setError(errorMessage(err));
          }
        } finally {
          if (refreshSeq === seqRef.current) {
            setBusy(false);
          }
        }
      } else {
        setBusy(false);
      }
    },
    [refresh]
  );

  return { busy, error, mutate, refresh: wrappedRefresh, setError };
}
