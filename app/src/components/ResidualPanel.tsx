'use client';

import { useMemo, useState } from 'react';
import { solveResidual } from '@/engine/solve';
import { formatCrore, formatNumber, formatRupees } from '@/engine/format';
import type { FeasibilityInputs } from '@/engine/types';

/**
 * "What can I afford to offer?"
 *
 * The reference tool back-solves the land price. On a redevelopment the land is
 * not for sale, so the questions that actually decide a tender are how much
 * corpus the builder can put up and how much extra carpet they can promise the
 * members. All three are solved from the same target margin.
 */
export function ResidualPanel({ inputs }: { inputs: FeasibilityInputs }) {
  const [target, setTarget] = useState('25');

  const result = useMemo(() => {
    const t = Number(target);
    if (!Number.isFinite(t) || t <= 0 || t >= 100) return null;
    try {
      return solveResidual(inputs, t);
    } catch {
      return null;
    }
  }, [inputs, target]);

  // The corpus can be quoted as a lump sum or per sq.ft. of the members'
  // existing carpet. Read the standing offer off whichever basis is in force,
  // otherwise the "currently" figure contradicts the report.
  const membersCarpetSqft =
    inputs.existingResidentialCarpetSqft + inputs.existingCommercialCarpetSqft;
  const perSqftBasis = inputs.corpusFundBasis === 'PER_SQFT_EXISTING_CARPET';
  const currentCorpus = perSqftBasis
    ? membersCarpetSqft * inputs.corpusFundRatePerSqft
    : inputs.corpusFundCost;

  return (
    <section className="no-print rounded-lg border border-ink-200 bg-white p-4 shadow-sm">
      <h2 className="text-[13px] font-semibold text-ink-900">What can I afford to offer?</h2>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
        Set the margin you need and the engine back-solves the most you can put on the table at the
        current sale and construction rates.
      </p>

      <div className="mt-3 flex items-end gap-2">
        <div className="w-32">
          <label className="field-label">Target margin (%)</label>
          <input
            type="number"
            step={1}
            min={1}
            max={99}
            className="field-input"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        {result && (
          <p className="pb-2 text-[12px] text-ink-500">
            Currently at <strong className="text-ink-800">{formatNumber(result.currentMarginPct)}%</strong>
          </p>
        )}
      </div>

      {result ? (
        <>
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Row
              label="Corpus payable to the society"
              value={formatCrore(result.maxCorpusFund)}
              hint={
                perSqftBasis
                  ? `up to Rs. ${formatRupees(result.maxCorpusRatePerSqft)}/sq.ft of existing carpet — currently Rs. ${formatRupees(
                      inputs.corpusFundRatePerSqft,
                    )} (${formatCrore(currentCorpus)})`
                  : `currently ${formatCrore(currentCorpus)}`
              }
              highlight
            />
            <Row
              label="Additional carpet offerable"
              value={
                result.maxTenantUpliftPct === null
                  ? 'not achievable'
                  : `${formatNumber(result.maxTenantUpliftPct * 100, 1)}%`
              }
              hint={`currently ${formatNumber(inputs.additionalCarpetToTenantsPct * 100, 0)}%`}
              highlight
            />
            <Row
              label="Land price, if buying outright"
              value={formatCrore(result.maxLandCost)}
              hint={`Rs. ${formatRupees(result.maxLandRatePerSqft)}/sq.ft of plot`}
            />
            <Row
              label="Construction rate ceiling"
              value={`Rs. ${formatRupees(result.maxConstructionRatePerSqft)}/sq.ft`}
              hint={`currently Rs. ${formatRupees(inputs.constructionRatePerSqft)}`}
            />
            <Row
              label="Sale rate floor"
              value={`Rs. ${formatRupees(result.minResidentialSaleRatePerSqft)}/sq.ft`}
              hint={`currently Rs. ${formatRupees(inputs.residentialSaleRatePerSqft)}`}
            />
          </dl>

          {result.notes.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-ink-100 pt-2.5">
              {result.notes.map((n, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-amber-700">
                  {n}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
            Each figure assumes every other lever stays where it is. They are alternatives, not a shopping
            list &mdash; spending the full corpus and the full uplift together will not hold the margin.
          </p>
        </>
      ) : (
        <p className="mt-3 text-[12px] text-ink-400">Enter a target margin between 1 and 99.</p>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        highlight ? 'border-brand-200 bg-brand-50/60' : 'border-ink-200 bg-ink-50/50'
      }`}
    >
      <dt className="text-[11px] text-ink-500">{label}</dt>
      <dd className={`mt-0.5 text-[14px] font-semibold tabular-nums ${highlight ? 'text-brand-800' : 'text-ink-900'}`}>
        {value}
      </dd>
      {hint && <dd className="text-[10.5px] text-ink-400">{hint}</dd>}
    </div>
  );
}
