import {
  CRORE,
  SQM_TO_SQFT,
  entitlementFor,
  inSituMultiplierFor,
  isMumbai,
  rulebookFor,
  schemeFor,
  schemesForRulebook,
  type Rulebook,
} from './constants';
import { runPlausibilityChecks } from './checks';
import { DCPR_STAIRCASE_PREMIUM_RATE, computeDcprFsi } from './dcpr';
import { resolveInputs } from './derive';
import { formatArea, formatCrore, formatNumber, formatRupees, round } from './format';
import type {
  AreaBreakdown,
  ExpenseBreakdown,
  ExpenseHead,
  FeasibilityInputs,
  FeasibilityResult,
  FeasibilitySummary,
  FsiBreakdown,
  IncomeBreakdown,
  LineItem,
} from './types';
import { buildScore } from './score';
import { buildSections } from './document';

/**
 * Step 1 - Maximum permissible FSI, computed two ways.
 *
 * Path A follows UDCPR entitlement. Path B follows the redevelopment scheme
 * (Reg. 7.5 / 7.6). UDCPR Reg. 7.5 says the FSI allowed is whichever is more.
 *
 * Note the deliberate asymmetry required by Reg. 14.2.1.2.3: basic FSI is
 * computed on the plot area remaining after the DP road is surrendered, while
 * premium FSI and TDR are computed on the entire conveyance plot area.
 */
export function computeFsi(inputs: FeasibilityInputs): FsiBreakdown {
  // A Greater Mumbai plot is not on UDCPR at all - it runs the DCPR-2034 chain.
  if (isMumbai(inputs.authority)) return computeFsiDcpr(inputs);

  const balancePlotAreaSqm = inputs.plotAreaConveyanceSqm - inputs.dpRoadAreaSqm;

  // --- Path A: as per UDCPR ---
  const basicFsiAreaSqm = balancePlotAreaSqm * inputs.basicFsi;

  // Entitlement over and above basic FSI. In a TOD zone this is the headroom up
  // to the sanctioned TOD ceiling; elsewhere it is premium FSI + max TDR loading
  // from Table 6-G.
  const additionalFsiRate = inputs.isTodZone
    ? Math.max(0, inputs.todMaxFsi - inputs.basicFsi)
    : inputs.premiumFsiRate + inputs.maxTdrLoading;

  const premiumFsiAreaSqm = additionalFsiRate * inputs.plotAreaConveyanceSqm;
  const minTdrToBeLoadedSqm = premiumFsiAreaSqm * inputs.minTdrLoadingPct;
  const inSituFsiSqm = inputs.dpRoadAreaSqm * inputs.inSituFsiMultiplier;
  const balancePremiumFsiSqm = Math.max(0, premiumFsiAreaSqm - inSituFsiSqm);
  const pathATotal = basicFsiAreaSqm + inSituFsiSqm + balancePremiumFsiSqm;

  // --- Path B: as per the redevelopment scheme ---
  const existingBuiltUpSqm = inputs.existingBuiltUpAreaSqm;
  const incentiveByPct = existingBuiltUpSqm * inputs.incentiveFsiPctOfExisting;
  const incentiveByTenement = inputs.incentiveFsiPerTenementSqm * inputs.residentialTenements;
  const incentiveFsiSqm = Math.max(incentiveByPct, incentiveByTenement);
  const incentiveBasis =
    incentiveByTenement >= incentiveByPct
      ? `${formatNumber(inputs.incentiveFsiPerTenementSqm)} Sq.mt. x ${inputs.residentialTenements} tenements`
      : `${formatNumber(inputs.incentiveFsiPctOfExisting * 100)}% x ${formatArea(existingBuiltUpSqm)}`;

  // Reg. 7.6.1(ii): a tenement occupying less than 27.87 Sq.mt. carpet is
  // entitled to that minimum, and the shortfall is allowed as FSI without
  // premium. It lifts both the entitlement and what must be handed back.
  const isRedevScheme = inputs.schemeType === 'SOCIETY_REDEV' || inputs.schemeType === 'TENANTED_REDEV';
  const MIN_CARPET_SQM = 27.87;
  const avgCarpet = inputs.avgExistingCarpetPerTenementSqm;
  const shortfallPerTenement = avgCarpet > 0 ? Math.max(0, MIN_CARPET_SQM - avgCarpet) : 0;
  const minCarpetTopUpSqm = isRedevScheme ? shortfallPerTenement * inputs.residentialTenements : 0;
  const minCarpetBasis =
    avgCarpet <= 0
      ? 'Average existing carpet per tenement not given, so the minimum-carpet top-up is skipped.'
      : shortfallPerTenement > 0
        ? `(${formatNumber(MIN_CARPET_SQM)} - ${formatNumber(avgCarpet)}) Sq.mt. x ${inputs.residentialTenements} tenements, allowed without premium`
        : `Average carpet of ${formatNumber(avgCarpet)} Sq.mt. already meets the ${formatNumber(MIN_CARPET_SQM)} Sq.mt. minimum.`;

  const premiumFsiSqm = inputs.premiumFsiRate * inputs.plotAreaConveyanceSqm;

  const balanceTdrFsiSqm = Math.max(
    0,
    pathATotal - existingBuiltUpSqm - incentiveFsiSqm - minCarpetTopUpSqm - premiumFsiSqm,
  );
  const pathBInSitu = inputs.dpRoadAreaSqm * inputs.inSituFsiMultiplier;
  const tdrToPurchaseSqm = Math.max(0, balanceTdrFsiSqm - pathBInSitu);
  const pathBTotal =
    existingBuiltUpSqm + incentiveFsiSqm + minCarpetTopUpSqm + premiumFsiSqm + pathBInSitu + tdrToPurchaseSqm;

  const governingPath = pathBTotal > pathATotal ? 'B' : 'A';

  // The scheme incentive exists so the members can be given more than they had.
  // Where it lifts the entitlement above what Chapter 6 alone permits, that
  // additional area belongs to the members, not to the sale pool - which is
  // what keeps the income line invariant to the scheme selected.
  const memberIncentiveBuaSqm =
    inputs.incentiveAreaTreatment === 'RETAINED_BY_MEMBERS' ? Math.max(0, pathBTotal - pathATotal) : 0;

  return {
    balancePlotAreaSqm,
    pathA: {
      basicFsiAreaSqm,
      premiumFsiAreaSqm,
      minTdrToBeLoadedSqm,
      inSituFsiSqm,
      balancePremiumFsiSqm,
      totalSqm: pathATotal,
    },
    pathB: {
      existingBuiltUpSqm,
      incentiveFsiSqm,
      incentiveBasis,
      minCarpetTopUpSqm,
      minCarpetBasis,
      premiumFsiSqm,
      balanceTdrFsiSqm,
      inSituFsiSqm: pathBInSitu,
      tdrToPurchaseSqm,
      totalSqm: pathBTotal,
    },
    governingPath,
    totalPermissibleBuaSqm: Math.max(pathATotal, pathBTotal),
    memberIncentiveBuaSqm,
  };
}

/**
 * Step 1, Greater Mumbai - the DCPR-2034 entitlement chain.
 *
 * The shape of the answer is the same, so it is projected onto the same
 * FsiBreakdown: Path A is the Reg. 33(7)(B) entitlement read off Table 12,
 * Path B is the Reg. 33(20)(B) route that lifts the plot to 4.00 FSI against a
 * PAP obligation. The DCPR-specific detail rides along in `dcpr`.
 */
export function computeFsiDcpr(inputs: FeasibilityInputs): FsiBreakdown {
  const d = computeDcprFsi(inputs);

  return {
    balancePlotAreaSqm: d.netPlotAreaSqm,
    pathA: {
      basicFsiAreaSqm: d.baseBuaSqm,
      premiumFsiAreaSqm: d.govtFsiSqm + d.tdrEntitlementSqm,
      minTdrToBeLoadedSqm: 0,
      inSituFsiSqm: d.setbackCompensationSqm,
      balancePremiumFsiSqm: d.govtFsiSqm,
      totalSqm: d.buaUnder33_7BSqm,
    },
    pathB: {
      existingBuiltUpSqm: inputs.existingBuiltUpWithBalconySqm,
      // Under DCPR the "incentive" is the additional area negotiated with the
      // society, delivered through the rehab component rather than as FSI.
      incentiveFsiSqm: Math.max(0, d.rehabBuaSqm - inputs.existingBuiltUpWithBalconySqm),
      incentiveBasis: `${(inputs.additionalCarpetToTenantsPct * 100).toFixed(0)}% additional area on ${formatArea(inputs.existingBuiltUpWithBalconySqm)} of existing built-up including balcony`,
      minCarpetTopUpSqm: 0,
      minCarpetBasis: 'Not applicable under DCPR-2034.',
      premiumFsiSqm: d.govtFsiSqm,
      balanceTdrFsiSqm: d.tdrEntitlementSqm,
      inSituFsiSqm: d.setbackCompensationSqm,
      tdrToPurchaseSqm: d.tdrToPurchaseSqm,
      totalSqm: d.usesCeiling ? d.ceilingBuaSqm : d.buaUnder33_7BSqm,
    },
    governingPath: d.usesCeiling && d.ceilingBuaSqm > d.buaUnder33_7BSqm ? 'B' : 'A',
    totalPermissibleBuaSqm: d.totalBuaSqm,
    // Mumbai carves the rehab component out explicitly in computeAreas, so
    // there is no separate incentive area to hold back here.
    memberIncentiveBuaSqm: 0,
    dcpr: d,
  };
}

/**
 * Caps the permissible area to what the proposed massing can actually hold.
 *
 * "Max potential" appraises the full entitlement. "Design" caps built-up to
 * floors x footprint, which is what a real sanction ends up at once marginal
 * distances and massing bite. Setbacks are not modelled here, so the footprint
 * comes from a ground-coverage assumption - indicative, not a sanction figure.
 */
export function applyMassingCap(inputs: FeasibilityInputs, fsi: FsiBreakdown): { capped: number; note?: string } {
  if (inputs.analysisBasis !== 'DESIGN_CAPPED' || inputs.floors <= 0) {
    return { capped: fsi.totalPermissibleBuaSqm };
  }
  const footprint = fsi.balancePlotAreaSqm * (inputs.groundCoveragePct / 100);
  const designArea = footprint * inputs.floors;
  if (designArea >= fsi.totalPermissibleBuaSqm) {
    return {
      capped: fsi.totalPermissibleBuaSqm,
      note: `${inputs.floors} floors at ${inputs.groundCoveragePct}% coverage can hold ${formatArea(designArea)}, which exceeds the entitlement - no cap applied.`,
    };
  }
  return {
    capped: designArea,
    note: `Capped to ${inputs.floors} floors x ${formatArea(footprint)} footprint at ${inputs.groundCoveragePct}% ground coverage. ${formatArea(fsi.totalPermissibleBuaSqm - designArea)} of entitlement is left unbuilt.`,
  };
}

/** Steps 2 and 3 - ancillary FSI and saleable RERA carpet area. */
export function computeAreas(inputs: FeasibilityInputs, fsi: FsiBreakdown): AreaBreakdown {
  const total = applyMassingCap(inputs, fsi).capped;

  const commercialBuaSqm =
    inputs.commercialSplitMode === 'ABSOLUTE'
      ? Math.min(inputs.commercialAreaSqm, total)
      : total * (inputs.commercialSharePct / 100);
  const residentialBuaSqm = total - commercialBuaSqm;

  const ancillaryCommercialSqm = commercialBuaSqm * inputs.ancillaryCommercialPct;
  const ancillaryResidentialSqm = residentialBuaSqm * inputs.ancillaryResidentialPct;
  const totalAncillarySqm = ancillaryCommercialSqm + ancillaryResidentialSqm;

  const totalBuaInclAncillarySqm = total + totalAncillarySqm;
  const totalBuaInclAncillarySqft = totalBuaInclAncillarySqm * SQM_TO_SQFT;
  const commercialBuaInclAncillarySqm = commercialBuaSqm + ancillaryCommercialSqm;
  const residentialBuaInclAncillarySqm = residentialBuaSqm + ancillaryResidentialSqm;

  const isDcpr = Boolean(fsi.dcpr);

  // Both rulebooks divide the loaded built-up figure to get carpet; only the
  // loading differs - 1.32 on a UDCPR super built-up basis, 1.10 in Mumbai.
  const approxReraCarpetSqft = totalBuaInclAncillarySqft / inputs.builtUpToCarpetFactor;

  // A MOFA-to-RERA conversion only applies where the existing agreements are on
  // MOFA carpet. Mumbai society records are already RERA carpet.
  const existingResidentialReraCarpetSqft =
    inputs.existingResidentialCarpetSqft * (isDcpr ? 1 : inputs.mofaToReraFactor);
  const existingCommercialCarpetSqft = inputs.existingCommercialCarpetSqft;
  const totalExistingReraCarpetSqft = existingResidentialReraCarpetSqft + existingCommercialCarpetSqft;

  // The uplift is offered on flats only - shops get back what they had. On top
  // of it, Reg. 7.6.1(ii) forces each tenement up to 27.87 Sq.mt. carpet where
  // it falls short, and that area also leaves the saleable pool.
  const minCarpetTopUpSqft = fsi.pathB.minCarpetTopUpSqm * SQM_TO_SQFT;
  const udcprUpliftSqft =
    existingResidentialReraCarpetSqft * inputs.additionalCarpetToTenantsPct + minCarpetTopUpSqft;

  // Under DCPR the rehab obligation is stated in built-up terms - existing BUA
  // including balcony, grossed up by the additional area offered - so the
  // members' carpet and the uplift both fall out of that one figure.
  const rehabCarpetSqft = isDcpr
    ? (fsi.dcpr!.rehabBuaSqm * SQM_TO_SQFT) / inputs.rehabBuaToCarpetFactor
    : 0;
  const additionalCarpetToTenantsSqft = isDcpr
    ? Math.max(0, rehabCarpetSqft - totalExistingReraCarpetSqft)
    : udcprUpliftSqft;

  // Scheme incentive area retained by the members, converted to carpet on the
  // same loading as the rest of the building.
  const blendedLoading = total > 0 ? totalBuaInclAncillarySqm / total : 1;
  const incentiveCarpetToMembersSqft =
    (fsi.memberIncentiveBuaSqm * blendedLoading * SQM_TO_SQFT) / inputs.builtUpToCarpetFactor;

  // Mumbai nets the rehab built-up straight off the loaded total, which is how
  // the client's own Versova working arrives at its sale carpet figure.
  const developerBalanceCarpetSqft = isDcpr
    ? ((totalBuaInclAncillarySqm - fsi.dcpr!.rehabBuaSqm) * SQM_TO_SQFT) / inputs.builtUpToCarpetFactor
    : approxReraCarpetSqft -
      totalExistingReraCarpetSqft -
      additionalCarpetToTenantsSqft -
      incentiveCarpetToMembersSqft;

  const totalHandBackCarpetSqft = isDcpr
    ? rehabCarpetSqft
    : totalExistingReraCarpetSqft + additionalCarpetToTenantsSqft + incentiveCarpetToMembersSqft;

  // The sale mix follows the building mix. The shops in the new building are
  // the commercial area, so the commercial share of what the developer is left
  // to sell is the commercial share of the building itself. It is taken on the
  // loaded built-up figure rather than the raw entitlement because commercial
  // and residential carry different ancillary loading, and it is the loaded
  // area the hand-back is drawn out of. On the source report that ratio is
  // 9.3735%, which is the 9.4% the document itself worked to.
  const loadedCommercialShare =
    totalBuaInclAncillarySqm > 0 ? commercialBuaInclAncillarySqm / totalBuaInclAncillarySqm : 0;

  const developerCommercialCarpetSqft =
    inputs.developerSplitMode === 'ABSOLUTE'
      ? Math.min(inputs.developerCommercialCarpetSqft, Math.max(0, developerBalanceCarpetSqft))
      : inputs.developerSplitMode === 'PERCENT'
        ? Math.max(0, developerBalanceCarpetSqft) * (inputs.developerCommercialSharePct / 100)
        : Math.max(0, developerBalanceCarpetSqft) * loadedCommercialShare;
  const developerResidentialCarpetSqft = developerBalanceCarpetSqft - developerCommercialCarpetSqft;

  return {
    commercialBuaSqm,
    residentialBuaSqm,
    ancillaryCommercialSqm,
    ancillaryResidentialSqm,
    totalAncillarySqm,
    totalBuaInclAncillarySqm,
    totalBuaInclAncillarySqft,
    commercialBuaInclAncillarySqm,
    residentialBuaInclAncillarySqm,
    approxReraCarpetSqft,
    existingResidentialReraCarpetSqft,
    existingCommercialCarpetSqft,
    totalExistingReraCarpetSqft,
    additionalCarpetToTenantsSqft,
    incentiveCarpetToMembersSqft,
    developerBalanceCarpetSqft,
    developerResidentialCarpetSqft,
    developerCommercialCarpetSqft,
    totalHandBackCarpetSqft,
  };
}

/** Step 4 - income from sale of the developer's balance carpet area. */
export function computeIncome(inputs: FeasibilityInputs, areas: AreaBreakdown): IncomeBreakdown {
  const residentialIncome = areas.developerResidentialCarpetSqft * inputs.residentialSaleRatePerSqft;
  const commercialIncome = areas.developerCommercialCarpetSqft * inputs.commercialSaleRatePerSqft;
  return {
    residentialIncome,
    commercialIncome,
    totalIncome: residentialIncome + commercialIncome,
  };
}

function head(id: string, label: string, items: LineItem[], approximate = false): ExpenseHead {
  return { id, label, amount: items.reduce((s, i) => s + i.value, 0), items, approximate };
}

/** Step 5 - the full expenditure side. */
export function computeExpenses(
  inputs: FeasibilityInputs,
  fsi: FsiBreakdown,
  areas: AreaBreakdown,
  income: IncomeBreakdown,
  customItems: LineItem[] = [],
): ExpenseBreakdown {
  const asr = inputs.asrRatePerSqm;
  const rulebook = rulebookFor(inputs.authority);
  const dcpr = fsi.dcpr;

  // --- 5a. Premium & ancillary charges to the authority ---
  // The charge falls on the 0.5 premium FSI component of the redevelopment
  // scheme, not on the full TOD headroom. Under DCPR it falls on the FSI
  // actually purchased from the Corporation, computed on the net plot.
  const premiumChargeableAreaSqm = dcpr ? dcpr.govtFsiSqm : inputs.premiumFsiRate * inputs.plotAreaConveyanceSqm;
  const premiumPayment = premiumChargeableAreaSqm * inputs.premiumFsiChargeRate * asr;

  // The members' rehab component carries its loading free of premium; only the
  // saleable share of the fungible / ancillary area is charged.
  const chargeableLoadingSqm = dcpr
    ? Math.max(0, areas.totalAncillarySqm - dcpr.rehabFungibleSqm)
    : areas.totalAncillarySqm;
  const ancillaryPayment = chargeableLoadingSqm * inputs.ancillaryChargeRate * asr;

  const premiumItems: LineItem[] = [
    {
      id: 'exp.premium.fsi',
      label: dcpr ? 'Premium FSI purchased from MCGM' : 'Payment towards premium FSI',
      value: premiumPayment,
      unit: 'inr',
      formula: `${formatArea(premiumChargeableAreaSqm)} x ${inputs.premiumFsiChargeRate} x Rs. ${formatRupees(asr)}`,
      regulation: dcpr ? 'DCPR-2034 Reg. 30(A) - 50% of RR' : 'UDCPR Reg. 6.3, Note (viii) - 35% of ASR',
      drivenBy: 'premiumFsiChargeRate',
    },
    {
      id: 'exp.premium.ancillary',
      label: dcpr ? 'Premium on saleable fungible area' : 'Payment towards ancillary area',
      value: ancillaryPayment,
      unit: 'inr',
      formula: `${formatArea(chargeableLoadingSqm)} x ${inputs.ancillaryChargeRate * 100}% x Rs. ${formatRupees(asr)}`,
      regulation: dcpr ? 'DCPR-2034 Reg. 31(3)' : 'UDCPR Table 6-G, Note (i)',
      note: dcpr ? "The members' rehab fungible area is not charged." : undefined,
      drivenBy: 'ancillaryChargeRate',
    },
  ];

  // Two Mumbai-only heads, both material on a 33(20)(B) scheme.
  if (dcpr) {
    premiumItems.push(
      {
        id: 'exp.premium.pap',
        label: 'PAP obligation to MCGM',
        value: dcpr.papBuaSqm * inputs.dcprPapRatePerSqm,
        unit: 'inr',
        formula:
          dcpr.papBuaSqm > 0
            ? `${formatArea(dcpr.papBuaSqm)} x Rs. ${formatRupees(inputs.dcprPapRatePerSqm)}/Sq.mt.`
            : 'Not applicable on this scheme',
        regulation: 'DCPR-2034 Reg. 33(20)(B)',
        note:
          dcpr.papBuaSqm > 0
            ? `${(inputs.dcprPapSharePct * 100).toFixed(0)}% of the ${formatArea(dcpr.balanceBuaSqm)} of built-up area above the 33(7)(B) entitlement.`
            : undefined,
        drivenBy: 'dcprPapRatePerSqm',
      },
      {
        id: 'exp.premium.staircase',
        label: 'Staircase, lift and lobby premium',
        value: dcpr.staircasePremiumAreaSqm * DCPR_STAIRCASE_PREMIUM_RATE * asr,
        unit: 'inr',
        formula:
          dcpr.staircasePremiumAreaSqm > 0
            ? `${formatArea(dcpr.staircasePremiumAreaSqm)} x ${DCPR_STAIRCASE_PREMIUM_RATE * 100}% x Rs. ${formatRupees(asr)}`
            : 'Enter the staircase area per floor and the number of floors to price this line',
        regulation: 'DCPR-2034 - free of FSI on payment of premium',
        drivenBy: 'dcprStaircaseAreaPerFloorSqm',
      },
    );
  }

  const premiumAndAncillary = head(
    'premiumAndAncillary',
    `${rulebook.loadingLabel} & Premium Charges to Corporation / Govt.`,
    premiumItems,
  );

  // --- 5b. Development charges (Corporation and Metro are levied separately) ---
  const landDevCorp = inputs.landDevChargeMbmcPct * inputs.plotAreaConveyanceSqm * asr;
  const landDevMetro = inputs.landDevChargeMetroPct * inputs.plotAreaConveyanceSqm * asr;
  const devCommCorp = inputs.devChargeCommercialPct * areas.commercialBuaInclAncillarySqm * asr;
  const devCommMetro = devCommCorp;
  const devResCorp = inputs.devChargeResidentialPct * areas.residentialBuaInclAncillarySqm * asr;
  const devResMetro = devResCorp;

  const scrutinyPlotPart = Math.round(
    (inputs.scrutinyFeePerPlotUnit * inputs.plotAreaConveyanceSqm) / inputs.scrutinyFeePlotDivisor,
  );
  const scrutinyBuaPart = Math.round(areas.totalBuaInclAncillarySqm * inputs.scrutinyFeePerSqmBua);
  const scrutinyFee = scrutinyPlotPart + scrutinyBuaPart;

  const devFeeUncapped = areas.totalBuaInclAncillarySqm * inputs.devFeeMultiplier * inputs.devFeeRatePerSqm;
  const devFee = Math.min(devFeeUncapped, inputs.devFeeCap);

  const labourBase = areas.totalBuaInclAncillarySqm + (inputs.includePodiumInLabourTax ? inputs.podiumAreaSqm : 0);
  const labourTax = inputs.labourTaxPct * labourBase * inputs.labourTaxRatePerSqm;

  const fireBase = areas.totalBuaInclAncillarySqm + (inputs.includePodiumInFireFee ? inputs.podiumAreaSqm : 0);
  const fireFee = inputs.fireCapitationRatePerSqm * fireBase;

  // Reg. 7.6, Note 3 - a redevelopment pays an additional Development Cess on
  // the built-up area over and above the base FSI. The rate is set by
  // Government order, so it stays zero until the client supplies it.
  const baseFsiAreaSqm = inputs.basicFsi * inputs.plotAreaConveyanceSqm;
  const areaAboveBaseFsi = Math.max(0, areas.totalBuaInclAncillarySqm - baseFsiAreaSqm);
  const redevCess = inputs.redevCessRatePerSqm * areaAboveBaseFsi;

  const developmentCharges = head('developmentCharges', 'Development Charges', [
    {
      id: 'exp.dev.landCorp',
      label: 'Land development charges (Corporation)',
      value: landDevCorp,
      unit: 'inr',
      formula: `${inputs.landDevChargeMbmcPct * 100}% x ${formatArea(inputs.plotAreaConveyanceSqm)} x Rs. ${formatRupees(asr)}`,
      drivenBy: 'landDevChargeMbmcPct',
    },
    {
      id: 'exp.dev.landMetro',
      label: 'Land development charges (Metro)',
      value: landDevMetro,
      unit: 'inr',
      formula: `${inputs.landDevChargeMetroPct * 100}% x ${formatArea(inputs.plotAreaConveyanceSqm)} x Rs. ${formatRupees(asr)}`,
      drivenBy: 'landDevChargeMetroPct',
    },
    {
      id: 'exp.dev.commCorp',
      label: 'Development charges - Commercial (Corporation)',
      value: devCommCorp,
      unit: 'inr',
      formula: `${inputs.devChargeCommercialPct * 100}% x ${formatArea(areas.commercialBuaInclAncillarySqm)} x Rs. ${formatRupees(asr)}`,
      drivenBy: 'devChargeCommercialPct',
    },
    {
      id: 'exp.dev.commMetro',
      label: 'Development charges - Commercial (Metro)',
      value: devCommMetro,
      unit: 'inr',
      formula: `${inputs.devChargeCommercialPct * 100}% x ${formatArea(areas.commercialBuaInclAncillarySqm)} x Rs. ${formatRupees(asr)}`,
      drivenBy: 'devChargeCommercialPct',
    },
    {
      id: 'exp.dev.resCorp',
      label: 'Development charges - Residential (Corporation)',
      value: devResCorp,
      unit: 'inr',
      formula: `${inputs.devChargeResidentialPct * 100}% x ${formatArea(areas.residentialBuaInclAncillarySqm)} x Rs. ${formatRupees(asr)}`,
      drivenBy: 'devChargeResidentialPct',
    },
    {
      id: 'exp.dev.resMetro',
      label: 'Development charges - Residential (Metro)',
      value: devResMetro,
      unit: 'inr',
      formula: `${inputs.devChargeResidentialPct * 100}% x ${formatArea(areas.residentialBuaInclAncillarySqm)} x Rs. ${formatRupees(asr)}`,
      drivenBy: 'devChargeResidentialPct',
    },
    {
      id: 'exp.dev.scrutiny',
      label: 'Scrutiny fee',
      value: scrutinyFee,
      unit: 'inr',
      formula: `(Rs. ${formatRupees(inputs.scrutinyFeePerPlotUnit)} x ${formatNumber(inputs.plotAreaConveyanceSqm)} / ${formatNumber(inputs.scrutinyFeePlotDivisor, 0)}) + (${formatArea(areas.totalBuaInclAncillarySqm)} x Rs. ${inputs.scrutinyFeePerSqmBua})`,
      drivenBy: 'scrutinyFeePerSqmBua',
    },
    {
      id: 'exp.dev.fee',
      label: 'Development fee',
      value: devFee,
      unit: 'inr',
      formula: `min(${formatArea(areas.totalBuaInclAncillarySqm)} x ${inputs.devFeeMultiplier} x Rs. ${inputs.devFeeRatePerSqm} = Rs. ${formatRupees(devFeeUncapped)}, cap Rs. ${formatRupees(inputs.devFeeCap)})`,
      note: devFeeUncapped > inputs.devFeeCap ? 'Capped' : undefined,
      drivenBy: 'devFeeCap',
    },
    {
      id: 'exp.dev.labour',
      label: 'Labour tax',
      value: labourTax,
      unit: 'inr',
      formula: `${inputs.labourTaxPct * 100}% x ${formatArea(labourBase)} x Rs. ${formatRupees(inputs.labourTaxRatePerSqm)}`,
      note: inputs.includePodiumInLabourTax
        ? `Includes ${formatArea(inputs.podiumAreaSqm)} assumed podium area`
        : undefined,
      drivenBy: 'labourTaxRatePerSqm',
    },
    {
      id: 'exp.dev.fire',
      label: 'Fire capitation fee',
      value: fireFee,
      unit: 'inr',
      formula: `Rs. ${inputs.fireCapitationRatePerSqm} x ${formatArea(fireBase)}`,
      note: inputs.includePodiumInFireFee
        ? `Includes ${formatArea(inputs.podiumAreaSqm)} assumed podium area`
        : undefined,
      drivenBy: 'fireCapitationRatePerSqm',
    },
    {
      id: 'exp.dev.redevCess',
      label: 'Redevelopment Development Cess (over base FSI)',
      value: redevCess,
      unit: 'inr',
      formula:
        inputs.redevCessRatePerSqm > 0
          ? `${formatArea(areaAboveBaseFsi)} above base FSI x Rs. ${formatRupees(inputs.redevCessRatePerSqm)}`
          : 'Not priced',
      regulation: 'UDCPR Reg. 7.6, Note 3',
      note:
        inputs.redevCessRatePerSqm > 0
          ? undefined
          : 'The rate is set by Government order and varies by authority. Enter it to price this line.',
      drivenBy: 'redevCessRatePerSqm',
    },
  ]);

  // --- 5c. TDR ---
  const tdrToPurchaseSqft = fsi.pathB.tdrToPurchaseSqm * SQM_TO_SQFT;
  const tdrCost = head('tdrCost', 'TDR Cost', [
    {
      id: 'exp.tdr',
      label: `Cost of TDR @ Rs. ${formatRupees(inputs.tdrRatePerSqft)}/Sq.ft. (incl. 18% GST)`,
      value: tdrToPurchaseSqft * inputs.tdrRatePerSqft,
      unit: 'inr',
      formula: `${formatArea(fsi.pathB.tdrToPurchaseSqm)} x ${SQM_TO_SQFT} x Rs. ${formatRupees(inputs.tdrRatePerSqft)}`,
      regulation: 'UDCPR Reg. 11.2 - TDR utilisation',
      drivenBy: 'tdrRatePerSqft',
    },
  ]);

  // --- 5d. Construction and project costs ---
  const sqft = areas.totalBuaInclAncillarySqft;

  // The construction rate can be quoted against saleable super built-up, plain
  // built-up, or carpet. Getting this wrong moves the biggest cost line by
  // 25-30%, so it is an explicit choice rather than an assumption.
  // Ancillary area is physically constructed, so it belongs in every basis.
  // The three differ by loading: carpet < built-up (carpet + walls) < super
  // built-up (carpet + walls + common areas), which is the saleable figure.
  const costBasisArea =
    inputs.constructionCostBasis === 'CARPET'
      ? areas.approxReraCarpetSqft
      : inputs.constructionCostBasis === 'BUILTUP'
        ? areas.approxReraCarpetSqft * inputs.carpetToBuiltUpFactor
        : sqft;
  const costBasisLabel =
    inputs.constructionCostBasis === 'CARPET'
      ? 'RERA carpet'
      : inputs.constructionCostBasis === 'BUILTUP'
        ? `built-up (carpet x ${inputs.carpetToBuiltUpFactor})`
        : 'super built-up (saleable)';

  const incidentals = head(
    'incidentals',
    'Other Incidental Expenses till OC',
    [
      {
        id: 'exp.incidentals',
        label: 'Incidental expenses till Occupation Certificate',
        value: sqft * inputs.incidentalRatePerSqft,
        unit: 'inr',
        formula: `Rs. ${inputs.incidentalRatePerSqft} x ${formatArea(sqft, 'sqft')}`,
        note: 'The source report states a different area basis on this line; see the reconciliation note.',
        drivenBy: 'incidentalRatePerSqft',
      },
    ],
    true,
  );

  const construction = head(
    'construction',
    'Cost of Construction',
    [
      {
        id: 'exp.construction',
        label: `Cost of construction @ Rs. ${formatRupees(inputs.constructionRatePerSqft)}/Sq.ft. (incl. 18% GST)`,
        value: costBasisArea * inputs.constructionRatePerSqft,
        unit: 'inr',
        formula: `${formatArea(costBasisArea, 'sqft')} x Rs. ${formatRupees(inputs.constructionRatePerSqft)}`,
        note: `Rate applied to ${costBasisLabel}`,
        drivenBy: 'constructionRatePerSqft',
      },
    ],
    true,
  );

  const professionalFees = head('professionalFees', 'Professional Fees', [
    {
      id: 'exp.professional',
      label: `Professional fees @ Rs. ${inputs.professionalFeeRatePerSqft}/Sq.ft.`,
      value: sqft * inputs.professionalFeeRatePerSqft,
      unit: 'inr',
      formula: `${formatArea(sqft, 'sqft')} x Rs. ${inputs.professionalFeeRatePerSqft}`,
      note: 'Planning, designing, MEP, PMC, structural engineer',
      drivenBy: 'professionalFeeRatePerSqft',
    },
  ]);

  const agentCommission = head('agentCommission', 'Commission to Agents & Advertising', [
    {
      id: 'exp.commission',
      label: `${inputs.agentCommissionPct * 100}% commission to agents and advertising`,
      value: income.totalIncome * inputs.agentCommissionPct,
      unit: 'inr',
      formula: `${formatCrore(income.totalIncome)} x ${inputs.agentCommissionPct * 100}%`,
      drivenBy: 'agentCommissionPct',
    },
  ]);

  const officeExpense = head('officeExpense', 'Office Expense of Developers', [
    {
      id: 'exp.office',
      label: 'Developer office expense',
      value: inputs.officeExpensePerMonth * inputs.constructionPeriodMonths,
      unit: 'inr',
      formula: `Rs. ${formatRupees(inputs.officeExpensePerMonth)} x ${inputs.constructionPeriodMonths} months`,
      drivenBy: 'officeExpensePerMonth',
    },
  ]);

  // --- 5e. Rent and displacement, on the tenants' EXISTING carpet area ---
  const months = inputs.constructionPeriodMonths;
  const shopRent = inputs.existingCommercialCarpetSqft * inputs.shopRentPerSqftPerMonth * months;
  const flatRent = inputs.existingResidentialCarpetSqft * inputs.flatRentPerSqftPerMonth * months;
  const brokerage = inputs.brokerageUnitCount * inputs.brokeragePerUnit * inputs.brokerageCycles;

  const rentAndServices = head('rentAndServices', `Rent & Other Services (${months} months)`, [
    {
      id: 'exp.rent.shops',
      label: 'Shops',
      value: shopRent,
      unit: 'inr',
      formula: `Rs. ${inputs.shopRentPerSqftPerMonth}/Sq.ft. x ${formatArea(inputs.existingCommercialCarpetSqft, 'sqft')} x ${months} months`,
      drivenBy: 'shopRentPerSqftPerMonth',
    },
    {
      id: 'exp.rent.flats',
      label: 'Flats',
      value: flatRent,
      unit: 'inr',
      formula: `Rs. ${inputs.flatRentPerSqftPerMonth}/Sq.ft. x ${formatArea(inputs.existingResidentialCarpetSqft, 'sqft')} x ${months} months`,
      drivenBy: 'flatRentPerSqftPerMonth',
    },
    {
      id: 'exp.rent.brokerage',
      label: 'Commission for rent',
      value: brokerage,
      unit: 'inr',
      formula: `${inputs.brokerageUnitCount} units x Rs. ${formatRupees(inputs.brokeragePerUnit)} x ${inputs.brokerageCycles}`,
      drivenBy: 'brokeragePerUnit',
    },
  ]);

  // --- 5f. Ancillary project expenses, entered by the builder ---
  const ancillaryRateAmount = sqft * inputs.ancillaryExpenseRatePerSqft;
  const ancillaryExpenses = head('ancillaryExpenses', 'Ancillary Expenses', [
    {
      id: 'exp.ancillary.lump',
      label: 'Ancillary expenses (lump sum)',
      value: inputs.ancillaryExpenseLumpSum,
      unit: 'inr',
      note: 'Society liaison, NOCs, surveys, temporary services and deposits.',
      drivenBy: 'ancillaryExpenseLumpSum',
    },
    {
      id: 'exp.ancillary.rate',
      label: `Ancillary expenses @ Rs. ${formatRupees(inputs.ancillaryExpenseRatePerSqft)}/Sq.ft.`,
      value: ancillaryRateAmount,
      unit: 'inr',
      formula:
        inputs.ancillaryExpenseRatePerSqft > 0
          ? `Rs. ${formatRupees(inputs.ancillaryExpenseRatePerSqft)} x ${formatArea(sqft, 'sqft')}`
          : 'Not priced',
      drivenBy: 'ancillaryExpenseRatePerSqft',
    },
  ]);

  // --- 5g. Other heads ---
  // The corpus is quoted per sq.ft. of the carpet each member holds today,
  // which is what the trade negotiates on. A lump sum stays available.
  const existingCarpetForCorpusSqft =
    inputs.existingResidentialCarpetSqft + inputs.existingCommercialCarpetSqft;
  const corpusFund =
    inputs.corpusFundBasis === 'PER_SQFT_EXISTING_CARPET'
      ? existingCarpetForCorpusSqft * inputs.corpusFundRatePerSqft
      : inputs.corpusFundCost;

  // Land cost is zero on a society redevelopment - the society owns the land and
  // is paid in area, rent and corpus instead. It matters on an outright purchase.
  const landCost =
    inputs.landRatePerSqft > 0
      ? inputs.plotAreaConveyanceSqm * SQM_TO_SQFT * inputs.landRatePerSqft
      : inputs.landLumpSum;

  const otherItems: LineItem[] = [
    {
      id: 'exp.other.land',
      label: 'Land acquisition cost',
      value: landCost,
      unit: 'inr',
      formula:
        inputs.landRatePerSqft > 0
          ? `${formatArea(inputs.plotAreaConveyanceSqm * SQM_TO_SQFT, 'sqft')} x Rs. ${formatRupees(inputs.landRatePerSqft)}/Sq.ft.`
          : 'Lump sum',
      note:
        landCost === 0
          ? 'Zero on a redevelopment - the society owns the land and is paid in area, rent and corpus.'
          : undefined,
      drivenBy: 'landRatePerSqft',
    },
    {
      id: 'exp.other.env',
      label: 'Environmental clearance (approx.)',
      value: inputs.environmentalClearanceCost,
      unit: 'inr',
      drivenBy: 'environmentalClearanceCost',
    },
    {
      id: 'exp.other.stamp',
      label: 'Stamp duty & registration (approx.)',
      value: inputs.stampDutyRegistrationCost,
      unit: 'inr',
      drivenBy: 'stampDutyRegistrationCost',
    },
    {
      id: 'exp.other.corpus',
      label: 'Corpus fund to society',
      value: corpusFund,
      unit: 'inr',
      formula:
        inputs.corpusFundBasis === 'PER_SQFT_EXISTING_CARPET'
          ? `Rs. ${formatRupees(inputs.corpusFundRatePerSqft)}/Sq.ft. x ${formatArea(existingCarpetForCorpusSqft, 'sqft')} of members' existing carpet`
          : 'Negotiated lump sum',
      regulation: 'UDCPR Reg. 7.6, Note 3',
      note: 'Negotiable with the society, and often what wins the tender.',
      drivenBy: inputs.corpusFundBasis === 'PER_SQFT_EXISTING_CARPET' ? 'corpusFundRatePerSqft' : 'corpusFundCost',
    },
    {
      id: 'exp.other.misc',
      label: 'Other miscellaneous (deficiency, OLT etc.)',
      value: inputs.otherMiscCost,
      unit: 'inr',
      drivenBy: 'otherMiscCost',
    },
  ];
  const otherHeads = head('otherHeads', 'Other Expenses', otherItems);

  const heads = [
    premiumAndAncillary,
    developmentCharges,
    tdrCost,
    incidentals,
    construction,
    professionalFees,
    agentCommission,
    officeExpense,
    rentAndServices,
    ancillaryExpenses,
    otherHeads,
  ];

  const customTotal = customItems.reduce((s, i) => s + i.value, 0);
  const totalExpenditure = heads.reduce((s, h) => s + h.amount, 0) + customTotal;

  return {
    premiumAndAncillary,
    developmentCharges,
    tdrCost,
    incidentals,
    construction,
    professionalFees,
    agentCommission,
    officeExpense,
    rentAndServices,
    ancillaryExpenses,
    otherHeads,
    customItems,
    totalExpenditure,
  };
}

export interface CoreFinancials {
  fsi: FsiBreakdown;
  areas: AreaBreakdown;
  income: IncomeBreakdown;
  expenses: ExpenseBreakdown;
  summary: FeasibilitySummary;
}

/**
 * The deterministic core. Used directly by sensitivity analysis.
 *
 * Expects inputs that have already been through `resolveInputs`, so that
 * sensitivity runs do not re-derive on every perturbation.
 */
export function computeCore(inputs: FeasibilityInputs, customItems: LineItem[] = []): CoreFinancials {
  const fsi = computeFsi(inputs);
  const areas = computeAreas(inputs, fsi);
  const income = computeIncome(inputs, areas);
  const expenses = computeExpenses(inputs, fsi, areas, income, customItems);

  const netProfit = income.totalIncome - expenses.totalExpenditure;
  const summary: FeasibilitySummary = {
    totalIncome: income.totalIncome,
    totalExpenditure: expenses.totalExpenditure,
    netProfit,
    marginPct: income.totalIncome === 0 ? 0 : (netProfit / income.totalIncome) * 100,
    roiPct: expenses.totalExpenditure === 0 ? 0 : (netProfit / expenses.totalExpenditure) * 100,
  };

  return { fsi, areas, income, expenses, summary };
}

function sensitivity(inputs: FeasibilityInputs, base: CoreFinancials, customItems: LineItem[]) {
  const variables: { key: keyof FeasibilityInputs; label: string }[] = [
    { key: 'constructionRatePerSqft', label: 'Cost of construction' },
    { key: 'residentialSaleRatePerSqft', label: 'Residential sale rate' },
    { key: 'commercialSaleRatePerSqft', label: 'Commercial sale rate' },
    { key: 'tdrRatePerSqft', label: 'TDR rate' },
  ];
  const deltas = [-10, -5, 5, 10];

  const rows = variables.flatMap((v) =>
    deltas.map((d) => {
      const perturbed: FeasibilityInputs = {
        ...inputs,
        [v.key]: (inputs[v.key] as number) * (1 + d / 100),
      };
      const r = computeCore(perturbed, customItems);
      return {
        variable: v.label,
        deltaPct: d,
        netProfit: r.summary.netProfit,
        marginPct: r.summary.marginPct,
        deltaProfit: r.summary.netProfit - base.summary.netProfit,
      };
    }),
  );

  // Breakeven residential sale rate: net profit = 0.
  // income*(1 - commission%) = fixed expenses, so solve for the residential rate.
  const commissionPct = inputs.agentCommissionPct;
  const fixedExpenses = base.expenses.totalExpenditure - base.expenses.agentCommission.amount;
  const requiredIncome = fixedExpenses / (1 - commissionPct);
  const commercialIncome = base.areas.developerCommercialCarpetSqft * inputs.commercialSaleRatePerSqft;
  const breakevenResidentialRatePerSqft =
    base.areas.developerResidentialCarpetSqft > 0
      ? (requiredIncome - commercialIncome) / base.areas.developerResidentialCarpetSqft
      : 0;

  // Breakeven construction rate: net profit = 0 with everything else held.
  const expensesExConstruction = base.expenses.totalExpenditure - base.expenses.construction.amount;
  const breakevenConstructionRatePerSqft =
    base.areas.totalBuaInclAncillarySqft > 0
      ? (base.income.totalIncome - expensesExConstruction) / base.areas.totalBuaInclAncillarySqft
      : 0;

  return { rows, breakevenResidentialRatePerSqft, breakevenConstructionRatePerSqft };
}

function collectWarnings(inputs: FeasibilityInputs, core: CoreFinancials): string[] {
  const w: string[] = [];
  const { fsi, areas, summary } = core;
  const rulebook = rulebookFor(inputs.authority);
  const dcpr = rulebook.id === 'DCPR_2034';

  // These now only fire when the user has explicitly pinned a value away from
  // the regulation, since everything else derives.
  if (!dcpr) {
    const table = entitlementFor(inputs.roadWidthM, inputs.authority);
    if (Math.abs(table.basicFsi - inputs.basicFsi) > 0.001) {
      w.push(
        `Basic FSI is pinned at ${inputs.basicFsi}; UDCPR Table 6-G gives ${table.basicFsi} for a ${inputs.roadWidthM} m road.`,
      );
    }
    if (!inputs.isTodZone && Math.abs(table.maxTdr - inputs.maxTdrLoading) > 0.001) {
      w.push(
        `Maximum TDR loading is pinned at ${inputs.maxTdrLoading}; Table 6-G gives ${table.maxTdr} for a ${inputs.roadWidthM} m road.`,
      );
    }
    if (inputs.isTodZone && inputs.todMaxFsi > 4.0) {
      w.push('UDCPR Reg. 14.2.1.2 caps total FSI in a TOD zone at 4.00.');
    }
  } else {
    if (inputs.dcprMaxFsi > 4.0) {
      w.push('DCPR-2034 Reg. 33(20)(B) caps total FSI at 4.00.');
    }
    if (inputs.existingBuiltUpWithBalconySqm <= 0) {
      w.push(
        'Existing built-up area including balconies is zero, so the Mumbai rehab obligation computes to nothing. Enter it, or enter the existing carpet areas so it can derive.',
      );
    }
    for (const note of fsi.dcpr?.notes ?? []) w.push(note);
  }
  const scheme = schemeFor(inputs.schemeType);
  if (scheme.rulebook !== rulebook.id) {
    w.push(
      `The selected scheme (${scheme.label}, ${scheme.regulation}) belongs to a different rulebook from the one governing ${inputs.authority}. Pick a ${rulebook.shortName} scheme.`,
    );
  }
  const expectedInSitu = inSituMultiplierFor(inputs.areaCategory);
  if (Math.abs(expectedInSitu - inputs.inSituFsiMultiplier) > 0.001) {
    w.push(
      `In-situ FSI multiplier is pinned at ${inputs.inSituFsiMultiplier}; UDCPR Reg. 11.2.4 gives ${expectedInSitu} for a ${inputs.areaCategory === 'CONGESTED' ? 'congested' : 'non-congested'} area.`,
    );
  }
  if (fsi.pathA.premiumFsiAreaSqm < fsi.pathA.inSituFsiSqm) {
    w.push('In-situ FSI from the surrendered DP road exceeds the premium FSI entitlement; balance premium FSI clamped to zero.');
  }
  if (areas.developerBalanceCarpetSqft <= 0) {
    w.push('No surplus carpet area remains for the developer after tenant hand-back. The scheme cannot generate sale revenue as configured.');
  }
  if (
    inputs.developerSplitMode === 'ABSOLUTE' &&
    inputs.developerCommercialCarpetSqft > Math.max(0, areas.developerBalanceCarpetSqft)
  ) {
    w.push("Proposed commercial carpet exceeds the developer's total balance carpet area; it has been clamped.");
  }
  if (Math.abs(inputs.additionalCarpetToTenantsPct - 0.2) > 1e-9) {
    w.push(
      `Tenant uplift is set to ${round(inputs.additionalCarpetToTenantsPct * 100, 2)}% rather than the standard 20%.`,
    );
  }
  if (inputs.stampDutyRegistrationCost === 0) {
    w.push('Stamp duty & registration is Rs. 0. The source report leaves this line blank - fill it before relying on the profit figure.');
  }
  if (summary.netProfit < 0) {
    w.push('The scheme runs at a loss on the current parameters.');
  }
  return w;
}

/**
 * Stamped on every report. A feasibility document that goes to a society needs
 * to say which consolidation of the rules produced it.
 */
export const RULESET_VERSION = 'UDCPR-2020 v1 (consolidated to 30 January 2023)';
export const DCPR_RULESET_VERSION = 'DCPR-2034 v1 (Greater Mumbai, Reg. 30 / 31 / 33)';

export function rulesetVersionFor(rulebook: Rulebook): string {
  return rulebook.id === 'DCPR_2034' ? DCPR_RULESET_VERSION : RULESET_VERSION;
}

/** A plain-language read of the result, for the top of the report. */
function buildHeadline(inputs: FeasibilityInputs, core: CoreFinancials, rulebook: Rulebook): string {
  const { areas, summary, fsi } = core;
  const entitledFsi = fsi.totalPermissibleBuaSqm / Math.max(1, inputs.plotAreaConveyanceSqm);
  const withAncillary = areas.totalBuaInclAncillarySqm / Math.max(1, inputs.plotAreaConveyanceSqm);

  if (inputs.plotAreaConveyanceSqm <= 0) {
    return 'Enter a plot area and road width to see what this site can carry.';
  }

  // The achieved ratio can exceed the table ceiling, because in-situ FSI against
  // the surrendered road land sits on top of it. Say "achieved", not "entitled",
  // so nobody reads it as the Table 6-G figure.
  const ceiling = rulebook.id === 'DCPR_2034' ? fsi.totalPermissibleBuaSqm / Math.max(1, inputs.plotAreaConveyanceSqm) : inputs.todMaxFsi;
  const loading = rulebook.loadingLabel.toLowerCase();
  const buildable =
    `Under ${rulebook.name}, you can build about ${formatArea(areas.totalBuaInclAncillarySqft, 'sqft')} on this plot - ` +
    `a ceiling of FSI ${formatNumber(ceiling)}, working out at ${formatNumber(entitledFsi)} achieved on the plot area ` +
    `(${formatNumber(withAncillary)} including ${loading}).`;

  if (areas.developerBalanceCarpetSqft <= 0) {
    return `${buildable} After returning area to the existing occupiers nothing is left to sell, so the scheme cannot pay as configured.`;
  }

  const money =
    summary.netProfit >= 0
      ? `After handing back ${formatArea(areas.totalHandBackCarpetSqft, 'sqft')} to the existing occupiers, ${formatArea(areas.developerBalanceCarpetSqft, 'sqft')} of RERA carpet is left to sell, giving a net profit of ${formatCrore(summary.netProfit)} on ${formatCrore(summary.totalIncome)} of sales - a ${formatNumber(summary.marginPct)}% margin.`
      : `After the hand-back, ${formatArea(areas.developerBalanceCarpetSqft, 'sqft')} is left to sell, which does not cover costs - the scheme runs at a loss of ${formatCrore(Math.abs(summary.netProfit))}.`;

  const caveat = rulebook.supported ? '' : ` Computed on ${rulebook.name} tables that do not govern this authority - treat as indicative only.`;

  return `${buildable} ${money}${caveat}`;
}

/** The same plot appraised under each scheme, for a side-by-side read. */
function buildSchemeComparison(rawInputs: FeasibilityInputs, customItems: LineItem[]) {
  // Only the schemes that exist under the governing rulebook - a UDCPR scheme
  // is not a live alternative on a Mumbai plot.
  const rulebook = rulebookFor(rawInputs.authority);
  const candidates = schemesForRulebook(rulebook.id)
    .filter((s) => s.supported)
    .map((s) => s.id);
  return candidates.map((schemeType) => {
    const { effective } = resolveInputs({ ...rawInputs, schemeType });
    const c = computeCore(effective, customItems);
    const scheme = schemeFor(schemeType);
    return {
      schemeType,
      label: scheme.label,
      regulation: scheme.regulation,
      incentiveFsiSqm: c.fsi.pathB.incentiveFsiSqm,
      totalPermissibleBuaSqm: c.fsi.totalPermissibleBuaSqm,
      developerCarpetSqft: c.areas.developerBalanceCarpetSqft,
      netProfit: c.summary.netProfit,
      marginPct: c.summary.marginPct,
      score: buildScore(effective, c).score,
      isCurrent: schemeType === rawInputs.schemeType,
    };
  });
}

/**
 * Full pipeline: derive the regulation-driven parameters, compute, score,
 * stress, then render.
 *
 * Derivation happens here, once, so a change to road width propagates to
 * permissible FSI, to saleable area, to income - and to every consumer of this
 * function, whether that is the form preview, the API or the chatbot.
 */
export function calculateFeasibility(
  rawInputs: FeasibilityInputs,
  customItems: LineItem[] = [],
): FeasibilityResult {
  const { effective: inputs, derived, schemes } = resolveInputs(rawInputs);

  const core = computeCore(inputs, customItems);
  const score = buildScore(inputs, core);
  const sens = sensitivity(inputs, core, customItems);
  const warnings = collectWarnings(inputs, core);

  const rulebook = rulebookFor(inputs.authority);
  if (!rulebook.supported && rulebook.caveat) warnings.unshift(rulebook.caveat);

  for (const scheme of schemes) {
    if (!scheme.applies && scheme.id === 'redevelopment') {
      warnings.push(`Incentive FSI not applied: ${scheme.reason} (${scheme.regulation})`);
    }
  }

  const checks = runPlausibilityChecks(inputs, core);
  const schemeComparison = buildSchemeComparison(rawInputs, customItems);

  const result: FeasibilityResult = {
    headline: buildHeadline(inputs, core, rulebook),
    ruleset: rulesetVersionFor(rulebook),
    inputs: rawInputs,
    effectiveInputs: inputs,
    derived,
    schemes,
    rulebook,
    fsi: core.fsi,
    areas: core.areas,
    income: core.income,
    expenses: core.expenses,
    summary: core.summary,
    score,
    sensitivity: sens,
    sections: [],
    warnings,
    checks,
    schemeComparison,
    computedAt: new Date().toISOString(),
  };

  result.sections = buildSections(result);
  return result;
}

export { CRORE, SQM_TO_SQFT };
