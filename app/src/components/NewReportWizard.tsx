'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AreaMixControls } from '@/components/AreaMixControls';
import { ChatPanel } from '@/components/ChatPanel';
import { DerivedPanel } from '@/components/DerivedPanel';
import { MobilePaneToggle } from '@/components/MobilePaneToggle';
import { ParameterForm } from '@/components/ParameterForm';
import { WizardStepper } from '@/components/WizardStepper';
import { calculateFeasibility } from '@/engine/calculate';
import {
  DEFAULT_INPUTS,
  WIZARD_STEPS,
  createBlankInputs,
  defaultSchemeFor,
  normaliseInputs,
  rateMasterFor,
  rulebookFor,
  schemeFor,
} from '@/engine/constants';
import { formatArea, formatCrore, formatNumber, formatPercent } from '@/engine/format';
import type { FeasibilityInputs } from '@/engine/types';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';

const SUGGESTIONS = [
  'What FSI do I get on an 18 m road in a metro corridor?',
  'Is this plot in Mumbai on DCPR or UDCPR, and what changes?',
  '4,200 sq.m plot in Bhayandar, 18 m road, 111 flats, 34 shops, MBMC',
  'How much extra carpet can I offer the members and still clear 20%?',
];

/** Fields that must be present before a step can be considered complete. */
const REQUIRED_BY_STEP: Record<string, (keyof FeasibilityInputs)[]> = {
  plot: ['plotAreaConveyanceSqm'],
  road: ['roadWidthM'],
  development: ['constructionRatePerSqft', 'residentialSaleRatePerSqft'],
  scheme: [],
  generate: [],
};

/**
 * The New Report wizard.
 *
 * Lives in its own client module rather than in the route file: it reads the
 * `?from=` search param, which forces the subtree out of the static shell, and
 * the Suspense boundary that catches that has to sit in the server component
 * above it. With both in one client route file the boundary is prerendered as a
 * postponed placeholder and never resolves, leaving the page on its fallback.
 */
export function NewReportWizard() {
  const router = useRouter();

  const [inputs, setInputs] = useState<FeasibilityInputs>(() => createBlankInputs());
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<'form' | 'chat'>('form');
  const [sourceReportId, setSourceReportId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // ---------------------------------------------------------------- restore
  // Nothing entered here should be lost by navigating away. On mount we either
  // pull the inputs of a report the user came back from, or the local draft.
  useEffect(() => {
    let cancelled = false;

    // Read off the URL rather than through useSearchParams: the value is only
    // ever needed here, in an effect, and subscribing to it in render would opt
    // this subtree out of the prerendered shell for no benefit.
    const fromReportId =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('from');

    async function restore() {
      if (fromReportId) {
        try {
          const res = await fetch(`/api/reports/${fromReportId}`);
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) {
              setInputs(normaliseInputs(data.result.inputs as Partial<FeasibilityInputs>));
              setSourceReportId(fromReportId);
              setFurthest(WIZARD_STEPS.length - 1);
              setRestored(true);
              return;
            }
          }
        } catch {
          // Fall through to the local draft.
        }
      }

      const draft = loadDraft();
      if (draft && !cancelled) {
        setInputs(draft.inputs);
        setStep(Math.min(draft.step, WIZARD_STEPS.length - 1));
        setFurthest(draft.furthest);
        setSourceReportId(draft.sourceReportId ?? null);
      }
      if (!cancelled) setRestored(true);
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------------ save
  // Written on every change once the restore has run, so a reload or a trip to
  // the report and back picks up exactly where the user left off.
  useEffect(() => {
    if (!restored) return;
    saveDraft({ inputs, step, furthest, sourceReportId });
  }, [inputs, step, furthest, sourceReportId, restored]);

  // The engine is pure TypeScript, so the preview recomputes in the browser on
  // every keystroke without a round trip.
  const preview = useMemo(() => {
    try {
      return calculateFeasibility(inputs);
    } catch {
      return null;
    }
  }, [inputs]);

  const rulebook = rulebookFor(inputs.authority);
  const currentStep = WIZARD_STEPS[step];
  const isLast = step === WIZARD_STEPS.length - 1;

  const missing = useMemo(
    () => (REQUIRED_BY_STEP[currentStep.id] ?? []).filter((k) => !inputs[k]),
    [currentStep.id, inputs],
  );

  const applyChange = useCallback((patch: Partial<FeasibilityInputs>) => {
    setInputs((prev) => {
      const next = { ...prev, ...patch };

      if (patch.authority && patch.authority !== prev.authority) {
        const rm = rateMasterFor(patch.authority);
        Object.assign(next, {
          constructionRatePerSqft: rm.constructionRatePerSqft,
          tdrRatePerSqft: rm.tdrRatePerSqft,
          residentialSaleRatePerSqft: rm.residentialSaleRatePerSqft,
          commercialSaleRatePerSqft: rm.commercialSaleRatePerSqft,
          flatRentPerSqftPerMonth: rm.flatRentPerSqftPerMonth,
          shopRentPerSqftPerMonth: rm.shopRentPerSqftPerMonth,
        });

        // Moving between Mumbai and the rest of the state changes the rulebook,
        // and a UDCPR scheme does not run under DCPR. Switch to that
        // rulebook's default rather than leaving an inapplicable one selected.
        const nextBook = rulebookFor(patch.authority);
        if (schemeFor(next.schemeType).rulebook !== nextBook.id) {
          next.schemeType = defaultSchemeFor(nextBook.id);
        }
      }

      return next;
    });
  }, []);

  const handleOverride = useCallback((key: string, value: number | null) => {
    setInputs((prev) => {
      const overrides = new Set(prev.overrides ?? []);
      const next = { ...prev };
      if (value === null) overrides.delete(key);
      else {
        overrides.add(key);
        (next as unknown as Record<string, unknown>)[key] = value;
      }
      next.overrides = [...overrides];
      return next;
    });
  }, []);

  const handleFormFills = useCallback(
    (fills: { field: string; value: unknown }[]) => {
      const patch: Record<string, unknown> = {};
      for (const f of fills) patch[f.field] = f.value;
      applyChange(patch as Partial<FeasibilityInputs>);
      setHighlighted(new Set(fills.map((f) => f.field)));
      setPane('form');
      setTimeout(() => setHighlighted(new Set()), 2600);
    },
    [applyChange],
  );

  const goTo = useCallback((idx: number) => {
    setStep(idx);
    setFurthest((f) => Math.max(f, idx));
    window.scrollTo({ top: 0 });
  }, []);

  async function generate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate report');
      // The draft has become a report, so it stops being a draft - but keep the
      // inputs available under the new report's id for a round trip back here.
      saveDraft({ inputs, step, furthest, sourceReportId: data.id });
      router.push(`/workspace/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-[1800px]">
      <div className={`flex-1 flex-col overflow-hidden ${pane === 'chat' ? 'hidden' : 'flex'} lg:flex`}>
        <div className="thin-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-4xl">
            {/* ------------------------------------------------ header */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] font-semibold tracking-tight text-ink-950">
                {inputs.projectName || 'Untitled report'}
              </h1>
              <span className="text-[11px] text-ink-400">
                {schemeFor(inputs.schemeType).label} &middot; {inputs.authority} &middot; {rulebook.shortName}
              </span>
              <div className="ml-auto flex gap-1.5">
                {sourceReportId && (
                  <Link href={`/workspace/${sourceReportId}`} className="btn-secondary h-8">
                    Back to report
                  </Link>
                )}
                <button
                  onClick={() => {
                    setInputs(createBlankInputs(inputs.authority));
                    setStep(0);
                    setFurthest(0);
                    setSourceReportId(null);
                    clearDraft();
                  }}
                  className="btn-secondary h-8"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    setInputs({ ...DEFAULT_INPUTS });
                    setFurthest(WIZARD_STEPS.length - 1);
                  }}
                  className="btn-secondary h-8"
                >
                  Load example
                </button>
              </div>
            </div>

            <div className="mb-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[11.5px] leading-snug text-brand-900">
              <strong>{rulebook.name}</strong> governs this plot &mdash; {rulebook.region}. Entitlement is read from{' '}
              {rulebook.table} and the free-of-FSI loading is granted as {rulebook.loadingLabel.toLowerCase()}.
              {sourceReportId && ' Your entries are kept as you move between this page and the report.'}
            </div>

            <div className="mb-5">
              <WizardStepper current={step} furthest={furthest} onJump={goTo} />
            </div>

            <div className="mb-3 lg:hidden">
              <MobilePaneToggle
                value={pane}
                onChange={setPane}
                options={[
                  { value: 'form', label: 'Report' },
                  { value: 'chat', label: 'Assistant' },
                ]}
              />
            </div>

            {/* ------------------------------------------------ step body */}
            {isLast ? (
              <GenerateStep inputs={inputs} preview={preview} />
            ) : (
              <>
                <ParameterForm
                  inputs={inputs}
                  onChange={applyChange}
                  highlighted={highlighted}
                  sectionIds={currentStep.sections}
                />

                {/* The regulation panel belongs on the steps that move it. */}
                {preview && (currentStep.id === 'road' || currentStep.id === 'scheme') && (
                  <div className="mt-4">
                    <DerivedPanel
                      derived={preview.derived}
                      schemes={preview.schemes}
                      rulebook={preview.rulebook}
                      onOverride={handleOverride}
                    />
                  </div>
                )}

                {/* Area mix sits with the scheme, where the hand-back is decided. */}
                {(currentStep.id === 'scheme' || currentStep.id === 'development') && (
                  <div className="mt-4">
                    <AreaMixControls inputs={inputs} preview={preview} onChange={applyChange} />
                  </div>
                )}

                {currentStep.id === 'development' && (
                  <div className="mt-4">
                    <ParameterForm
                      inputs={inputs}
                      onChange={applyChange}
                      highlighted={highlighted}
                      includeAdvanced
                    />
                  </div>
                )}
              </>
            )}

            {preview && preview.warnings.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="mb-1.5 text-[12px] font-semibold text-amber-900">Checks</p>
                <ul className="space-y-1">
                  {preview.warnings.map((w, i) => (
                    <li key={i} className="text-[12px] leading-snug text-amber-800">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ------------------------------------------------ nav */}
            <div className="mt-5 flex items-center gap-2">
              <button onClick={() => goTo(Math.max(0, step - 1))} disabled={step === 0} className="btn-secondary h-9">
                &larr; Back
              </button>

              {missing.length > 0 && (
                <span className="text-[11.5px] text-amber-700">
                  Needs {missing.map((m) => m.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}
                </span>
              )}

              <div className="ml-auto">
                {isLast ? (
                  <button onClick={generate} disabled={submitting} className="btn-primary h-9 px-5">
                    {submitting ? 'Generating…' : sourceReportId ? 'Generate new version' : 'Generate report'}
                  </button>
                ) : (
                  <button
                    onClick={() => goTo(step + 1)}
                    disabled={missing.length > 0}
                    className="btn-primary h-9 px-4"
                  >
                    {WIZARD_STEPS[step + 1].label} &rarr;
                  </button>
                )}
              </div>
            </div>

            {error && <p className="mt-2 text-[12px] text-loss">{error}</p>}
            <div className="h-6" />
          </div>
        </div>

        {/* ------------------------------------------------- live preview */}
        <div className="border-t border-ink-200 bg-white px-4 py-2.5 sm:px-6">
          <div className="mx-auto max-w-4xl">
            {preview ? (
              <div className="thin-scroll -mx-1 flex gap-5 overflow-x-auto px-1">
                <Stat label="Permissible BUA" value={formatArea(preview.areas.totalBuaInclAncillarySqm)} />
                <Stat label="Developer carpet" value={formatArea(preview.areas.developerBalanceCarpetSqft, 'sqft')} />
                <Stat label="Income" value={formatCrore(preview.income.totalIncome)} />
                <Stat label="Expenditure" value={formatCrore(preview.summary.totalExpenditure)} />
                <Stat
                  label="Net profit"
                  value={formatCrore(preview.summary.netProfit)}
                  tone={preview.summary.netProfit >= 0 ? 'gain' : 'loss'}
                />
                <Stat label="Margin" value={formatPercent(preview.summary.marginPct)} />
                <Stat
                  label="Feasibility"
                  value={`${formatNumber(preview.score.score, 1)} · ${preview.score.verdict}`}
                />
              </div>
            ) : (
              <p className="text-[13px] text-loss">The parameters do not compute. Check the plot figures.</p>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- assistant */}
      <aside
        className={`w-full shrink-0 border-ink-200 lg:block lg:w-[400px] lg:border-l ${
          pane === 'chat' ? 'block' : 'hidden'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-ink-200 bg-white px-4 py-2.5 lg:hidden">
            <MobilePaneToggle
              value={pane}
              onChange={setPane}
              options={[
                { value: 'form', label: 'Report' },
                { value: 'chat', label: 'Assistant' },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel
              reportId={null}
              title="Feasibility assistant"
              intro="I can see what you have entered and the running calculation alongside it, so ask me about the numbers as well as the rules. I can also fill the form from a plain description of the site."
              suggestions={SUGGESTIONS}
              draftInputs={inputs}
              onFormFills={handleFormFills}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Step 5 - a plain-language read of what is about to be generated. */
function GenerateStep({
  inputs,
  preview,
}: {
  inputs: FeasibilityInputs;
  preview: ReturnType<typeof calculateFeasibility> | null;
}) {
  if (!preview) return <p className="text-[13px] text-loss">The parameters do not compute.</p>;
  const scheme = schemeFor(inputs.schemeType);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-ink-200 bg-white p-5 shadow-sm">
        <h2 className="text-[14px] font-semibold text-ink-950">Ready to generate</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
          A {scheme.label.toLowerCase()} under {scheme.regulation} on a{' '}
          {formatArea(inputs.plotAreaConveyanceSqm)} plot abutting a {formatNumber(inputs.roadWidthM, 1)} m road
          {inputs.isTodZone ? ', inside a metro corridor' : ''}. Permissible built-up area works out at{' '}
          {formatArea(preview.areas.totalBuaInclAncillarySqm)} including{' '}
          {preview.rulebook.loadingLabel.toLowerCase()}, leaving{' '}
          {formatArea(preview.areas.developerBalanceCarpetSqft, 'sqft')} of RERA carpet for sale after the
          hand-back to existing occupiers.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Total income', formatCrore(preview.summary.totalIncome)],
            ['Total expenditure', formatCrore(preview.summary.totalExpenditure)],
            ['Net profit', formatCrore(preview.summary.netProfit)],
            ['Feasibility', `${formatNumber(preview.score.score, 1)} / 100`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-ink-200 bg-ink-50/60 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wide text-ink-400">{k}</dt>
              <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-[12px] text-ink-500">
          Verdict: <strong className="text-ink-800">{preview.score.verdict}</strong>. {preview.score.drivers[0]}
        </p>
      </section>

      <section className="rounded-lg border border-ink-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Applied regulations</h3>
        <ul className="space-y-1.5">
          {preview.schemes
            .filter((s) => s.applies)
            .map((s) => (
              <li key={s.id} className="text-[12.5px] leading-relaxed text-ink-600">
                <span className="font-medium text-ink-800">{s.label}</span> &mdash; {s.regulation}. {s.reason}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div className="shrink-0 whitespace-nowrap">
      <p className="text-[10px] uppercase tracking-wide text-ink-400">{label}</p>
      <p
        className={`text-[13px] font-medium tabular-nums ${
          tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
