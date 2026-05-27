'use client';

import { useEffect, useRef, useState } from 'react';
import type { JobUpdate } from '../lib/types';

interface UseJobSocketOpts {
  jobId: string | null;
  onUpdate?: (u: JobUpdate) => void;
}

/**
 * Subscribe to a single job topic over WebSocket. The server publishes JSON
 * messages to topic `job:<jobId>`; we subscribe on open and surface only the
 * payload to callers, with automatic reconnect on transient drops.
 *
 * The protocol is intentionally tiny:
 *   →  { type: 'subscribe', topic: 'job:<id>' }
 *   ←  { type: 'subscribed', topic }
 *   ←  { type: 'update', topic, payload: JobUpdate }
 */
export function useJobSocket({ jobId, onUpdate }: UseJobSocketOpts) {
  const [latest, setLatest] = useState<JobUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!jobId) return;
    const url = process.env.NEXT_PUBLIC_WS_URL;
    // No WS configured (Vercel deployment with API routes only). Skip
    // entirely — the generating page's HTTP polling fallback drives the UI.
    if (!url) return;

    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(url);

      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        ws?.send(JSON.stringify({ type: 'subscribe', topic: `job:${jobId}` }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'update' && msg.payload) {
            setLatest(msg.payload as JobUpdate);
            onUpdateRef.current?.(msg.payload as JobUpdate);
          }
        } catch { /* ignore non-JSON heartbeats */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (stopped) return;
        // Exponential backoff capped at 8 seconds.
        const delay = Math.min(8000, 500 * Math.pow(2, retry++));
        retryTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => { /* close handler takes over */ };
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'unsubscribe', topic: `job:${jobId}` })); } catch { /* noop */ }
      }
      ws?.close();
    };
  }, [jobId]);

  return { latest, connected };
}
