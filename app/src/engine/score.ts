import type { CoreFinancials } from './calculate';
import { round } from './format';
import type { FeasibilityInputs, FeasibilityScore, ScoreComponent } from './types';

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function band(value: number, thresholds: [number, number, number]): ScoreComponent['band'] {
  if (value < thresholds[0]) return 'poor';
  if (value < thresholds[1]) return 'moderate';
  if (value < thresholds[2]) return 'good';
  return 'excellent';
}

/**
 * A 0-100 read on whether a site is worth pursuing, with the workings visible.
 * Never a black box - the client's team has to be able to argue with it.
 */
export function buildScore(inputs: FeasibilityInputs, core: CoreFinancials): FeasibilityScore {
  const { summary, areas, fsi } = core;

  // 1. Profit margin - the headline test (weight 40).
  const margin = summary.marginPct;
  const marginComponent: ScoreComponent = {
    id: 'margin',
    label: 'Profit margin',
    weight: 40,
    rawValue: round(margin, 2),
    unit: 'pct',
    points: round(clamp(margin / 30) * 40, 2),
    band: band(margin, [10, 20, 30]),
    explanation:
      'Net profit as a share of gross sale income. Under 10% leaves no room for cost overruns; over 30% is exceptional for a redevelopment.',
  };

  // 2. Return on capital deployed (weight 25).
  const roi = summary.roiPct;
  const roiComponent: ScoreComponent = {
    id: 'roi',
    label: 'Return on outlay',
    weight: 25,
    rawValue: round(roi, 2),
    unit: 'pct',
    points: round(clamp(roi / 40) * 25, 2),
    band: band(roi, [15, 25, 40]),
    explanation: 'Net profit against total expenditure, over the full construction cycle.',
  };

  // 3. Surplus-area ratio - how much sellable area survives tenant hand-back (weight 20).
  const surplusRatio =
    areas.approxReraCarpetSqft > 0 ? areas.developerBalanceCarpetSqft / areas.approxReraCarpetSqft : 0;
  const surplusPct = surplusRatio * 100;
  const surplusComponent: ScoreComponent = {
    id: 'surplus',
    label: 'Surplus area ratio',
    weight: 20,
    rawValue: round(surplusPct, 2),
    unit: 'pct',
    points: round(clamp(surplusRatio / 0.75) * 20, 2),
    band: band(surplusPct, [40, 55, 70]),
    explanation:
      "Share of total RERA carpet left for the developer after returning existing area plus the tenant uplift. This is the project's real earning capacity.",
  };

  // 4. Regulatory headroom - how much of the scheme leans on bought-in TDR (weight 15).
  const tdrDependency =
    fsi.totalPermissibleBuaSqm > 0 ? fsi.pathB.tdrToPurchaseSqm / fsi.totalPermissibleBuaSqm : 0;
  const tdrPct = tdrDependency * 100;
  const headroomComponent: ScoreComponent = {
    id: 'headroom',
    label: 'Regulatory headroom',
    weight: 15,
    rawValue: round(tdrPct, 2),
    unit: 'pct',
    points: round(clamp(1 - tdrDependency / 0.5) * 15, 2),
    band: band(100 - tdrPct, [50, 70, 85]),
    explanation:
      'Share of permissible built-up area that depends on TDR the builder must buy in the open market. Higher dependency means more exposure to TDR price movement.',
  };

  const components = [marginComponent, roiComponent, surplusComponent, headroomComponent];
  const score = round(
    components.reduce((s, c) => s + c.points, 0),
    1,
  );

  const verdict: FeasibilityScore['verdict'] =
    score >= 75 ? 'Highly Feasible' : score >= 55 ? 'Feasible' : score >= 40 ? 'Marginal' : 'Not Feasible';

  const ranked = [...components].sort((a, b) => b.points / b.weight - a.points / a.weight);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  const drivers = [
    `${strongest.label} is the strongest driver at ${strongest.rawValue}% (${strongest.band}).`,
    `${weakest.label} is the weakest at ${weakest.rawValue}% (${weakest.band}).`,
  ];

  if (summary.netProfit < 0) {
    drivers.unshift('The project does not break even on the current parameters.');
  } else if (margin < 15) {
    drivers.push('Margin is thin enough that a 5% construction cost overrun materially changes the outcome.');
  }

  return { score, verdict, components, drivers };
}
