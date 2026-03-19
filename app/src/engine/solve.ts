import { computeCore } from './calculate';
import { SQM_TO_SQFT } from './constants';
import type { FeasibilityInputs, LineItem } from './types';

/**
 * Back-solving from a target margin.
 *
 * The reference tool asks "what can I pay for the land?". On a redevelopment
 * the land is not for sale - the society owns it - so the equivalent questions,
 * and the ones that actually win a tender, are:
 *
 *   how much corpus can I put on the table?
 *   how much extra carpet can I offer the members?
 *
 * Both are solved here alongside the land-price case, which still matters when
 * the builder is buying outright.
 */

export interface ResidualResult {
  targetMarginPct: number;
  /** Achievable at the current parameters. */
  currentMarginPct: number;
  /** Maximum outright land price that still hits the target. */
  maxLandCost: number;
  maxLandRatePerSqft: number;
  /** Maximum corpus payable to the society, as a total. */
  maxCorpusFund: number;
  /** The same ceiling expressed per sq.ft. of the members' existing carpet. */
  maxCorpusRatePerSqft: number;
  /** Maximum additional carpet offerable to members, as a fraction. */
  maxTenantUpliftPct: number | null;
  /** Highest construction rate the scheme can absorb. */
  maxConstructionRatePerSqft: number;
  /** Lowest residential sale rate that still hits the target. */
  minResidentialSaleRatePerSqft: number;
  /** True where the target is unreachable however the levers are set. */
  unreachable: boolean;
  notes: string[];
}

/**
 * Expenditure split into the part that moves with income (agent commission)
 * and the part that does not. Needed for every closed-form solve below.
 */
function decompose(inputs: FeasibilityInputs, customItems: LineItem[]) {
  const core = computeCore(inputs, customItems);
  const commissionPct = inputs.agentCommissionPct;
  const fixedExpenses = core.expenses.totalExpenditure - core.expenses.agentCommission.amount;
  return { core, commissionPct, fixedExpenses };
}

/**
 * Solves the tenant uplift numerically. Raising the uplift hands more carpet
 * back to members, which lowers saleable area and margin monotonically, so a
 * bisection is both safe and sufficient.
 */
function solveUplift(
  inputs: FeasibilityInputs,
  customItems: LineItem[],
  targetMargin: number,
): { value: number | null; note?: string } {
  const marginAt = (uplift: number) =>
    computeCore({ ...inputs, additionalCarpetToTenantsPct: uplift }, customItems).summary.marginPct / 100;

  const atZero = marginAt(0);
  if (atZero < targetMargin) {
    return {
      value: null,
      note: `Even offering no additional carpet, the margin tops out at ${(atZero * 100).toFixed(2)}%.`,
    };
  }

  const ceiling = 1.0; // 100% extra carpet - far beyond anything negotiated
  if (marginAt(ceiling) >= targetMargin) {
    return { value: ceiling, note: 'The target holds even at a 100% uplift; the binding constraint is elsewhere.' };
  }

  let lo = 0;
  let hi = ceiling;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (marginAt(mid) >= targetMargin) lo = mid;
    else hi = mid;
  }
  return { value: lo };
}

export function solveResidual(
  inputs: FeasibilityInputs,
  targetMarginPct: number,
  customItems: LineItem[] = [],
): ResidualResult {
  const target = targetMarginPct / 100;
  const notes: string[] = [];
  const { core, commissionPct, fixedExpenses } = decompose(inputs, customItems);
  const income = core.income.totalIncome;

  // --- Land / corpus: both enter expenditure linearly, so one algebraic step.
  // margin = (income - expenses) / income = target
  //   => expenses* = income x (1 - target)
  const allowedExpenditure = income * (1 - target);
  const headroom = allowedExpenditure - core.expenses.totalExpenditure;

  const currentLandCost =
    inputs.landRatePerSqft > 0 ? inputs.plotAreaConveyanceSqm * SQM_TO_SQFT * inputs.landRatePerSqft : inputs.landLumpSum;

  const maxLandCost = Math.max(0, currentLandCost + headroom);
  const plotSqft = inputs.plotAreaConveyanceSqm * SQM_TO_SQFT;
  const maxLandRatePerSqft = plotSqft > 0 ? maxLandCost / plotSqft : 0;

  // The corpus can be quoted either way, so start from whichever basis the
  // report is actually on, then express the ceiling both ways.
  const membersCarpetSqft = inputs.existingResidentialCarpetSqft + inputs.existingCommercialCarpetSqft;
  const currentCorpus =
    inputs.corpusFundBasis === 'PER_SQFT_EXISTING_CARPET'
      ? membersCarpetSqft * inputs.corpusFundRatePerSqft
      : inputs.corpusFundCost;
  const maxCorpusFund = Math.max(0, currentCorpus + headroom);
  const maxCorpusRatePerSqft = membersCarpetSqft > 0 ? maxCorpusFund / membersCarpetSqft : 0;

  if (headroom < 0) {
    notes.push(
      `The scheme is already ${(-headroom / 1e7).toFixed(2)} Cr short of a ${targetMarginPct}% margin, so there is no room for land cost or corpus.`,
    );
  }

  // --- Construction rate: expenditure = other + area x rate
  const constructionArea =
    inputs.constructionRatePerSqft > 0 ? core.expenses.construction.amount / inputs.constructionRatePerSqft : 0;
  const expensesExConstruction = core.expenses.totalExpenditure - core.expenses.construction.amount;
  const maxConstructionRatePerSqft =
    constructionArea > 0 ? Math.max(0, (allowedExpenditure - expensesExConstruction) / constructionArea) : 0;

  // --- Sale rate: income appears on both sides through the agent commission.
  //   margin = 1 - commission% - fixed/income = target
  //   => income* = fixed / (1 - commission% - target)
  const denom = 1 - commissionPct - target;
  let minResidentialSaleRatePerSqft = 0;
  if (denom <= 0) {
    notes.push(
      `A ${targetMarginPct}% margin is unreachable at a ${(commissionPct * 100).toFixed(1)}% agent commission - the two together exceed the whole sale value.`,
    );
  } else {
    const requiredIncome = fixedExpenses / denom;
    const commercialIncome = core.areas.developerCommercialCarpetSqft * inputs.commercialSaleRatePerSqft;
    minResidentialSaleRatePerSqft =
      core.areas.developerResidentialCarpetSqft > 0
        ? Math.max(0, (requiredIncome - commercialIncome) / core.areas.developerResidentialCarpetSqft)
        : 0;
  }

  const uplift = solveUplift(inputs, customItems, target);
  if (uplift.note) notes.push(uplift.note);

  return {
    targetMarginPct,
    currentMarginPct: core.summary.marginPct,
    maxLandCost,
    maxLandRatePerSqft,
    maxCorpusFund,
    maxCorpusRatePerSqft,
    maxTenantUpliftPct: uplift.value,
    maxConstructionRatePerSqft,
    minResidentialSaleRatePerSqft,
    unreachable: headroom < 0 && uplift.value === null,
    notes,
  };
}
