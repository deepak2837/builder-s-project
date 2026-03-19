'use client';

import { useEffect, useState } from 'react';
import { FRACTION_FIELDS } from '@/engine/constants';
import { todFsiFor } from '@/engine/derive';
import type { FeasibilityInputs } from '@/engine/types';

/**
 * The handful of levers the finance team actually moves when stress-testing a
 * scheme, surfaced at the top of the report so they do not have to go back to
 * the form. Changing any of them re-derives the whole document.
 */
const DRIVERS: { key: keyof FeasibilityInputs; label: string; unit?: string; step: number }[] = [
  { key: 'roadWidthM', label: 'Road width', unit: 'm', step: 0.5 },
  { key: 'plotAreaConveyanceSqm', label: 'Plot area', unit: 'sq.m', step: 1 },
  { key: 'existingResidentialCarpetSqft', label: 'Existing flat carpet', unit: 'sq.ft', step: 100 },
  { key: 'additionalCarpetToTenantsPct', label: 'Tenant uplift', unit: '%', step: 1 },
  { key: 'constructionRatePerSqft', label: 'Construction', unit: 'Rs/sq.ft', step: 50 },
  { key: 'residentialSaleRatePerSqft', label: 'Resi. sale rate', unit: 'Rs/sq.ft', step: 250 },
];

export function PrimaryDrivers({
  inputs,
  onChange,
  busy,
}: {
  inputs: FeasibilityInputs;
  onChange: (patch: Partial<FeasibilityInputs>) => void;
  busy?: boolean;
}) {
  const tod = todFsiFor(inputs.roadWidthM, inputs.plotAreaConveyanceSqm, inputs.authority);

  return (
    <div className="no-print rounded-lg border border-ink-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold text-ink-900">Primary drivers</p>
        <p className="text-[11px] text-ink-400">
          Change one and the whole report re-derives &mdash; FSI, saleable area, income, profit.
        </p>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-600">
          <input
            type="checkbox"
            checked={inputs.isTodZone}
            onChange={(e) => onChange({ isTodZone: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
          />
          Metro corridor
          {inputs.isTodZone && tod && (
            <span className="pill bg-brand-100 text-brand-800">max FSI {tod.maxFsi.toFixed(2)}</span>
          )}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {DRIVERS.map((d) => (
          <DriverInput key={d.key} meta={d} inputs={inputs} onChange={onChange} disabled={busy} />
        ))}
      </div>
    </div>
  );
}

function DriverInput({
  meta,
  inputs,
  onChange,
  disabled,
}: {
  meta: { key: keyof FeasibilityInputs; label: string; unit?: string; step: number };
  inputs: FeasibilityInputs;
  onChange: (patch: Partial<FeasibilityInputs>) => void;
  disabled?: boolean;
}) {
  const isFraction = FRACTION_FIELDS.has(meta.key);
  const raw = inputs[meta.key] as number;
  const shown = isFraction ? Number((raw * 100).toFixed(4)) : raw;
  const [draft, setDraft] = useState(String(shown));

  useEffect(() => setDraft(String(shown)), [shown]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(shown));
      return;
    }
    const next = isFraction ? n / 100 : n;
    if (next !== raw) onChange({ [meta.key]: next } as unknown as Partial<FeasibilityInputs>);
  };

  return (
    <div>
      <label className="mb-0.5 block truncate text-[10px] uppercase tracking-wide text-ink-400">
        {meta.label}
        {meta.unit && <span className="ml-1 normal-case tracking-normal text-ink-300">{meta.unit}</span>}
      </label>
      <input
        type="number"
        step={meta.step}
        disabled={disabled}
        className="field-input py-1 text-[12.5px]"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}
