import type { AreaCategory, Authority, FeasibilityInputs, SchemeType } from './types';

/** 1 sq.m = 10.764 sq.ft. Used consistently throughout the engine. */
export const SQM_TO_SQFT = 10.764;

/** 1 crore = 10,000,000. */
export const CRORE = 1e7;

/**
 * UDCPR-2020 Table 6-G (Regulation 6.3) - Permissible FSI in non-congested areas.
 *
 * Columns 4-6 apply to all Municipal Corporations and to CIDCO as Planning
 * Authority by virtue of NTDA. Columns 7-9 apply to the remaining
 * authorities / areas.
 */
export interface Table6GRow {
  minRoadWidthM: number;
  maxRoadWidthM: number | null;
  label: string;
  basicFsi: number;
  corporation: { premiumFsi: number; maxTdr: number; maxPotential: number };
  other: { premiumFsi: number; maxTdr: number; maxPotential: number };
}

export const TABLE_6G: Table6GRow[] = [
  {
    minRoadWidthM: 0,
    maxRoadWidthM: 9,
    label: 'Below 9 m.',
    basicFsi: 1.1,
    corporation: { premiumFsi: 0, maxTdr: 0, maxPotential: 1.1 },
    other: { premiumFsi: 0, maxTdr: 0, maxPotential: 1.1 },
  },
  {
    minRoadWidthM: 9,
    maxRoadWidthM: 12,
    label: '9 m. and above but below 12 m.',
    basicFsi: 1.1,
    corporation: { premiumFsi: 0.5, maxTdr: 0.4, maxPotential: 2.0 },
    other: { premiumFsi: 0.3, maxTdr: 0.3, maxPotential: 1.7 },
  },
  {
    minRoadWidthM: 12,
    maxRoadWidthM: 15,
    label: '12 m. and above but below 15 m.',
    basicFsi: 1.1,
    corporation: { premiumFsi: 0.5, maxTdr: 0.65, maxPotential: 2.25 },
    other: { premiumFsi: 0.3, maxTdr: 0.6, maxPotential: 2.0 },
  },
  {
    minRoadWidthM: 15,
    maxRoadWidthM: 24,
    label: '15 m. and above but below 24 m.',
    basicFsi: 1.1,
    corporation: { premiumFsi: 0.5, maxTdr: 0.9, maxPotential: 2.5 },
    other: { premiumFsi: 0.3, maxTdr: 0.7, maxPotential: 2.1 },
  },
  {
    minRoadWidthM: 24,
    maxRoadWidthM: 30,
    label: '24 m. and above but below 30 m.',
    basicFsi: 1.1,
    corporation: { premiumFsi: 0.5, maxTdr: 1.15, maxPotential: 2.75 },
    other: { premiumFsi: 0.3, maxTdr: 0.9, maxPotential: 2.3 },
  },
  {
    minRoadWidthM: 30,
    maxRoadWidthM: null,
    label: '30 m. and above',
    basicFsi: 1.1,
    corporation: { premiumFsi: 0.5, maxTdr: 1.4, maxPotential: 3.0 },
    other: { premiumFsi: 0.3, maxTdr: 1.1, maxPotential: 2.5 },
  },
];

const CORPORATION_AUTHORITIES: Authority[] = ['MBMC', 'BMC', 'NMC', 'TMC', 'PMC', 'NMMC', 'NAGPUR'];

export function isCorporation(authority: Authority): boolean {
  return CORPORATION_AUTHORITIES.includes(authority);
}

export function lookupTable6G(roadWidthM: number): Table6GRow {
  const row = TABLE_6G.find(
    (r) => roadWidthM >= r.minRoadWidthM && (r.maxRoadWidthM === null || roadWidthM < r.maxRoadWidthM),
  );
  return row ?? TABLE_6G[0];
}

export function entitlementFor(roadWidthM: number, authority: Authority) {
  const row = lookupTable6G(roadWidthM);
  const useCorporation = isCorporation(authority);
  const column = useCorporation ? row.corporation : row.other;
  return {
    row,
    ...column,
    basicFsi: row.basicFsi,
    column: useCorporation ? 'Municipal Corporation' : 'other authorities',
  };
}

/**
 * Which rulebook governs an authority.
 *
 * This matters more than it looks. UDCPR-2020 explicitly does NOT apply to the
 * Municipal Corporation of Greater Mumbai, which runs on DCPR-2034 with a
 * different FSI structure entirely. Everything else in MMR - Mira-Bhayandar,
 * Thane, Navi Mumbai - is on UDCPR, which is why the Sita Smruti reference
 * project reconciles against it.
 */
export interface Rulebook {
  id: 'UDCPR' | 'DCPR_2034';
  name: string;
  /** Short form used in headings, e.g. "DCPR". */
  shortName: string;
  table: string;
  regulation: string;
  /** The region this rulebook governs, for the region selector. */
  region: string;
  /**
   * What the free-of-FSI loading is called under this rulebook. UDCPR grants
   * "ancillary area FSI"; DCPR grants "fungible compensatory area". They occupy
   * the same slot in the engine, so only the label and the percentages differ.
   */
  loadingLabel: string;
  /** False where this application does not yet carry the governing tables. */
  supported: boolean;
  caveat?: string;
}

/** Greater Mumbai is the only authority in the state that runs on DCPR-2034. */
const DCPR_AUTHORITIES: Authority[] = ['BMC'];

export function isMumbai(authority: Authority): boolean {
  return DCPR_AUTHORITIES.includes(authority);
}

export function rulebookFor(authority: Authority): Rulebook {
  if (isMumbai(authority)) {
    return {
      id: 'DCPR_2034',
      name: 'DCPR-2034 (Greater Mumbai)',
      shortName: 'DCPR',
      table: 'DCPR-2034 Table 12',
      regulation: 'DCPR-2034 Reg. 30 / 31',
      region: 'Greater Mumbai (MCGM)',
      loadingLabel: 'Fungible compensatory area',
      supported: true,
      caveat:
        'Greater Mumbai runs on DCPR-2034, so this report is computed on the DCPR Table 12 bands, fungible compensatory area and the Reg. 33 redevelopment routes - not on UDCPR. The tables are consolidated from DCPR-2034 and reconciled against the Dharti CHS Versova working; confirm the current sanctioned figures before the report is issued.',
    };
  }
  return {
    id: 'UDCPR',
    name: 'UDCPR-2020',
    shortName: 'UDCPR',
    table: 'UDCPR Table 6-G',
    regulation: 'UDCPR Reg. 6.3, Table 6-G',
    region: 'Maharashtra, outside Greater Mumbai',
    loadingLabel: 'Ancillary area FSI',
    supported: true,
  };
}

/**
 * TDR / in-situ FSI generated against surrendered land.
 * UDCPR Reg. 11.2.4: 2x the surrendered area in non-congested areas,
 * 3x in congested areas.
 */
export function inSituMultiplierFor(areaCategory: AreaCategory): number {
  return areaCategory === 'CONGESTED' ? 3.0 : 2.0;
}

/**
 * Development schemes. The scheme decides which incentive-FSI regulation
 * applies, which is the single biggest lever on a redevelopment appraisal
 * after road width.
 */
export interface SchemeDefinition {
  id: SchemeType;
  label: string;
  regulation: string;
  summary: string;
  /** Which rulebook the scheme belongs to. */
  rulebook: Rulebook['id'];
  /** False where this application does not yet carry the governing tables. */
  supported: boolean;
  caveat?: string;
}

export const SCHEMES: SchemeDefinition[] = [
  {
    id: 'STANDARD',
    label: 'Standard development',
    regulation: 'UDCPR Ch. 6',
    summary:
      'Green-field or ordinary development. Basic FSI plus premium FSI and TDR up to the Table 6-G ceiling. No incentive FSI.',
    rulebook: 'UDCPR',
    supported: true,
  },
  {
    id: 'SOCIETY_REDEV',
    label: 'Society redevelopment',
    regulation: 'UDCPR Reg. 7.6.1',
    summary:
      'Co-operative housing society or apartment redevelopment. Incentive FSI of 30% of existing built-up area, or 15 Sq.mt. per tenement, whichever is more.',
    rulebook: 'UDCPR',
    supported: true,
  },
  {
    id: 'TENANTED_REDEV',
    label: 'Tenanted redevelopment',
    regulation: 'UDCPR Reg. 7.6.2',
    summary:
      'Building with protected tenants. Incentive FSI of 50% of the rehab area, where rehab area is the authorisedly utilised area or 27.87 Sq.mt. carpet per tenement, whichever is more.',
    rulebook: 'UDCPR',
    supported: true,
  },
  {
    id: 'TOD',
    label: 'Metro corridor / TOD',
    regulation: 'UDCPR Reg. 14.2.1.2, extended by 14.2.4',
    summary:
      'Plot within 500 m of a metro or MRTS station. Maximum total FSI is banded by road width up to 4.00, and TDR is taken in a 1/4 share with premium FSI.',
    rulebook: 'UDCPR',
    supported: true,
  },
  {
    id: 'HIGHER_FSI',
    label: 'Higher-FSI use',
    regulation: 'UDCPR Table 7-A',
    summary:
      'Educational, medical, institutional and similar uses. Additional FSI up to the road-width ceiling minus basic FSI, at a reduced premium of 5% to 15% of ASR.',
    rulebook: 'UDCPR',
    supported: true,
  },
  {
    id: 'PMAY',
    label: 'PMAY / Inclusive housing',
    regulation: 'UDCPR Reg. 14.4 / 3.8',
    summary: 'Pradhan Mantri Awas Yojana and inclusive-housing components.',
    rulebook: 'UDCPR',
    supported: false,
    caveat:
      'The PMAY entitlement and cross-subsidy tables are not yet loaded. FSI is computed on the standard Chapter 6 basis, so the figures understate what the scheme allows. Supply the PMAY annexure to enable this properly.',
  },
  {
    id: 'SLUM_REHAB',
    label: 'Slum Rehabilitation',
    regulation: 'UDCPR Reg. 14.7.8',
    summary: 'Slum rehabilitation scheme with rehab and free-sale components.',
    rulebook: 'UDCPR',
    supported: false,
    caveat:
      'Slum rehabilitation runs on its own rehab / free-sale ratio and generates Slum TDR, none of which is modelled yet. FSI is computed on the standard Chapter 6 basis. Supply the SRA annexure to enable this properly.',
  },

  // ---- Greater Mumbai, under DCPR-2034 ----
  {
    id: 'DCPR_SOCIETY_REDEV',
    label: 'Society redevelopment (Mumbai)',
    regulation: 'DCPR-2034 Reg. 33(7)(B)',
    summary:
      'Redevelopment of an existing society building in Greater Mumbai. Entitlement is basic FSI plus premium FSI purchased from MCGM plus TDR, banded by road width in Table 12, with fungible compensatory area of 35% residential / 20% commercial on top.',
    rulebook: 'DCPR_2034',
    supported: true,
  },
  {
    id: 'DCPR_33_20B',
    label: 'Additional FSI up to 4.00 with PAP (Mumbai)',
    regulation: 'DCPR-2034 Reg. 33(20)(B)',
    summary:
      'Lifts total FSI on the plot in possession to 4.00. Half the built-up area above the 33(7)(B) entitlement is handed to MCGM as Project Affected Persons stock, priced as a purchase cost in the appraisal.',
    rulebook: 'DCPR_2034',
    supported: true,
  },
];

export function schemeFor(id: SchemeType): SchemeDefinition {
  return SCHEMES.find((s) => s.id === id) ?? SCHEMES[0];
}

/** The schemes that exist under a given rulebook - drives the scheme dropdown. */
export function schemesForRulebook(rulebook: Rulebook['id']): SchemeDefinition[] {
  return SCHEMES.filter((s) => s.rulebook === rulebook);
}

/**
 * The scheme to fall back to when the authority changes rulebook. Selecting a
 * Mumbai plot while a UDCPR scheme is chosen would otherwise leave the report
 * computing on a regulation that does not apply there.
 */
export function defaultSchemeFor(rulebook: Rulebook['id']): SchemeType {
  return rulebook === 'DCPR_2034' ? 'DCPR_SOCIETY_REDEV' : 'SOCIETY_REDEV';
}

/**
 * The road width that actually governs the FSI band.
 *
 * A sanctioned widening counts, and on a corner plot the wider of the two
 * abutting roads governs - so the entitlement follows the best road the plot
 * touches, not the one the address happens to use.
 */
export function governingRoadWidth(inputs: {
  roadWidthM: number;
  proposedRoadWidthM?: number;
  secondRoadWidthM?: number;
}): { width: number; source: string } {
  const candidates: { width: number; source: string }[] = [
    { width: inputs.roadWidthM || 0, source: 'existing abutting road' },
    { width: inputs.proposedRoadWidthM || 0, source: 'proposed road widening' },
    { width: inputs.secondRoadWidthM || 0, source: 'second road on corner plot' },
  ];
  return candidates.reduce((best, c) => (c.width > best.width ? c : best), candidates[0]);
}

/**
 * Per-authority rate master. Extend this as the client supplies circulars for
 * other municipalities; the ASR in particular changes every year and by ward.
 */
export interface RateMaster {
  authority: Authority;
  label: string;
  effectiveFrom: string;
  asrRatePerSqm: number;
  labourTaxRatePerSqm: number;
  fireCapitationRatePerSqm: number;
  constructionRatePerSqft: number;
  tdrRatePerSqft: number;
  residentialSaleRatePerSqft: number;
  commercialSaleRatePerSqft: number;
  flatRentPerSqftPerMonth: number;
  shopRentPerSqftPerMonth: number;
  note?: string;
}

export const RATE_MASTERS: RateMaster[] = [
  {
    authority: 'MBMC',
    label: 'Mira-Bhayandar Municipal Corporation',
    effectiveFrom: '2026-04-01',
    asrRatePerSqm: 40800,
    labourTaxRatePerSqm: 27951,
    fireCapitationRatePerSqm: 250,
    constructionRatePerSqft: 4130,
    tdrRatePerSqft: 2124,
    residentialSaleRatePerSqft: 16500,
    commercialSaleRatePerSqft: 18000,
    flatRentPerSqftPerMonth: 40,
    shopRentPerSqftPerMonth: 100,
    note: 'Derived from the Sita Smruti project report dated 26/05/2026.',
  },
  {
    authority: 'BMC',
    label: 'Brihanmumbai Municipal Corporation (MCGM)',
    effectiveFrom: '2026-04-01',
    asrRatePerSqm: 122580,
    labourTaxRatePerSqm: 31763,
    fireCapitationRatePerSqm: 160,
    constructionRatePerSqft: 4720,
    // DCPR quotes TDR per Sq.mt. against the RR rate; 122,580 x 0.65 works out
    // near Rs. 7,400/Sq.ft. of TDR, which is the figure the Versova file uses.
    tdrRatePerSqft: 7400,
    residentialSaleRatePerSqft: 55000,
    commercialSaleRatePerSqft: 60000,
    flatRentPerSqftPerMonth: 150,
    shopRentPerSqftPerMonth: 300,
    note: 'Derived from the Feasibility Report of Dharti CHS, Versova. Greater Mumbai runs on DCPR-2034; the RR rate is ward-specific and must be checked per plot.',
  },
  {
    authority: 'NMC',
    label: 'Navi Mumbai / Nashik Municipal Corporation',
    effectiveFrom: '2026-04-01',
    asrRatePerSqm: 52000,
    labourTaxRatePerSqm: 27951,
    fireCapitationRatePerSqm: 250,
    constructionRatePerSqft: 4400,
    tdrRatePerSqft: 2600,
    residentialSaleRatePerSqft: 19000,
    commercialSaleRatePerSqft: 22000,
    flatRentPerSqftPerMonth: 48,
    shopRentPerSqftPerMonth: 110,
    note: 'Placeholder rates pending client circulars.',
  },
];

RATE_MASTERS.push({
  authority: 'NAGPUR',
  label: 'Nagpur Municipal Corporation',
  effectiveFrom: '2026-04-01',
  asrRatePerSqm: 31000,
  labourTaxRatePerSqm: 27951,
  fireCapitationRatePerSqm: 250,
  constructionRatePerSqft: 2100,
  tdrRatePerSqft: 1400,
  residentialSaleRatePerSqft: 7000,
  commercialSaleRatePerSqft: 9000,
  flatRentPerSqftPerMonth: 22,
  shopRentPerSqftPerMonth: 55,
  note: 'Nagpur runs the Table 14-O metro TOD bands, which gate FSI on plot area as well as road width. Rates are placeholders pending client circulars.',
});

export function rateMasterFor(authority: Authority): RateMaster {
  return RATE_MASTERS.find((r) => r.authority === authority) ?? RATE_MASTERS[0];
}

/**
 * Default inputs. Pre-loaded with the Sita Smruti parameters so the app opens
 * on a case the client's team already recognises.
 */
export const DEFAULT_INPUTS: FeasibilityInputs = {
  overrides: [],
  projectName: 'Sita Smruti',
  surveyNo: 'Survey No. 545(40), Hissa No. 7',
  village: 'Bhayandar',
  authority: 'MBMC',
  reportDate: '2026-05-26',

  schemeType: 'SOCIETY_REDEV',
  // The builder's instruction: scheme details must not move the income line.
  incentiveAreaTreatment: 'RETAINED_BY_MEMBERS',

  dcprLocation: 'SUBURBS',
  dcprMaxFsi: 4.0,
  dcprPapSharePct: 0.5,
  dcprPapRatePerSqm: 170000,
  dcprRoadSetbackCreditSqm: 0,
  dcprStaircaseAreaPerFloorSqm: 0,
  existingBuiltUpWithBalconySqm: 0,
  rehabBuaToCarpetFactor: 1.2,

  plotAreaSevenTwelveSqm: 4200,
  plotAreaConveyanceSqm: 4199,
  dpRoadAreaSqm: 1354,
  roadWidthM: 18,
  proposedRoadWidthM: 0,
  secondRoadWidthM: 0,
  frontageM: 0,
  depthM: 0,
  zone: 'MIXED',
  areaCategory: 'NON_CONGESTED',
  isTodZone: true,
  todMaxFsi: 3.5,

  existingBuiltUpAreaSqm: 4000.74,
  residentialTenements: 111,
  commercialUnits: 34,
  existingResidentialCarpetSqft: 40196,
  existingCommercialCarpetSqft: 5673,
  buildingAgeYears: 35,
  buildingStatus: 'NORMAL',
  // Blank in the source report, so the minimum-carpet top-up is skipped there.
  avgExistingCarpetPerTenementSqm: 0,

  basicFsi: 1.1,
  premiumFsiRate: 0.5,
  maxTdrLoading: 0.9,
  incentiveFsiPctOfExisting: 0.3,
  incentiveFsiPerTenementSqm: 15,
  inSituFsiMultiplier: 2.0,
  minTdrLoadingPct: 0.25,
  ancillaryResidentialPct: 0.6,
  ancillaryCommercialPct: 0.8,

  commercialSplitMode: 'ABSOLUTE',
  commercialSharePct: 8.42,
  commercialAreaSqm: 1112,

  builtUpToCarpetFactor: 1.32,
  carpetToBuiltUpFactor: 1.15,
  mofaToReraFactor: 1.04,
  // The standing brief specifies 20%. The Sita Smruti reference report was run
  // at 25%; the acceptance test overrides this to reproduce that document.
  additionalCarpetToTenantsPct: 0.2,

  developerSplitMode: 'ABSOLUTE',
  developerCommercialCarpetSqft: 10927,
  developerCommercialSharePct: 9.4,

  asrRatePerSqm: 40800,
  premiumFsiChargeRate: 0.35,
  ancillaryChargeRate: 0.1,
  landDevChargeMbmcPct: 0.005,
  landDevChargeMetroPct: 0.005,
  devChargeCommercialPct: 0.04,
  devChargeResidentialPct: 0.02,
  scrutinyFeePerPlotUnit: 2000,
  scrutinyFeePlotDivisor: 4000,
  scrutinyFeePerSqmBua: 5,
  devFeeRatePerSqm: 15,
  devFeeMultiplier: 1.1,
  devFeeCap: 200000,
  labourTaxPct: 0.01,
  labourTaxRatePerSqm: 27951,
  fireCapitationRatePerSqm: 250,
  podiumAreaSqm: 7000,
  includePodiumInLabourTax: true,
  includePodiumInFireFee: true,

  floors: 0,
  analysisBasis: 'MAX_POTENTIAL',
  groundCoveragePct: 55,
  constructionCostBasis: 'SUPER_BUILTUP',
  landRatePerSqft: 0,
  landLumpSum: 0,

  tdrRatePerSqft: 2124,
  constructionRatePerSqft: 4130,
  professionalFeeRatePerSqft: 100,
  incidentalRatePerSqft: 400,
  agentCommissionPct: 0.04,
  officeExpensePerMonth: 500000,

  ancillaryExpenseLumpSum: 0,
  ancillaryExpenseRatePerSqft: 0,

  environmentalClearanceCost: 2 * CRORE,
  stampDutyRegistrationCost: 0,
  redevCessRatePerSqm: 0,
  corpusFundBasis: 'PER_SQFT_EXISTING_CARPET',
  corpusFundRatePerSqft: 0,
  corpusFundCost: 0,
  otherMiscCost: 5 * CRORE,

  residentialSaleRatePerSqft: 16500,
  commercialSaleRatePerSqft: 18000,

  constructionPeriodMonths: 36,
  flatRentPerSqftPerMonth: 40,
  shopRentPerSqftPerMonth: 100,
  brokeragePerUnit: 15000,
  brokerageCycles: 2,
  brokerageUnitCount: 145,
};

/**
 * A genuinely empty project.
 *
 * Clicking "New report" must not hand the user another site's numbers - that
 * was explicit feedback from the client. Only three classes of value survive:
 * regulation constants (which derive anyway), the selected authority's rate
 * master, and structural conventions like the 36-month rent period and the 20%
 * tenant uplift. Everything site-specific starts empty.
 */
export function createBlankInputs(authority: Authority = 'MBMC'): FeasibilityInputs {
  const rm = rateMasterFor(authority);
  const rulebook = rulebookFor(authority);
  return {
    ...DEFAULT_INPUTS,
    overrides: [],

    projectName: '',
    surveyNo: '',
    village: '',
    authority,
    reportDate: new Date().toISOString().slice(0, 10),

    // Mumbai starts on the DCPR route; everywhere else on UDCPR Reg. 7.6.1.
    schemeType: defaultSchemeFor(rulebook.id),
    incentiveAreaTreatment: 'RETAINED_BY_MEMBERS',
    dcprLocation: 'SUBURBS',
    dcprRoadSetbackCreditSqm: 0,
    dcprStaircaseAreaPerFloorSqm: 0,
    existingBuiltUpWithBalconySqm: 0,

    plotAreaSevenTwelveSqm: 0,
    plotAreaConveyanceSqm: 0,
    dpRoadAreaSqm: 0,
    roadWidthM: 0,
    proposedRoadWidthM: 0,
    secondRoadWidthM: 0,
    frontageM: 0,
    depthM: 0,
    floors: 0,
    analysisBasis: 'MAX_POTENTIAL',
    landRatePerSqft: 0,
    landLumpSum: 0,
    zone: 'RESIDENTIAL',
    areaCategory: 'NON_CONGESTED',
    isTodZone: false,

    existingBuiltUpAreaSqm: 0,
    residentialTenements: 0,
    commercialUnits: 0,
    existingResidentialCarpetSqft: 0,
    existingCommercialCarpetSqft: 0,
    buildingAgeYears: 0,
    buildingStatus: 'NORMAL',

    // Proportional rather than absolute, so the split rescales when the road
    // width (and therefore the permissible area) changes.
    commercialSplitMode: 'PERCENT',
    commercialSharePct: 0,
    commercialAreaSqm: 0,
    developerSplitMode: 'PERCENT',
    developerCommercialSharePct: 0,
    developerCommercialCarpetSqft: 0,

    additionalCarpetToTenantsPct: 0.2,

    stampDutyRegistrationCost: 0,
    corpusFundBasis: 'PER_SQFT_EXISTING_CARPET',
    corpusFundRatePerSqft: 0,
    corpusFundCost: 0,
    ancillaryExpenseLumpSum: 0,
    ancillaryExpenseRatePerSqft: 0,
    environmentalClearanceCost: 0,
    otherMiscCost: 0,

    asrRatePerSqm: rm.asrRatePerSqm,
    tdrRatePerSqft: rm.tdrRatePerSqft,
    constructionRatePerSqft: rm.constructionRatePerSqft,
    residentialSaleRatePerSqft: rm.residentialSaleRatePerSqft,
    commercialSaleRatePerSqft: rm.commercialSaleRatePerSqft,
    flatRentPerSqftPerMonth: rm.flatRentPerSqftPerMonth,
    shopRentPerSqftPerMonth: rm.shopRentPerSqftPerMonth,

    brokerageUnitCount: 0,
  };
}

/**
 * Brings a set of inputs up to the current shape.
 *
 * Reports are stored as the inputs that produced them, so every report saved
 * before a field existed is missing that field. Left alone those gaps propagate
 * as `undefined` into the arithmetic and come out the far end as NaN, or throw
 * outright where a derivation formats the value. Merging over a fresh blank for
 * the same authority gives each new field its default and leaves everything the
 * report actually recorded untouched.
 *
 * Applied on the way out of storage, so an older report opens, recalculates and
 * round-trips to the wizard exactly like one saved today.
 */
export function normaliseInputs(stored: Partial<FeasibilityInputs> | null | undefined): FeasibilityInputs {
  const authority = stored?.authority ?? 'MBMC';
  const base = createBlankInputs(authority);
  if (!stored) return base;

  const merged = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(stored)) {
    // A stored null or undefined is an absent field, not a deliberate zero.
    if (value === null || value === undefined) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    merged[key] = value;
  }

  // A scheme belongs to one rulebook. An authority change that predates the
  // DCPR work can leave a UDCPR scheme on a Mumbai plot, which derives nothing.
  const book = rulebookFor(authority);
  if (schemeFor(merged.schemeType as SchemeType).rulebook !== book.id) {
    merged.schemeType = defaultSchemeFor(book.id);
  }

  return merged as unknown as FeasibilityInputs;
}

/**
 * Field metadata drives the form UI and the assistant's field-filling tool.
 * `source` is shown as a tooltip so the user can verify a default rather than
 * trust it - several of these were open questions in the client's own
 * calculation spreadsheet.
 */
export interface FieldMeta {
  key: keyof FeasibilityInputs;
  label: string;
  unit?: string;
  section: string;
  type: 'number' | 'text' | 'date' | 'select' | 'toggle';
  options?: { value: string; label: string }[];
  step?: number;
  source?: string;
  help?: string;
}

/**
 * `primary` sections are what the user actually fills in. `advanced` sections
 * are collapsed by default and hold values that rarely move. Everything the
 * regulations decide is not in either - it renders in the auto-derived panel.
 */
export const FORM_SECTIONS = [
  { id: 'identity', title: 'Project identity', tier: 'primary' },
  { id: 'plot', title: 'Plot & zone', tier: 'primary' },
  { id: 'road', title: 'Road information', tier: 'primary' },
  { id: 'development', title: 'Development', tier: 'primary' },
  { id: 'costs', title: 'Costs & sale rates', tier: 'primary' },
  { id: 'scheme', title: 'Scheme', tier: 'primary' },
  { id: 'existing', title: 'Existing building', tier: 'primary' },
  { id: 'handback', title: 'Hand-back & unit mix', tier: 'primary' },
  { id: 'rent', title: 'Rent & displacement', tier: 'advanced' },
  { id: 'entitlement', title: 'Conversion factors', tier: 'advanced' },
  { id: 'rates', title: 'Municipal charge rates', tier: 'advanced' },
  { id: 'sale', title: 'Sale rates', tier: 'advanced' },
] as const;

/**
 * The five-step wizard. Mirrors the flow the client's team already knows from
 * the reference tool: Plot, Road, Development, Scheme details, Generate.
 */
export const WIZARD_STEPS = [
  { id: 'plot', label: 'Plot', sections: ['identity', 'plot'] },
  { id: 'road', label: 'Road', sections: ['road'] },
  { id: 'development', label: 'Development', sections: ['development', 'costs'] },
  { id: 'scheme', label: 'Scheme details', sections: ['scheme', 'existing', 'handback'] },
  { id: 'generate', label: 'Generate', sections: [] },
] as const;

export const FIELD_META: FieldMeta[] = [
  // identity
  { key: 'projectName', label: 'Project name', section: 'identity', type: 'text' },
  { key: 'surveyNo', label: 'Survey / Hissa no.', section: 'identity', type: 'text' },
  { key: 'village', label: 'Village / locality', section: 'identity', type: 'text' },
  {
    key: 'authority',
    label: 'Municipal authority',
    section: 'identity',
    type: 'select',
    options: [
      { value: 'MBMC', label: 'MBMC - Mira-Bhayandar' },
      { value: 'BMC', label: 'BMC - Brihanmumbai' },
      { value: 'NMC', label: 'NMC - Navi Mumbai / Nashik' },
      { value: 'TMC', label: 'TMC - Thane' },
      { value: 'PMC', label: 'PMC - Pune' },
      { value: 'NMMC', label: 'NMMC' },
      { value: 'NAGPUR', label: 'NMC - Nagpur (Table 14-O TOD)' },
      { value: 'OTHER', label: 'Other' },
    ],
    help: 'Switching authority reloads the rate master (ASR, construction and sale rates).',
  },
  { key: 'reportDate', label: 'Report date', section: 'identity', type: 'date' },

  // plot
  { key: 'plotAreaSevenTwelveSqm', label: 'Plot area as per 7/12 extract', unit: 'sq.m', section: 'plot', type: 'number', step: 0.01 },
  {
    key: 'plotAreaConveyanceSqm',
    label: 'Plot area as per Conveyance Deed',
    unit: 'sq.m',
    section: 'plot',
    type: 'number',
    step: 0.01,
    help: 'Premium FSI and TDR are computed on this figure; basic FSI is not.',
    source: 'UDCPR Reg. 14.2.1.2.3',
  },
  { key: 'dpRoadAreaSqm', label: 'Area under DP road / reservation', unit: 'sq.m', section: 'plot', type: 'number', step: 0.01 },
  { key: 'frontageM', label: 'Frontage / width', unit: 'm', section: 'plot', type: 'number', step: 0.1 },
  { key: 'depthM', label: 'Depth', unit: 'm', section: 'plot', type: 'number', step: 0.1 },

  // road
  {
    key: 'roadWidthM',
    label: 'Existing road width',
    unit: 'm',
    section: 'road',
    type: 'number',
    step: 0.5,
    source: 'UDCPR Table 6-G',
    help: 'FSI is banded by road width - measure it, do not guess. This single field drives basic FSI, premium FSI, TDR loading and the TOD ceiling.',
  },
  {
    key: 'proposedRoadWidthM',
    label: 'Proposed road width',
    unit: 'm',
    section: 'road',
    type: 'number',
    step: 0.5,
    help: 'A sanctioned widening. If wider than the existing road, it governs the FSI band.',
  },
  {
    key: 'secondRoadWidthM',
    label: '2nd road - corner plot',
    unit: 'm',
    section: 'road',
    type: 'number',
    step: 0.5,
    help: 'On a corner plot the wider of the two abutting roads governs FSI, and that side takes a front margin.',
  },

  // development
  {
    key: 'schemeType',
    label: 'Scheme',
    section: 'scheme',
    type: 'select',
    options: SCHEMES.map((s) => ({ value: s.id, label: `${s.label} (${s.regulation.replace(/^(UDCPR|DCPR-2034) /, '')})` })),
    help: 'Decides which incentive-FSI regulation applies. The biggest lever after road width. Only the schemes that exist under the governing rulebook are offered.',
  },
  {
    key: 'incentiveAreaTreatment',
    label: 'Scheme incentive area',
    section: 'scheme',
    type: 'select',
    options: [
      { value: 'RETAINED_BY_MEMBERS', label: 'Goes to the members (not sold)' },
      { value: 'SALEABLE', label: 'Sold by the developer' },
    ],
    help: 'Incentive FSI is granted so the members can be given more than they had. Kept with the members, the scheme changes the entitlement and the hand-back but never the income line.',
    source: 'Builder instruction - incentive area is not income',
  },
  {
    key: 'dcprLocation',
    label: 'Location within Greater Mumbai',
    section: 'plot',
    type: 'select',
    options: [
      { value: 'SUBURBS', label: 'Suburbs (basic FSI 1.00)' },
      { value: 'ISLAND_CITY', label: 'Island City (basic FSI 1.33)' },
    ],
    source: 'DCPR-2034 Reg. 30, Table 12',
    help: 'Only used on a Mumbai plot. Decides the basic FSI column in DCPR Table 12.',
  },
  {
    key: 'dcprRoadSetbackCreditSqm',
    label: 'Earlier road setback credited against TDR',
    unit: 'sq.m',
    section: 'plot',
    type: 'number',
    step: 0.01,
    source: 'DCPR-2034',
    help: 'Area already surrendered to an earlier road line. It comes off the TDR that has to be bought.',
  },
  {
    key: 'dcprMaxFsi',
    label: 'Maximum total FSI under Reg. 33(20)(B)',
    section: 'plot',
    type: 'number',
    step: 0.05,
    source: 'DCPR-2034 Reg. 33(20)(B) caps this at 4.00',
  },
  {
    key: 'dcprPapSharePct',
    label: 'PAP share of balance BUA',
    section: 'rates',
    type: 'number',
    step: 0.05,
    source: 'DCPR-2034 Reg. 33(20)(B)',
    help: 'Half the built-up area above the 33(7)(B) entitlement is handed to MCGM as Project Affected Persons stock.',
  },
  {
    key: 'dcprPapRatePerSqm',
    label: 'PAP purchase rate',
    unit: 'Rs/sq.m',
    section: 'rates',
    type: 'number',
    step: 1000,
    help: 'What it costs the developer to discharge the PAP obligation.',
  },
  {
    key: 'dcprStaircaseAreaPerFloorSqm',
    label: 'Staircase / lift area per floor',
    unit: 'sq.m',
    section: 'rates',
    type: 'number',
    step: 1,
    source: 'DCPR-2034 - staircase and lift premium at 25% of RR',
    help: 'Free of FSI but charged a premium. Multiplied by the number of floors.',
  },
  {
    key: 'analysisBasis',
    label: 'Analysis basis',
    section: 'development',
    type: 'select',
    options: [
      { value: 'MAX_POTENTIAL', label: 'Max potential (full FSI)' },
      { value: 'DESIGN_CAPPED', label: 'Design (capped to floors)' },
    ],
    help: 'Design caps built-up to your floors, closer to real sanction figures.',
  },
  { key: 'floors', label: 'Floors (over stilt)', section: 'development', type: 'number', step: 1, help: 'Only used on a design-capped run.' },
  {
    key: 'groundCoveragePct',
    label: 'Ground coverage',
    unit: '%',
    section: 'development',
    type: 'number',
    step: 1,
    help: 'Footprint as a share of the balance plot. Marginal distances are not modelled, so a design-capped area is indicative.',
  },
  {
    key: 'constructionCostBasis',
    label: 'Construction cost on',
    section: 'development',
    type: 'select',
    options: [
      { value: 'SUPER_BUILTUP', label: 'Super built-up (saleable)' },
      { value: 'BUILTUP', label: 'Built-up (excluding ancillary)' },
      { value: 'CARPET', label: 'RERA carpet' },
    ],
    help: 'Which area the construction rate multiplies. Moves the biggest cost line by 25-30%.',
  },
  {
    key: 'landRatePerSqft',
    label: 'Land rate',
    unit: 'Rs/sq.ft',
    section: 'costs',
    type: 'number',
    step: 100,
    help: 'Zero on a redevelopment - the society owns the land. Leave blank and use the lump sum instead if you have a negotiated figure.',
  },
  { key: 'landLumpSum', label: 'Land cost (lump sum)', unit: 'Rs', section: 'costs', type: 'number', step: 100000 },
  {
    key: 'zone',
    label: 'Zone',
    section: 'plot',
    type: 'select',
    options: [
      { value: 'RESIDENTIAL', label: 'Residential' },
      { value: 'COMMERCIAL', label: 'Commercial' },
      { value: 'MIXED', label: 'Mixed use' },
      { value: 'PUBLIC_SEMI_PUBLIC', label: 'Public / Semi-public' },
    ],
  },
  {
    key: 'areaCategory',
    label: 'Area category',
    section: 'plot',
    type: 'select',
    options: [
      { value: 'NON_CONGESTED', label: 'Non-congested' },
      { value: 'CONGESTED', label: 'Congested (gaothan / core)' },
    ],
    help: 'Congested areas generate 3x TDR against surrendered land instead of 2x.',
    source: 'UDCPR Reg. 11.2.4',
  },
  { key: 'isTodZone', label: 'Plot falls in a TOD zone', section: 'plot', type: 'toggle', source: 'UDCPR Reg. 14.2' },
  {
    key: 'todMaxFsi',
    label: 'Maximum permissible FSI in TOD zone',
    section: 'plot',
    type: 'number',
    step: 0.05,
    source: 'UDCPR Reg. 14.2.1.2 caps this at 4.00',
  },

  // existing
  { key: 'existingBuiltUpAreaSqm', label: 'Existing built-up area (sanctioned plan)', unit: 'sq.m', section: 'existing', type: 'number', step: 0.01 },
  {
    key: 'existingBuiltUpWithBalconySqm',
    label: 'Existing built-up area including balconies',
    unit: 'sq.m',
    section: 'existing',
    type: 'number',
    step: 0.01,
    source: 'DCPR-2034 rehab base',
    help: 'The Mumbai rehab entitlement is built on this figure. Leave blank and it derives as existing carpet x 1.20.',
  },
  { key: 'residentialTenements', label: 'Number of residential tenements', unit: 'flats', section: 'existing', type: 'number', step: 1 },
  { key: 'commercialUnits', label: 'Number of commercial units / shops', unit: 'shops', section: 'existing', type: 'number', step: 1 },
  { key: 'existingResidentialCarpetSqft', label: 'Existing residential carpet area (MOFA)', unit: 'sq.ft', section: 'existing', type: 'number', step: 1 },
  { key: 'existingCommercialCarpetSqft', label: 'Existing commercial carpet area', unit: 'sq.ft', section: 'existing', type: 'number', step: 1 },
  { key: 'buildingAgeYears', label: 'Age of building', unit: 'years', section: 'existing', type: 'number', step: 1, help: 'Over 30 years unlocks incentive FSI under Reg. 7.6.' },
  {
    key: 'avgExistingCarpetPerTenementSqm',
    label: 'Avg. existing carpet per tenement',
    unit: 'sq.m',
    section: 'existing',
    type: 'number',
    step: 0.1,
    source: 'UDCPR Reg. 7.6.1(ii)',
    help: 'Blank skips the minimum-carpet top-up. Below 27.87 sq.m, the shortfall to that minimum is allowed as premium-free FSI and goes to the members.',
  },
  {
    key: 'buildingStatus',
    label: 'Building status',
    section: 'existing',
    type: 'select',
    options: [
      { value: 'NORMAL', label: 'Normal' },
      { value: 'DILAPIDATED', label: 'Dilapidated' },
      { value: 'DANGEROUS', label: 'Declared dangerous' },
    ],
  },

  // entitlement
  { key: 'basicFsi', label: 'Basic FSI', section: 'entitlement', type: 'number', step: 0.05, source: 'UDCPR Table 6-G' },
  { key: 'premiumFsiRate', label: 'Premium FSI', section: 'entitlement', type: 'number', step: 0.05, source: 'UDCPR Table 6-G' },
  { key: 'maxTdrLoading', label: 'Maximum TDR loading', section: 'entitlement', type: 'number', step: 0.05, source: 'UDCPR Table 6-G' },
  { key: 'incentiveFsiPctOfExisting', label: 'Incentive FSI as % of existing BUA', section: 'entitlement', type: 'number', step: 0.01, source: 'UDCPR Reg. 7.6.1(i)' },
  { key: 'incentiveFsiPerTenementSqm', label: 'Incentive FSI per tenement', unit: 'sq.m', section: 'entitlement', type: 'number', step: 0.5, source: 'UDCPR Reg. 7.6.1(i) - whichever is more' },
  { key: 'inSituFsiMultiplier', label: 'In-situ FSI multiplier on surrendered road land', section: 'entitlement', type: 'number', step: 0.5, source: 'UDCPR Reg. 11.2.4' },
  { key: 'minTdrLoadingPct', label: 'Minimum TDR to be loaded', section: 'entitlement', type: 'number', step: 0.05 },
  { key: 'ancillaryResidentialPct', label: 'Ancillary FSI - residential', section: 'entitlement', type: 'number', step: 0.05, source: 'UDCPR Table 6-G, Note (i)' },
  { key: 'ancillaryCommercialPct', label: 'Ancillary FSI - commercial', section: 'entitlement', type: 'number', step: 0.05, source: 'UDCPR Table 6-G, Note (i) - non-residential' },
  {
    key: 'commercialSplitMode',
    label: 'Commercial share expressed as',
    section: 'handback',
    type: 'select',
    options: [
      { value: 'PERCENT', label: 'Percentage of total BUA' },
      { value: 'ABSOLUTE', label: 'Absolute area (sq.m)' },
    ],
    help: 'Percentage rescales automatically when road width changes the permissible area. Absolute does not.',
  },
  { key: 'commercialSharePct', label: 'Commercial share of total BUA', unit: '%', section: 'handback', type: 'number', step: 0.01 },
  { key: 'commercialAreaSqm', label: 'Commercial built-up area', unit: 'sq.m', section: 'handback', type: 'number', step: 0.01 },
  {
    key: 'builtUpToCarpetFactor',
    label: 'Built-up to RERA carpet loading factor',
    section: 'entitlement',
    type: 'number',
    step: 0.01,
    source: 'Source report uses 1.32; the internal Excel format shows 1.30',
  },
  {
    key: 'carpetToBuiltUpFactor',
    label: 'Carpet to built-up factor',
    section: 'entitlement',
    type: 'number',
    step: 0.01,
    help: 'Carpet plus walls. Used only when the construction rate is quoted on built-up area.',
  },
  { key: 'mofaToReraFactor', label: 'MOFA to RERA carpet conversion', section: 'entitlement', type: 'number', step: 0.01 },
  {
    key: 'rehabBuaToCarpetFactor',
    label: 'Rehab built-up to carpet factor',
    section: 'entitlement',
    type: 'number',
    step: 0.01,
    help: 'Applies to the members’ rehab component on a Mumbai scheme, where built-up includes the balcony. The convention is 1.20.',
  },
  {
    key: 'additionalCarpetToTenantsPct',
    label: 'Additional carpet area offered to tenants',
    section: 'handback',
    type: 'number',
    step: 0.01,
    help: 'The incentive that wins the tender. Applies to flats only - shops get back the area they had.',
  },
  {
    key: 'developerSplitMode',
    label: "Developer's commercial carpet expressed as",
    section: 'handback',
    type: 'select',
    options: [
      { value: 'PERCENT', label: 'Percentage of balance carpet' },
      { value: 'ABSOLUTE', label: 'Absolute area (sq.ft)' },
    ],
  },
  { key: 'developerCommercialSharePct', label: "Developer's commercial share", unit: '%', section: 'handback', type: 'number', step: 0.1 },
  {
    key: 'developerCommercialCarpetSqft',
    label: "Developer's commercial carpet (proposed)",
    unit: 'sq.ft',
    section: 'handback',
    type: 'number',
    step: 1,
    help: "Use only when the architect's layout fixes an absolute figure.",
  },

  // rates
  { key: 'asrRatePerSqm', label: 'ASR / Ready Reckoner rate', unit: 'Rs/sq.m', section: 'rates', type: 'number', step: 100, help: 'Varies by area and revises annually. Verify against the current ASR before relying on the report.' },
  { key: 'premiumFsiChargeRate', label: 'Premium rate on premium FSI', section: 'rates', type: 'number', step: 0.01, source: 'UDCPR Reg. 6.3, Note (viii) - 35% of ASR' },
  { key: 'ancillaryChargeRate', label: 'Premium rate on ancillary FSI', section: 'rates', type: 'number', step: 0.01, source: '10% of ASR' },
  { key: 'landDevChargeMbmcPct', label: 'Land development charge - Corporation', section: 'rates', type: 'number', step: 0.001 },
  { key: 'landDevChargeMetroPct', label: 'Land development charge - Metro', section: 'rates', type: 'number', step: 0.001 },
  { key: 'devChargeCommercialPct', label: 'Development charge - commercial (each of Corp. & Metro)', section: 'rates', type: 'number', step: 0.005 },
  { key: 'devChargeResidentialPct', label: 'Development charge - residential (each of Corp. & Metro)', section: 'rates', type: 'number', step: 0.005 },
  { key: 'scrutinyFeePerPlotUnit', label: 'Scrutiny fee per plot unit', unit: 'Rs', section: 'rates', type: 'number', step: 100 },
  { key: 'scrutinyFeePlotDivisor', label: 'Scrutiny fee plot divisor', unit: 'sq.m', section: 'rates', type: 'number', step: 100 },
  { key: 'scrutinyFeePerSqmBua', label: 'Scrutiny fee per sq.m of BUA', unit: 'Rs', section: 'rates', type: 'number', step: 1 },
  { key: 'devFeeRatePerSqm', label: 'Development fee rate', unit: 'Rs/sq.m', section: 'rates', type: 'number', step: 1 },
  { key: 'devFeeCap', label: 'Development fee cap', unit: 'Rs', section: 'rates', type: 'number', step: 10000 },
  { key: 'labourTaxRatePerSqm', label: 'Labour tax rate', unit: 'Rs/sq.m', section: 'rates', type: 'number', step: 1 },
  { key: 'fireCapitationRatePerSqm', label: 'Fire capitation fee rate', unit: 'Rs/sq.m', section: 'rates', type: 'number', step: 1, help: 'Source report uses Rs 250/sq.m; the internal Excel shows a different basis.' },
  { key: 'podiumAreaSqm', label: 'Assumed podium area', unit: 'sq.m', section: 'rates', type: 'number', step: 100 },
  { key: 'includePodiumInLabourTax', label: 'Include podium in labour tax base', section: 'rates', type: 'toggle' },
  { key: 'includePodiumInFireFee', label: 'Include podium in fire fee base', section: 'rates', type: 'toggle' },

  // costs
  { key: 'tdrRatePerSqft', label: 'TDR purchase rate', unit: 'Rs/sq.ft', section: 'costs', type: 'number', step: 1, help: 'Inclusive of 18% GST.' },
  { key: 'constructionRatePerSqft', label: 'Cost of construction', unit: 'Rs/sq.ft', section: 'costs', type: 'number', step: 10, help: "The builder's own rate, inclusive of 18% GST. Single biggest cost line." },
  { key: 'professionalFeeRatePerSqft', label: 'Professional fees', unit: 'Rs/sq.ft', section: 'costs', type: 'number', step: 5, help: 'Planning, design, MEP, PMC, structural engineer.' },
  { key: 'incidentalRatePerSqft', label: 'Other incidentals till OC', unit: 'Rs/sq.ft', section: 'costs', type: 'number', step: 10 },
  { key: 'agentCommissionPct', label: 'Agent commission & advertising', section: 'costs', type: 'number', step: 0.005 },
  { key: 'officeExpensePerMonth', label: 'Developer office expense', unit: 'Rs/month', section: 'costs', type: 'number', step: 10000 },
  { key: 'environmentalClearanceCost', label: 'Environmental clearance', unit: 'Rs', section: 'costs', type: 'number', step: 100000 },
  { key: 'stampDutyRegistrationCost', label: 'Stamp duty & registration', unit: 'Rs', section: 'costs', type: 'number', step: 100000 },
  {
    key: 'redevCessRatePerSqm',
    label: 'Redevelopment Development Cess',
    unit: 'Rs/sq.m',
    section: 'rates',
    type: 'number',
    step: 100,
    source: 'UDCPR Reg. 7.6, Note 3',
    help: 'Charged on built-up area above the base FSI. The rate is fixed by Government order and differs by authority - leave at zero until confirmed.',
  },
  {
    key: 'corpusFundBasis',
    label: 'Corpus fund computed on',
    section: 'costs',
    type: 'select',
    options: [
      { value: 'PER_SQFT_EXISTING_CARPET', label: "Rate x members' existing carpet area" },
      { value: 'LUMP_SUM', label: 'Negotiated lump sum' },
    ],
    source: 'UDCPR Reg. 7.6, Note 3',
    help: 'The trade quotes corpus per sq.ft. of the carpet area each member holds today, which is what the first option computes.',
  },
  {
    key: 'corpusFundRatePerSqft',
    label: 'Corpus fund rate',
    unit: 'Rs/sq.ft',
    section: 'costs',
    type: 'number',
    step: 50,
    help: "Applied to the members' total existing carpet area - residential plus commercial.",
  },
  {
    key: 'corpusFundCost',
    label: 'Corpus fund to society (lump sum)',
    unit: 'Rs',
    section: 'costs',
    type: 'number',
    step: 100000,
    source: 'UDCPR Reg. 7.6, Note 3',
    help: 'The 10-year maintenance corpus the developer must create. Its size is negotiated, and it is often what wins the tender.',
  },
  {
    key: 'ancillaryExpenseLumpSum',
    label: 'Ancillary expenses (lump sum)',
    unit: 'Rs',
    section: 'costs',
    type: 'number',
    step: 100000,
    help: 'Society liaison, NOCs, surveys, temporary services, deposits - the running heads that sit outside the statutory lines.',
  },
  {
    key: 'ancillaryExpenseRatePerSqft',
    label: 'Ancillary expenses rate',
    unit: 'Rs/sq.ft',
    section: 'costs',
    type: 'number',
    step: 5,
    help: 'Charged on total built-up area including the loading. Adds to the lump sum above.',
  },
  { key: 'otherMiscCost', label: 'Other miscellaneous (deficiency, OLT etc.)', unit: 'Rs', section: 'costs', type: 'number', step: 100000 },

  // rent
  { key: 'constructionPeriodMonths', label: 'Construction / rent period', unit: 'months', section: 'rent', type: 'number', step: 1, help: '36 months is the norm, not a statutory requirement.' },
  { key: 'flatRentPerSqftPerMonth', label: 'Monthly rent per sq.ft - flats', unit: 'Rs', section: 'rent', type: 'number', step: 1 },
  { key: 'shopRentPerSqftPerMonth', label: 'Monthly rent per sq.ft - shops', unit: 'Rs', section: 'rent', type: 'number', step: 1 },
  { key: 'brokeragePerUnit', label: 'Brokerage per unit', unit: 'Rs', section: 'rent', type: 'number', step: 1000 },
  { key: 'brokerageCycles', label: 'Number of brokerage cycles', section: 'rent', type: 'number', step: 1 },
  { key: 'brokerageUnitCount', label: 'Units counted for brokerage', section: 'rent', type: 'number', step: 1 },

  // sale rates sit with costs, so the whole revenue-and-cost picture is on one step
  {
    key: 'residentialSaleRatePerSqft',
    label: 'Residential selling rate',
    unit: 'Rs/sq.ft',
    section: 'costs',
    type: 'number',
    step: 100,
    help: 'On saleable super built-up area.',
  },
  { key: 'commercialSaleRatePerSqft', label: 'Commercial / office selling rate', unit: 'Rs/sq.ft', section: 'costs', type: 'number', step: 100 },
];

export const FIELD_META_BY_KEY = new Map(FIELD_META.map((f) => [f.key, f]));

/**
 * Fields stored as a fraction (0.35) rather than a percentage (35).
 * Users and the assistant both naturally say "35%", so inbound values above 1
 * on these keys are divided by 100. Note that `commercialSharePct` and
 * `developerCommercialSharePct` are genuinely 0-100 and are NOT in this set.
 */
export const FRACTION_FIELDS = new Set<keyof FeasibilityInputs>([
  'incentiveFsiPctOfExisting',
  'minTdrLoadingPct',
  'ancillaryResidentialPct',
  'ancillaryCommercialPct',
  'additionalCarpetToTenantsPct',
  'premiumFsiChargeRate',
  'ancillaryChargeRate',
  'landDevChargeMbmcPct',
  'landDevChargeMetroPct',
  'devChargeCommercialPct',
  'devChargeResidentialPct',
  'labourTaxPct',
  'agentCommissionPct',
  'dcprPapSharePct',
]);

/** Normalises an inbound value for a given field. */
export function coerceFieldValue(key: keyof FeasibilityInputs, raw: unknown): unknown {
  const meta = FIELD_META_BY_KEY.get(key);
  if (!meta) return raw;

  if (meta.type === 'toggle') {
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).toLowerCase();
    return s === 'true' || s === 'yes' || s === '1';
  }
  if (meta.type === 'number') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(n)) return undefined;
    if (FRACTION_FIELDS.has(key) && n > 1) return n / 100;
    return n;
  }
  return String(raw);
}
