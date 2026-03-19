'use client';

import { useEffect, useState } from 'react';
import { formatArea, formatNumber } from '@/engine/format';
import type { FeasibilityInputs, FeasibilityResult, SplitMode } from '@/engine/types';

/**
 * Residential / commercial area controls.
 *
 * The builder asked to be able to move these directly rather than through the
 * parameter form, and to enter either side as an area or as a percentage. Two
 * splits matter and they are different questions:
 *
 *   the building mix   - how much of the permissible built-up area is commercial
 *   the sale mix       - how the developer's balance carpet splits between
 *                        residential and commercial
 *
 * In both cases the two sides must sum, so one is the control and the other is
 * shown live. Typing into either side is allowed; the other is back-solved.
 */
export function AreaMixControls({
  inputs,
  preview,
  onChange,
  disabled,
}: {
  inputs: FeasibilityInputs;
  preview: FeasibilityResult | null;
  onChange: (patch: Partial<FeasibilityInputs>) => void;
  disabled?: boolean;
}) {
  const totalBuaSqm = preview?.fsi.totalPermissibleBuaSqm ?? 0;
  const balanceCarpetSqft = Math.max(0, preview?.areas.developerBalanceCarpetSqft ?? 0);

  const commercialBuaSqm = preview?.areas.commercialBuaSqm ?? 0;
  const residentialBuaSqm = preview?.areas.residentialBuaSqm ?? 0;
  const saleCommercialSqft = preview?.areas.developerCommercialCarpetSqft ?? 0;
  const saleResidentialSqft = preview?.areas.developerResidentialCarpetSqft ?? 0;

  return (
    <section className="rounded-lg border border-ink-200 bg-white shadow-sm">
      <div className="border-b border-ink-100 px-4 py-3">
        <p className="text-[13px] font-semibold text-ink-900">Residential &amp; commercial area</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
          Move either split as a percentage or as an area &mdash; the other side follows. Everything downstream
          recomputes as you drag.
        </p>
      </div>

      <div className="space-y-5 px-4 py-4">
        <SplitControl
          title="Building mix"
          hint="Share of the permissible built-up area built as commercial. Commercial carries a higher loading and a higher development charge, so this moves cost as well as revenue."
          mode={inputs.commercialSplitMode}
          onModeChange={(m) => onChange({ commercialSplitMode: m })}
          total={totalBuaSqm}
          unit="sqm"
          controlledLabel="Commercial built-up"
          complementLabel="Residential built-up"
          controlledValue={commercialBuaSqm}
          complementValue={residentialBuaSqm}
          percentValue={inputs.commercialSharePct}
          disabled={disabled}
          onPercent={(pct) => onChange({ commercialSplitMode: 'PERCENT', commercialSharePct: pct })}
          onAbsolute={(area) => onChange({ commercialSplitMode: 'ABSOLUTE', commercialAreaSqm: area })}
          onComplementAbsolute={(area) =>
            onChange({ commercialSplitMode: 'ABSOLUTE', commercialAreaSqm: Math.max(0, totalBuaSqm - area) })
          }
        />

        <SplitControl
          title="Sale mix"
          hint="How the developer's balance carpet splits. Residential and commercial sell at different rates, so this is a direct lever on income."
          mode={inputs.developerSplitMode}
          onModeChange={(m) => onChange({ developerSplitMode: m })}
          total={balanceCarpetSqft}
          unit="sqft"
          controlledLabel="Commercial carpet"
          complementLabel="Residential carpet"
          controlledValue={saleCommercialSqft}
          complementValue={saleResidentialSqft}
          percentValue={inputs.developerCommercialSharePct}
          disabled={disabled}
          onPercent={(pct) => onChange({ developerSplitMode: 'PERCENT', developerCommercialSharePct: pct })}
          onAbsolute={(area) =>
            onChange({ developerSplitMode: 'ABSOLUTE', developerCommercialCarpetSqft: area })
          }
          onComplementAbsolute={(area) =>
            onChange({
              developerSplitMode: 'ABSOLUTE',
              developerCommercialCarpetSqft: Math.max(0, balanceCarpetSqft - area),
            })
          }
        />
      </div>
    </section>
  );
}

function SplitControl({
  title,
  hint,
  mode,
  onModeChange,
  total,
  unit,
  controlledLabel,
  complementLabel,
  controlledValue,
  complementValue,
  percentValue,
  disabled,
  onPercent,
  onAbsolute,
  onComplementAbsolute,
}: {
  title: string;
  hint: string;
  mode: SplitMode;
  onModeChange: (m: SplitMode) => void;
  total: number;
  unit: 'sqm' | 'sqft';
  controlledLabel: string;
  complementLabel: string;
  controlledValue: number;
  complementValue: number;
  percentValue: number;
  disabled?: boolean;
  onPercent: (pct: number) => void;
  onAbsolute: (area: number) => void;
  onComplementAbsolute: (area: number) => void;
}) {
  // The slider always works in percentage terms even when the stored value is
  // an absolute area, because dragging a raw square-metre figure is unusable.
  const effectivePct = total > 0 ? (controlledValue / total) * 100 : percentValue;

  const setFromSlider = (pct: number) => {
    if (mode === 'PERCENT') onPercent(pct);
    else onAbsolute((total * pct) / 100);
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold text-ink-800">{title}</p>
        <div className="ml-auto flex rounded-md border border-ink-200 p-0.5">
          {(['PERCENT', 'ABSOLUTE'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              disabled={disabled}
              className={`rounded px-2 py-0.5 text-[11px] transition ${
                mode === m ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              {m === 'PERCENT' ? '%' : unit === 'sqm' ? 'sq.m' : 'sq.ft'}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2.5 text-[11.5px] leading-snug text-ink-400">{hint}</p>

      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={Number.isFinite(effectivePct) ? Math.min(100, Math.max(0, effectivePct)) : 0}
        disabled={disabled || total <= 0}
        onChange={(e) => setFromSlider(Number(e.target.value))}
        className="w-full accent-brand-600 disabled:opacity-40"
      />

      <div className="mt-2 grid grid-cols-2 gap-3">
        <NumberField
          label={complementLabel}
          suffix={unit === 'sqm' ? 'sq.m' : 'sq.ft'}
          value={complementValue}
          disabled={disabled || total <= 0}
          onCommit={onComplementAbsolute}
          caption={total > 0 ? `${formatNumber(100 - effectivePct, 1)}% of the total` : undefined}
        />
        <NumberField
          label={controlledLabel}
          suffix={unit === 'sqm' ? 'sq.m' : 'sq.ft'}
          value={controlledValue}
          disabled={disabled || total <= 0}
          onCommit={onAbsolute}
          caption={total > 0 ? `${formatNumber(effectivePct, 1)}% of the total` : undefined}
        />
      </div>

      <p className="mt-1.5 text-[11px] text-ink-400">
        {total > 0 ? `Total ${formatArea(total, unit)}` : 'Enter the plot details to size this split.'}
      </p>
    </div>
  );
}

/** A numeric field that only commits on blur, so typing does not fight the slider. */
function NumberField({
  label,
  suffix,
  value,
  caption,
  disabled,
  onCommit,
}: {
  label: string;
  suffix: string;
  value: number;
  caption?: string;
  disabled?: boolean;
  onCommit: (n: number) => void;
}) {
  const rounded = Math.round(value * 100) / 100;
  const [draft, setDraft] = useState(String(rounded));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(rounded));
  }, [rounded, editing]);

  return (
    <div>
      <label className="mb-0.5 block truncate text-[10px] uppercase tracking-wide text-ink-400">
        {label}
        <span className="ml-1 normal-case tracking-normal text-ink-300">{suffix}</span>
      </label>
      <input
        type="number"
        disabled={disabled}
        className="field-input py-1 text-[12.5px]"
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const n = Number(draft);
          if (Number.isFinite(n) && n >= 0) onCommit(n);
          else setDraft(String(rounded));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {caption && <p className="mt-0.5 text-[10.5px] text-ink-400">{caption}</p>}
    </div>
  );
}
