import { SQM_TO_SQFT } from './constants';
import { formatArea, formatCrore, formatNumber, formatPercent, formatRupees } from './format';
import type { FeasibilityResult, LineItem, ReportSection } from './types';

/**
 * The Greater Mumbai FSI page.
 *
 * DCPR builds the entitlement in a different order from UDCPR, so the page is
 * written the way a Mumbai feasibility is actually laid out rather than being
 * forced into the Path A / Path B shape.
 */
function buildDcprFsiSection(r: FeasibilityResult): ReportSection {
  const { inputs: i, fsi } = r;
  const d = fsi.dcpr!;
  const sqm = (id: string, label: string, value: number, extra: Partial<LineItem> = {}): LineItem => ({
    id,
    label,
    value,
    unit: 'sqm',
    ...extra,
  });

  return {
    id: 'fsi',
    title: 'Maximum Permissible FSI (DCPR-2034)',
    subtitle: `${i.projectName}, ${i.surveyNo}, ${i.village} - ${d.location === 'ISLAND_CITY' ? 'Island City' : 'Suburbs'}`,
    prose: `<p>Greater Mumbai is expressly excluded from UDCPR-2020, so this plot is appraised on <strong>DCPR-2034</strong>. Entitlement comes off Table 12 by abutting road width, the loading is granted as <em>fungible compensatory area</em> rather than ancillary FSI, and the redevelopment runs under Regulation 33.</p>`,
    items: [
      sqm('fsi.plot.conveyance', 'Area of plot in possession', i.plotAreaConveyanceSqm, {
        drivenBy: 'plotAreaConveyanceSqm',
      }),
      sqm('fsi.plot.road', 'Less area surrendered to road setback', i.dpRoadAreaSqm, { drivenBy: 'dpRoadAreaSqm' }),
      sqm('fsi.plot.balance', 'New net plot area', d.netPlotAreaSqm, {
        formula: `${formatArea(i.plotAreaConveyanceSqm)} - ${formatArea(i.dpRoadAreaSqm)}`,
        emphasis: true,
      }),

      {
        id: 'fsi.dcpr.heading',
        label: `A. Entitlement under Reg. 33(7)(B) - Table 12 band "${d.roadBand}"`,
        value: 0,
        unit: 'ratio',
        emphasis: true,
      },
      sqm('fsi.dcpr.base', `1) Basic FSI ${formatNumber(d.baseFsi)} on the net plot`, d.baseBuaSqm, {
        formula: `${formatNumber(d.baseFsi)} x ${formatArea(d.netPlotAreaSqm)}`,
        regulation: 'DCPR-2034 Reg. 30, Table 12',
        indent: 1,
        drivenBy: 'basicFsi',
      }),
      sqm('fsi.dcpr.govt', `2) Premium FSI purchased from MCGM (${formatNumber(i.premiumFsiRate)})`, d.govtFsiSqm, {
        formula: `${formatNumber(i.premiumFsiRate)} x ${formatArea(d.netPlotAreaSqm)}`,
        regulation: 'DCPR-2034 Reg. 30(A) - premium at 50% of RR',
        indent: 1,
        drivenBy: 'premiumFsiRate',
      }),
      sqm('fsi.dcpr.tdr', `3) TDR entitlement (${formatNumber(i.maxTdrLoading)})`, d.tdrEntitlementSqm, {
        formula: `${formatNumber(i.maxTdrLoading)} x ${formatArea(d.netPlotAreaSqm)}`,
        indent: 1,
        drivenBy: 'maxTdrLoading',
      }),
      sqm('fsi.dcpr.tdrPurchase', '3a) TDR actually to be purchased', d.tdrToPurchaseSqm, {
        formula: `${formatArea(d.tdrEntitlementSqm)} - ${i.residentialTenements} tenements x ${formatNumber(i.incentiveFsiPerTenementSqm)} Sq.mt. - ${formatArea(i.dcprRoadSetbackCreditSqm)} earlier setback`,
        note: 'This is what carries forward to the TDR cost line.',
        indent: 2,
        drivenBy: 'dcprRoadSetbackCreditSqm',
      }),
      sqm('fsi.dcpr.setback', '4) Setback compensation FSI', d.setbackCompensationSqm, {
        formula: `${formatNumber(i.inSituFsiMultiplier)} x ${formatArea(i.dpRoadAreaSqm)}`,
        indent: 1,
        drivenBy: 'inSituFsiMultiplier',
      }),
      sqm('fsi.dcpr.total337b', 'Built-up area under Reg. 33(7)(B) (1 + 2 + 3 + 4)', d.buaUnder33_7BSqm, {
        emphasis: true,
      }),

      {
        id: 'fsi.dcpr.ceiling.heading',
        label: 'B. Additional FSI under Reg. 33(20)(B)',
        value: 0,
        unit: 'ratio',
        emphasis: true,
      },
      sqm('fsi.dcpr.ceiling', `Ceiling at FSI ${formatNumber(i.dcprMaxFsi)} on the plot in possession`, d.ceilingBuaSqm, {
        formula: `${formatNumber(i.dcprMaxFsi)} x ${formatArea(i.plotAreaConveyanceSqm)}`,
        regulation: 'DCPR-2034 Reg. 33(20)(B)',
        indent: 1,
        drivenBy: 'dcprMaxFsi',
      }),
      sqm('fsi.dcpr.balance', 'Balance built-up area above the 33(7)(B) entitlement', d.balanceBuaSqm, { indent: 1 }),
      sqm('fsi.dcpr.pap', `PAP built-up area to MCGM (${formatNumber(i.dcprPapSharePct * 100, 0)}% of the balance)`, d.papBuaSqm, {
        formula: `${formatNumber(i.dcprPapSharePct * 100, 0)}% x ${formatArea(d.balanceBuaSqm)}`,
        note: d.usesCeiling
          ? 'Discharged as a purchase cost in the expenditure statement.'
          : 'Not applicable - the 33(20)(B) route is not selected.',
        indent: 2,
        drivenBy: 'dcprPapSharePct',
      }),

      sqm('fsi.governing', 'Total permissible built-up area', fsi.totalPermissibleBuaSqm, {
        emphasis: true,
        regulation: d.usesCeiling ? 'DCPR-2034 Reg. 33(20)(B)' : 'DCPR-2034 Reg. 33(7)(B)',
      }),

      {
        id: 'fsi.dcpr.rehab.heading',
        label: 'C. Rehabilitation component - what the members get back',
        value: 0,
        unit: 'ratio',
        emphasis: true,
      },
      sqm('fsi.dcpr.existing', 'Existing built-up area including balconies', i.existingBuiltUpWithBalconySqm, {
        indent: 1,
        drivenBy: 'existingBuiltUpWithBalconySqm',
      }),
      sqm(
        'fsi.dcpr.rehab',
        `Rehab built-up area at ${formatNumber(i.additionalCarpetToTenantsPct * 100, 0)}% additional area`,
        d.rehabBuaSqm,
        {
          formula: `${formatArea(i.existingBuiltUpWithBalconySqm)} x (1 + ${formatNumber(i.additionalCarpetToTenantsPct * 100, 0)}%)`,
          indent: 1,
          drivenBy: 'additionalCarpetToTenantsPct',
        },
      ),
      sqm('fsi.dcpr.rehabFungible', 'Rehab fungible area (free of premium)', d.rehabFungibleSqm, {
        formula: `${formatArea(i.existingBuiltUpWithBalconySqm)} x ${formatNumber(i.ancillaryResidentialPct * 100, 0)}%`,
        indent: 1,
      }),
    ],
  };
}

/**
 * Turns a computed result into the renderable / exportable document, mirroring
 * the five-page structure of the client's existing project report so their team
 * reads it in the format they already know.
 */
export function buildSections(r: FeasibilityResult): ReportSection[] {
  const { inputs: i, fsi, areas, income, expenses, summary, score, sensitivity, rulebook } = r;
  const isDcpr = Boolean(fsi.dcpr);
  const loading = rulebook.loadingLabel;

  const sqm = (id: string, label: string, value: number, extra: Partial<LineItem> = {}): LineItem => ({
    id,
    label,
    value,
    unit: 'sqm',
    ...extra,
  });
  const sqft = (id: string, label: string, value: number, extra: Partial<LineItem> = {}): LineItem => ({
    id,
    label,
    value,
    unit: 'sqft',
    ...extra,
  });
  const money = (id: string, label: string, value: number, extra: Partial<LineItem> = {}): LineItem => ({
    id,
    label,
    value,
    unit: 'inr',
    ...extra,
  });

  // ---------- Page 1: FSI ----------
  const fsiSection: ReportSection = isDcpr ? buildDcprFsiSection(r) : {
    id: 'fsi',
    title: 'Maximum Permissible FSI',
    subtitle: `${i.projectName}, ${i.surveyNo}, Village - ${i.village}`,
    prose: `<p>Computed two ways, as required by UDCPR Regulation 7.5 &mdash; the FSI allowed on redevelopment is the entitlement under Regulation 6.3 or the FSI protected by the existing authorised building, <em>whichever is more</em>. Path ${fsi.governingPath} governs.</p>`,
    items: [
      sqm('fsi.plot.712', 'Plot area as per 7/12 extract', i.plotAreaSevenTwelveSqm, { drivenBy: 'plotAreaSevenTwelveSqm' }),
      sqm('fsi.plot.conveyance', 'Plot area as per Conveyance Deed', i.plotAreaConveyanceSqm, {
        drivenBy: 'plotAreaConveyanceSqm',
      }),
      sqm('fsi.plot.road', `Less area under D.P. Road (${formatNumber(i.roadWidthM)} m)`, i.dpRoadAreaSqm, {
        drivenBy: 'dpRoadAreaSqm',
      }),
      sqm('fsi.plot.balance', 'Balance plot area', fsi.balancePlotAreaSqm, {
        formula: `${formatArea(i.plotAreaConveyanceSqm)} - ${formatArea(i.dpRoadAreaSqm)}`,
        emphasis: true,
      }),

      {
        id: 'fsi.pathA.heading',
        label: 'A. Maximum Permissible FSI as per UDCPR',
        value: 0,
        unit: 'ratio',
        emphasis: true,
      },
      sqm('fsi.pathA.basic', `1) Basic FSI (${formatNumber(i.basicFsi)} x balance plot area)`, fsi.pathA.basicFsiAreaSqm, {
        formula: `${formatNumber(i.basicFsi)} x ${formatArea(fsi.balancePlotAreaSqm)}`,
        regulation: 'UDCPR Table 6-G',
        indent: 1,
        drivenBy: 'basicFsi',
      }),
      sqm(
        'fsi.pathA.premium',
        i.isTodZone
          ? `2) Premium FSI in TOD Zone = ${formatNumber(i.todMaxFsi)} (plot abutting ${formatNumber(i.roadWidthM)} m road)`
          : '2) Premium FSI + TDR entitlement',
        fsi.pathA.premiumFsiAreaSqm,
        {
          formula: i.isTodZone
            ? `(${formatNumber(i.todMaxFsi)} - ${formatNumber(i.basicFsi)}) x ${formatArea(i.plotAreaConveyanceSqm)}`
            : `(${formatNumber(i.premiumFsiRate)} + ${formatNumber(i.maxTdrLoading)}) x ${formatArea(i.plotAreaConveyanceSqm)}`,
          regulation: i.isTodZone ? 'UDCPR Reg. 14.2.1.2 / 14.2.1.2.3' : 'UDCPR Table 6-G',
          note: 'Computed on the full conveyance plot area, not the balance area.',
          indent: 1,
        },
      ),
      sqm(
        'fsi.pathA.minTdr',
        `Minimum ${formatNumber(i.minTdrLoadingPct * 100, 0)}% TDR FSI to be loaded`,
        fsi.pathA.minTdrToBeLoadedSqm,
        { formula: `${formatArea(fsi.pathA.premiumFsiAreaSqm)} x ${i.minTdrLoadingPct}`, indent: 2 },
      ),
      sqm('fsi.pathA.insitu', `2a) In-situ FSI (D.P. Road)`, fsi.pathA.inSituFsiSqm, {
        formula: `${formatNumber(i.inSituFsiMultiplier)} x ${formatArea(i.dpRoadAreaSqm)}`,
        regulation: 'UDCPR Reg. 11.2.4',
        indent: 1,
        drivenBy: 'inSituFsiMultiplier',
      }),
      sqm('fsi.pathA.balancePremium', '2b) Balance premium FSI to be loaded', fsi.pathA.balancePremiumFsiSqm, {
        formula: `${formatArea(fsi.pathA.premiumFsiAreaSqm)} - ${formatArea(fsi.pathA.inSituFsiSqm)}`,
        indent: 1,
      }),
      sqm('fsi.pathA.total', 'Total permissible built-up area (1 + 2a + 2b)', fsi.pathA.totalSqm, { emphasis: true }),

      {
        id: 'fsi.pathB.heading',
        label: 'B. Maximum Permissible FSI as per Redevelopment Scheme',
        value: 0,
        unit: 'ratio',
        emphasis: true,
      },
      sqm('fsi.pathB.existing', '1) Existing built-up area as per sanctioned plan', fsi.pathB.existingBuiltUpSqm, {
        indent: 1,
        drivenBy: 'existingBuiltUpAreaSqm',
      }),
      sqm(
        'fsi.pathB.incentive',
        `2) Incentive FSI (${formatNumber(i.incentiveFsiPctOfExisting * 100, 0)}% of existing BUA or ${formatNumber(i.incentiveFsiPerTenementSqm)} Sq.mt./tenement, whichever is more)`,
        fsi.pathB.incentiveFsiSqm,
        {
          formula: fsi.pathB.incentiveBasis,
          regulation: 'UDCPR Reg. 7.6.1(i)',
          indent: 1,
          drivenBy: 'incentiveFsiPerTenementSqm',
        },
      ),
      ...(fsi.pathB.minCarpetTopUpSqm > 0
        ? [
            sqm(
              'fsi.pathB.minCarpet',
              '2a) Minimum-carpet top-up to 27.87 Sq.mt. per tenement (premium-free)',
              fsi.pathB.minCarpetTopUpSqm,
              {
                formula: fsi.pathB.minCarpetBasis,
                regulation: 'UDCPR Reg. 7.6.1(ii)',
                note: 'This area also goes to the members, so it leaves the saleable pool.',
                indent: 1,
                drivenBy: 'avgExistingCarpetPerTenementSqm' as const,
              },
            ),
          ]
        : []),
      sqm('fsi.pathB.premium', `3) Premium FSI = ${formatNumber(i.premiumFsiRate)} x plot area`, fsi.pathB.premiumFsiSqm, {
        formula: `${formatNumber(i.premiumFsiRate)} x ${formatArea(i.plotAreaConveyanceSqm)}`,
        indent: 1,
        drivenBy: 'premiumFsiRate',
      }),
      sqm('fsi.pathB.balanceTdr', '4) Add balance TDR FSI', fsi.pathB.balanceTdrFsiSqm, {
        formula: `${formatArea(fsi.pathA.totalSqm)} - ${formatArea(fsi.pathB.existingBuiltUpSqm)} - ${formatArea(fsi.pathB.incentiveFsiSqm)} - ${formatArea(fsi.pathB.premiumFsiSqm)}`,
        indent: 1,
      }),
      sqm('fsi.pathB.insitu', '4a) Add in-situ FSI of road', fsi.pathB.inSituFsiSqm, {
        formula: `${formatNumber(i.inSituFsiMultiplier)} x ${formatArea(i.dpRoadAreaSqm)}`,
        indent: 2,
      }),
      sqm('fsi.pathB.tdrPurchase', '4b) Add balance TDR FSI (to be purchased)', fsi.pathB.tdrToPurchaseSqm, {
        formula: `${formatArea(fsi.pathB.balanceTdrFsiSqm)} - ${formatArea(fsi.pathB.inSituFsiSqm)}`,
        note: 'This is the TDR the builder must actually buy. It carries forward to the TDR cost line.',
        indent: 2,
      }),
      sqm('fsi.pathB.total', 'Total permissible built-up area (1 + 2 + 3 + 4a + 4b)', fsi.pathB.totalSqm, {
        emphasis: true,
      }),

      sqm('fsi.governing', `Maximum permissible built-up area (whichever is more)`, fsi.totalPermissibleBuaSqm, {
        emphasis: true,
        regulation: 'UDCPR Reg. 7.5',
      }),
    ],
  };

  // ---------- Page 2: Areas and income ----------
  const areaSection: ReportSection = {
    id: 'areas',
    title: 'Area Statement & Income from Sale',
    prose:
      '<p>Gross built-up potential is not what the builder can sell. Loading, the area returned to existing occupiers, and the tenant uplift all come off before any surplus remains.</p>',
    items: [
      sqm('area.total', 'Total permissible built-up area', fsi.totalPermissibleBuaSqm),
      sqm('area.comm', 'Commercial built-up area', areas.commercialBuaSqm, {
        indent: 1,
        drivenBy: 'commercialAreaSqm',
      }),
      sqm('area.res', 'Residential built-up area', areas.residentialBuaSqm, { indent: 1 }),
      sqm(
        'area.anc.comm',
        `Add ${loading.toLowerCase()} - Commercial ${formatNumber(i.ancillaryCommercialPct * 100, 0)}%`,
        areas.ancillaryCommercialSqm,
        {
          formula: `${formatArea(areas.commercialBuaSqm)} x ${i.ancillaryCommercialPct}`,
          regulation: isDcpr ? 'DCPR-2034 Reg. 31(3)' : 'UDCPR Table 6-G, Note (i)',
          indent: 1,
          drivenBy: 'ancillaryCommercialPct',
        },
      ),
      sqm(
        'area.anc.res',
        `Add ${loading.toLowerCase()} - Residential ${formatNumber(i.ancillaryResidentialPct * 100, 0)}%`,
        areas.ancillaryResidentialSqm,
        {
          formula: `${formatArea(areas.residentialBuaSqm)} x ${i.ancillaryResidentialPct}`,
          regulation: isDcpr ? 'DCPR-2034 Reg. 31(3)' : 'UDCPR Table 6-G, Note (i)',
          indent: 1,
          drivenBy: 'ancillaryResidentialPct',
        },
      ),
      sqm('area.anc.total', `Total ${loading.toLowerCase()}`, areas.totalAncillarySqm, { indent: 1 }),
      sqm('area.inclAnc', `Total permissible built-up area including ${loading.toLowerCase()}`, areas.totalBuaInclAncillarySqm, {
        emphasis: true,
      }),
      sqft('area.inclAnc.sqft', `Total permissible built-up area including ${loading.toLowerCase()}`, areas.totalBuaInclAncillarySqft, {
        formula: `${formatArea(areas.totalBuaInclAncillarySqm)} x ${SQM_TO_SQFT}`,
        emphasis: true,
      }),

      sqft('area.rera', 'Approximate RERA carpet area available from the layout', areas.approxReraCarpetSqft, {
        formula: `${formatArea(areas.totalBuaInclAncillarySqft, 'sqft')} / ${i.builtUpToCarpetFactor}`,
        note: 'i.e. P-line area. The loading factor is the single most sensitive assumption on this page.',
        drivenBy: 'builtUpToCarpetFactor',
      }),
      sqft(
        'area.existing.res',
        `Less existing RERA carpet - Residential (MOFA x ${i.mofaToReraFactor})`,
        areas.existingResidentialReraCarpetSqft,
        {
          formula: `${i.mofaToReraFactor} x ${formatArea(i.existingResidentialCarpetSqft, 'sqft')}`,
          indent: 1,
          drivenBy: 'mofaToReraFactor',
        },
      ),
      sqft('area.existing.comm', 'Less existing carpet - Commercial', areas.existingCommercialCarpetSqft, {
        indent: 1,
        drivenBy: 'existingCommercialCarpetSqft',
      }),
      sqft('area.existing.total', 'Total existing RERA carpet area', areas.totalExistingReraCarpetSqft, { indent: 1 }),
      sqft(
        'area.uplift',
        `Less ${formatNumber(i.additionalCarpetToTenantsPct * 100, 0)}% additional RERA carpet to tenants (flats only)`,
        areas.additionalCarpetToTenantsSqft,
        {
          formula: `${formatArea(areas.existingResidentialReraCarpetSqft, 'sqft')} x ${formatNumber(i.additionalCarpetToTenantsPct * 100, 0)}%`,
          note: 'The commercial occupiers get back the area they had, with no uplift.',
          indent: 1,
          drivenBy: 'additionalCarpetToTenantsPct',
        },
      ),
      ...(areas.incentiveCarpetToMembersSqft > 0
        ? [
            sqft(
              'area.incentive',
              'Less scheme incentive carpet retained by the members',
              areas.incentiveCarpetToMembersSqft,
              {
                formula: `${formatArea(fsi.memberIncentiveBuaSqm)} of incentive built-up, loaded and converted to carpet`,
                regulation: 'UDCPR Reg. 7.6.1(i)',
                note: 'Incentive FSI is granted so the members can be given more than they had, so it is not treated as income. Switch "Scheme incentive area" to sell it instead.',
                indent: 1,
                drivenBy: 'incentiveAreaTreatment',
              },
            ),
          ]
        : []),
      sqft('area.handback', 'Total carpet area handed back to the existing occupiers', areas.totalHandBackCarpetSqft, {
        indent: 1,
        emphasis: true,
      }),
      sqft('area.developer', 'Balance RERA carpet area available for the developer', areas.developerBalanceCarpetSqft, {
        formula: isDcpr
          ? `(${formatArea(areas.totalBuaInclAncillarySqm)} - ${formatArea(fsi.dcpr!.rehabBuaSqm)} rehab) x ${SQM_TO_SQFT} / ${i.builtUpToCarpetFactor}`
          : `${formatArea(areas.approxReraCarpetSqft, 'sqft')} - ${formatArea(areas.totalHandBackCarpetSqft, 'sqft')}`,
        emphasis: true,
      }),
      sqft('area.developer.res', 'Residential RERA carpet area (proposed)', areas.developerResidentialCarpetSqft, {
        indent: 1,
      }),
      sqft('area.developer.comm', 'Commercial carpet area (proposed)', areas.developerCommercialCarpetSqft, {
        indent: 1,
        note: "From the architect's proposed layout, not a formula.",
        drivenBy: 'developerCommercialCarpetSqft',
      }),

      money('income.res', `Residential @ Rs. ${formatRupees(i.residentialSaleRatePerSqft)}/Sq.ft.`, income.residentialIncome, {
        formula: `${formatRupees(i.residentialSaleRatePerSqft)} x ${formatArea(areas.developerResidentialCarpetSqft, 'sqft')}`,
        drivenBy: 'residentialSaleRatePerSqft',
      }),
      money('income.comm', `Office / Commercial @ Rs. ${formatRupees(i.commercialSaleRatePerSqft)}/Sq.ft.`, income.commercialIncome, {
        formula: `${formatRupees(i.commercialSaleRatePerSqft)} x ${formatArea(areas.developerCommercialCarpetSqft, 'sqft')}`,
        drivenBy: 'commercialSaleRatePerSqft',
      }),
      money('income.total', 'Total income from sale of office & flats', income.totalIncome, { emphasis: true }),
    ],
  };

  // ---------- Page 3: Municipal charges ----------
  const municipalSection: ReportSection = {
    id: 'municipal',
    title: `Municipal Charges @ ${i.authority}`,
    subtitle: `${isDcpr ? 'Ready Reckoner' : 'ASR'} rate Rs. ${formatRupees(i.asrRatePerSqm)} per Sq.mt. &middot; ${rulebook.name}`,
    prose:
      '<p>Every rate on this page is editable. Several were flagged as open questions in the internal calculation format &mdash; verify against the current circular before the report goes to the society.</p>',
    items: [
      ...expenses.premiumAndAncillary.items,
      money('municipal.premiumTotal', 'Total payable for premium & ancillary FSI', expenses.premiumAndAncillary.amount, {
        emphasis: true,
      }),
      ...expenses.developmentCharges.items,
      money('municipal.devTotal', 'Total development charges', expenses.developmentCharges.amount, { emphasis: true }),
      ...expenses.tdrCost.items,
      ...expenses.incidentals.items,
    ],
  };

  // ---------- Page 4: Construction and project costs ----------
  const costSection: ReportSection = {
    id: 'costs',
    title: 'Construction & Project Costs',
    prose: `<p>Rent for the ${i.constructionPeriodMonths}-month displacement period is calculated on each occupier's <em>existing</em> carpet area, not the enhanced area they will receive. It is the cost most often under-estimated in a redevelopment appraisal.</p>`,
    items: [
      ...expenses.construction.items,
      ...expenses.professionalFees.items,
      ...expenses.agentCommission.items,
      ...expenses.officeExpense.items,
      ...expenses.ancillaryExpenses.items,
      { id: 'cost.rent.heading', label: `Advance rent cost for ${i.constructionPeriodMonths} months`, value: 0, unit: 'ratio', emphasis: true },
      ...expenses.rentAndServices.items.map((it) => ({ ...it, indent: 1 })),
      money('cost.rent.total', 'Total rent cost', expenses.rentAndServices.amount, { emphasis: true }),
    ],
  };

  // ---------- Page 5: Summary ----------
  const summaryItems: LineItem[] = [
    money('summary.income', 'Total income from sale of office & flats', summary.totalIncome, { emphasis: true }),
    money('summary.exp.1', '1) Ancillary & premium charges to Corporation / Govt.', expenses.premiumAndAncillary.amount),
    money('summary.exp.2', '2) Development charges', expenses.developmentCharges.amount),
    money('summary.exp.3', '3) TDR cost', expenses.tdrCost.amount),
    money('summary.exp.4', '4) Other incidental expenses till OC', expenses.incidentals.amount),
    money('summary.exp.5', '5) Cost of construction (approx.)', expenses.construction.amount),
    money('summary.exp.6', '6) Professional fees', expenses.professionalFees.amount),
    money('summary.exp.7', '7) Commission to agents and advertising', expenses.agentCommission.amount),
    money('summary.exp.8', '8) Office expense', expenses.officeExpense.amount),
    money('summary.exp.9', '9) Rent & other services', expenses.rentAndServices.amount),
    money('summary.exp.10', '10) Ancillary expenses', expenses.ancillaryExpenses.amount, {
      drivenBy: 'ancillaryExpenseLumpSum',
    }),
    ...expenses.otherHeads.items.map((it, idx) =>
      money(`summary.exp.other.${idx}`, `${11 + idx}) ${it.label}`, it.value, { drivenBy: it.drivenBy }),
    ),
    ...expenses.customItems.map((it) => money(`summary.exp.custom.${it.id}`, it.label, it.value, { note: 'Added manually' })),
    money('summary.expenditure', 'Total expenses', summary.totalExpenditure, { emphasis: true }),
    money('summary.netProfit', 'Net profit', summary.netProfit, { emphasis: true }),
    {
      id: 'summary.margin',
      label: 'Profit margin',
      value: summary.marginPct,
      unit: 'pct',
      formula: `${formatCrore(summary.netProfit)} / ${formatCrore(summary.totalIncome)}`,
    },
    {
      id: 'summary.roi',
      label: 'Return on outlay',
      value: summary.roiPct,
      unit: 'pct',
      formula: `${formatCrore(summary.netProfit)} / ${formatCrore(summary.totalExpenditure)}`,
    },
    {
      id: 'summary.score',
      label: `Feasibility score - ${score.verdict}`,
      value: score.score,
      unit: 'ratio',
      emphasis: true,
      note: score.drivers.join(' '),
    },
  ];

  const summarySection: ReportSection = {
    id: 'summary',
    title: 'Summary',
    prose: `<p><strong>Verdict: ${score.verdict}</strong> &mdash; feasibility score ${formatNumber(score.score, 1)} / 100 on a net profit of ${formatCrore(summary.netProfit)} against income of ${formatCrore(summary.totalIncome)}, a margin of ${formatPercent(summary.marginPct)}.</p><p><em>Note: stamp duty, registration fees, corpus fund, Estate Investment NOC cost, ULC NOC (if applicable) and all other construction costs will be subtracted when figuring out the profit. The numbers and areas in the table are estimates and could change based on actual market rates.</em></p>`,
    items: summaryItems,
  };

  // ---------- Score & sensitivity ----------
  const analysisSection: ReportSection = {
    id: 'analysis',
    title: 'Feasibility Score & Sensitivity',
    prose: `<p>Breakeven residential sale rate is <strong>Rs. ${formatRupees(sensitivity.breakevenResidentialRatePerSqft)}/Sq.ft.</strong> against an assumed Rs. ${formatRupees(i.residentialSaleRatePerSqft)}. Breakeven construction cost is <strong>Rs. ${formatRupees(sensitivity.breakevenConstructionRatePerSqft)}/Sq.ft.</strong> against an assumed Rs. ${formatRupees(i.constructionRatePerSqft)}.</p>`,
    items: [
      ...score.components.map((c) => ({
        id: `score.${c.id}`,
        label: `${c.label} (${c.points} / ${c.weight} pts, ${c.band})`,
        value: c.rawValue,
        unit: c.unit,
        note: c.explanation,
      })),
      {
        id: 'score.total',
        label: `Feasibility score - ${score.verdict}`,
        value: score.score,
        unit: 'ratio',
        emphasis: true,
      },
      ...sensitivity.rows.map((row) => ({
        id: `sens.${row.variable}.${row.deltaPct}`,
        label: `${row.variable} ${row.deltaPct > 0 ? '+' : ''}${row.deltaPct}%`,
        value: row.netProfit,
        unit: 'inr' as const,
        note: `${row.deltaProfit >= 0 ? '+' : ''}${formatCrore(row.deltaProfit)} vs base, margin ${formatPercent(row.marginPct)}`,
      })),
    ],
  };

  // ---------- Scheme comparison ----------
  const comparisonSection: ReportSection = {
    id: 'comparison',
    title: 'Scheme Comparison',
    prose:
      '<p>The same plot appraised under each redevelopment route. The scheme decides the incentive FSI, which is the largest single lever on the outcome after road width.</p>',
    items: r.schemeComparison.flatMap((row) => [
      {
        id: `cmp.${row.schemeType}.head`,
        label: `${row.label} (${row.regulation})${row.isCurrent ? '  - selected' : ''}`,
        value: 0,
        unit: 'ratio' as const,
        emphasis: true,
      },
      sqm(`cmp.${row.schemeType}.incentive`, 'Incentive FSI', row.incentiveFsiSqm, { indent: 1 }),
      sqft(`cmp.${row.schemeType}.carpet`, 'Developer carpet', row.developerCarpetSqft, { indent: 1 }),
      money(`cmp.${row.schemeType}.profit`, 'Net profit', row.netProfit, { indent: 1 }),
      {
        id: `cmp.${row.schemeType}.margin`,
        label: 'Margin',
        value: row.marginPct,
        unit: 'pct' as const,
        indent: 1,
        note: `Feasibility score ${formatNumber(row.score, 1)}`,
      },
    ]),
  };

  return [fsiSection, areaSection, municipalSection, costSection, summarySection, analysisSection, comparisonSection];
}
