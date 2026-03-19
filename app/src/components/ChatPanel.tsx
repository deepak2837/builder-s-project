'use client';

import { useEffect, useRef, useState } from 'react';
import type { FeasibilityInputs } from '@/engine/types';

export interface ChatChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  display: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  changes?: ChatChange[];
  citations?: { source: string; regulation?: string }[];
  tools?: { name: string; summary: string }[];
  pending?: boolean;
  failed?: boolean;
}

interface Props {
  reportId: string | null;
  title: string;
  intro: string;
  suggestions: string[];
  /**
   * The live state of the calculation page. Sent with every message so the
   * assistant is always answering about the numbers on screen, not a stale copy.
   */
  draftInputs?: FeasibilityInputs | null;
  onFormFills?: (fills: { field: string; value: unknown }[]) => void;
  onReportUpdated?: (changes: ChatChange[]) => void;
}

/** Minimal, escape-first markdown - the model returns light formatting only. */
function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (bullet) {
      if (list !== 'ul') {
        closeList();
        out.push('<ul>');
        list = 'ul';
      }
      out.push(`<li>${bullet[1]}</li>`);
    } else if (numbered) {
      if (list !== 'ol') {
        closeList();
        out.push('<ol>');
        list = 'ol';
      }
      out.push(`<li>${numbered[1]}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${line}</p>`);
    }
  }
  closeList();

  return out
    .join('')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function ChatPanel({
  reportId,
  title,
  intro,
  suggestions,
  draftInputs,
  onFormFills,
  onReportUpdated,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The panel re-renders on every keystroke in the form, so read the latest
  // state through a ref rather than closing over a stale prop in send().
  const latestInputs = useRef(draftInputs);
  latestInputs.current = draftInputs;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const history = messages
      .filter((m) => !m.pending && !m.failed)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((m) => [...m, { role: 'user', text: trimmed }, { role: 'model', text: '', pending: true }]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          reportId,
          draftInputs: latestInputs.current ?? null,
        }),
      });
      const data = await res.json();

      setMessages((m) => [
        ...m.slice(0, -1),
        {
          role: 'model',
          text: data.text ?? 'No response.',
          changes: data.changes ?? [],
          citations: data.citations ?? [],
          tools: (data.toolLog ?? []).map((t: { name: string; summary: string }) => ({
            name: t.name,
            summary: t.summary,
          })),
          failed: Boolean(data.error),
        },
      ]);

      if (data.formFills?.length && onFormFills) onFormFills(data.formFills);
      if (data.reportUpdated && onReportUpdated) onReportUpdated(data.changes ?? []);
    } catch (err) {
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: 'model', text: `Could not reach the assistant. ${String(err)}`, failed: true },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex h-full flex-col bg-ink-50">
      <div className="flex items-center gap-2 border-b border-ink-200 bg-white px-4 py-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700">
          AI
        </span>
        <h2 className="text-[13px] font-semibold text-ink-900">{title}</h2>
        {busy && <span className="ml-auto text-[11px] text-ink-400">thinking…</span>}
      </div>

      <div ref={scrollRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="chat-bubble-model">
              <p>{intro}</p>
            </div>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-left text-[12.5px] text-ink-600 transition hover:border-brand-300 hover:text-ink-900"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className="max-w-[92%] space-y-1.5">
              {m.role === 'user' ? (
                <div className="chat-bubble-user">{m.text}</div>
              ) : m.pending ? (
                <div className="chat-bubble-model flex items-center gap-1.5 text-ink-400">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" />
                </div>
              ) : (
                <>
                  {m.tools && m.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.tools.map((t, i) => (
                        <span
                          key={i}
                          title={t.summary}
                          className="pill bg-ink-100 text-ink-500 font-mono text-[10px]"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div
                    className={`chat-bubble-model ${m.failed ? 'border-amber-300 bg-amber-50' : ''}`}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
                  />
                  {m.changes && m.changes.length > 0 && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                        Applied to the document
                      </p>
                      <ul className="space-y-0.5">
                        {m.changes.map((c, i) => (
                          <li key={i} className="text-[12px] text-emerald-900">
                            {c.display}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {m.citations && m.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.citations.map((c, i) => (
                        <span key={i} className="pill border border-ink-200 bg-white text-ink-500">
                          {c.regulation ? `${c.regulation}` : c.source}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={reportId ? 'Ask about the report, or tell me what to change…' : 'Ask about a field, or describe the site…'}
            className="field-input max-h-32 min-h-[38px] resize-none"
          />
          <button onClick={() => send(input)} disabled={busy || !input.trim()} className="btn-primary h-[38px] shrink-0">
            Send
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-400">
          All arithmetic is done by the engine, not the model. Regulatory answers cite UDCPR.
        </p>
      </div>
    </div>
  );
}
