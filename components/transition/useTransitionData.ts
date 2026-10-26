'use client';

import { useCallback, useEffect, useState } from 'react';
import { TRANSITION_DATASETS, TRANSITION_KEYS, type TransitionManifest, type TransitionRecord } from '@/lib/transition';

export function useTransitionData() {
  const [manifest, setManifest] = useState<TransitionManifest | null>(null);
  const [records, setRecords] = useState<TransitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError('');
    async function read(path: string) {
      const response = await fetch(`/data/transition/${path}`, { signal: abort.signal });
      if (!response.ok) throw new Error('Transition data could not load. Please retry.');
      return response.json();
    }
    void Promise.all([read('manifest.json'), ...TRANSITION_KEYS.map((key) => read(TRANSITION_DATASETS[key].file))]).then(([metadata, ...collections]) => {
      if (!metadata.datasets || collections.some((collection) => collection.type !== 'FeatureCollection' || !Array.isArray(collection.features))) throw new Error('The dataset snapshot is incomplete. Please retry.');
      if (abort.signal.aborted) return;
      setManifest(metadata);
      setRecords(collections.flatMap((collection) => collection.features));
    }).catch((failure: unknown) => {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Transition data could not load.');
    }).finally(() => {
      if (!abort.signal.aborted) setLoading(false);
    });
    return () => abort.abort();
  }, [attempt]);

  return { manifest, records, loading, error, retry };
}
