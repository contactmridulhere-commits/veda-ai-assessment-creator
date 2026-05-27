'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Check, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useJobSocket } from '../../../hooks/useJobSocket';
import { STAGES } from '../../../lib/types';
import { TopHeader } from '../../../components/Chrome';
import { PrimaryButton, GhostButton, cls } from '../../../components/ui';
import { api } from '../../../lib/api';

export default function GeneratingPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [error, setError] = useState<string | null>(null);
  const [stageKey, setStageKey] = useState<string>('connect');

  const { latest, connected } = useJobSocket({
    jobId,
    onUpdate: (u) => {
      if (u.stage) setStageKey(u.stage);
      if (u.status === 'failed') setError(u.error ?? 'Generation failed');
      if (u.status === 'completed') {
        // Look up the assignment id so we can navigate to /output/[id]
        api.getByJobId(jobId)
          .then((r) => router.push(`/output/${r.assignment.id}`))
          .catch((e) => setError((e as Error).message));
      }
    },
  });

  // Fallback poll — in case the WS is unavailable (proxies, etc.) we still
  // recover by checking the assignment status every 3 seconds.
  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      try {
        const r = await api.getByJobId(jobId);
        if (r.assignment.status === 'completed') {
          router.push(`/output/${r.assignment.id}`);
        } else if (r.assignment.status === 'failed') {
          setError(r.assignment.error || 'Generation failed');
          clearInterval(t);
        }
      } catch { /* swallow — WS may still arrive */ }
    }, 3000);
    return () => clearInterval(t);
  }, [jobId, router]);

  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.key === stageKey));

  const retry = async () => {
    // The assignment is already created — kick a regenerate against its id.
    try {
      const r = await api.getByJobId(jobId);
      const rr = await api.regenerate(r.assignment.id);
      router.replace(`/generating/${rr.jobId}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <TopHeader title="Assignment" showBack onBack={() => router.push('/')} />

      <div className="px-4 lg:px-6 py-10 lg:py-16">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-[var(--shadow-card)] p-8 lg:p-12 text-center">
          {error ? (
            <>
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[var(--hard-bg)] flex items-center justify-center">
                <AlertCircle size={28} className="text-[var(--hard-fg)]" />
              </div>
              <h2 className="font-display text-2xl font-semibold mb-2">Generation failed</h2>
              <p className="text-sm text-[var(--muted)] mb-6">{error}</p>
              <div className="flex justify-center gap-3">
                <GhostButton icon={ArrowLeft} onClick={() => router.push('/')}>Back</GhostButton>
                <PrimaryButton icon={RefreshCw} onClick={retry}>Try again</PrimaryButton>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[var(--ivory)] flex items-center justify-center">
                <Loader2 size={28} className="text-[var(--terracotta)] animate-spin" />
              </div>
              <h2 className="font-display text-2xl lg:text-3xl font-semibold mb-1">Crafting your paper</h2>
              <p className="text-sm text-[var(--muted)] mb-1">
                Hold tight — typically this takes 10–15 seconds.
              </p>
              <p className="text-xs text-[var(--muted)] mb-7">
                Live updates {connected ? '· connected' : '· reconnecting…'}
              </p>

              <div className="space-y-2.5 text-left max-w-md mx-auto">
                {STAGES.map((stg, i) => {
                  const done = i < stageIndex;
                  const current = i === stageIndex;
                  return (
                    <div key={stg.key} className="flex items-center gap-3">
                      <div className={cls(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition',
                        done    && 'bg-emerald-500 text-white',
                        current && 'bg-[var(--ink)] text-white',
                        !done && !current && 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--muted)]',
                      )}>
                        {done    ? <Check size={12} /> :
                         current ? <Loader2 size={12} className="animate-spin" /> :
                                   <span className="text-[10px]">{i + 1}</span>}
                      </div>
                      <span className={cls('text-sm', current ? 'text-[var(--ink)] font-medium' : 'text-[var(--muted)]')}>
                        {stg.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {latest?.ts && (
                <div className="mt-6 text-[10px] text-[var(--muted)] font-mono">
                  last update {new Date(latest.ts).toLocaleTimeString()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
