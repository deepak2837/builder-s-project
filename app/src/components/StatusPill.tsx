'use client';

import { useEffect, useState } from 'react';

interface Status {
  store: { backend: string; detail: string; degraded: boolean; degradedReason: string | null };
  gemini: { configured: boolean; model: string };
  knowledgeBase: { totalChunks: number; sources: { source: string; count: number }[] };
}

/**
 * Shows which storage backend and model are actually in use. The app falls back
 * to local JSON files when MongoDB is not running, and nobody should have to
 * guess where their reports went.
 */
export function StatusPill() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  if (!status) return null;

  const mongo = status.store.backend === 'mongodb';
  const ok = mongo && status.gemini.configured;

  return (
    <div className="relative">
      {/* A serverless deploy running on the file fallback loses data between
          invocations. That must never be discovered after the fact. */}
      {status.store.degraded && (
        <div className="fixed inset-x-0 top-14 z-40 border-b border-red-300 bg-red-600 px-4 py-2 text-center text-[12px] font-medium text-white">
          Database not connected &mdash; reports will not be saved.
          {status.store.degradedReason ? ` (${status.store.degradedReason})` : ''} Check MONGODB_URI and
          that Atlas Network Access allows 0.0.0.0/0.
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={`pill border ${
          ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className="hidden sm:inline">{mongo ? 'MongoDB' : 'Local files'}</span>
        <span className="sm:hidden">{mongo ? 'DB' : 'Local'}</span>
        <span className="hidden text-ink-400 sm:inline">|</span>
        <span className="hidden sm:inline">{status.gemini.configured ? 'Gemini' : 'No API key'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-ink-200 bg-white p-3.5 text-[12px] shadow-lg">
          <dl className="space-y-2.5">
            <div>
              <dt className="font-medium text-ink-900">Storage</dt>
              <dd className="text-ink-600">{status.store.detail}</dd>
              {!mongo && (
                <dd className="mt-1 text-amber-700">
                  MongoDB is not reachable, so reports are being written to JSON files. Start mongod on
                  localhost:27017 and reload to switch over.
                </dd>
              )}
            </div>
            <div>
              <dt className="font-medium text-ink-900">Model</dt>
              <dd className="text-ink-600">{status.gemini.model}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-900">Knowledge base</dt>
              <dd className="text-ink-600">{status.knowledgeBase.totalChunks} chunks indexed</dd>
              <dd className="mt-1 space-y-0.5">
                {status.knowledgeBase.sources.map((s) => (
                  <div key={s.source} className="flex justify-between text-ink-500">
                    <span className="truncate pr-2">{s.source}</span>
                    <span className="tabular-nums">{s.count}</span>
                  </div>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
