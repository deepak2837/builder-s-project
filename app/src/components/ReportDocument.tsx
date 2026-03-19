'use client';

import { useEffect, useRef, useState } from 'react';
import { FIELD_META_BY_KEY, FRACTION_FIELDS } from '@/engine/constants';
import { formatNumber, formatValue } from '@/engine/format';
import type { FeasibilityInputs, FeasibilityResult, LineItem } from '@/engine/types';

interface Props {
  result: FeasibilityResult;
  changedFields: Set<string>;
  onUpdateInput: (patch: Partial<FeasibilityInputs>) => void;
  onEditProse: (sectionId: string, html: string) => void;
  onRemoveItem: (sectionId: string, itemId: string) => void;
}

export function ReportDocument({ result, changedFields, onUpdateInput, onEditProse, onRemoveItem }: Props) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const i = result.inputs;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-8 print:max-w-none print:px-0 print:py-0">
      {/* ---------------------------------------------------------- header */}
      <div className="doc-page px-5 py-6 text-center sm:px-10 sm:py-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Project Report</p>
        <h1 className="mt-2 text-[20px] font-semibold tracking-tight text-ink-950 sm:text-[24px]">
          {i.projectName}
        </h1>
        <p className="mt-1 text-[13px] text-ink-600">
          {i.surveyNo}, Village &ndash; {i.village}
        </p>
        <p className="mt-0.5 text-[12px] text-ink-400">
          {i.authority} &nbsp;|&nbsp; Date: {i.reportDate}
        </p>

        <p className="mt-1 text-[11px] text-ink-400">
          Indicative per {result.rulebook.name} &mdash; verify before sanction. Ruleset {result.ruleset}.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:flex sm:items-stretch sm:justify-center sm:gap-3">
          <Headline label="Total income" value={formatValue(result.summary.totalIncome, 'cr')} />
          <Headline label="Total expenditure" value={formatValue(result.summary.totalExpenditure, 'cr')} />
          <Headline
            label="Net profit"
            value={formatValue(result.summary.netProfit, 'cr')}
            tone={result.summary.netProfit >= 0 ? 'gain' : 'loss'}
          />
          <Headline
            label={`Score ${result.score.score}`}
            value={result.score.verdict}
            tone={result.score.score >= 55 ? 'gain' : 'loss'}
          />
        </div>
      </div>

      {/* ------------------------------------------------- plain-language read */}
      <div className="doc-page px-5 py-5 sm:px-10 sm:py-6">
        <p className="text-[14px] leading-relaxed text-ink-800">{result.headline}</p>

        {/* Entitlement at a glance, each figure traceable to its table */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Basic FSI', value: result.effectiveInputs.basicFsi },
            { label: 'Premium (max)', value: result.effectiveInputs.premiumFsiRate },
            { label: 'TDR (max)', value: result.effectiveInputs.maxTdrLoading },
            { label: 'Max potential', value: result.effectiveInputs.todMaxFsi, accent: true },
          ].map((k) => (
            <div
              key={k.label}
              className={`rounded-lg border px-3 py-2.5 ${
                k.accent ? 'border-brand-300 bg-brand-50' : 'border-ink-200 bg-ink-50/60'
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-ink-400">{k.label}</p>
              <p className={`mt-0.5 text-[20px] font-semibold tabular-nums ${k.accent ? 'text-brand-700' : 'text-ink-900'}`}>
                {formatNumber(k.value, 2)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-400">
          {result.rulebook.table}, {result.effectiveInputs.authority === 'OTHER' ? 'other authorities' : 'Municipal Corporation'}{' '}
          column &middot; {formatNumber(result.effectiveInputs.roadWidthM, 1)} m governing road width
          {result.effectiveInputs.isTodZone ? ' · metro corridor (Reg. 14.2)' : ''}
        </p>
      </div>

      {/* ------------------------------------------------------- input checks */}
      {result.checks.length > 0 && (
        <section className="doc-page border-amber-200 px-5 py-5 sm:px-10 sm:py-6">
          <h2 className="text-[14px] font-semibold text-amber-900">Check your inputs</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">
            These are not regulatory objections &mdash; they are places the data looks unlikely.
          </p>
          <ul className="mt-2.5 space-y-2">
            {result.checks.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span
                  className={`mt-0.5 shrink-0 text-[11px] ${
                    c.severity === 'error' ? 'text-loss' : c.severity === 'warning' ? 'text-amber-600' : 'text-ink-400'
                  }`}
                >
                  {c.severity === 'error' ? '■' : c.severity === 'warning' ? '▲' : '●'}
                </span>
                <span className="text-[12.5px] leading-relaxed text-ink-700">{c.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --------------------------------------------------------- sections */}
      {result.sections.map((section) => (
        <section key={section.id} className="doc-page px-5 py-6 sm:px-10 sm:py-8">
          <h2 className="text-[16px] font-semibold tracking-tight text-ink-950">{section.title}</h2>
          {section.subtitle && <p className="mt-0.5 text-[12px] text-ink-500">{section.subtitle}</p>}

          {section.prose !== undefined && (
            <EditableProse html={section.prose} onSave={(html) => onEditProse(section.id, html)} />
          )}

          <div className="mt-4">
            {section.items.map((item) => (
              <LineRow
                key={item.id}
                item={item}
                inputs={i}
                isOpen={openItem === item.id}
                isChanged={Boolean(item.drivenBy && changedFields.has(item.drivenBy))}
                onToggle={() => setOpenItem(openItem === item.id ? null : item.id)}
                onUpdateInput={onUpdateInput}
                onRemove={() => onRemoveItem(section.id, item.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* --------------------------------------------------------- warnings */}
      {result.warnings.length > 0 && (
        <section className="doc-page border-amber-200 px-5 py-5 sm:px-10 sm:py-6">
          <h2 className="text-[14px] font-semibold text-amber-900">Checks raised by the engine</h2>
          <ul className="mt-2 space-y-1.5">
            {result.warnings.map((w, idx) => (
              <li key={idx} className="text-[12.5px] leading-relaxed text-amber-800">
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Headline({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2 text-left sm:min-w-[150px] sm:px-4 sm:py-2.5 sm:text-center">
      <p className="text-[10px] uppercase tracking-wide text-ink-400">{label}</p>
      <p
        className={`mt-0.5 text-[14px] font-semibold tabular-nums ${
          tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** Prose blocks are directly editable, Google-Docs style, and persist on blur. */
function EditableProse({ html, onSave }: { html?: string; onSave: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (ref.current && !dirty && ref.current.innerHTML !== (html ?? '')) {
      ref.current.innerHTML = html ?? '';
    }
  }, [html, dirty]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="doc-prose mt-3 cursor-text"
      onInput={() => setDirty(true)}
      onBlur={() => {
        if (dirty && ref.current) {
          onSave(ref.current.innerHTML);
          setDirty(false);
        }
      }}
    />
  );
}

function LineRow({
  item,
  inputs,
  isOpen,
  isChanged,
  onToggle,
  onUpdateInput,
  onRemove,
}: {
  item: LineItem;
  inputs: FeasibilityInputs;
  isOpen: boolean;
  isChanged: boolean;
  onToggle: () => void;
  onUpdateInput: (patch: Partial<FeasibilityInputs>) => void;
  onRemove: () => void;
}) {
  // Heading rows carry no value.
  const isHeading = item.unit === 'ratio' && item.value === 0 && item.emphasis;
  if (isHeading) {
    return <p className="mb-1 mt-4 text-[13px] font-semibold text-ink-950">{item.label}</p>;
  }

  const meta = item.drivenBy ? FIELD_META_BY_KEY.get(item.drivenBy) : undefined;
  const hasDetail = Boolean(item.formula || item.regulation || item.note || meta);

  return (
    <div className={isChanged ? 'just-changed' : ''}>
      <div
        className={`line-row ${item.emphasis ? 'line-row-emphasis' : ''} ${
          hasDetail ? 'cursor-pointer hover:bg-ink-50' : ''
        }`}
        onClick={hasDetail ? onToggle : undefined}
      >
        <span className="line-label" style={{ paddingLeft: `${(item.indent ?? 0) * 16}px` }}>
          {item.label}
          {hasDetail && <span className="ml-1.5 text-[10px] text-ink-300">{isOpen ? '▾' : '▸'}</span>}
        </span>
        <span className="line-value">{formatValue(item.value, item.unit)}</span>
      </div>

      {isOpen && hasDetail && (
        <div className="no-print mb-2 ml-1 rounded-md border border-ink-200 bg-ink-50/70 px-3.5 py-3 text-[12px]">
          {item.formula && (
            <p className="font-mono text-[11.5px] leading-relaxed text-ink-700">{item.formula}</p>
          )}
          {item.regulation && (
            <p className="mt-1.5">
              <span className="pill bg-brand-100 text-brand-800">{item.regulation}</span>
            </p>
          )}
          {item.note && <p className="mt-1.5 leading-relaxed text-ink-500">{item.note}</p>}

          {meta && item.drivenBy && (
            <div className="mt-3 flex items-end gap-2 border-t border-ink-200 pt-3">
              <div className="flex-1">
                <label className="field-label">
                  {meta.label}
                  {FRACTION_FIELDS.has(item.drivenBy) ? ' (%)' : meta.unit ? ` (${meta.unit})` : ''}
                </label>
                <InlineNumber
                  field={item.drivenBy}
                  value={inputs[item.drivenBy] as number}
                  step={meta.step}
                  onCommit={onUpdateInput}
                />
              </div>
              {meta.source && <p className="pb-2 text-[11px] text-ink-400">{meta.source}</p>}
            </div>
          )}

          {item.id.startsWith('custom.') && (
            <button onClick={onRemove} className="btn-ghost mt-2 text-[12px] text-loss">
              Remove this line
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Editing the driving input here re-runs the whole engine, same as the chatbot. */
function InlineNumber({
  field,
  value,
  step,
  onCommit,
}: {
  field: keyof FeasibilityInputs;
  value: number;
  step?: number;
  onCommit: (patch: Partial<FeasibilityInputs>) => void;
}) {
  const isFraction = FRACTION_FIELDS.has(field);
  const display = isFraction ? Number((value * 100).toFixed(4)) : value;
  const [draft, setDraft] = useState(String(display));

  useEffect(() => setDraft(String(display)), [display]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(display));
      return;
    }
    const next = isFraction ? n / 100 : n;
    if (next !== value) onCommit({ [field]: next } as unknown as Partial<FeasibilityInputs>);
  };

  return (
    <input
      type="number"
      step={step}
      className="field-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
