'use client';

import { useEffect, useRef, useState } from 'react';
import { formatArea, formatNumber } from '@/engine/format';
import type { FeasibilityInputs, FeasibilityResult, SplitMode } from '@/engine/types';

/**
 * Residential / commercial area control.
 *
 * There is one question here, not two. The builder sets how much of the
 * permissible built-up area is commercial; the split of what is left to sell
 * follows from it, because the shops in the new building are the commercial
 * area. Either side can be entered as an area or as a percentage, and the sale
 * split is shown live underneath so the income consequence stays visible.
 *
 * A report saved before the two were tied - or one where the architect's layout
 * pins the commercial carpet - keeps its own figure until it is released back.
 */
export function AreaMixControls({
  inputs,
  preview,
  onChange,
  busy,
}: {
  inputs: FeasibilityInputs;
  preview: FeasibilityResult | null;
  onChange: (patch: Partial<FeasibilityInputs>) => void;
  /** A save is in flight. The controls stay live; only the read-outs lag. */
  busy?: boolean;
}) {
  const totalBuaSqm = preview?.fsi.totalPermissibleBuaSqm ?? 0;
  const balanceCarpetSqft = Math.max(0, preview?.areas.developerBalanceCarpetSqft ?? 0);

  const commercialBuaSqm = preview?.areas.commercialBuaSqm ?? 0;
  const residentialBuaSqm = preview?.areas.residentialBuaSqm ?? 0;
  const saleCommercialSqft = preview?.areas.developerCommercialCarpetSqft ?? 0;
  const saleResidentialSqft = preview?.areas.developerResidentialCarpetSqft ?? 0;

  const salePinned = inputs.developerSplitMode !== 'FOLLOW_BUILDING';
  const salePct = balanceCarpetSqft > 0 ? (saleCommercialSqft / balanceCarpetSqft) * 100 : 0;

  // Moving the slider is also the gesture that hands a pinned sale mix back to
  // the building mix - otherwise dragging would move cost without moving income.
  const release = { developerSplitMode: 'FOLLOW_BUILDING' as const };

  return (
    <section className="rounded-lg border border-ink-200 bg-white shadow-sm">
      <div className="border-b border-ink-100 px-4 py-3">
        <p className="text-[13px] font-semibold text-ink-900">Residential &amp; commercial area</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
          Move the split as a percentage or as an area &mdash; the other side follows. Everything downstream
          recomputes as you drag.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4">
        <SplitControl
          title="Commercial share"
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
          busy={busy}
          onPercent={(pct) => onChange({ ...release, commercialSplitMode: 'PERCENT', commercialSharePct: pct })}
          onAbsolute={(area) => onChange({ ...release, commercialSplitMode: 'ABSOLUTE', commercialAreaSqm: area })}
          onComplementAbsolute={(area) =>
            onChange({
              ...release,
              commercialSplitMode: 'ABSOLUTE',
              commercialAreaSqm: Math.max(0, totalBuaSqm - area),
            })
          }
        />

        {/* The sale mix - a consequence of the split above, not a second lever. */}
        <div className="rounded-md bg-ink-50 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-[12px] font-semibold text-ink-800">Sale mix</p>
            <p className="text-[11px] text-ink-400">
              {salePinned ? 'pinned by the layout' : 'follows the split above'}
            </p>
            {salePinned && (
              <button
                onClick={() => onChange(release)}
                className="ml-auto text-[11px] font-medium text-brand-600 hover:underline"
              >
                Follow the building mix
              </button>
            )}
          </div>

          {balanceCarpetSqft > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <SaleFigure label="Residential carpet" value={saleResidentialSqft} pct={100 - salePct} />
              <SaleFigure label="Commercial carpet" value={saleCommercialSqft} pct={salePct} />
            </div>
          ) : (
            <p className="mt-1 text-[11.5px] text-ink-400">
              No balance carpet remains for the developer to sell.
            </p>
          )}

          <p className="mt-1.5 text-[11px] text-ink-400">
            {balanceCarpetSqft > 0
              ? `Balance carpet ${formatArea(balanceCarpetSqft, 'sqft')}`
              : 'Enter the plot details to size this split.'}
          </p>
        </div>
      </div>
    </section>
  );
}

function SaleFigure({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <p className="truncate text-[10px] uppercase tracking-wide text-ink-400">{label}</p>
      <p className="text-[12.5px] font-medium tabular-nums text-ink-800">
        {formatArea(Math.max(0, value), 'sqft')}
      </p>
      <p className="text-[10.5px] text-ink-400">
        {Number.isFinite(pct) ? `${formatNumber(Math.min(100, Math.max(0, pct)), 1)}% of the balance` : '—'}
      </p>
    </div>
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
  busy,
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
  busy?: boolean;
  onPercent: (pct: number) => void;
  onAbsolute: (area: number) => void;
  onComplementAbsolute: (area: number) => void;
}) {
  // The slider always works in percentage terms even when the stored value is
  // an absolute area, because dragging a raw square-metre figure is unusable.
  const derivedPct = total > 0 ? (controlledValue / total) * 100 : percentValue;
  const clamped = Number.isFinite(derivedPct) ? Math.min(100, Math.max(0, derivedPct)) : 0;

  const setFromSlider = (pct: number) => {
    if (mode === 'PERCENT') onPercent(pct);
    else onAbsolute((total * pct) / 100);
  };

  const slider = useDraggableValue(clamped, setFromSlider, busy);
  const shown = slider.value;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold text-ink-800">{title}</p>
        <span className="text-[12px] tabular-nums text-ink-500">{formatNumber(shown, 1)}%</span>
        <div className="ml-auto flex rounded-md border border-ink-200 p-0.5">
          {(['PERCENT', 'ABSOLUTE'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
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

      {/* Deliberately not disabled while a save is in flight. Disabling the
          input mid-drag makes the browser drop the drag, which is what made
          this stutter instead of slide. */}
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={shown}
        disabled={total <= 0}
        onChange={(e) => slider.onInput(Number(e.target.value))}
        onPointerDown={slider.onGrab}
        onPointerUp={slider.onRelease}
        onPointerCancel={slider.onRelease}
        onKeyUp={slider.onRelease}
        onBlur={slider.onRelease}
        className="w-full accent-brand-600 disabled:opacity-40"
      />

      <div className="mt-2 grid grid-cols-2 gap-3">
        <NumberField
          label={complementLabel}
          suffix={unit === 'sqm' ? 'sq.m' : 'sq.ft'}
          value={complementValue}
          disabled={total <= 0}
          onCommit={onComplementAbsolute}
          caption={total > 0 ? `${formatNumber(100 - shown, 1)}% of the total` : undefined}
        />
        <NumberField
          label={controlledLabel}
          suffix={unit === 'sqm' ? 'sq.m' : 'sq.ft'}
          value={controlledValue}
          disabled={total <= 0}
          onCommit={onAbsolute}
          caption={total > 0 ? `${formatNumber(shown, 1)}% of the total` : undefined}
        />
      </div>

      <p className="mt-1.5 text-[11px] text-ink-400">
        {total > 0 ? `Total ${formatArea(total, unit)}` : 'Enter the plot details to size this split.'}
      </p>
    </div>
  );
}

/**
 * Keeps a slider under the thumb while the value it displays is round-tripping
 * through the server.
 *
 * Every move saves, and the figure that comes back is recalculated rather than
 * echoed, so binding the thumb straight to it means each drag fights a value
 * one request behind. This holds the dragged position locally, throttles what
 * is sent, and hands control back only once the recalculation has landed - so
 * any clamping the engine applied still shows up.
 */
function useDraggableValue(derived: number, commit: (v: number) => void, busy?: boolean) {
  const [local, setLocal] = useState<number | null>(null);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(derived);
  const wasBusy = useRef(false);

  latest.current = local ?? derived;

  useEffect(() => {
    if (wasBusy.current && !busy && !dragging.current) setLocal(null);
    wasBusy.current = Boolean(busy);
  }, [busy]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    value: local ?? derived,
    onInput: (v: number) => {
      setLocal(v);
      latest.current = v;
      // Trailing throttle: the figures below the slider keep up with the drag
      // without firing one request per pixel.
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        commit(latest.current);
      }, 140);
    },
    onGrab: () => {
      dragging.current = true;
    },
    onRelease: () => {
      if (!dragging.current && local === null) return;
      dragging.current = false;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      commit(latest.current);
    },
  };
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
