import {
  SQM_TO_SQFT,
  TABLE_6G,
  entitlementFor,
  governingRoadWidth,
  inSituMultiplierFor,
  rateMasterFor,
  rulebookFor,
  schemeFor,
} from './constants';
import {
  DCPR_33_20B_MAX_FSI,
  DCPR_FUNGIBLE_PREMIUM_RATE,
  DCPR_PAP_SHARE,
  DCPR_PREMIUM_FSI_RATE,
  FUNGIBLE_COMMERCIAL_PCT,
  FUNGIBLE_RESIDENTIAL_PCT,
  dcprEntitlementFor,
} from './dcpr';
import type { FeasibilityInputs } from './types';

/** The two Greater Mumbai redevelopment routes this application models. */
export const DCPR_SCHEMES = new Set<FeasibilityInputs['schemeType']>(['DCPR_SOCIETY_REDEV', 'DCPR_33_20B']);

/** Schemes that carry a rehab obligation and therefore an incentive entitlement. */
export function isRedevelopmentScheme(scheme: FeasibilityInputs['schemeType']): boolean {
  return scheme === 'SOCIETY_REDEV' || scheme === 'TENANTED_REDEV' || DCPR_SCHEMES.has(scheme);
}

/**
 * Incentive FSI, decided entirely by the chosen scheme.
 *
 * Both redevelopment regulations happen to share the same "whichever is more"
 * shape, so each reduces to a percentage of existing built-up area and a
 * per-tenement floor:
 *
 *   7.6.1 society   - 30% of existing BUA, or 15 Sq.mt. per tenement
 *   7.6.2 tenanted  - 50% of the rehab area, where rehab area is the
 *                     authorised area or 27.87 Sq.mt. carpet per tenement
 *                     => 50% of BUA, or 13.935 Sq.mt. per tenement
 */
export function incentiveRuleFor(scheme: FeasibilityInputs['schemeType']): {
  pctOfExisting: number;
  perTenementSqm: number;
  regulation: string;
  basis: string;
} {
  switch (scheme) {
    case 'SOCIETY_REDEV':
      return {
        pctOfExisting: 0.3,
        perTenementSqm: 15,
        regulation: 'UDCPR Reg. 7.6.1(i)',
        basis: '30% of existing BUA or 15 Sq.mt. per tenement, whichever is more',
      };
    case 'TENANTED_REDEV':
      return {
        pctOfExisting: 0.5,
        perTenementSqm: 27.87 * 0.5,
        regulation: 'UDCPR Reg. 7.6.2(i)',
        basis: '50% of rehab area - the authorised area or 27.87 Sq.mt. carpet per tenement, whichever is more',
      };
    // Mumbai does not grant incentive FSI as a percentage of existing area. The
    // rehab uplift is negotiated with the society, and the regulation instead
    // credits 10 Sq.mt. per rehabilitated tenement against the TDR to be bought.
    case 'DCPR_SOCIETY_REDEV':
    case 'DCPR_33_20B':
      return {
        pctOfExisting: 0,
        perTenementSqm: 10,
        regulation: 'DCPR-2034 Reg. 33(7)(B)',
        basis: '10 Sq.mt. per rehabilitated tenement, credited against the TDR to be purchased',
      };
    default:
      return {
        pctOfExisting: 0,
        perTenementSqm: 0,
        regulation: schemeFor(scheme).regulation,
        basis: 'No incentive FSI under this scheme',
      };
  }
}

/**
 * The derivation layer.
 *
 * The client's requirement: "each changed metric should change the other, i.e.
 * road width should change max permissible FSI and therefore calculations."
 *
 * So everything the regulations can determine is derived from four primary
 * facts - plot area, abutting road width, whether the plot sits in a metro
 * corridor, and the existing building - rather than typed in by hand. A user
 * can still pin any single value by adding its key to `inputs.overrides`, which
 * is what the padlock in the UI does; that is needed when a local circular
 * departs from the state rule.
 */

/**
 * UDCPR Reg. 14.2.1.2 - maximum permissible total FSI inside a TOD zone,
 * by abutting road width. Reg. 14.2.4 extends this table from Pune to all other
 * Municipal Corporations, Metropolitan Region Development Authorities and
 * CIDCO - which is what puts MBMC and the rest of MMR on it.
 */
export const TOD_FSI_TABLE: { minRoadWidthM: number; maxRoadWidthM: number | null; label: string; maxFsi: number }[] = [
  { minRoadWidthM: 9, maxRoadWidthM: 12, label: '9 m. and up to 12 m.', maxFsi: 2.5 },
  { minRoadWidthM: 12, maxRoadWidthM: 15, label: '12 m. and up to 15 m.', maxFsi: 3.0 },
  { minRoadWidthM: 15, maxRoadWidthM: 24, label: '15 m. and up to 24 m.', maxFsi: 3.5 },
  { minRoadWidthM: 24, maxRoadWidthM: null, label: '24 m. and above', maxFsi: 4.0 },
];

/**
 * UDCPR Table 14-O (Reg. 14.2.3) - Nagpur Metro Rail Corporation.
 *
 * Nagpur gates the TOD uplift on plot area as well as road width, and the lower
 * of the two governs. Pune and, through Reg. 14.2.4, the rest of the state band
 * on road width alone - so the two tables are kept separate and selected by
 * jurisdiction rather than blended.
 */
export const TABLE_14O: { minRoadWidthM: number; minPlotAreaSqm: number; maxPlotAreaSqm: number | null; maxFsi: number }[] = [
  { minRoadWidthM: 9, minPlotAreaSqm: 0, maxPlotAreaSqm: 1000, maxFsi: 2.0 },
  { minRoadWidthM: 9, minPlotAreaSqm: 1000, maxPlotAreaSqm: null, maxFsi: 3.0 },
  { minRoadWidthM: 12, minPlotAreaSqm: 2000, maxPlotAreaSqm: null, maxFsi: 3.5 },
  { minRoadWidthM: 15, minPlotAreaSqm: 2000, maxPlotAreaSqm: null, maxFsi: 4.0 },
];

/** Authorities that sit under the Nagpur Metro TOD table rather than 14.2.1.2. */
const TABLE_14O_AUTHORITIES = new Set(['NAGPUR']);

export function todFsiFor(
  roadWidthM: number,
  plotAreaSqm?: number,
  authority?: string,
): { maxFsi: number; label: string; table: string } | null {
  if (authority && TABLE_14O_AUTHORITIES.has(authority)) {
    // Take the best row the plot qualifies for on BOTH conditions.
    const eligible = TABLE_14O.filter(
      (r) =>
        roadWidthM >= r.minRoadWidthM &&
        (plotAreaSqm ?? 0) >= r.minPlotAreaSqm &&
        (r.maxPlotAreaSqm === null || (plotAreaSqm ?? 0) < r.maxPlotAreaSqm),
    );
    if (eligible.length === 0) return null;
    const best = eligible.reduce((a, b) => (b.maxFsi > a.maxFsi ? b : a));
    return {
      maxFsi: best.maxFsi,
      label: `road >= ${best.minRoadWidthM} m and plot ${best.maxPlotAreaSqm ? `${best.minPlotAreaSqm}-${best.maxPlotAreaSqm}` : `>= ${best.minPlotAreaSqm}`} Sq.mt.`,
      table: 'UDCPR Table 14-O (Reg. 14.2.3)',
    };
  }

  const row = TOD_FSI_TABLE.find(
    (r) => roadWidthM >= r.minRoadWidthM && (r.maxRoadWidthM === null || roadWidthM < r.maxRoadWidthM),
  );
  // Below 9 m a plot gets no TOD uplift at all.
  return row ? { maxFsi: row.maxFsi, label: row.label, table: 'UDCPR Reg. 14.2.1.2 / 14.2.4' } : null;
}

export interface DerivedField {
  key: keyof FeasibilityInputs;
  label: string;
  value: number;
  unit?: string;
  /** How it was arrived at, with the actual driving values in it. */
  basis: string;
  regulation: string;
  /** True when the user has pinned this field rather than letting it derive. */
  overridden: boolean;
  /** The value the regulations would give, shown alongside an override. */
  derivedValue: number;
}

/** Scheme eligibility, decided from the primary inputs rather than asked for. */
export interface SchemeStatus {
  id: string;
  label: string;
  applies: boolean;
  reason: string;
  regulation: string;
}

export function deriveSchemes(inputs: FeasibilityInputs): SchemeStatus[] {
  const road = governingRoadWidth(inputs);
  const rulebook = rulebookFor(inputs.authority);
  const isDcpr = rulebook.id === 'DCPR_2034';
  const tod = todFsiFor(road.width, inputs.plotAreaConveyanceSqm, inputs.authority);
  const scheme = schemeFor(inputs.schemeType);
  const isRedev = isRedevelopmentScheme(inputs.schemeType);
  const ageQualifies = inputs.buildingAgeYears >= 30 || inputs.buildingStatus !== 'NORMAL';
  const todSelected = !isDcpr && (inputs.schemeType === 'TOD' || inputs.isTodZone);
  const rule = incentiveRuleFor(inputs.schemeType);

  // Selecting a scheme that belongs to the other rulebook cannot be honoured -
  // a UDCPR regulation does not run in Mumbai, and vice versa.
  const schemeMatchesRulebook = scheme.rulebook === rulebook.id;

  return [
    {
      id: 'rulebook',
      label: `${rulebook.name} governs this plot`,
      applies: true,
      reason: `${inputs.authority} sits in ${rulebook.region}, so entitlement is read from ${rulebook.table} and the loading is granted as ${rulebook.loadingLabel.toLowerCase()}.`,
      regulation: rulebook.regulation,
    },
    {
      id: 'scheme',
      label: scheme.label,
      applies: scheme.supported && schemeMatchesRulebook,
      reason: !schemeMatchesRulebook
        ? `${scheme.label} is a ${scheme.rulebook === 'UDCPR' ? 'UDCPR-2020' : 'DCPR-2034'} scheme and does not run under ${rulebook.name}. Pick a scheme from the governing rulebook.`
        : scheme.supported
          ? scheme.summary
          : (scheme.caveat ?? scheme.summary),
      regulation: scheme.regulation,
    },
    {
      id: 'tod',
      label: 'Transit Oriented Development',
      applies: todSelected && tod !== null,
      reason: isDcpr
        ? 'DCPR-2034 carries no UDCPR-style TOD table; Mumbai density is governed by Table 12 and the Reg. 33 schemes.'
        : !todSelected
          ? 'Plot is not within 500 m of a metro / MRTS station.'
          : tod === null
            ? `A ${road.width} m road is below the 9 m minimum for any TOD uplift.`
            : `Within the metro corridor on a ${road.width} m road, ${road.source} (${tod.label}) - maximum total FSI ${tod.maxFsi.toFixed(2)}.`,
      regulation: 'UDCPR Reg. 14.2.1.2, extended by Reg. 14.2.4',
    },
    {
      id: 'redevelopment',
      label: 'Redevelopment incentive FSI',
      applies: isRedev && ageQualifies,
      reason: !isRedev
        ? `The ${scheme.label} scheme carries no incentive FSI.`
        : ageQualifies
          ? `${rule.basis}. ${inputs.buildingStatus !== 'NORMAL' ? `Building is ${inputs.buildingStatus.toLowerCase()}.` : `Building is ${inputs.buildingAgeYears} years old (over 30).`}`
          : `Building is ${inputs.buildingAgeYears} years old. Incentive FSI needs over 30 years, or a dilapidated / dangerous declaration.`,
      regulation: rule.regulation,
    },
    {
      id: 'insitu',
      label: isDcpr ? 'Setback compensation FSI' : 'In-situ FSI against surrendered road land',
      applies: inputs.dpRoadAreaSqm > 0,
      reason:
        inputs.dpRoadAreaSqm > 0
          ? `${inputs.dpRoadAreaSqm} Sq.mt. surrendered ${isDcpr ? 'to the road setback' : 'under DP road'}, generating ${inSituMultiplierFor(inputs.areaCategory)}x${isDcpr ? '' : ` in a ${inputs.areaCategory === 'CONGESTED' ? 'congested' : 'non-congested'} area`}.`
          : `No land ${isDcpr ? 'under road setback' : 'under DP road or reservation'} is being surrendered.`,
      regulation: isDcpr ? 'DCPR-2034 Reg. 30' : 'UDCPR Reg. 11.2.4',
    },
    {
      id: 'ancillary',
      label: rulebook.loadingLabel,
      applies: true,
      reason: isDcpr
        ? 'Always available on payment of premium - 35% of proposed built-up for residential, 20% for commercial.'
        : 'Always available on payment of premium - 60% residential, 80% non-residential.',
      regulation: isDcpr ? 'DCPR-2034 Reg. 31(3)' : 'UDCPR Table 6-G, Note (i)',
    },
    ...(isDcpr
      ? [
          {
            id: 'pap',
            label: 'Additional FSI to 4.00 with PAP obligation',
            applies: inputs.schemeType === 'DCPR_33_20B',
            reason:
              inputs.schemeType === 'DCPR_33_20B'
                ? `Total FSI lifted to ${inputs.dcprMaxFsi.toFixed(2)} on the plot in possession, with ${(inputs.dcprPapSharePct * 100).toFixed(0)}% of the balance built-up area handed to MCGM as PAP stock.`
                : 'Not selected. Choosing this route lifts total FSI to 4.00 in exchange for the PAP obligation.',
            regulation: 'DCPR-2034 Reg. 33(20)(B)',
          },
        ]
      : []),
  ];
}

/**
 * Computes what every regulation-determined parameter should be, given the
 * primary inputs. Does not mutate; `resolveInputs` applies the result.
 */
export function deriveParameters(inputs: FeasibilityInputs): DerivedField[] {
  const overrides = new Set(inputs.overrides ?? []);
  const road = governingRoadWidth(inputs);
  const table = entitlementFor(road.width, inputs.authority);
  const tod = todFsiFor(road.width, inputs.plotAreaConveyanceSqm, inputs.authority);
  const rates = rateMasterFor(inputs.authority);
  const rulebook = rulebookFor(inputs.authority);
  const rule = incentiveRuleFor(inputs.schemeType);
  const todApplies = inputs.schemeType === 'TOD' || inputs.isTodZone;

  const isDcpr = rulebook.id === 'DCPR_2034';
  const dcpr = isDcpr ? dcprEntitlementFor(road.width, inputs.dcprLocation) : null;

  const band = isDcpr
    ? `${dcpr!.row.label} (${road.width} m, ${dcpr!.column})`
    : `${table.row.label} (${road.width} m, ${road.source})`;

  const out: DerivedField[] = [];
  const add = (
    key: keyof FeasibilityInputs,
    label: string,
    derivedValue: number,
    basis: string,
    regulation: string,
    unit?: string,
  ) => {
    const overridden = overrides.has(key);
    out.push({
      key,
      label,
      derivedValue,
      value: overridden ? (inputs[key] as number) : derivedValue,
      basis,
      regulation,
      overridden,
      unit,
    });
  };

  // ---- Entitlement, straight off the road-width tables ----
  // Greater Mumbai reads DCPR Table 12; everywhere else reads UDCPR Table 6-G.
  const basicFsi = isDcpr ? dcpr!.baseFsi : table.basicFsi;
  const premiumFsi = isDcpr ? dcpr!.premiumFsi : table.premiumFsi;
  const maxTdr = isDcpr ? dcpr!.maxTdr : table.maxTdr;
  const column = isDcpr ? dcpr!.column : table.column;

  add('basicFsi', 'Basic FSI', basicFsi, `${rulebook.table} band "${band}"`, rulebook.regulation);
  add(
    'premiumFsiRate',
    isDcpr ? 'Premium FSI purchasable from MCGM' : 'Premium FSI',
    premiumFsi,
    `${rulebook.table} band "${band}", ${column} column`,
    rulebook.regulation,
  );
  add(
    'maxTdrLoading',
    'Maximum TDR loading',
    maxTdr,
    `${rulebook.table} band "${band}", ${column} column`,
    rulebook.regulation,
  );

  // In a TOD zone the ceiling comes from the metro table instead; outside it the
  // ceiling is basic + premium + TDR from the entitlement table. DCPR has no
  // TOD table of its own, so the Table 12 potential governs.
  const nonTodCeiling = basicFsi + premiumFsi + maxTdr;
  add(
    'todMaxFsi',
    'Maximum permissible total FSI',
    isDcpr ? nonTodCeiling : todApplies && tod ? tod.maxFsi : nonTodCeiling,
    isDcpr
      ? `Basic ${basicFsi} + premium ${premiumFsi} + TDR ${maxTdr} from ${rulebook.table}`
      : todApplies && tod
        ? `Metro corridor, road band "${tod.label}"`
        : `Basic ${basicFsi} + premium ${premiumFsi} + TDR ${maxTdr} from ${rulebook.table}`,
    !isDcpr && todApplies && tod ? 'UDCPR Reg. 14.2.1.2 / 14.2.4' : rulebook.regulation,
  );

  if (isDcpr) {
    add(
      'dcprMaxFsi',
      'Maximum total FSI under Reg. 33(20)(B)',
      DCPR_33_20B_MAX_FSI,
      'Additional FSI route, against a PAP obligation on the balance built-up area',
      'DCPR-2034 Reg. 33(20)(B)',
    );
    add(
      'dcprPapSharePct',
      'PAP share of balance BUA',
      DCPR_PAP_SHARE,
      'Half the built-up area above the 33(7)(B) entitlement goes to MCGM',
      'DCPR-2034 Reg. 33(20)(B)',
    );
  }

  // The Mumbai rehab entitlement is built on existing built-up including
  // balcony. Where the user has not measured it, it follows from carpet.
  if (isDcpr && inputs.existingBuiltUpWithBalconySqm <= 0) {
    const existingCarpetSqm =
      (inputs.existingResidentialCarpetSqft + inputs.existingCommercialCarpetSqft) / SQM_TO_SQFT;
    add(
      'existingBuiltUpWithBalconySqm',
      'Existing built-up area including balconies',
      existingCarpetSqm * inputs.rehabBuaToCarpetFactor,
      `Existing carpet ${(existingCarpetSqm).toFixed(2)} Sq.mt. x ${inputs.rehabBuaToCarpetFactor}`,
      'DCPR-2034 rehab base',
      'sq.m',
    );
  }

  // Carpet loading differs by rulebook: UDCPR reports super built-up against
  // RERA carpet at 1.32, Mumbai works to 1.10 on built-up excluding fungible.
  add(
    'builtUpToCarpetFactor',
    'Built-up to carpet loading factor',
    isDcpr ? 1.1 : 1.32,
    isDcpr ? 'Mumbai convention - built-up excluding fungible, divided by 1.10' : 'Source report basis',
    isDcpr ? 'DCPR-2034 practice' : 'Project Report - Sita Smruti',
  );

  // ---- Surrendered land ----
  add(
    'inSituFsiMultiplier',
    'In-situ FSI multiplier',
    inSituMultiplierFor(inputs.areaCategory),
    `${inputs.areaCategory === 'CONGESTED' ? 'Congested' : 'Non-congested'} area`,
    'UDCPR Reg. 11.2.4',
  );

  // Inside a TOD zone, TDR must be taken in a 1:4 share alongside premium FSI.
  add(
    'minTdrLoadingPct',
    'Minimum TDR to be loaded',
    !isDcpr && todApplies ? 0.25 : 0,
    isDcpr
      ? 'DCPR-2034 sets no minimum TDR share'
      : todApplies
        ? 'TOD zone - TDR utilised in 1/4 share with premium FSI'
        : 'Not in a TOD zone, so no minimum share applies',
    !isDcpr && todApplies ? 'UDCPR Reg. 14.2.1.2.4(ii)' : 'n/a',
  );

  // ---- Ancillary FSI (UDCPR) / fungible compensatory area (DCPR) ----
  add(
    'ancillaryResidentialPct',
    `${rulebook.loadingLabel} - residential`,
    isDcpr ? FUNGIBLE_RESIDENTIAL_PCT : 0.6,
    'Residential use',
    isDcpr ? 'DCPR-2034 Reg. 31(3)' : 'UDCPR Table 6-G, Note (i)',
  );
  add(
    'ancillaryCommercialPct',
    `${rulebook.loadingLabel} - commercial`,
    isDcpr ? FUNGIBLE_COMMERCIAL_PCT : 0.8,
    'Non-residential use',
    isDcpr ? 'DCPR-2034 Reg. 31(3)' : 'UDCPR Table 6-G, Note (i)',
  );

  // ---- Redevelopment incentive, decided by the chosen scheme ----
  add('incentiveFsiPctOfExisting', 'Incentive FSI as % of existing BUA', rule.pctOfExisting, rule.basis, rule.regulation);
  add(
    'incentiveFsiPerTenementSqm',
    'Incentive FSI per tenement',
    rule.perTenementSqm,
    'Alternative basis - whichever is more',
    rule.regulation,
  );

  // ---- Charge rates ----
  // A Table 7-A use pays a reduced premium on its additional FSI. Mumbai buys
  // its premium FSI from the Corporation at half the Ready Reckoner rate.
  const premiumRate = isDcpr ? DCPR_PREMIUM_FSI_RATE : inputs.schemeType === 'HIGHER_FSI' ? 0.1 : 0.35;
  add(
    'premiumFsiChargeRate',
    'Premium rate on premium FSI',
    premiumRate,
    isDcpr
      ? '50% of the Ready Reckoner rate, payable to MCGM'
      : inputs.schemeType === 'HIGHER_FSI'
        ? 'Higher-FSI use - reduced premium (5% to 15% by category; 10% assumed)'
        : '35% of ASR',
    isDcpr
      ? 'DCPR-2034 Reg. 30(A)'
      : inputs.schemeType === 'HIGHER_FSI'
        ? 'UDCPR Table 7-A, column 4'
        : 'UDCPR Reg. 6.3, Note (viii)',
  );
  add(
    'ancillaryChargeRate',
    isDcpr ? 'Premium rate on fungible area' : 'Premium rate on ancillary FSI',
    isDcpr ? DCPR_FUNGIBLE_PREMIUM_RATE : 0.1,
    isDcpr ? '50% of the Ready Reckoner rate' : '10% of ASR',
    isDcpr ? 'DCPR-2034 Reg. 31(3)' : 'UDCPR Table 6-G, Note (i)',
  );

  // ---- Authority-specific rates from the rate master ----
  add(
    'asrRatePerSqm',
    'ASR / Ready Reckoner rate',
    rates.asrRatePerSqm,
    `${rates.label} rate master, effective ${rates.effectiveFrom}`,
    'Annual Statement of Rates',
    'Rs/sq.m',
  );
  add('labourTaxRatePerSqm', 'Labour tax rate', rates.labourTaxRatePerSqm, `${rates.label} rate master`, 'Labour Cess', 'Rs/sq.m');
  add(
    'fireCapitationRatePerSqm',
    'Fire capitation fee rate',
    rates.fireCapitationRatePerSqm,
    `${rates.label} rate master`,
    'Fire Infrastructure Charges',
    'Rs/sq.m',
  );

  return out;
}

/** Keys that derive automatically. Used by the UI to render them read-only. */
export const DERIVED_KEYS: ReadonlySet<string> = new Set([
  'basicFsi',
  'premiumFsiRate',
  'maxTdrLoading',
  'todMaxFsi',
  'dcprMaxFsi',
  'dcprPapSharePct',
  'existingBuiltUpWithBalconySqm',
  'builtUpToCarpetFactor',
  'inSituFsiMultiplier',
  'minTdrLoadingPct',
  'ancillaryResidentialPct',
  'ancillaryCommercialPct',
  'incentiveFsiPctOfExisting',
  'incentiveFsiPerTenementSqm',
  'premiumFsiChargeRate',
  'ancillaryChargeRate',
  'asrRatePerSqm',
  'labourTaxRatePerSqm',
  'fireCapitationRatePerSqm',
]);

/**
 * Applies every non-overridden derivation, returning the inputs the engine
 * should actually compute on. This is the single point where the cascade
 * happens, so the form, the API and the chatbot all get it for free.
 */
export function resolveInputs(inputs: FeasibilityInputs): {
  effective: FeasibilityInputs;
  derived: DerivedField[];
  schemes: SchemeStatus[];
} {
  const derived = deriveParameters(inputs);
  const effective = { ...inputs };

  for (const d of derived) {
    if (!d.overridden) {
      (effective as unknown as Record<string, unknown>)[d.key] = d.derivedValue;
    }
  }

  // The governing road width is what the entitlement was computed on, so the
  // engine must see it too.
  effective.roadWidthM = governingRoadWidth(inputs).width;

  // Selecting the TOD scheme implies the plot is in a metro corridor. DCPR has
  // no TOD route, so a Mumbai plot never carries the metro uplift.
  const rulebook = rulebookFor(inputs.authority);
  if (rulebook.id === 'DCPR_2034') effective.isTodZone = false;
  else if (inputs.schemeType === 'TOD') effective.isTodZone = true;

  // A building that does not qualify gets no incentive FSI at all, regardless
  // of what the rate says.
  const schemes = deriveSchemes(inputs);
  if (!schemes.find((s) => s.id === 'redevelopment')?.applies) {
    effective.incentiveFsiPctOfExisting = 0;
    effective.incentiveFsiPerTenementSqm = 0;
  }

  return { effective, derived, schemes };
}
