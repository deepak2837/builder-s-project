'use client';

import { useMemo, useState } from 'react';
import {
  FIELD_META,
  FORM_SECTIONS,
  FRACTION_FIELDS,
  entitlementFor,
  rulebookFor,
  schemesForRulebook,
} from '@/engine/constants';
import { dcprEntitlementFor } from '@/engine/dcpr';
import { DERIVED_KEYS, todFsiFor } from '@/engine/derive';
import { formatArea, formatNumber } from '@/engine/format';
import type { FeasibilityInputs } from '@/engine/types';

/** Fields that only mean anything under one rulebook. */
const DCPR_ONLY = new Set<keyof FeasibilityInputs>([
  'dcprLocation',
  'dcprMaxFsi',
  'dcprPapSharePct',
  'dcprPapRatePerSqm',
  'dcprRoadSetbackCreditSqm',
  'dcprStaircaseAreaPerFloorSqm',
  'existingBuiltUpWithBalconySqm',
  'rehabBuaToCarpetFactor',
]);

const UDCPR_ONLY = new Set<keyof FeasibilityInputs>([
  'isTodZone',
  'todMaxFsi',
  'areaCategory',
  'avgExistingCarpetPerTenementSqm',
  'redevCessRatePerSqm',
  'mofaToReraFactor',
]);

interface Props {
  inputs: FeasibilityInputs;
  onChange: (patch: Partial<FeasibilityInputs>) => void;
  highlighted: Set<string>;
  /** Restricts rendering to these sections. Used by the wizard steps. */
  sectionIds?: readonly string[];
  /** Also render the advanced sections that belong to no wizard step. */
  includeAdvanced?: boolean;
}

const SECTION_HINTS: Record<string, string> = {
  identity: 'Identifies the project and selects the rate master.',
  plot: 'The four facts everything else derives from. Road width is the single most consequential field on this form.',
  existing: 'What is standing today. Determines incentive FSI, the hand-back to occupiers, and the rent liability.',
  handback: 'What the occupiers get back and how the new building splits between residential and commercial.',
  entitlement: 'Loading and carpet conversion factors. Change only against a measured layout.',
  rates: 'Municipal charge percentages. Several were open questions in the internal calculation format.',
  costs: "The builder's own cost assumptions and the sale-side revenue rates.",
  rent: 'Displacement cost for the construction period, computed on existing carpet area.',
  sale: 'Market rates for the surplus area. The revenue side of the whole appraisal.',
};

export function ParameterForm({ inputs, onChange, highlighted, sectionIds, includeAdvanced }: Props) {
  // Advanced sections start closed - the client asked for a short form with the
  // rest handled in the backend.
  // Inside a wizard step everything is open, since a step is already small.
  // On the single-page form the advanced sections start closed.
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    sectionIds ? new Set() : new Set(FORM_SECTIONS.filter((s) => s.tier === 'advanced').map((s) => s.id)),
  );

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const balancePlot = inputs.plotAreaConveyanceSqm - inputs.dpRoadAreaSqm;
  const rulebook = useMemo(() => rulebookFor(inputs.authority), [inputs.authority]);
  const isDcpr = rulebook.id === 'DCPR_2034';

  // Whichever table governs, the band read-out below the plot fields shows the
  // consequence of the four primary facts the user has just entered.
  const entitlement = useMemo(
    () =>
      isDcpr
        ? dcprEntitlementFor(inputs.roadWidthM, inputs.dcprLocation)
        : entitlementFor(inputs.roadWidthM, inputs.authority),
    [isDcpr, inputs.roadWidthM, inputs.authority, inputs.dcprLocation],
  );
  const entitlementBasic = isDcpr
    ? (entitlement as ReturnType<typeof dcprEntitlementFor>).baseFsi
    : (entitlement as ReturnType<typeof entitlementFor>).basicFsi;
  const todFsi = useMemo(
    () =>
      isDcpr ? null : todFsiFor(inputs.roadWidthM, inputs.plotAreaConveyanceSqm, inputs.authority),
    [isDcpr, inputs.roadWidthM, inputs.plotAreaConveyanceSqm, inputs.authority],
  );

  // A scheme from the other rulebook is not a live option on this plot.
  const schemeOptions = useMemo(
    () => schemesForRulebook(rulebook.id).map((s) => ({ value: s.id, label: `${s.label} (${s.regulation})` })),
    [rulebook.id],
  );

  return (
    <div className="space-y-4">
      {FORM_SECTIONS.filter((s) => {
        if (sectionIds) return sectionIds.includes(s.id);
        if (includeAdvanced) return s.tier === 'advanced';
        return true;
      }).map((section) => {
        // Regulation-derived keys are shown in the derived panel, not asked for.
        const fields = FIELD_META.filter((f) => f.section === section.id && !DERIVED_KEYS.has(f.key));
        if (fields.length === 0) return null;

        // Hide the split field that the chosen mode is not using, and anything
        // belonging to the rulebook that does not govern this plot.
        const visible = fields.filter((f) => {
          if (isDcpr && UDCPR_ONLY.has(f.key)) return false;
          if (!isDcpr && DCPR_ONLY.has(f.key)) return false;
          if (f.key === 'commercialAreaSqm') return inputs.commercialSplitMode === 'ABSOLUTE';
          if (f.key === 'commercialSharePct') return inputs.commercialSplitMode === 'PERCENT';
          if (f.key === 'developerCommercialCarpetSqft') return inputs.developerSplitMode === 'ABSOLUTE';
          if (f.key === 'developerCommercialSharePct') return inputs.developerSplitMode === 'PERCENT';
          if (f.key === 'corpusFundRatePerSqft') return inputs.corpusFundBasis === 'PER_SQFT_EXISTING_CARPET';
          if (f.key === 'corpusFundCost') return inputs.corpusFundBasis === 'LUMP_SUM';
          if (f.key === 'todMaxFsi' || f.key === 'dcprMaxFsi') return false;
          return true;
        });

        const isCollapsed = collapsed.has(section.id);

        return (
          <section key={section.id} className="rounded-lg border border-ink-200 bg-white shadow-sm">
            <button
              onClick={() => toggle(section.id)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className={`text-ink-400 transition ${isCollapsed ? '' : 'rotate-90'}`}>&rsaquo;</span>
              <span className="text-[13px] font-semibold text-ink-900">{section.title}</span>
              {section.tier === 'advanced' && (
                <span className="pill bg-ink-100 text-[10px] text-ink-500">advanced</span>
              )}
              <span className="ml-auto text-[11px] text-ink-400">{visible.length} fields</span>
            </button>

            {!isCollapsed && (
              <div className="border-t border-ink-100 px-4 pb-4 pt-3">
                {SECTION_HINTS[section.id] && (
                  <p className="mb-3 text-[12px] leading-relaxed text-ink-500">{SECTION_HINTS[section.id]}</p>
                )}

                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                  {visible.map((meta) => {
                    const value = inputs[meta.key];
                    const isFraction = FRACTION_FIELDS.has(meta.key);
                    const displayValue =
                      isFraction && typeof value === 'number' ? Number((value * 100).toFixed(4)) : value;
                    const isHot = highlighted.has(meta.key);

                    return (
                      <div key={meta.key} className={isHot ? 'just-changed -m-1 p-1' : ''}>
                        <label className="field-label flex items-baseline gap-1.5">
                          <span>{meta.label}</span>
                          {(meta.unit || isFraction) && (
                            <span className="text-ink-400">({isFraction ? '%' : meta.unit})</span>
                          )}
                          {meta.source && (
                            <span
                              title={meta.source}
                              className="cursor-help text-[10px] text-brand-500 underline decoration-dotted"
                            >
                              src
                            </span>
                          )}
                        </label>

                        {meta.type === 'select' ? (
                          <select
                            className="field-input"
                            value={String(value)}
                            onChange={(e) => onChange({ [meta.key]: e.target.value } as Partial<FeasibilityInputs>)}
                          >
                            {(meta.key === 'schemeType' ? schemeOptions : (meta.options ?? [])).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : meta.type === 'toggle' ? (
                          <label className="flex cursor-pointer items-center gap-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(e) =>
                                onChange({ [meta.key]: e.target.checked } as unknown as Partial<FeasibilityInputs>)
                              }
                              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
                            />
                            <span className="text-[13px] text-ink-700">{Boolean(value) ? 'Yes' : 'No'}</span>
                          </label>
                        ) : (
                          <input
                            type={meta.type === 'number' ? 'number' : meta.type === 'date' ? 'date' : 'text'}
                            step={meta.step}
                            className="field-input"
                            value={String(displayValue ?? '')}
                            onChange={(e) => {
                              if (meta.type === 'number') {
                                const n = Number(e.target.value);
                                if (!Number.isFinite(n)) return;
                                onChange({ [meta.key]: isFraction ? n / 100 : n } as unknown as Partial<FeasibilityInputs>);
                              } else {
                                onChange({ [meta.key]: e.target.value } as unknown as Partial<FeasibilityInputs>);
                              }
                            }}
                          />
                        )}

                        {meta.help && <p className="mt-1 text-[11px] leading-snug text-ink-400">{meta.help}</p>}
                      </div>
                    );
                  })}
                </div>

                {/* Live consequence of the four primary plot facts */}
                {section.id === 'plot' && (
                  <div className="mt-4 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5">
                    <p className="text-[12px] font-medium text-brand-900">
                      What these four values already decide
                    </p>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                      <dt className="text-brand-800">{isDcpr ? 'Net plot area' : 'Balance plot area'}</dt>
                      <dd className="text-right tabular-nums text-brand-900">{formatArea(balancePlot)}</dd>
                      <dt className="text-brand-800">{rulebook.table} band</dt>
                      <dd className="text-right text-brand-900">{entitlement.row.label}</dd>
                      <dt className="text-brand-800">Basic / premium / max TDR</dt>
                      <dd className="text-right tabular-nums text-brand-900">
                        {formatNumber(entitlementBasic)} / {formatNumber(entitlement.premiumFsi)} /{' '}
                        {formatNumber(entitlement.maxTdr)}
                      </dd>
                      <dt className="text-brand-800">
                        {!isDcpr && inputs.isTodZone ? 'Metro corridor max FSI' : 'Max building potential'}
                      </dt>
                      <dd className="text-right tabular-nums font-semibold text-brand-900">
                        {!isDcpr && inputs.isTodZone
                          ? formatNumber(todFsi?.maxFsi ?? entitlement.maxPotential)
                          : formatNumber(entitlement.maxPotential)}
                      </dd>
                      {!isDcpr && inputs.isTodZone && todFsi && (
                        <>
                          <dt className="text-brand-800">TOD road band</dt>
                          <dd className="text-right text-brand-900">{todFsi.label}</dd>
                        </>
                      )}
                      {isDcpr && (
                        <>
                          <dt className="text-brand-800">Reg. 33(20)(B) ceiling</dt>
                          <dd className="text-right tabular-nums text-brand-900">
                            {formatNumber(inputs.dcprMaxFsi)} on the plot in possession
                          </dd>
                        </>
                      )}
                    </dl>
                    {!isDcpr && inputs.isTodZone && !todFsi && (
                      <p className="mt-1.5 text-[11px] text-amber-700">
                        Below 9 m no TOD uplift applies, so the plot falls back to Table 6-G.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
