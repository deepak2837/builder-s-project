import ExcelJS from 'exceljs';
import { CRORE } from '@/engine/constants';
import { FIELD_META } from '@/engine/constants';
import type { FeasibilityResult } from '@/engine/types';

/** Exports the report as a workbook, with every section on its own sheet. */
export async function buildXlsx(result: FeasibilityResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Asmita Builders Feasibility Generator';
  wb.created = new Date();

  const title = (ws: ExcelJS.Worksheet, text: string, sub?: string) => {
    ws.mergeCells('A1:D1');
    const cell = ws.getCell('A1');
    cell.value = text;
    cell.font = { size: 14, bold: true };
    if (sub) {
      ws.mergeCells('A2:D2');
      const s = ws.getCell('A2');
      s.value = sub;
      s.font = { size: 10, italic: true, color: { argb: 'FF666666' } };
    }
    ws.getColumn(1).width = 62;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 60;
  };

  // ---- Summary ----
  const summary = wb.addWorksheet('Summary');
  title(
    summary,
    `${result.inputs.projectName} - Feasibility Summary`,
    `${result.inputs.surveyNo}, ${result.inputs.village} | ${result.inputs.authority} | ${result.ruleset} | ${result.inputs.reportDate}`,
  );
  summary.addRow([]);
  summary.addRow(['Particulars', 'Amount (Rs.)', 'Rs. Cr', 'Notes']).font = { bold: true };

  const money = (label: string, value: number, note = '') =>
    summary.addRow([label, Math.round(value), Number((value / CRORE).toFixed(2)), note]);

  money('Total income from sale of office & flats', result.summary.totalIncome);
  summary.addRow([]);
  money('1) Ancillary & premium charges to authority', result.expenses.premiumAndAncillary.amount);
  money('2) Development charges', result.expenses.developmentCharges.amount);
  money('3) TDR cost', result.expenses.tdrCost.amount);
  money('4) Other incidental expenses till OC', result.expenses.incidentals.amount);
  money('5) Cost of construction', result.expenses.construction.amount);
  money('6) Professional fees', result.expenses.professionalFees.amount);
  money('7) Commission to agents and advertising', result.expenses.agentCommission.amount);
  money('8) Office expense', result.expenses.officeExpense.amount);
  money('9) Rent & other services', result.expenses.rentAndServices.amount);
  money('10) Ancillary expenses', result.expenses.ancillaryExpenses.amount);
  result.expenses.otherHeads.items.forEach((it, idx) =>
    money(`${11 + idx}) ${it.label}`, it.value, [it.formula, it.note].filter(Boolean).join(' | ')),
  );
  result.expenses.customItems.forEach((it) => money(it.label, it.value, 'Added manually'));
  summary.addRow([]);
  const totalRow = money('Total expenses', result.summary.totalExpenditure);
  totalRow.font = { bold: true };
  const profitRow = money('Net profit', result.summary.netProfit);
  profitRow.font = { bold: true };
  summary.addRow(['Profit margin', '', Number(result.summary.marginPct.toFixed(2)), '%']);
  summary.addRow(['Return on outlay', '', Number(result.summary.roiPct.toFixed(2)), '%']);
  summary.addRow(['Feasibility score', '', result.score.score, result.score.verdict]);
  result.score.drivers.forEach((d) => summary.addRow(['', '', '', d]));

  // ---- One sheet per document section ----
  for (const section of result.sections) {
    if (section.id === 'summary') continue;
    const ws = wb.addWorksheet(section.title.slice(0, 30).replace(/[\\/*?:[\]]/g, '-'));
    title(ws, section.title, section.subtitle);
    ws.addRow([]);
    ws.addRow(['Particulars', 'Value', 'Unit', 'Formula / Regulation']).font = { bold: true };

    for (const item of section.items) {
      if (item.unit === 'ratio' && item.value === 0 && item.emphasis) {
        const r = ws.addRow([item.label, '', '', '']);
        r.font = { bold: true };
        continue;
      }
      const indent = '    '.repeat(item.indent ?? 0);
      const value = item.unit === 'inr' ? Math.round(item.value) : Number(item.value.toFixed(2));
      const row = ws.addRow([
        indent + item.label,
        value,
        item.unit === 'inr' ? 'Rs.' : item.unit === 'sqm' ? 'Sq.mt.' : item.unit === 'sqft' ? 'Sq.ft.' : item.unit,
        [item.formula, item.regulation, item.note].filter(Boolean).join(' | '),
      ]);
      if (item.emphasis) row.font = { bold: true };
    }
  }

  // ---- Inputs, so the run is reproducible ----
  const inputsSheet = wb.addWorksheet('Inputs');
  title(
    inputsSheet,
    'Input parameters',
    `Every figure in this report derives from these values, read against ${result.ruleset}.`,
  );
  inputsSheet.getColumn(4).width = 16;
  inputsSheet.getColumn(5).width = 60;
  inputsSheet.addRow([]);
  inputsSheet.addRow(['Parameter', 'Entered', 'Unit', 'Used by engine', 'Source / note']).font = { bold: true };

  // The entered value and the value actually calculated on diverge wherever the
  // regulation supplies the figure - which under DCPR-2034 is most of the FSI
  // table. Both are shown so the workbook explains its own numbers.
  for (const meta of FIELD_META) {
    const entered = result.inputs[meta.key];
    const effective = result.effectiveInputs[meta.key];
    const derived = effective !== entered;
    const row = inputsSheet.addRow([
      meta.label,
      typeof entered === 'number' ? entered : String(entered),
      meta.unit ?? '',
      derived ? (typeof effective === 'number' ? effective : String(effective)) : '',
      [meta.source, meta.help].filter(Boolean).join(' | '),
    ]);
    if (derived) row.getCell(4).font = { bold: true, color: { argb: 'FF1D4ED8' } };
  }

  // ---- Sensitivity ----
  const sens = wb.addWorksheet('Sensitivity');
  title(sens, 'Sensitivity analysis', 'Net profit recomputed at plus/minus 5% and 10% on the key rates.');
  sens.addRow([]);
  sens.addRow(['Variable', 'Change', 'Net profit (Rs. Cr)', 'Margin %']).font = { bold: true };
  for (const row of result.sensitivity.rows) {
    sens.addRow([
      row.variable,
      `${row.deltaPct > 0 ? '+' : ''}${row.deltaPct}%`,
      Number((row.netProfit / CRORE).toFixed(2)),
      Number(row.marginPct.toFixed(2)),
    ]);
  }
  sens.addRow([]);
  sens.addRow(['Breakeven residential sale rate (Rs./Sq.ft.)', Math.round(result.sensitivity.breakevenResidentialRatePerSqft)]);
  sens.addRow(['Breakeven construction rate (Rs./Sq.ft.)', Math.round(result.sensitivity.breakevenConstructionRatePerSqft)]);

  if (result.warnings.length) {
    const w = wb.addWorksheet('Warnings');
    title(w, 'Warnings raised by the engine');
    w.addRow([]);
    result.warnings.forEach((x) => w.addRow([x]));
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
