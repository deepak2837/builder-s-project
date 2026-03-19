/**
 * DCPR-2034 - Development Control and Promotion Regulations for Greater Mumbai.
 *
 * UDCPR-2020 expressly does NOT apply to the Municipal Corporation of Greater
 * Mumbai, so a plot in Mumbai has to be appraised on a different rulebook with a
 * different shape: fungible compensatory area instead of ancillary FSI, premium
 * FSI bought from the Corporation at a share of the Ready Reckoner rate, and the
 * 33(20)(B) route that lifts total FSI to 4.00 against a PAP obligation.
 *
 * The tables below are consolidated from DCPR-2034 Regulations 30, 31 and 33 and
 * reconciled line by line against the client's own "Feasibility Report of Dharti
 * CHS, Versova" working, which is a Mumbai suburbs plot on an 18.3 m road and
 * lands on base 1.00 + premium 0.50 + TDR 0.90 = 2.40. Every figure here is
 * editable in the UI - verify against the current sanctioned table and the
 * prevailing circulars before a report leaves the office.
 */
import type { FeasibilityInputs } from './types';

/** Greater Mumbai splits into the island city and the suburbs at Mahim / Sion. */
export type MumbaiLocation = 'ISLAND_CITY' | 'SUBURBS';

export interface DcprBand {
  /** FSI available as of right on the net plot area. */
  baseFsi: number;
  /** Additional FSI purchasable from the Corporation on payment of premium. */
  premiumFsi: number;
  /** Maximum TDR loadable on the plot. */
  maxTdr: number;
  /** base + premium + TDR. */
  maxPotential: number;
}

export interface DcprTableRow {
  minRoadWidthM: number;
  maxRoadWidthM: number | null;
  label: string;
  islandCity: DcprBand;
  suburbs: DcprBand;
}

const band = (baseFsi: number, premiumFsi: number, maxTdr: number): DcprBand => ({
  baseFsi,
  premiumFsi,
  maxTdr,
  maxPotential: baseFsi + premiumFsi + maxTdr,
});

/**
 * DCPR-2034 Reg. 30 / Table 12 - maximum building potential by abutting road
 * width. Basic FSI is 1.33 in the island city and 1.00 in the suburbs; the road
 * width decides how much premium FSI and TDR can be stacked on top.
 */
export const DCPR_TABLE_12: DcprTableRow[] = [
  {
    minRoadWidthM: 0,
    maxRoadWidthM: 9,
    label: 'Below 9 m.',
    islandCity: band(1.33, 0, 0),
    suburbs: band(1.0, 0, 0),
  },
  {
    minRoadWidthM: 9,
    maxRoadWidthM: 12,
    label: '9 m. and above but below 12 m.',
    islandCity: band(1.33, 0.5, 0.17),
    suburbs: band(1.0, 0.5, 0.5),
  },
  {
    minRoadWidthM: 12,
    maxRoadWidthM: 18,
    label: '12 m. and above but below 18 m.',
    islandCity: band(1.33, 0.5, 0.67),
    suburbs: band(1.0, 0.5, 0.7),
  },
  {
    minRoadWidthM: 18,
    maxRoadWidthM: 27,
    label: '18 m. and above but below 27 m.',
    islandCity: band(1.33, 0.5, 1.17),
    suburbs: band(1.0, 0.5, 0.9),
  },
  {
    minRoadWidthM: 27,
    maxRoadWidthM: null,
    label: '27 m. and above',
    islandCity: band(1.33, 0.5, 1.17),
    suburbs: band(1.0, 0.5, 1.2),
  },
];

export function lookupDcprTable12(roadWidthM: number): DcprTableRow {
  return (
    DCPR_TABLE_12.find(
      (r) => roadWidthM >= r.minRoadWidthM && (r.maxRoadWidthM === null || roadWidthM < r.maxRoadWidthM),
    ) ?? DCPR_TABLE_12[0]
  );
}

export function dcprEntitlementFor(roadWidthM: number, location: MumbaiLocation) {
  const row = lookupDcprTable12(roadWidthM);
  const column = location === 'ISLAND_CITY' ? row.islandCity : row.suburbs;
  return { row, ...column, column: location === 'ISLAND_CITY' ? 'Island City' : 'Suburbs' };
}

/**
 * Fungible compensatory area - DCPR-2034 Reg. 31(3).
 *
 * Mumbai's answer to ancillary FSI. Balconies, flower beds, voids and terraces
 * are counted in FSI but a corresponding free-of-FSI allowance is granted on
 * payment of premium: 35% of the proposed BUA for residential, 20% for
 * commercial and industrial. It is the closest analogue to UDCPR's 60% / 80%
 * ancillary FSI and occupies the same slot in this engine.
 */
export const FUNGIBLE_RESIDENTIAL_PCT = 0.35;
export const FUNGIBLE_COMMERCIAL_PCT = 0.2;

/**
 * Premium payable, as a share of the Ready Reckoner (RR) rate for the land.
 * The client's Versova working charges both the premium FSI purchased from the
 * Corporation and the saleable fungible area at 50% of RR, with commercial
 * fungible at 60%.
 */
export const DCPR_PREMIUM_FSI_RATE = 0.5;
export const DCPR_FUNGIBLE_PREMIUM_RATE = 0.5;
export const DCPR_FUNGIBLE_PREMIUM_RATE_COMMERCIAL = 0.6;

/** DCPR-2034 Reg. 33(20)(B) - additional FSI up to 4.00 against a PAP obligation. */
export const DCPR_33_20B_MAX_FSI = 4.0;
/** Share of the balance BUA that must be handed to the Corporation as PAP stock. */
export const DCPR_PAP_SHARE = 0.5;

/** Staircase, lift and lift-lobby premium - charged at 25% of RR on that area. */
export const DCPR_STAIRCASE_PREMIUM_RATE = 0.25;

export interface DcprFsiBreakdown {
  location: MumbaiLocation;
  roadBand: string;
  /** Plot area left after the setback / DP road is surrendered. */
  netPlotAreaSqm: number;
  baseFsi: number;
  baseBuaSqm: number;
  /** Premium FSI purchased from the Corporation. */
  govtFsiSqm: number;
  /** TDR entitlement on the net plot. */
  tdrEntitlementSqm: number;
  /** TDR actually to be bought, after the per-tenement and setback credits. */
  tdrToPurchaseSqm: number;
  /** Compensatory FSI for the area surrendered to road setback. */
  setbackCompensationSqm: number;
  /** BUA available under the redevelopment regulation alone, Reg. 33(7)(B). */
  buaUnder33_7BSqm: number;
  /** The 33(20)(B) ceiling: plot area in possession x 4.00. */
  ceilingBuaSqm: number;
  /** Headroom between the 33(7)(B) entitlement and the 33(20)(B) ceiling. */
  balanceBuaSqm: number;
  /** BUA handed to the Corporation as Project Affected Persons stock. */
  papBuaSqm: number;
  /** What the project is actually appraised on. */
  totalBuaSqm: number;
  /** Rehab BUA returned to the existing members, including their uplift. */
  rehabBuaSqm: number;
  /** Fungible allowance attaching to the rehab component. */
  rehabFungibleSqm: number;
  /** Staircase / lift area attracting premium. */
  staircasePremiumAreaSqm: number;
  usesCeiling: boolean;
  notes: string[];
}

/**
 * The DCPR entitlement chain, in the order a Mumbai feasibility is actually
 * built up: net plot -> base + premium + TDR -> setback compensation -> the
 * 33(20)(B) ceiling if that route is taken -> what the members get back.
 */
export function computeDcprFsi(inputs: FeasibilityInputs): DcprFsiBreakdown {
  const location = inputs.dcprLocation;
  const table = dcprEntitlementFor(inputs.roadWidthM, location);
  const notes: string[] = [];

  const netPlotAreaSqm = Math.max(0, inputs.plotAreaConveyanceSqm - inputs.dpRoadAreaSqm);

  const baseBuaSqm = netPlotAreaSqm * inputs.basicFsi;
  const govtFsiSqm = netPlotAreaSqm * inputs.premiumFsiRate;
  const tdrEntitlementSqm = netPlotAreaSqm * inputs.maxTdrLoading;

  // The setback surrendered to the road line is compensated in FSI at the
  // in-situ multiplier, exactly as a DP road surrender is under UDCPR.
  const setbackCompensationSqm = inputs.dpRoadAreaSqm * inputs.inSituFsiMultiplier;

  // TDR credits: a per-tenement allowance for the rehab component and any area
  // already surrendered to an earlier road line come off the TDR to be bought.
  const tenementCredit = inputs.residentialTenements * inputs.incentiveFsiPerTenementSqm;
  const tdrToPurchaseSqm = Math.max(
    0,
    tdrEntitlementSqm - tenementCredit - inputs.dcprRoadSetbackCreditSqm,
  );

  const buaUnder33_7BSqm = baseBuaSqm + govtFsiSqm + tdrEntitlementSqm + setbackCompensationSqm;

  // Reg. 33(20)(B): the plot may go to 4.00 FSI on the area in possession, but
  // half the headroom above the redevelopment entitlement is Corporation stock.
  const usesCeiling = inputs.schemeType === 'DCPR_33_20B';
  const ceilingBuaSqm = inputs.plotAreaConveyanceSqm * inputs.dcprMaxFsi;
  const balanceBuaSqm = Math.max(0, ceilingBuaSqm - buaUnder33_7BSqm);
  const papBuaSqm = usesCeiling ? balanceBuaSqm * inputs.dcprPapSharePct : 0;

  const totalBuaSqm = usesCeiling ? Math.max(buaUnder33_7BSqm, ceilingBuaSqm) : buaUnder33_7BSqm;

  if (usesCeiling && ceilingBuaSqm <= buaUnder33_7BSqm) {
    notes.push(
      'The Reg. 33(20)(B) ceiling is already met by the 33(7)(B) entitlement, so the additional-FSI route adds nothing and no PAP obligation arises.',
    );
  }

  // What the members get back: their existing BUA including balcony, grossed up
  // by the additional area the developer has offered them.
  const rehabBuaSqm = inputs.existingBuiltUpWithBalconySqm * (1 + inputs.additionalCarpetToTenantsPct);
  const rehabFungibleSqm = inputs.existingBuiltUpWithBalconySqm * inputs.ancillaryResidentialPct;

  if (rehabBuaSqm >= totalBuaSqm) {
    notes.push(
      'The rehab obligation alone exceeds the permissible built-up area. Nothing is left to sell on these parameters.',
    );
  }

  // Staircases, lifts and lobbies are free of FSI but attract a premium; the
  // area scales with the number of floors the massing carries.
  const staircasePremiumAreaSqm = inputs.dcprStaircaseAreaPerFloorSqm * Math.max(0, inputs.floors);

  return {
    location,
    roadBand: `${table.row.label} (${inputs.roadWidthM} m, ${table.column})`,
    netPlotAreaSqm,
    baseFsi: inputs.basicFsi,
    baseBuaSqm,
    govtFsiSqm,
    tdrEntitlementSqm,
    tdrToPurchaseSqm,
    setbackCompensationSqm,
    buaUnder33_7BSqm,
    ceilingBuaSqm,
    balanceBuaSqm,
    papBuaSqm,
    totalBuaSqm,
    rehabBuaSqm,
    rehabFungibleSqm,
    staircasePremiumAreaSqm,
    usesCeiling,
    notes,
  };
}
