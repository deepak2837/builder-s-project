'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCrore, formatNumber, formatPercent } from '@/engine/format';

interface Row {
  id: string;
  projectId: string;
  projectName: string;
  version: number;
  village: string;
  authority: string;
  netProfit: number;
  totalIncome: number;
  totalExpenditure: number;
  marginPct: number;
  score: number;
  verdict: string;
  tenantUpliftPct: number;
  createdAt: string;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    const res = await fetch('/api/reports');
    const data = await res.json();
    setRows(data.reports ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    load();
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });

  const comparison = useMemo(() => (rows ?? []).filter((r) => selected.has(r.id)), [rows, selected]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-950 sm:text-[22px]">
            Report history
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Every run is versioned rather than overwritten, so assumptions can be compared over time.
            Tick up to three to compare them side by side.
          </p>
        </div>
        <Link href="/" className="btn-primary h-9 shrink-0 self-start sm:self-auto">
          New report
        </Link>
      </header>

      {comparison.length >= 2 && (
        <div className="mb-6 overflow-x-auto rounded-lg border border-brand-200 bg-brand-50/50 p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-brand-900">Comparison</h2>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="pb-2 font-medium">Metric</th>
                {comparison.map((c) => (
                  <th key={c.id} className="pb-2 text-right font-medium">
                    {c.projectName} v{c.version}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(
                [
                  ['Tenant uplift', (c: Row) => `${formatNumber(c.tenantUpliftPct, 0)}%`],
                  ['Total income', (c: Row) => formatCrore(c.totalIncome)],
                  ['Total expenditure', (c: Row) => formatCrore(c.totalExpenditure)],
                  ['Net profit', (c: Row) => formatCrore(c.netProfit)],
                  ['Margin', (c: Row) => formatPercent(c.marginPct)],
                  ['Score', (c: Row) => `${formatNumber(c.score, 1)} - ${c.verdict}`],
                ] as [string, (c: Row) => string][]
              ).map(([label, fn]) => (
                <tr key={label} className="border-t border-brand-200/60">
                  <td className="py-1.5 text-ink-600">{label}</td>
                  {comparison.map((c) => (
                    <td key={c.id} className="py-1.5 text-right text-ink-900">
                      {fn(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows === null ? (
        <p className="text-[13px] text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
          <p className="text-[14px] text-ink-700">No reports yet.</p>
          <p className="mt-1 text-[13px] text-ink-500">
            Generate one from the parameter form and it will appear here.
          </p>
          <Link href="/" className="btn-primary mt-4">
            Create the first report
          </Link>
        </div>
      ) : (
        <>
          {/* ---------- phone: cards, because a 10-column table cannot fit ---------- */}
          <div className="space-y-2.5 sm:hidden">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-ink-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/workspace/${r.id}`} className="text-[14px] font-medium text-ink-900">
                      {r.projectName}
                      <span className="ml-1.5 text-[11px] font-normal text-ink-400">v{r.version}</span>
                    </Link>
                    <p className="text-[11px] text-ink-400">
                      {r.village} &middot; {r.authority} &middot; {formatNumber(r.tenantUpliftPct, 0)}% uplift
                    </p>
                  </div>
                  <span
                    className={`pill shrink-0 ${
                      r.score >= 75
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.score >= 55
                          ? 'bg-brand-100 text-brand-800'
                          : r.score >= 40
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {r.verdict}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-2.5">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-ink-400">Income</dt>
                    <dd className="text-[12.5px] tabular-nums text-ink-700">{formatCrore(r.totalIncome)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-ink-400">Net profit</dt>
                    <dd
                      className={`text-[12.5px] font-medium tabular-nums ${
                        r.netProfit >= 0 ? 'text-gain' : 'text-loss'
                      }`}
                    >
                      {formatCrore(r.netProfit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-ink-400">Margin</dt>
                    <dd className="text-[12.5px] tabular-nums text-ink-700">{formatPercent(r.marginPct)}</dd>
                  </div>
                </dl>

                <div className="mt-2 flex items-center gap-1 border-t border-ink-100 pt-2">
                  <Link href={`/workspace/${r.id}`} className="btn-ghost h-7 text-[12px]">
                    Open
                  </Link>
                  <a href={`/api/export/${r.id}?format=xlsx`} className="btn-ghost h-7 text-[12px]">
                    xlsx
                  </a>
                  <button onClick={() => remove(r.id)} className="btn-ghost ml-auto h-7 text-[12px] text-loss">
                    delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ---------- tablet and up: the full table ---------- */}
          <div className="hidden overflow-x-auto rounded-lg border border-ink-200 bg-white shadow-sm sm:block">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-500">
              <tr>
                <th className="w-10 px-3 py-2.5" />
                <th className="px-3 py-2.5 text-left font-medium">Project</th>
                <th className="px-3 py-2.5 text-left font-medium">Authority</th>
                <th className="px-3 py-2.5 text-right font-medium">Uplift</th>
                <th className="px-3 py-2.5 text-right font-medium">Income</th>
                <th className="px-3 py-2.5 text-right font-medium">Net profit</th>
                <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                <th className="px-3 py-2.5 text-left font-medium">Verdict</th>
                <th className="px-3 py-2.5 text-right font-medium">Created</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/workspace/${r.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {r.projectName}
                    </Link>
                    <span className="ml-1.5 text-[11px] text-ink-400">v{r.version}</span>
                    <p className="text-[11px] text-ink-400">{r.village}</p>
                  </td>
                  <td className="px-3 py-2.5 text-ink-600">{r.authority}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-600">
                    {formatNumber(r.tenantUpliftPct, 0)}%
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{formatCrore(r.totalIncome)}</td>
                  <td
                    className={`px-3 py-2.5 text-right font-medium tabular-nums ${
                      r.netProfit >= 0 ? 'text-gain' : 'text-loss'
                    }`}
                  >
                    {formatCrore(r.netProfit)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{formatPercent(r.marginPct)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`pill ${
                        r.score >= 75
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.score >= 55
                            ? 'bg-brand-100 text-brand-800'
                            : r.score >= 40
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {r.verdict}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-ink-400">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <a href={`/api/export/${r.id}?format=xlsx`} className="btn-ghost h-7 text-[12px]">
                        xlsx
                      </a>
                      <button onClick={() => remove(r.id)} className="btn-ghost h-7 text-[12px] text-loss">
                        delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
