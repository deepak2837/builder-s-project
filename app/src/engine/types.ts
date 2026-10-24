/**
 * Domain types for the redevelopment feasibility engine.
 *
 * Every rate in `FeasibilityInputs` is user-editable with a documented default,
 * because municipal rates vary by authority and by year. See constants.ts.
 */

export type Unit = 'sqm' | 'sqft' | 'inr' | 'cr' | 'ratio' | 'pct' | 'count' | 'months' | 'm';

export type Authority = 'MBMC' | 'BMC' | 'NMC' | 'TMC' | 'PMC' | 'NMMC' | 'NAGPUR' | 'OTHER';

export type Zone = 'RESIDENTIAL' | 'COMMERCIAL' | 'MIXED' | 'PUBLIC_SEMI_PUBLIC';

export type AreaCategory = 'CONGESTED' | 'NON_CONGESTED';

export type BuildingStatus = 'NORMAL' | 'DILAPIDATED' | 'DANGEROUS';

/** Whether the commercial share of built-up area is given as a % or an absolute figure. */
export type SplitMode = 'PERCENT' | 'ABSOLUTE';

/**
 * How the developer's sale mix is decided.
 *
 * `FOLLOW_BUILDING` ties it to the building mix, which is the normal case - the
 * shops in the new building are the commercial area, so the share of the
 * developer's balance carpet that is commercial is the share of the building
 * that is commercial. The other two modes exist for a layout that pins the
 * figure independently, and for reports saved before the two were tied.
 */
export type DeveloperSplitMode = SplitMode | 'FOLLOW_BUILDING';

/** The development scheme, which decides which incentive-FSI regulation applies. */
export type SchemeType =
  | 'STANDARD'
  | 'SOCIETY_REDEV'
  | 'TENANTED_REDEV'
  | 'TOD'
  | 'PMAY'
  | 'HIGHER_FSI'
  | 'SLUM_REHAB'
  // Greater Mumbai, governed by DCPR-2034 rather than UDCPR-2020.
  | 'DCPR_SOCIETY_REDEV'
  | 'DCPR_33_20B';

/**
 * Where the scheme incentive area ends up.
 *
 * The builder's instruction is that scheme details must not move the income
 * line - incentive FSI is granted so the members can be given more area, so it
 * belongs to the rehab component, not to the saleable pool.
 */
export type IncentiveTreatment = 'RETAINED_BY_MEMBERS' | 'SALEABLE';

/** How the corpus paid to the society is arrived at. */
export type CorpusBasis = 'PER_SQFT_EXISTING_CARPET' | 'LUMP_SUM';

/** Whether to appraise the full entitlement or only what the massing can hold. */
export type AnalysisBasis = 'MAX_POTENTIAL' | 'DESIGN_CAPPED';

/** Which area the per-sq.ft construction rate is applied to. */
export type CostBasis = 'SUPER_BUILTUP' | 'BUILTUP' | 'CARPET';

export interface FeasibilityInputs {
  /**
   * Keys the user has taken manual control of. Everything the regulations can
   * determine is derived automatically from plot area, road width, metro
   * corridor and the existing building - see engine/derive.ts. Listing a key
   * here pins it to the stored value instead.
   */
  overrides: string[];

  // ---- 4.1 Project identity ----
  projectName: string;
  surveyNo: string;
  village: string;
  authority: Authority;
  reportDate: string; // ISO yyyy-mm-dd

  // ---- Scheme ----
  /** Decides which incentive-FSI regulation is applied. */
  schemeType: SchemeType;

  /**
   * Whether the scheme's incentive area is sold or handed to the members.
   * Defaults to RETAINED_BY_MEMBERS so that changing the scheme moves the
   * entitlement and the hand-back, but never the income line.
   */
  incentiveAreaTreatment: IncentiveTreatment;

  // ---- DCPR-2034 (Greater Mumbai) ----
  /** Island city or suburbs. Decides the basic FSI in DCPR Table 12. */
  dcprLocation: import('./dcpr').MumbaiLocation;
  /** Reg. 33(20)(B) ceiling on total FSI. The regulation caps this at 4.00. */
  dcprMaxFsi: number;
  /** Share of the balance BUA handed to the Corporation as PAP stock. */
  dcprPapSharePct: number;
  /** What the developer pays per Sq.mt. to discharge the PAP obligation. */
  dcprPapRatePerSqm: number;
  /** Area already surrendered to an earlier road line, credited against TDR. */
  dcprRoadSetbackCreditSqm: number;
  /** Staircase, lift and lobby area per floor, which attracts a premium. */
  dcprStaircaseAreaPerFloorSqm: number;
  /** Existing built-up area including balconies - the DCPR rehab base. */
  existingBuiltUpWithBalconySqm: number;
  /** Rehab BUA to carpet loading. The Mumbai convention is 1.20. */
  rehabBuaToCarpetFactor: number;

  // ---- 4.2 Plot & land ----
  plotAreaSevenTwelveSqm: number;
  plotAreaConveyanceSqm: number;
  dpRoadAreaSqm: number;
  /** Existing abutting road width. */
  roadWidthM: number;
  /** Sanctioned widening, if any. The wider road governs the FSI band. */
  proposedRoadWidthM: number;
  /** Second abutting road on a corner plot. The wider road governs FSI. */
  secondRoadWidthM: number;
  frontageM: number;
  depthM: number;
  zone: Zone;
  areaCategory: AreaCategory;
  isTodZone: boolean;
  /** Max total FSI permissible in the TOD zone (UDCPR 14.2.1.2 caps this at 4.00). */
  todMaxFsi: number;

  // ---- 4.3 Existing building ----
  existingBuiltUpAreaSqm: number;
  residentialTenements: number;
  commercialUnits: number;
  existingResidentialCarpetSqft: number; // MOFA carpet
  existingCommercialCarpetSqft: number;
  buildingAgeYears: number;
  buildingStatus: BuildingStatus;
  /**
   * Average existing carpet per tenement. Where this falls below 27.87 Sq.mt.,
   * Reg. 7.6.1(ii) entitles each tenement to that minimum and allows the
   * shortfall as premium-free FSI. Zero skips the top-up.
   */
  avgExistingCarpetPerTenementSqm: number;

  // ---- 4.4 Entitlement & scheme parameters ----
  basicFsi: number;
  premiumFsiRate: number;
  maxTdrLoading: number;
  incentiveFsiPctOfExisting: number; // 0.30
  incentiveFsiPerTenementSqm: number; // 15
  inSituFsiMultiplier: number; // 2.0 non-congested / 3.0 congested
  minTdrLoadingPct: number; // 0.25
  ancillaryResidentialPct: number; // 0.60
  ancillaryCommercialPct: number; // 0.80

  /** How the commercial share of total permissible BUA is expressed. */
  commercialSplitMode: SplitMode;
  commercialSharePct: number; // used when mode = PERCENT
  commercialAreaSqm: number; // used when mode = ABSOLUTE

  builtUpToCarpetFactor: number; // 1.32 - carpet to super built-up (saleable)
  /** Carpet to plain built-up, i.e. carpet plus walls. Sits below the saleable loading. */
  carpetToBuiltUpFactor: number; // 1.15
  mofaToReraFactor: number; // 1.04
  /** Additional RERA carpet handed back to residential tenants. Brief says 20%. */
  additionalCarpetToTenantsPct: number;

  /**
   * Developer's saleable commercial carpet.
   *
   * Normally `FOLLOW_BUILDING`, where the sale mix is read straight off the
   * building mix and these two figures are ignored. They are kept because the
   * source report labels the commercial carpet "(Proposed)" - an architect's
   * layout can fix it independently - and because reports saved before the two
   * splits were tied still carry their own value.
   */
  developerSplitMode: DeveloperSplitMode;
  developerCommercialCarpetSqft: number;
  developerCommercialSharePct: number;

  // ---- 4.5 Rates & financials ----
  asrRatePerSqm: number;
  premiumFsiChargeRate: number; // 0.35 of ASR
  ancillaryChargeRate: number; // 0.10 of ASR
  landDevChargeMbmcPct: number; // 0.005
  landDevChargeMetroPct: number; // 0.005
  devChargeCommercialPct: number; // 0.04 (levied by MBMC and by Metro separately)
  devChargeResidentialPct: number; // 0.02 (ditto)
  scrutinyFeePerPlotUnit: number; // Rs 2000 per 4000 sqm
  scrutinyFeePlotDivisor: number; // 4000
  scrutinyFeePerSqmBua: number; // Rs 5
  devFeeRatePerSqm: number; // Rs 15
  devFeeMultiplier: number; // 1.1
  devFeeCap: number; // Rs 2,00,000
  labourTaxPct: number; // 0.01
  labourTaxRatePerSqm: number; // Rs 27,951
  fireCapitationRatePerSqm: number; // Rs 250
  podiumAreaSqm: number; // 7000
  includePodiumInLabourTax: boolean;
  includePodiumInFireFee: boolean;

  // ---- Massing & basis ----
  /** Floors over stilt. Only used when analysisBasis is DESIGN_CAPPED. */
  floors: number;
  analysisBasis: AnalysisBasis;
  /** Share of net plot the building footprint occupies, for design-capped runs. */
  groundCoveragePct: number;
  /** Which area the construction rate multiplies. */
  constructionCostBasis: CostBasis;

  // ---- Land ----
  /** Land acquisition rate. Zero on a redevelopment where the society owns the land. */
  landRatePerSqft: number;
  /** Lump-sum land cost, used when no rate is given. */
  landLumpSum: number;

  tdrRatePerSqft: number; // Rs 2124 incl 18% GST
  constructionRatePerSqft: number; // Rs 4130 incl 18% GST
  professionalFeeRatePerSqft: number; // Rs 100
  incidentalRatePerSqft: number; // Rs 400
  agentCommissionPct: number; // 0.04
  officeExpensePerMonth: number; // Rs 5,00,000

  /**
   * Ancillary project expenses - the running heads a redevelopment carries that
   * do not belong to any of the modelled statutory lines: society liaison,
   * NOCs, surveys, temporary services, deposits. Entered as a lump sum, a rate
   * on built-up area, or both.
   */
  ancillaryExpenseLumpSum: number;
  ancillaryExpenseRatePerSqft: number;

  environmentalClearanceCost: number;
  stampDutyRegistrationCost: number;
  /**
   * Additional Development Cess on built-up area over and above the base FSI,
   * payable on a redevelopment under Reg. 7.6, Note 3. Zero = not priced.
   */
  redevCessRatePerSqm: number;
  /**
   * The 10-year maintenance corpus the developer must create (Reg. 7.6, Note 3).
   * The trade quotes it per sq.ft. of the members' existing carpet area, which
   * is what PER_SQFT_EXISTING_CARPET computes; LUMP_SUM uses `corpusFundCost`.
   */
  corpusFundBasis: CorpusBasis;
  corpusFundRatePerSqft: number;
  corpusFundCost: number;
  otherMiscCost: number;

  residentialSaleRatePerSqft: number;
  commercialSaleRatePerSqft: number;

  // ---- 4.6 Rent & displacement ----
  constructionPeriodMonths: number; // 36
  flatRentPerSqftPerMonth: number; // Rs 40
  shopRentPerSqftPerMonth: number; // Rs 100
  brokeragePerUnit: number; // Rs 15,000
  brokerageCycles: number; // 2
  /** Units counted for brokerage. Source report used 145 (111 flats + 34 shops). */
  brokerageUnitCount: number;
}

/** A single traceable figure in the report. */
export interface LineItem {
  id: string;
  label: string;
  value: number;
  unit: Unit;
  /** Human-readable formula with the actual input values substituted in. */
  formula?: string;
  /** Governing regulation, e.g. "UDCPR Reg. 6.3, Note (viii)". */
  regulation?: string;
  note?: string;
  /** Renders bold / boxed in the document. */
  emphasis?: boolean;
  /** Indented sub-line. */
  indent?: number;
  /** Which input field drives this figure, so the chatbot can offer to change it. */
  drivenBy?: keyof FeasibilityInputs;
}

export interface ReportSection {
  id: string;
  title: string;
  subtitle?: string;
  /** Free prose the user (or the assistant) can edit. Stored as HTML. */
  prose?: string;
  items: LineItem[];
}

export interface FsiBreakdown {
  balancePlotAreaSqm: number;
  /** Path A - maximum permissible FSI as per UDCPR. */
  pathA: {
    basicFsiAreaSqm: number;
    premiumFsiAreaSqm: number;
    minTdrToBeLoadedSqm: number;
    inSituFsiSqm: number;
    balancePremiumFsiSqm: number;
    totalSqm: number;
  };
  /** Path B - maximum permissible FSI as per the redevelopment scheme. */
  pathB: {
    existingBuiltUpSqm: number;
    incentiveFsiSqm: number;
    incentiveBasis: string;
    /** Premium-free FSI for the shortfall to 27.87 Sq.mt. per tenement. */
    minCarpetTopUpSqm: number;
    minCarpetBasis: string;
    premiumFsiSqm: number;
    balanceTdrFsiSqm: number;
    inSituFsiSqm: number;
    tdrToPurchaseSqm: number;
    totalSqm: number;
  };
  governingPath: 'A' | 'B';
  totalPermissibleBuaSqm: number;
  /**
   * Area the scheme grants specifically so the members can be given more than
   * they had. Carved out of the saleable pool unless the user opts otherwise,
   * so that changing the scheme never moves the income line.
   */
  memberIncentiveBuaSqm: number;
  /** Present only on a Greater Mumbai plot, where DCPR-2034 governs. */
  dcpr?: import('./dcpr').DcprFsiBreakdown;
}

export interface AreaBreakdown {
  commercialBuaSqm: number;
  residentialBuaSqm: number;
  ancillaryCommercialSqm: number;
  ancillaryResidentialSqm: number;
  totalAncillarySqm: number;
  totalBuaInclAncillarySqm: number;
  totalBuaInclAncillarySqft: number;
  commercialBuaInclAncillarySqm: number;
  residentialBuaInclAncillarySqm: number;

  approxReraCarpetSqft: number;
  existingResidentialReraCarpetSqft: number;
  existingCommercialCarpetSqft: number;
  totalExistingReraCarpetSqft: number;
  additionalCarpetToTenantsSqft: number;
  /** Incentive carpet retained by the members, kept out of the saleable pool. */
  incentiveCarpetToMembersSqft: number;
  developerBalanceCarpetSqft: number;
  developerResidentialCarpetSqft: number;
  developerCommercialCarpetSqft: number;
  /** Everything handed back: existing carpet + uplift + retained incentive. */
  totalHandBackCarpetSqft: number;
}

export interface IncomeBreakdown {
  residentialIncome: number;
  commercialIncome: number;
  totalIncome: number;
}

export interface ExpenseHead {
  id: string;
  label: string;
  amount: number;
  items: LineItem[];
  /** True where the source report labels the figure "approx." */
  approximate?: boolean;
}

export interface ExpenseBreakdown {
  premiumAndAncillary: ExpenseHead;
  developmentCharges: ExpenseHead;
  tdrCost: ExpenseHead;
  incidentals: ExpenseHead;
  construction: ExpenseHead;
  professionalFees: ExpenseHead;
  agentCommission: ExpenseHead;
  officeExpense: ExpenseHead;
  rentAndServices: ExpenseHead;
  /** Ancillary project expenses, entered by the builder. */
  ancillaryExpenses: ExpenseHead;
  otherHeads: ExpenseHead;
  /** User-added ad-hoc line items (via the chatbot or the editor). */
  customItems: LineItem[];
  totalExpenditure: number;
}

export interface ScoreComponent {
  id: string;
  label: string;
  weight: number;
  rawValue: number;
  unit: Unit;
  points: number; // 0..weight
  band: 'poor' | 'moderate' | 'good' | 'excellent';
  explanation: string;
}

export interface FeasibilityScore {
  score: number; // 0..100
  verdict: 'Highly Feasible' | 'Feasible' | 'Marginal' | 'Not Feasible';
  components: ScoreComponent[];
  drivers: string[];
}

export interface SensitivityRow {
  variable: string;
  deltaPct: number;
  netProfit: number;
  marginPct: number;
  deltaProfit: number;
}

export interface SensitivityAnalysis {
  rows: SensitivityRow[];
  breakevenResidentialRatePerSqft: number;
  breakevenConstructionRatePerSqft: number;
}

export interface FeasibilitySummary {
  totalIncome: number;
  totalExpenditure: number;
  netProfit: number;
  marginPct: number;
  roiPct: number;
}

/** One scheme's headline numbers, for the side-by-side comparison. */
export interface SchemeComparisonRow {
  schemeType: SchemeType;
  label: string;
  regulation: string;
  incentiveFsiSqm: number;
  totalPermissibleBuaSqm: number;
  developerCarpetSqft: number;
  netProfit: number;
  marginPct: number;
  score: number;
  isCurrent: boolean;
}

export interface FeasibilityResult {
  /** A plain-language read of the result, for the top of the report. */
  headline: string;
  /** Which ruleset produced these numbers, stamped on the document. */
  ruleset: string;
  /** What the user entered. */
  inputs: FeasibilityInputs;
  /** What the engine actually computed on, after regulation derivation. */
  effectiveInputs: FeasibilityInputs;
  /** Regulation-derived parameters, with their basis, for display. */
  derived: import('./derive').DerivedField[];
  /** Which schemes apply, decided from the primary inputs. */
  schemes: import('./derive').SchemeStatus[];
  /** Which rulebook governs the selected authority. */
  rulebook: import('./constants').Rulebook;
  fsi: FsiBreakdown;
  areas: AreaBreakdown;
  income: IncomeBreakdown;
  expenses: ExpenseBreakdown;
  summary: FeasibilitySummary;
  score: FeasibilityScore;
  sensitivity: SensitivityAnalysis;
  sections: ReportSection[];
  /** Regulatory warnings - "is this legal?". */
  warnings: string[];
  /** Plausibility issues - "does this data look real?". */
  checks: import('./checks').PlausibilityIssue[];
  /** The same plot appraised under each scheme. */
  schemeComparison: SchemeComparisonRow[];
  computedAt: string;
}

/** A user- or assistant-authored override applied on top of the generated document. */
export interface DocumentPatch {
  sectionId: string;
  /** Prose edits. */
  prose?: string;
  /** Ad-hoc line items added to a section. */
  addedItems?: LineItem[];
  /** Line item ids removed from the section. */
  removedItemIds?: string[];
}
