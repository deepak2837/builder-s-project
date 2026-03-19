'use client';

import { useState } from 'react';
import { FRACTION_FIELDS } from '@/engine/constants';
import { formatNumber } from '@/engine/format';
import type { DerivedField, SchemeStatus } from '@/engine/derive';
import type { FeasibilityInputs } from '@/engine/types';

interface Props {
  derived: DerivedField[];
  schemes: SchemeStatus[];
  rulebook: { name: string; supported: boolean; caveat?: string };
  onOverride: (key: string, value: number | null) => void;
  readOnly?: boolean;
}

function display(field: DerivedField, value: number): string {
  if (FRACTION_FIELDS.has(field.key)) return `${formatNumber(value * 100, 0)}%`;
  if (field.unit === 'Rs/sq.m') return `Rs. ${formatNumber(value, 0)}`;
  return formatNumber(value, 2);
}

/**
 * Everything the regulations decide, shown as output rather than asked for as
 * input. The padlock pins a value when a local circular departs from the state
 * rule; otherwise it re-derives whenever road width, metro corridor, area
 * category or authority changes.
 */
export function DerivedPanel({ derived, schemes, rulebook, onOverride, readOnly }: Props) {
  const [expanded, setExpanded] = useState(false);
  const pinnedCount = derived.filter((d) => d.overridden).length;

  return (
    <section className="rounded-lg border border-brand-200 bg-brand-50/40 shadow-sm">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <span className={`text-brand-400 transition ${expanded ? 'rotate-90' : ''}`}>&rsaquo;</span>
        <span className="text-[13px] font-semibold text-brand-900">Derived from the regulations</span>
        <span className="ml-auto text-[11px] text-brand-700">
          {derived.length} parameters
          {pinnedCount > 0 && ` · ${pinnedCount} pinned`}
        </span>
      </button>

      <div className="border-t border-brand-200/70 px-4 pb-4 pt-3">
        <p className="mb-3 text-[12px] leading-relaxed text-brand-800">
          These are computed from plot area, road width, metro corridor and the existing building &mdash;
          you do not enter them. Change the road width and the permissible FSI, saleable area and income
          all move with it. Pin one only if a local circular differs from {rulebook.name}.
        </p>

        {/* ---- Scheme eligibility ---- */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {schemes.map((s) => (
            <span
              key={s.id}
              title={`${s.reason} (${s.regulation})`}
              className={`pill cursor-help border ${
                s.applies
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-ink-200 bg-white text-ink-400'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.applies ? 'bg-emerald-500' : 'bg-ink-300'}`} />
              {s.label}
            </span>
          ))}
        </div>

        {!rulebook.supported && rulebook.caveat && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5">
            <p className="text-[12px] font-semibold text-amber-900">Rulebook mismatch</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-amber-800">{rulebook.caveat}</p>
          </div>
        )}

        {/* ---- The derived values ---- */}
        <div className="overflow-hidden rounded-md border border-brand-200 bg-white">
          {(expanded ? derived : derived.slice(0, 5)).map((d) => (
            <div
              key={d.key}
              className="flex items-start gap-3 border-b border-ink-100 px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-ink-800">{d.label}</p>
                <p className="text-[11px] leading-snug text-ink-400">
                  {d.regulation} &middot; {d.basis}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className={`text-[13px] font-semibold tabular-nums ${d.overridden ? 'text-amber-700' : 'text-ink-900'}`}>
                  {display(d, d.value)}
                </p>
                {d.overridden && (
                  <p className="text-[10px] text-ink-400">rule: {display(d, d.derivedValue)}</p>
                )}
              </div>

              {!readOnly && (
                <button
                  onClick={() => onOverride(d.key, d.overridden ? null : d.derivedValue)}
                  title={d.overridden ? 'Release back to the regulation' : 'Pin this value'}
                  className={`shrink-0 rounded px-1.5 py-1 text-[13px] leading-none transition ${
                    d.overridden ? 'text-amber-600 hover:bg-amber-50' : 'text-ink-300 hover:bg-ink-100 hover:text-ink-500'
                  }`}
                >
                  {d.overridden ? '🔓' : '🔒'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Inline editors for whatever is pinned */}
        {!readOnly && derived.filter((d) => d.overridden).length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {derived
              .filter((d) => d.overridden)
              .map((d) => (
                <div key={`edit-${d.key}`}>
                  <label className="field-label">
                    {d.label}
                    {FRACTION_FIELDS.has(d.key) ? ' (%)' : d.unit ? ` (${d.unit})` : ''}
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="field-input"
                    value={FRACTION_FIELDS.has(d.key) ? Number((d.value * 100).toFixed(4)) : d.value}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      onOverride(d.key, FRACTION_FIELDS.has(d.key) ? n / 100 : n);
                    }}
                  />
                </div>
              ))}
          </div>
        )}

        {!expanded && derived.length > 5 && (
          <button onClick={() => setExpanded(true)} className="btn-ghost mt-2 text-[12px] text-brand-700">
            Show all {derived.length} derived parameters
          </button>
        )}
      </div>
    </section>
  );
}

export type { DerivedField, SchemeStatus, FeasibilityInputs };
