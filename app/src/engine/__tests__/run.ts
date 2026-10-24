/**
 * Acceptance test: the engine must reproduce the client's own
 * "Project Report Sita Smruti 25% Additonal" dated 26/05/2026.
 *
 * Run with:  npm test
 */
import { calculateFeasibility } from '../calculate';
import { CRORE, DEFAULT_INPUTS, createBlankInputs, normaliseInputs } from '../constants';
import { formatArea, formatCrore, formatNumber, round } from '../format';
import { solveResidual } from '../solve';
import type { FeasibilityInputs } from '../types';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, actual: number, expected: number, tolerance: number, unit = '') {
  const delta = Math.abs(actual - expected);
  const ok = delta <= tolerance;
  if (ok) {
    passed++;
    console.log(`  PASS  ${label.padEnd(52)} ${formatNumber(actual)}${unit}`);
  } else {
    failed++;
    const msg = `${label}: expected ${formatNumber(expected)}${unit}, got ${formatNumber(actual)}${unit} (delta ${formatNumber(delta)})`;
    failures.push(msg);
    console.log(`  FAIL  ${label.padEnd(52)} ${formatNumber(actual)}${unit}  <- expected ${formatNumber(expected)}${unit}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
  console.log('-'.repeat(78));
}

// The source report was run at a 25% tenant uplift, and it treated the scheme
// incentive area as saleable. DEFAULT_INPUTS otherwise carries the Sita Smruti
// parameters; the application now defaults incentive area to the members, so
// reproducing the published document means pinning both.
const sita: FeasibilityInputs = {
  ...DEFAULT_INPUTS,
  additionalCarpetToTenantsPct: 0.25,
  incentiveAreaTreatment: 'SALEABLE',
};
const r = calculateFeasibility(sita);

console.log('='.repeat(78));
console.log('ACCEPTANCE TEST - Project Report: Sita Smruti, Village Bhayandar, 26/05/2026');
console.log('='.repeat(78));

section('Page 1 - Maximum permissible FSI (Sq.mt.)');
check('Balance plot area', r.fsi.balancePlotAreaSqm, 2845.0, 0.01);
check('Path A: Basic FSI area', r.fsi.pathA.basicFsiAreaSqm, 3129.5, 0.01);
check('Path A: Premium FSI in TOD zone', r.fsi.pathA.premiumFsiAreaSqm, 10077.6, 0.01);
check('Path A: Minimum 25% TDR to be loaded', r.fsi.pathA.minTdrToBeLoadedSqm, 2519.4, 0.01);
check('Path A: In-situ FSI (DP road)', r.fsi.pathA.inSituFsiSqm, 2708.0, 0.01);
check('Path A: Balance premium FSI', r.fsi.pathA.balancePremiumFsiSqm, 7369.6, 0.01);
check('Path A: Total permissible BUA', r.fsi.pathA.totalSqm, 13207.1, 0.01);
check('Path B: Incentive FSI (15 x 111 tenements)', r.fsi.pathB.incentiveFsiSqm, 1665.0, 0.01);
check('Path B: Premium FSI (0.5 x plot)', r.fsi.pathB.premiumFsiSqm, 2099.5, 0.01);
check('Path B: Balance TDR FSI', r.fsi.pathB.balanceTdrFsiSqm, 5441.86, 0.01);
check('Path B: TDR to be purchased', r.fsi.pathB.tdrToPurchaseSqm, 2733.86, 0.01);
check('Path B: Total permissible BUA', r.fsi.pathB.totalSqm, 13207.1, 0.01);
check('Governing permissible BUA', r.fsi.totalPermissibleBuaSqm, 13207.1, 0.01);

section('Page 2 - Area statement');
check('Commercial BUA', r.areas.commercialBuaSqm, 1112.0, 0.01);
check('Residential BUA', r.areas.residentialBuaSqm, 12095.1, 0.01);
check('Ancillary commercial (80%)', r.areas.ancillaryCommercialSqm, 889.6, 0.01);
check('Ancillary residential (60%)', r.areas.ancillaryResidentialSqm, 7257.06, 0.01);
check('Total ancillary FSI', r.areas.totalAncillarySqm, 8146.66, 0.01);
check('Total BUA incl. ancillary (Sq.mt.)', r.areas.totalBuaInclAncillarySqm, 21353.76, 0.01);
check('Total BUA incl. ancillary (Sq.ft.)', r.areas.totalBuaInclAncillarySqft, 229852.0, 1.0);
check('Approx. RERA carpet available', r.areas.approxReraCarpetSqft, 174130.0, 1.0);
check('Existing residential RERA carpet', r.areas.existingResidentialReraCarpetSqft, 41804.0, 1.0);
check('Total existing RERA carpet', r.areas.totalExistingReraCarpetSqft, 47477.0, 1.0);
check('25% additional carpet to tenants', r.areas.additionalCarpetToTenantsSqft, 10451.0, 1.0);
check('Balance carpet for developer', r.areas.developerBalanceCarpetSqft, 116202.0, 1.0);
check('Developer residential carpet', r.areas.developerResidentialCarpetSqft, 105275.0, 1.0);
check('Developer commercial carpet', r.areas.developerCommercialCarpetSqft, 10927.0, 1.0);

section('Page 2 - Income (Rs. Cr)');
check('Residential income', r.income.residentialIncome / CRORE, 173.7, 0.01, ' Cr');
check('Commercial income', r.income.commercialIncome / CRORE, 19.67, 0.01, ' Cr');
check('Total income', r.income.totalIncome / CRORE, 193.37, 0.01, ' Cr');

section('Page 3 - Municipal charges (Rs.)');
const dev = r.expenses.developmentCharges.items;
const byId = (id: string) => dev.find((d) => d.id === id)?.value ?? NaN;
check('Payment towards premium FSI', r.expenses.premiumAndAncillary.items[0].value, 29980860, 1);
check('Payment towards ancillary area', r.expenses.premiumAndAncillary.items[1].value, 33238373, 1);
check('Premium & ancillary total (Cr)', r.expenses.premiumAndAncillary.amount / CRORE, 6.32, 0.005, ' Cr');
check('Land development charges (Corp.)', byId('exp.dev.landCorp'), 856596, 1);
check('Land development charges (Metro)', byId('exp.dev.landMetro'), 856596, 1);
check('Development charges - commercial (Corp.)', byId('exp.dev.commCorp'), 3266612, 1);
check('Development charges - residential (Corp.)', byId('exp.dev.resCorp'), 15791363, 1);
check('Scrutiny fee', byId('exp.dev.scrutiny'), 108869, 1);
check('Development fee (capped)', byId('exp.dev.fee'), 200000, 1);
check('Labour tax', byId('exp.dev.labour'), 7925160, 5);
check('Fire capitation fee', byId('exp.dev.fire'), 7088440, 1);
check('Development charges total (Cr)', r.expenses.developmentCharges.amount / CRORE, 5.52, 0.005, ' Cr');
check('TDR cost (Cr)', r.expenses.tdrCost.amount / CRORE, 6.25, 0.005, ' Cr');

section('Page 4 - Construction & project costs (Rs. Cr)');
check('Cost of construction', r.expenses.construction.amount / CRORE, 94.93, 0.01, ' Cr');
check('Professional fees', r.expenses.professionalFees.amount / CRORE, 2.3, 0.005, ' Cr');
check('Agent commission & advertising', r.expenses.agentCommission.amount / CRORE, 7.73, 0.005, ' Cr');
check('Office expense', r.expenses.officeExpense.amount / CRORE, 1.8, 0.005, ' Cr');
check('Shop rent (36 months)', r.expenses.rentAndServices.items[0].value, 20422800, 1);
check('Flat rent (36 months)', r.expenses.rentAndServices.items[1].value, 57882240, 1);
check('Rent brokerage', r.expenses.rentAndServices.items[2].value, 4350000, 1);
check('Rent & services total (Cr)', r.expenses.rentAndServices.amount / CRORE, 8.27, 0.005, ' Cr');
check('Other incidentals till OC (Cr)', r.expenses.incidentals.amount / CRORE, 9.19, 0.005, ' Cr');

section('Page 5 - Summary (Rs. Cr)');
check('Total expenditure (precise)', r.summary.totalExpenditure / CRORE, 149.31, 0.02, ' Cr');
check('Net profit (precise)', r.summary.netProfit / CRORE, 44.06, 0.02, ' Cr');
check('Profit margin', r.summary.marginPct, 22.79, 0.05, '%');

/**
 * Reconciliation with the published report.
 *
 * The source document rounds three heads UP to a "Say Rs. X Cr" figure before
 * summing, which is why it prints Rs. 149.40 Cr / Rs. 43.97 Cr where the precise
 * arithmetic gives Rs. 149.31 Cr / Rs. 44.06 Cr. Applying the same three
 * round-ups reproduces the published total exactly.
 */
section('Reconciliation with the published "Say" figures');
const published = {
  premiumAncillary: 6.32,
  developmentCharges: 5.52,
  tdr: 6.25,
  incidentals: 9.2, // precise 9.19 - report rounds the area basis up to 2.30 lakh Sq.ft.
  construction: 95.0, // precise 94.93 - report states "Say Rs. 95.00 Cr"
  professional: 2.3,
  commission: 7.74, // precise 7.73 - report rounds up
  office: 1.8,
  rent: 8.27,
  environmental: 2.0,
  stampDuty: 0,
  misc: 5.0,
};
const publishedTotal = Object.values(published).reduce((a, b) => a + b, 0);
const publishedProfit = 193.37 - publishedTotal;
check('Published total expenditure', publishedTotal, 149.4, 0.005, ' Cr');
check('Published net profit', publishedProfit, 43.97, 0.005, ' Cr');

const roundUpDelta =
  published.incidentals -
  r.expenses.incidentals.amount / CRORE +
  (published.construction - r.expenses.construction.amount / CRORE) +
  (published.commission - r.expenses.agentCommission.amount / CRORE);
console.log(
  `\n  The three round-ups account for ${formatNumber(roundUpDelta)} Cr of difference ` +
    `(${formatCrore(r.summary.netProfit)} precise vs Rs. 43.97 Cr published).`,
);

section('Derived analysis');
console.log(`  Feasibility score      ${formatNumber(r.score.score, 1)} / 100  -  ${r.score.verdict}`);
r.score.components.forEach((c) =>
  console.log(`    - ${c.label.padEnd(24)} ${formatNumber(c.rawValue)}%  ${c.points}/${c.weight} pts (${c.band})`),
);
console.log(
  `  Breakeven residential rate  Rs. ${formatNumber(r.sensitivity.breakevenResidentialRatePerSqft, 0)}/Sq.ft. (assumed Rs. 16,500)`,
);
console.log(
  `  Breakeven construction rate Rs. ${formatNumber(r.sensitivity.breakevenConstructionRatePerSqft, 0)}/Sq.ft. (assumed Rs. 4,130)`,
);
console.log(`  Document sections built     ${r.sections.length}`);
console.log(`  Warnings raised             ${r.warnings.length}`);
r.warnings.forEach((x) => console.log(`    ! ${x}`));

// ---- A second scenario: the 20% uplift the standing brief actually specifies ----
section('Scenario check - 20% tenant uplift (the standing brief)');
const at20 = calculateFeasibility({ ...sita, additionalCarpetToTenantsPct: 0.2 });
console.log(`  Developer balance carpet    ${formatNumber(at20.areas.developerBalanceCarpetSqft)} Sq.ft.`);
console.log(`  Net profit                  ${formatCrore(at20.summary.netProfit)}`);
console.log(`  Margin                      ${formatNumber(at20.summary.marginPct)}%`);
console.log(`  Feasibility score           ${formatNumber(at20.score.score, 1)} - ${at20.score.verdict}`);
if (at20.summary.netProfit <= r.summary.netProfit) {
  failed++;
  failures.push('A 20% uplift should leave MORE area for the developer than 25%, so profit should be higher.');
  console.log('  FAIL  profit at 20% uplift should exceed profit at 25%');
} else {
  passed++;
  console.log(
    `  PASS  a 20% uplift returns ${formatCrore(at20.summary.netProfit - r.summary.netProfit)} more profit than 25%`,
  );
}

// ---------------------------------------------------------------------------
// Cascade tests - the client's core requirement:
// "each changed metric should change the other, i.e. road width should change
//  max permissible FSI and therefore calculations"
// ---------------------------------------------------------------------------
section('Cascade - road width drives FSI, area, income and profit');

const widths = [12, 15, 18, 24, 30];
const cascade = widths.map((w) => {
  // Percentage splits so the mix rescales with the permissible area.
  const r2 = calculateFeasibility({
    ...sita,
    roadWidthM: w,
    commercialSplitMode: 'PERCENT',
    commercialSharePct: 8.42,
    developerSplitMode: 'PERCENT',
    developerCommercialSharePct: 9.4,
  });
  return {
    w,
    todFsi: r2.effectiveInputs.todMaxFsi,
    bua: r2.fsi.totalPermissibleBuaSqm,
    carpet: r2.areas.developerBalanceCarpetSqft,
    income: r2.income.totalIncome,
    profit: r2.summary.netProfit,
  };
});

console.log('  road   TOD FSI    permissible BUA        developer carpet        income      net profit');
cascade.forEach((c) =>
  console.log(
    `  ${String(c.w).padStart(4)}m   ${c.todFsi.toFixed(2).padStart(5)}   ${formatNumber(c.bua).padStart(14)} Sq.mt.  ${formatNumber(c.carpet).padStart(14)} Sq.ft.  ${formatCrore(c.income).padStart(14)}  ${formatCrore(c.profit).padStart(14)}`,
  ),
);

// The TOD table itself (Reg. 14.2.1.2).
check('TOD FSI at 12 m road', cascade[0].todFsi, 3.0, 1e-9);
check('TOD FSI at 15 m road', cascade[1].todFsi, 3.5, 1e-9);
check('TOD FSI at 18 m road', cascade[2].todFsi, 3.5, 1e-9);
check('TOD FSI at 24 m road', cascade[3].todFsi, 4.0, 1e-9);
check('TOD FSI at 30 m road', cascade[4].todFsi, 4.0, 1e-9);

// Each step up in the FSI band must raise permissible area, saleable carpet,
// income and profit - monotonically, with no manual re-entry.
for (let idx = 1; idx < cascade.length; idx++) {
  const prev = cascade[idx - 1];
  const cur = cascade[idx];
  if (cur.todFsi <= prev.todFsi) continue; // same band, nothing to prove
  const ok = cur.bua > prev.bua && cur.carpet > prev.carpet && cur.income > prev.income && cur.profit > prev.profit;
  if (ok) {
    passed++;
    console.log(
      `  PASS  ${prev.w}m -> ${cur.w}m cascades: FSI ${prev.todFsi} -> ${cur.todFsi}, profit ${formatCrore(prev.profit)} -> ${formatCrore(cur.profit)}`,
    );
  } else {
    failed++;
    failures.push(`Road width ${prev.w}m -> ${cur.w}m did not cascade through to profit.`);
    console.log(`  FAIL  ${prev.w}m -> ${cur.w}m did not cascade`);
  }
}

section('Cascade - existing building drives hand-back and saleable area');
const biggerExisting = calculateFeasibility({ ...sita, existingResidentialCarpetSqft: 50000 });
console.log(
  `  Existing residential carpet 40,196 -> 50,000 Sq.ft.\n` +
    `    hand-back to tenants   ${formatNumber(r.areas.totalExistingReraCarpetSqft + r.areas.additionalCarpetToTenantsSqft)} -> ${formatNumber(biggerExisting.areas.totalExistingReraCarpetSqft + biggerExisting.areas.additionalCarpetToTenantsSqft)} Sq.ft.\n` +
    `    developer carpet       ${formatNumber(r.areas.developerBalanceCarpetSqft)} -> ${formatNumber(biggerExisting.areas.developerBalanceCarpetSqft)} Sq.ft.\n` +
    `    net profit             ${formatCrore(r.summary.netProfit)} -> ${formatCrore(biggerExisting.summary.netProfit)}`,
);
if (
  biggerExisting.areas.developerBalanceCarpetSqft < r.areas.developerBalanceCarpetSqft &&
  biggerExisting.summary.netProfit < r.summary.netProfit
) {
  passed++;
  console.log('  PASS  more existing area returned to tenants leaves less for sale, and less profit');
} else {
  failed++;
  failures.push('Increasing existing carpet area should reduce the developer balance and the profit.');
  console.log('  FAIL  existing area did not cascade');
}

section('Derivation - every scheme parameter comes off the regulations');
const noOverrides = calculateFeasibility({ ...sita, overrides: [] });
noOverrides.derived.forEach((d) =>
  console.log(`  ${d.label.padEnd(38)} ${String(d.value).padStart(9)}   ${d.regulation} - ${d.basis}`),
);
console.log('\n  Schemes:');
noOverrides.schemes.forEach((s) => console.log(`    ${s.applies ? 'YES' : 'no '}  ${s.label.padEnd(38)} ${s.reason}`));

// A pinned value must survive derivation.
const pinned = calculateFeasibility({ ...sita, overrides: ['basicFsi'], basicFsi: 2.0 });
check('Pinned basic FSI survives derivation', pinned.effectiveInputs.basicFsi, 2.0, 1e-9);
check('Unpinned basic FSI still derives', noOverrides.effectiveInputs.basicFsi, 1.1, 1e-9);

// ---------------------------------------------------------------------------
// Scheme selection - the same plot appraised under each regulation
// ---------------------------------------------------------------------------
section('Scheme - the chosen regulation drives incentive FSI');

const schemeRuns = (['STANDARD', 'SOCIETY_REDEV', 'TENANTED_REDEV', 'TOD'] as const).map((s) => {
  const run = calculateFeasibility({ ...sita, schemeType: s });
  return { s, incentive: run.fsi.pathB.incentiveFsiSqm, bua: run.fsi.totalPermissibleBuaSqm, profit: run.summary.netProfit };
});
schemeRuns.forEach((x) =>
  console.log(
    `  ${x.s.padEnd(16)} incentive FSI ${formatNumber(x.incentive).padStart(10)} Sq.mt.   BUA ${formatNumber(x.bua).padStart(11)} Sq.mt.   profit ${formatCrore(x.profit)}`,
  ),
);

// Reg. 7.6.1: 30% of 4,000.74 = 1,200.22, or 15 x 111 = 1,665.00 -> 1,665.00
check('Society redevelopment incentive (Reg. 7.6.1)', schemeRuns[1].incentive, 1665.0, 0.01);
// Reg. 7.6.2: 50% of max(4,000.74, 27.87 x 111 = 3,093.57) = 2,000.37
check('Tenanted redevelopment incentive (Reg. 7.6.2)', schemeRuns[2].incentive, 2000.37, 0.01);
// Standard development carries no incentive FSI at all.
check('Standard development incentive', schemeRuns[0].incentive, 0, 1e-9);

section('Corner plot and road widening - the wider road governs');
const corner = calculateFeasibility({ ...sita, roadWidthM: 12, secondRoadWidthM: 24 });
const widened = calculateFeasibility({ ...sita, roadWidthM: 12, proposedRoadWidthM: 24 });
const plain12 = calculateFeasibility({ ...sita, roadWidthM: 12 });
console.log(`  12 m only                    TOD FSI ${plain12.effectiveInputs.todMaxFsi.toFixed(2)}`);
console.log(`  12 m + 24 m corner road      TOD FSI ${corner.effectiveInputs.todMaxFsi.toFixed(2)}`);
console.log(`  12 m widened to 24 m         TOD FSI ${widened.effectiveInputs.todMaxFsi.toFixed(2)}`);
check('Corner plot takes the wider road', corner.effectiveInputs.todMaxFsi, 4.0, 1e-9);
check('Sanctioned widening takes effect', widened.effectiveInputs.todMaxFsi, 4.0, 1e-9);
check('Plain 12 m road stays in its band', plain12.effectiveInputs.todMaxFsi, 3.0, 1e-9);

section('Construction cost basis and land cost');
const onCarpet = calculateFeasibility({ ...sita, constructionCostBasis: 'CARPET' });
const onBuiltUp = calculateFeasibility({ ...sita, constructionCostBasis: 'BUILTUP' });
console.log(`  on RERA carpet     ${formatCrore(onCarpet.expenses.construction.amount)}`);
console.log(`  on built-up        ${formatCrore(onBuiltUp.expenses.construction.amount)}`);
console.log(`  on super built-up  ${formatCrore(r.expenses.construction.amount)}`);
if (
  onCarpet.expenses.construction.amount < onBuiltUp.expenses.construction.amount &&
  onBuiltUp.expenses.construction.amount < r.expenses.construction.amount
) {
  passed++;
  console.log('  PASS  cost basis orders correctly: carpet < built-up < super built-up');
} else {
  failed++;
  failures.push('Construction cost basis did not order carpet < built-up < super built-up.');
  console.log('  FAIL  cost basis ordering');
}

const withLand = calculateFeasibility({ ...sita, landRatePerSqft: 5000 });
console.log(
  `  land at Rs 5,000/Sq.ft adds ${formatCrore(withLand.summary.totalExpenditure - r.summary.totalExpenditure)}, profit ${formatCrore(r.summary.netProfit)} -> ${formatCrore(withLand.summary.netProfit)}`,
);
if (withLand.summary.netProfit < r.summary.netProfit) {
  passed++;
  console.log('  PASS  land cost reduces profit');
} else {
  failed++;
  failures.push('Adding a land rate should reduce profit.');
}

section('Design-capped massing');
const capped = calculateFeasibility({ ...sita, analysisBasis: 'DESIGN_CAPPED', floors: 7, groundCoveragePct: 55 });
console.log(
  `  Max potential : ${formatArea(r.areas.totalBuaInclAncillarySqm)} incl. ancillary -> profit ${formatCrore(r.summary.netProfit)}\n` +
    `  7 floors @55% : ${formatArea(capped.areas.totalBuaInclAncillarySqm)} incl. ancillary -> profit ${formatCrore(capped.summary.netProfit)}`,
);
if (capped.summary.netProfit < r.summary.netProfit) {
  passed++;
  console.log('  PASS  a design cap below the entitlement reduces saleable area and profit');
} else {
  failed++;
  failures.push('Design-capped massing should reduce profit versus max potential.');
}

section('Blank project - New report must not inherit another site');
const blank = createBlankInputs('MBMC');
const blankChecks: [string, boolean][] = [
  ['project name empty', blank.projectName === ''],
  ['plot area zero', blank.plotAreaConveyanceSqm === 0],
  ['existing built-up zero', blank.existingBuiltUpAreaSqm === 0],
  ['tenements zero', blank.residentialTenements === 0],
  ['no TOD assumed', blank.isTodZone === false],
  ['building mix proportional', blank.commercialSplitMode === 'PERCENT'],
  ['sale mix follows the building mix', blank.developerSplitMode === 'FOLLOW_BUILDING'],
  ['tenant uplift 20%', Math.abs(blank.additionalCarpetToTenantsPct - 0.2) < 1e-9],
  ['rate master loaded', blank.asrRatePerSqm === 40800],
];
blankChecks.forEach(([label, ok]) => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(`Blank inputs: ${label}`);
    console.log(`  FAIL  ${label}`);
  }
});

// ---------------------------------------------------------------------------
// Residual solver and plausibility checks
// ---------------------------------------------------------------------------
section('Residual - what can be offered at a target margin');
const residual = solveResidual(sita, 20);
console.log(`  Current margin              ${formatNumber(residual.currentMarginPct)}%`);
console.log(`  Max corpus to society       ${formatCrore(residual.maxCorpusFund)}`);
console.log(
  `  Max tenant uplift           ${residual.maxTenantUpliftPct === null ? 'n/a' : formatNumber(residual.maxTenantUpliftPct * 100, 1) + '%'}`,
);
console.log(`  Max land price              ${formatCrore(residual.maxLandCost)}`);
console.log(`  Construction ceiling        Rs. ${formatNumber(residual.maxConstructionRatePerSqft, 0)}/sq.ft`);
console.log(`  Sale rate floor             Rs. ${formatNumber(residual.minResidentialSaleRatePerSqft, 0)}/sq.ft`);

// Applying the solved corpus should land the margin on the target, whichever
// basis it is quoted on.
const atCorpus = calculateFeasibility({
  ...sita,
  corpusFundBasis: 'LUMP_SUM',
  corpusFundCost: residual.maxCorpusFund,
});
check('Solved corpus hits the 20% target', atCorpus.summary.marginPct, 20, 0.05, '%');

const atCorpusRate = calculateFeasibility({
  ...sita,
  corpusFundBasis: 'PER_SQFT_EXISTING_CARPET',
  corpusFundRatePerSqft: residual.maxCorpusRatePerSqft,
});
check('Solved corpus rate per sq.ft. hits the target', atCorpusRate.summary.marginPct, 20, 0.05, '%');

// Same for the solved uplift.
if (residual.maxTenantUpliftPct !== null && residual.maxTenantUpliftPct < 1) {
  const atUplift = calculateFeasibility({ ...sita, additionalCarpetToTenantsPct: residual.maxTenantUpliftPct });
  check('Solved tenant uplift hits the 20% target', atUplift.summary.marginPct, 20, 0.05, '%');
}

// And the construction ceiling.
const atCeiling = calculateFeasibility({ ...sita, constructionRatePerSqft: residual.maxConstructionRatePerSqft });
check('Solved construction ceiling hits the target', atCeiling.summary.marginPct, 20, 0.05, '%');

section('Plausibility checks catch bad data');
const dodgy = calculateFeasibility({
  ...sita,
  residentialTenements: 7, // 7 flats over 40,196 sq.ft = 5,742 sq.ft each
  constructionRatePerSqft: 250, // an order of magnitude out
});
const ids = dodgy.checks.map((c) => c.id);
console.log(`  Issues raised: ${ids.join(', ')}`);
[
  ['existing.flatSize', 'implausible flat size'],
  ['rate.construction', 'construction rate out of range'],
].forEach(([id, label]) => {
  if (ids.includes(id)) {
    passed++;
    console.log(`  PASS  caught ${label}`);
  } else {
    failed++;
    failures.push(`Plausibility check did not catch ${label}.`);
    console.log(`  FAIL  missed ${label}`);
  }
});
if (r.checks.filter((c) => c.severity === 'error').length === 0) {
  passed++;
  console.log('  PASS  the reference project raises no errors');
} else {
  failed++;
  failures.push('The Sita Smruti reference project should raise no plausibility errors.');
}

section('Report headline and ruleset stamp');
console.log(`  ${r.headline}`);
console.log(`  Ruleset: ${r.ruleset}`);
console.log(`  Scheme comparison rows: ${r.schemeComparison.length}`);
if (r.headline.includes('2,29,851') || r.headline.includes('2,29,852')) {
  passed++;
  console.log('  PASS  headline states the buildable area');
} else {
  failed++;
  failures.push('Headline should state the buildable area.');
}

// ---------------------------------------------------------------------------
// Regulation gaps found in the reference tool's redevelopment panel
// ---------------------------------------------------------------------------
section('Reg. 7.6.1(ii) - minimum 27.87 Sq.mt. carpet top-up');
const smallFlats = calculateFeasibility({ ...sita, avgExistingCarpetPerTenementSqm: 22 });
// (27.87 - 22) x 111 tenements = 651.57 Sq.mt., allowed premium-free
check('Premium-free top-up area', smallFlats.fsi.pathB.minCarpetTopUpSqm, 651.57, 0.01);
check('No top-up when carpet already meets the minimum',
  calculateFeasibility({ ...sita, avgExistingCarpetPerTenementSqm: 40 }).fsi.pathB.minCarpetTopUpSqm, 0, 1e-9);
check('No top-up when the average is not supplied', r.fsi.pathB.minCarpetTopUpSqm, 0, 1e-9);
console.log(
  `  Top-up also leaves the saleable pool: developer carpet ${formatNumber(r.areas.developerBalanceCarpetSqft)} -> ${formatNumber(smallFlats.areas.developerBalanceCarpetSqft)} Sq.ft.`,
);
if (smallFlats.areas.developerBalanceCarpetSqft < r.areas.developerBalanceCarpetSqft) {
  passed++;
  console.log('  PASS  the top-up is handed to members, not sold');
} else {
  failed++;
  failures.push('The minimum-carpet top-up should reduce the developer balance.');
}

section('Reg. 7.6 Note 3 - redevelopment Development Cess');
const withCess = calculateFeasibility({ ...sita, redevCessRatePerSqm: 3000 });
const cessLine = withCess.expenses.developmentCharges.items.find((x) => x.id === 'exp.dev.redevCess');
const baseFsiArea = sita.basicFsi * sita.plotAreaConveyanceSqm;
const expectedCess = (withCess.areas.totalBuaInclAncillarySqm - baseFsiArea) * 3000;
check('Cess charged on built-up above base FSI', cessLine?.value ?? 0, expectedCess, 1);
check('Cess is zero until the rate is supplied',
  r.expenses.developmentCharges.items.find((x) => x.id === 'exp.dev.redevCess')?.value ?? -1, 0, 1e-9);

section('Table 14-O - Nagpur gates TOD on plot area as well as road width');
const nagpur = (plot: number, road: number) =>
  calculateFeasibility({ ...sita, authority: 'NAGPUR', plotAreaConveyanceSqm: plot, roadWidthM: road })
    .effectiveInputs.todMaxFsi;
console.log(`  9 m road,  800 Sq.mt. plot -> FSI ${nagpur(800, 9).toFixed(2)}`);
console.log(`  9 m road, 1500 Sq.mt. plot -> FSI ${nagpur(1500, 9).toFixed(2)}`);
console.log(`  12 m road, 2500 Sq.mt. plot -> FSI ${nagpur(2500, 12).toFixed(2)}`);
console.log(`  15 m road, 2500 Sq.mt. plot -> FSI ${nagpur(2500, 15).toFixed(2)}`);
console.log(`  15 m road, 1500 Sq.mt. plot -> FSI ${nagpur(1500, 15).toFixed(2)}  (plot too small for 4.00)`);
check('Table 14-O: 9 m / under 1000 Sq.mt.', nagpur(800, 9), 2.0, 1e-9);
check('Table 14-O: 9 m / 1000+ Sq.mt.', nagpur(1500, 9), 3.0, 1e-9);
check('Table 14-O: 12 m / 2000+ Sq.mt.', nagpur(2500, 12), 3.5, 1e-9);
check('Table 14-O: 15 m / 2000+ Sq.mt.', nagpur(2500, 15), 4.0, 1e-9);
check('Table 14-O: plot area caps the uplift', nagpur(1500, 15), 3.0, 1e-9);
// MMR still bands on road width alone.
check('MBMC ignores the plot-area gate',
  calculateFeasibility({ ...sita, plotAreaConveyanceSqm: 800, roadWidthM: 24 }).effectiveInputs.todMaxFsi, 4.0, 1e-9);

// ---------------------------------------------------------------------------
// Builder feedback, February 2026
// ---------------------------------------------------------------------------
section('Scheme details must not move the income line');

// A larger existing building pushes Path B past Path A, so under the old
// behaviour the incentive inflated the saleable pool. Retained by the members,
// the income has to come out identical whichever scheme is selected.
// A proportional commercial split, so the physical mix of the building - and
// therefore its loading - is held constant while the scheme varies.
const bigExisting: FeasibilityInputs = {
  ...DEFAULT_INPUTS,
  existingBuiltUpAreaSqm: 11000,
  residentialTenements: 240,
  commercialSplitMode: 'PERCENT',
  commercialSharePct: 8.42,
  developerSplitMode: 'PERCENT',
  developerCommercialSharePct: 9.4,
};
const incomeByScheme = (['SOCIETY_REDEV', 'TENANTED_REDEV', 'STANDARD'] as const).map((s) => ({
  s,
  run: calculateFeasibility({ ...bigExisting, schemeType: s }),
}));
incomeByScheme.forEach((x) =>
  console.log(
    `  ${x.s.padEnd(16)} incentive ${formatNumber(x.run.fsi.pathB.incentiveFsiSqm).padStart(10)} Sq.mt.   BUA ${formatNumber(x.run.fsi.totalPermissibleBuaSqm).padStart(11)} Sq.mt.   income ${formatCrore(x.run.income.totalIncome)}`,
  ),
);
const incomeSpread =
  Math.max(...incomeByScheme.map((x) => x.run.income.totalIncome)) -
  Math.min(...incomeByScheme.map((x) => x.run.income.totalIncome));
check('Income is identical across schemes', incomeSpread, 0, 1);

// And the incentive genuinely reaches the members rather than vanishing.
const societyRun = incomeByScheme[0].run;
if (societyRun.areas.incentiveCarpetToMembersSqft > 0) {
  passed++;
  console.log(
    `  PASS  ${formatNumber(societyRun.areas.incentiveCarpetToMembersSqft)} Sq.ft. of incentive carpet is handed to the members, not sold`,
  );
} else {
  failed++;
  failures.push('The scheme incentive should carve carpet out of the saleable pool for the members.');
}

// Opting the incentive back into the sale pool must restore the old behaviour.
const asSaleable = calculateFeasibility({ ...bigExisting, incentiveAreaTreatment: 'SALEABLE' });
if (asSaleable.income.totalIncome > societyRun.income.totalIncome) {
  passed++;
  console.log(
    `  PASS  treating incentive as saleable lifts income ${formatCrore(societyRun.income.totalIncome)} -> ${formatCrore(asSaleable.income.totalIncome)}`,
  );
} else {
  failed++;
  failures.push('Setting incentiveAreaTreatment to SALEABLE should raise income.');
}

section('Corpus fund on the members\' existing carpet area');
const corpusRun = calculateFeasibility({
  ...sita,
  corpusFundBasis: 'PER_SQFT_EXISTING_CARPET',
  corpusFundRatePerSqft: 1500,
});
const corpusLine = corpusRun.expenses.otherHeads.items.find((x) => x.id === 'exp.other.corpus');
const expectedCorpus = (sita.existingResidentialCarpetSqft + sita.existingCommercialCarpetSqft) * 1500;
check('Corpus = rate x existing carpet', corpusLine?.value ?? 0, expectedCorpus, 1);
check(
  'Lump-sum basis still honours the entered figure',
  calculateFeasibility({ ...sita, corpusFundBasis: 'LUMP_SUM', corpusFundCost: 5 * CRORE }).expenses.otherHeads.items.find(
    (x) => x.id === 'exp.other.corpus',
  )?.value ?? 0,
  5 * CRORE,
  1,
);

section('Ancillary expenses as an input');
const ancillaryRun = calculateFeasibility({
  ...sita,
  ancillaryExpenseLumpSum: 2 * CRORE,
  ancillaryExpenseRatePerSqft: 25,
});
const expectedAncillary = 2 * CRORE + ancillaryRun.areas.totalBuaInclAncillarySqft * 25;
check('Ancillary expense head totals lump sum + rate', ancillaryRun.expenses.ancillaryExpenses.amount, expectedAncillary, 1);
if (ancillaryRun.summary.totalExpenditure > r.summary.totalExpenditure) {
  passed++;
  console.log('  PASS  ancillary expenses reach the expenditure total');
} else {
  failed++;
  failures.push('Ancillary expenses should increase total expenditure.');
}

// ---------------------------------------------------------------------------
// DCPR-2034 - Greater Mumbai
// ---------------------------------------------------------------------------
section('One mix slider - the sale mix follows the building mix');

// The builder asked for a single control: the shops in the new building are the
// commercial area, so the commercial share of what is left to sell is the
// commercial share of the building. The source report set the two separately at
// 8.42% of BUA and 9.4% of balance carpet - and 9.4% is exactly what the
// building mix implies once the different ancillary loading is applied, which is
// why one lever is enough.
const followed = calculateFeasibility({ ...sita, developerSplitMode: 'FOLLOW_BUILDING' });
const impliedSharePct =
  (followed.areas.developerCommercialCarpetSqft / followed.areas.developerBalanceCarpetSqft) * 100;

check("Derived sale mix matches the report's 9.4%", impliedSharePct, 9.4, 0.05, '%');
check(
  'Derived commercial carpet is the pinned figure less rounding',
  followed.areas.developerCommercialCarpetSqft,
  10927,
  40,
  ' sq.ft',
);
check(
  'Residential carpet takes the remainder',
  followed.areas.developerResidentialCarpetSqft + followed.areas.developerCommercialCarpetSqft,
  followed.areas.developerBalanceCarpetSqft,
  0.01,
  ' sq.ft',
);

// The single slider has to move cost and income together. Under the old two
// slider arrangement, dragging the building mix moved the development charge
// while the sale mix - and therefore the income - stood still.
const atShare = (pct: number) =>
  calculateFeasibility({
    ...sita,
    developerSplitMode: 'FOLLOW_BUILDING',
    commercialSplitMode: 'PERCENT',
    commercialSharePct: pct,
  });
const lowMix = atShare(5);
const highMix = atShare(40);

const mixChecks: [string, boolean][] = [
  [
    'More commercial in the building means more commercial to sell',
    highMix.areas.developerCommercialCarpetSqft > lowMix.areas.developerCommercialCarpetSqft,
  ],
  [
    'and less residential to sell',
    highMix.areas.developerResidentialCarpetSqft < lowMix.areas.developerResidentialCarpetSqft,
  ],
  ['and the income line actually moves', Math.abs(highMix.income.totalIncome - lowMix.income.totalIncome) > 1],
  ['an all-residential building sells no commercial carpet', atShare(0).areas.developerCommercialCarpetSqft < 0.01],
  [
    'an all-commercial building sells no residential carpet',
    atShare(100).areas.developerResidentialCarpetSqft < 0.01,
  ],
  [
    'a pinned sale mix still overrides the building mix',
    Math.abs(calculateFeasibility(sita).areas.developerCommercialCarpetSqft - 10927) < 1,
  ],
  ['normalising fills the mode in for a report saved without it', normaliseInputs({}).developerSplitMode === 'FOLLOW_BUILDING'],
];
mixChecks.forEach(([label, ok]) => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(`Mix slider: ${label}`);
    console.log(`  FAIL  ${label}`);
  }
});

section('DCPR-2034 - Dharti CHS, Versova (BMC)');

const dharti: FeasibilityInputs = {
  ...createBlankInputs('BMC'),
  projectName: 'Dharti CHS Ltd.',
  village: 'Versova',
  schemeType: 'DCPR_33_20B',
  dcprLocation: 'SUBURBS',
  plotAreaConveyanceSqm: 1538.9,
  plotAreaSevenTwelveSqm: 1538.9,
  dpRoadAreaSqm: 73,
  roadWidthM: 18.3,
  residentialTenements: 33,
  commercialUnits: 4,
  existingBuiltUpAreaSqm: 1634.33,
  existingResidentialCarpetSqft: 1498.33 * 10.764,
  existingCommercialCarpetSqft: 138.424 * 10.764,
  existingBuiltUpWithBalconySqm: 1964.105,
  buildingAgeYears: 40,
  additionalCarpetToTenantsPct: 0.45,
  dcprRoadSetbackCreditSqm: 108.14,
  commercialSplitMode: 'PERCENT',
  commercialSharePct: 0,
  developerSplitMode: 'PERCENT',
  developerCommercialSharePct: 0,
  residentialSaleRatePerSqft: 55000,
  constructionRatePerSqft: 4720,
};
const dh = calculateFeasibility(dharti);
const d = dh.fsi.dcpr!;

console.log(`  Rulebook                   ${dh.rulebook.name}`);
console.log(`  Table 12 band              ${d.roadBand}`);
console.log(`  Basic / premium / TDR      ${dh.effectiveInputs.basicFsi} / ${dh.effectiveInputs.premiumFsiRate} / ${dh.effectiveInputs.maxTdrLoading}`);
check('Net plot area after setback', d.netPlotAreaSqm, 1465.9, 0.01);
check('Basic FSI on the net plot (1.00)', d.baseBuaSqm, 1465.9, 0.01);
check('Government FSI purchased (0.5)', d.govtFsiSqm, 732.95, 0.01);
check('TDR entitlement (0.9)', d.tdrEntitlementSqm, 1319.31, 0.01);
check('TDR to be purchased', d.tdrToPurchaseSqm, 881.17, 0.01);
check('Setback compensation (2 x 73)', d.setbackCompensationSqm, 146.0, 0.01);
check('BUA under Reg. 33(7)(B)', d.buaUnder33_7BSqm, 3664.16, 0.01);
check('Reg. 33(20)(B) ceiling (4.00 x plot)', d.ceilingBuaSqm, 6155.6, 0.01);
check('Balance BUA above the entitlement', d.balanceBuaSqm, 2491.44, 0.01);
check('PAP BUA to MCGM (50%)', d.papBuaSqm, 1245.72, 0.01);
check('Rehab BUA at 45% additional area', d.rehabBuaSqm, 2847.95, 0.01);
check('Fungible compensatory area (35%)', dh.areas.totalAncillarySqm, 2154.46, 0.01);
check('Total BUA with fungible', dh.areas.totalBuaInclAncillarySqm, 8310.06, 0.01);
check('Sale carpet area', dh.areas.developerBalanceCarpetSqft, 53449.21, 2);
check('Rehab carpet to members', dh.areas.totalHandBackCarpetSqft, 2373.29 * 10.764, 2);
check('Fungible is 35%, not the UDCPR 60%', dh.effectiveInputs.ancillaryResidentialPct, 0.35, 1e-9);
check('Premium is 50% of RR, not 35% of ASR', dh.effectiveInputs.premiumFsiChargeRate, 0.5, 1e-9);
check('No TOD uplift in Mumbai', dh.effectiveInputs.isTodZone ? 1 : 0, 0, 1e-9);

const papLine = dh.expenses.premiumAndAncillary.items.find((x) => x.id === 'exp.premium.pap');
check('PAP purchase cost priced', (papLine?.value ?? 0) / CRORE, 21.18, 0.01, ' Cr');

// The 33(7)(B) route must not carry a PAP obligation.
const dhSociety = calculateFeasibility({ ...dharti, schemeType: 'DCPR_SOCIETY_REDEV' });
check('33(7)(B) carries no PAP obligation', dhSociety.fsi.dcpr!.papBuaSqm, 0, 1e-9);
check('33(7)(B) builds to the Table 12 entitlement', dhSociety.fsi.totalPermissibleBuaSqm, 3664.16, 0.01);

section('Region selects the rulebook');
const regionChecks: [string, boolean][] = [
  ['BMC reads DCPR-2034', calculateFeasibility({ ...dharti }).rulebook.id === 'DCPR_2034'],
  ['MBMC reads UDCPR-2020', r.rulebook.id === 'UDCPR'],
  ['DCPR scheme list excludes UDCPR schemes', dh.schemeComparison.every((row) => row.schemeType.startsWith('DCPR_'))],
  ['UDCPR scheme list excludes DCPR schemes', r.schemeComparison.every((row) => !row.schemeType.startsWith('DCPR_'))],
  ['Mumbai stamps the DCPR ruleset', dh.ruleset.includes('DCPR-2034')],
];
regionChecks.forEach(([label, ok]) => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(`Region routing: ${label}`);
    console.log(`  FAIL  ${label}`);
  }
});

// ---------------------------------------------------------------------------
// A report saved before a field existed must still open, recalculate and
// round-trip. Reports are stored as the inputs that produced them, so every
// field added later is absent from every existing record; left alone those gaps
// reach the arithmetic as undefined and surface as NaN or a thrown derivation.
section('Older stored reports survive a schema change');

const NEWER_FIELDS: (keyof FeasibilityInputs)[] = [
  'incentiveAreaTreatment',
  'dcprLocation',
  'dcprMaxFsi',
  'dcprPapSharePct',
  'corpusFundBasis',
  'corpusFundRatePerSqft',
  'ancillaryExpenseLumpSum',
  'ancillaryExpenseRatePerSqft',
];

// A record as it would have been stored before any of the above existed.
const legacy = { ...DEFAULT_INPUTS } as Record<string, unknown>;
for (const key of NEWER_FIELDS) delete legacy[key];

const healed = normaliseInputs(legacy as Partial<FeasibilityInputs>);
const legacyResult = calculateFeasibility(healed);

// The same record carried onto a Mumbai plot, which also has to swap the
// scheme: a UDCPR scheme derives nothing under DCPR.
const legacyMumbai = normaliseInputs({ ...(legacy as Partial<FeasibilityInputs>), authority: 'BMC' });
const legacyMumbaiResult = calculateFeasibility(legacyMumbai);

const legacyChecks: [string, boolean][] = [
  ['Every newer field is filled in', NEWER_FIELDS.every((k) => healed[k] !== undefined)],
  ['Recomputes to a real number, not NaN', Number.isFinite(legacyResult.summary.netProfit)],
  ['Values actually recorded are preserved', healed.plotAreaConveyanceSqm === DEFAULT_INPUTS.plotAreaConveyanceSqm],
  ['A stored zero is not overwritten by a default', normaliseInputs({ otherMiscCost: 0 }).otherMiscCost === 0],
  ['Mumbai swaps a UDCPR scheme for a DCPR one', legacyMumbai.schemeType.startsWith('DCPR_')],
  ['Mumbai recomputes without throwing', Number.isFinite(legacyMumbaiResult.summary.netProfit)],
  ['Mumbai reads the DCPR rulebook', legacyMumbaiResult.rulebook.id === 'DCPR_2034'],
];
legacyChecks.forEach(([label, ok]) => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(`Legacy inputs: ${label}`);
    console.log(`  FAIL  ${label}`);
  }
});

console.log('\n' + '='.repeat(78));
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('Engine reproduces the source report.');
console.log('='.repeat(78));
