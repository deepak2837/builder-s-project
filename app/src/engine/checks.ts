import type { CoreFinancials } from './calculate';
import { SQM_TO_SQFT } from './constants';
import { formatArea, formatNumber, formatRupees } from './format';
import type { FeasibilityInputs } from './types';

/**
 * Plausibility checks - "does this data look like a real project?"
 *
 * Distinct from the regulatory warnings, which ask "is this legal?". These
 * catch the transcription slips that make a report quietly wrong: a plot area
 * entered in the wrong unit, a construction rate off by a decimal, a tenement
 * count that implies 5,000 sq.ft flats. A regulator would not object to any of
 * them; a reader should.
 */

export interface PlausibilityIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: keyof FeasibilityInputs;
}

function band(value: number, lo: number, hi: number) {
  return value >= lo && value <= hi;
}

export function runPlausibilityChecks(inputs: FeasibilityInputs, core: CoreFinancials): PlausibilityIssue[] {
  const out: PlausibilityIssue[] = [];
  const add = (
    id: string,
    severity: PlausibilityIssue['severity'],
    message: string,
    field?: keyof FeasibilityInputs,
  ) => out.push({ id, severity, message, field });

  const { areas, summary } = core;

  // ---- Plot ----
  if (inputs.plotAreaConveyanceSqm <= 0) {
    add('plot.missing', 'error', 'Plot area is not set, so nothing downstream can be trusted.', 'plotAreaConveyanceSqm');
  } else if (inputs.plotAreaConveyanceSqm < 100) {
    add(
      'plot.tiny',
      'warning',
      `A plot of ${formatArea(inputs.plotAreaConveyanceSqm)} is unusually small for a redevelopment - check the area is in square metres, not square feet.`,
      'plotAreaConveyanceSqm',
    );
  }
  if (inputs.dpRoadAreaSqm > inputs.plotAreaConveyanceSqm * 0.6 && inputs.plotAreaConveyanceSqm > 0) {
    add(
      'plot.roadShare',
      'warning',
      `${formatNumber((inputs.dpRoadAreaSqm / inputs.plotAreaConveyanceSqm) * 100, 0)}% of the plot is under DP road. Verify - that leaves very little balance plot for basic FSI.`,
      'dpRoadAreaSqm',
    );
  }
  if (
    inputs.plotAreaSevenTwelveSqm > 0 &&
    Math.abs(inputs.plotAreaSevenTwelveSqm - inputs.plotAreaConveyanceSqm) / inputs.plotAreaSevenTwelveSqm > 0.1
  ) {
    add(
      'plot.mismatch',
      'warning',
      `7/12 area and conveyance area differ by more than 10%. FSI is computed on the conveyance figure (${formatArea(inputs.plotAreaConveyanceSqm)}).`,
      'plotAreaConveyanceSqm',
    );
  }

  // ---- Road ----
  if (inputs.roadWidthM <= 0) {
    add('road.missing', 'error', 'Road width is not set. It drives the entire FSI entitlement.', 'roadWidthM');
  } else if (inputs.roadWidthM < 9) {
    add(
      'road.narrow',
      'warning',
      `A ${formatNumber(inputs.roadWidthM, 1)} m road gets basic FSI only - no premium FSI, no TDR and no TOD uplift.`,
      'roadWidthM',
    );
  } else if (inputs.roadWidthM > 60) {
    add('road.wide', 'warning', `A ${formatNumber(inputs.roadWidthM, 1)} m road is exceptional. Check the unit is metres.`, 'roadWidthM');
  }

  // ---- Existing building ----
  if (inputs.residentialTenements > 0 && inputs.existingResidentialCarpetSqft > 0) {
    const avg = inputs.existingResidentialCarpetSqft / inputs.residentialTenements;
    if (!band(avg, 150, 2500)) {
      add(
        'existing.flatSize',
        'warning',
        `${inputs.residentialTenements} flats over ${formatArea(inputs.existingResidentialCarpetSqft, 'sqft')} works out at ${formatNumber(avg, 0)} sq.ft per flat, which is implausible. Check the tenement count and the carpet area.`,
        'residentialTenements',
      );
    }
  }
  if (inputs.existingBuiltUpAreaSqm > 0 && inputs.plotAreaConveyanceSqm > 0) {
    const consumedFsi = inputs.existingBuiltUpAreaSqm / inputs.plotAreaConveyanceSqm;
    if (consumedFsi > 4) {
      add(
        'existing.fsi',
        'warning',
        `The existing building consumes FSI ${formatNumber(consumedFsi, 2)} on this plot, which is above anything UDCPR normally permits. Check the built-up area.`,
        'existingBuiltUpAreaSqm',
      );
    }
  }
  if (
    inputs.existingResidentialCarpetSqft > 0 &&
    inputs.existingBuiltUpAreaSqm > 0 &&
    inputs.existingResidentialCarpetSqft > inputs.existingBuiltUpAreaSqm * SQM_TO_SQFT
  ) {
    add(
      'existing.carpetExceedsBua',
      'error',
      'Existing carpet area exceeds existing built-up area, which cannot be. One of the two is in the wrong unit.',
      'existingResidentialCarpetSqft',
    );
  }
  if (inputs.brokerageUnitCount > 0 && inputs.residentialTenements + inputs.commercialUnits > 0) {
    const units = inputs.residentialTenements + inputs.commercialUnits;
    if (Math.abs(inputs.brokerageUnitCount - units) > units * 0.25) {
      add(
        'existing.unitCount',
        'info',
        `Brokerage is being paid on ${inputs.brokerageUnitCount} units but the building has ${units} (${inputs.residentialTenements} flats + ${inputs.commercialUnits} shops).`,
        'brokerageUnitCount',
      );
    }
  }

  // ---- Rates ----
  if (!band(inputs.constructionRatePerSqft, 1200, 9000) && inputs.constructionRatePerSqft > 0) {
    add(
      'rate.construction',
      'warning',
      `A construction rate of Rs. ${formatRupees(inputs.constructionRatePerSqft)}/sq.ft is outside the usual Rs. 1,200-9,000 range for Maharashtra.`,
      'constructionRatePerSqft',
    );
  }
  if (inputs.residentialSaleRatePerSqft > 0 && inputs.constructionRatePerSqft > 0) {
    const ratio = inputs.residentialSaleRatePerSqft / inputs.constructionRatePerSqft;
    if (ratio < 1.5) {
      add(
        'rate.margin',
        'warning',
        `The sale rate is only ${formatNumber(ratio, 2)}x the construction rate. Below about 1.5x a scheme rarely covers its municipal charges, TDR and rent.`,
        'residentialSaleRatePerSqft',
      );
    }
  }
  if (inputs.asrRatePerSqm > 0 && inputs.residentialSaleRatePerSqft > 0) {
    const asrPerSqft = inputs.asrRatePerSqm / SQM_TO_SQFT;
    if (inputs.residentialSaleRatePerSqft < asrPerSqft) {
      add(
        'rate.belowAsr',
        'warning',
        `The sale rate (Rs. ${formatRupees(inputs.residentialSaleRatePerSqft)}/sq.ft) is below the ASR (Rs. ${formatRupees(asrPerSqft)}/sq.ft). Market rates normally sit above the ready reckoner.`,
        'residentialSaleRatePerSqft',
      );
    }
  }
  if (inputs.flatRentPerSqftPerMonth > 0 && inputs.residentialSaleRatePerSqft > 0) {
    const yieldPct = ((inputs.flatRentPerSqftPerMonth * 12) / inputs.residentialSaleRatePerSqft) * 100;
    if (!band(yieldPct, 1.2, 6)) {
      add(
        'rate.rentYield',
        'info',
        `Displacement rent implies a ${formatNumber(yieldPct, 2)}% gross annual yield on the sale rate. Residential yields in MMR normally sit between 2% and 4%.`,
        'flatRentPerSqftPerMonth',
      );
    }
  }
  if (inputs.tdrRatePerSqft > 0 && inputs.residentialSaleRatePerSqft > 0) {
    const tdrShare = inputs.tdrRatePerSqft / inputs.residentialSaleRatePerSqft;
    if (tdrShare > 0.5) {
      add(
        'rate.tdr',
        'warning',
        `TDR at Rs. ${formatRupees(inputs.tdrRatePerSqft)}/sq.ft is ${formatNumber(tdrShare * 100, 0)}% of the sale rate. Buying TDR that dear rarely pays.`,
        'tdrRatePerSqft',
      );
    }
  }

  // ---- Output sanity ----
  if (areas.developerBalanceCarpetSqft > 0 && inputs.floors > 0) {
    const perFloor = areas.totalBuaInclAncillarySqft / inputs.floors;
    if (perFloor > inputs.plotAreaConveyanceSqm * SQM_TO_SQFT && inputs.plotAreaConveyanceSqm > 0) {
      add(
        'output.plate',
        'warning',
        `${inputs.floors} floors would need a floor plate of ${formatArea(perFloor, 'sqft')}, larger than the whole plot. The floor count is too low for this built-up area.`,
        'floors',
      );
    }
  }
  if (summary.totalIncome > 0 && summary.marginPct > 45) {
    add(
      'output.margin',
      'info',
      `A ${formatNumber(summary.marginPct, 1)}% margin is exceptional for a redevelopment. Check that no cost head has been left at zero.`,
    );
  }
  if (inputs.stampDutyRegistrationCost === 0 && inputs.environmentalClearanceCost === 0) {
    add(
      'output.zeroHeads',
      'info',
      'Stamp duty and environmental clearance are both zero. The profit figure is optimistic until those are filled in.',
      'stampDutyRegistrationCost',
    );
  }

  return out;
}
