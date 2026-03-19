import { CRORE } from '@/engine/constants';
import type { FeasibilityResult } from '@/engine/types';

function esc(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Flat CSV of every line item, so the finance team can pull the whole report
 * into their own model without going through the formatted workbook.
 */
export function buildCsv(result: FeasibilityResult): string {
  const rows: (string | number)[][] = [
    ['Section', 'Particulars', 'Value', 'Unit', 'Value (Rs. Cr)', 'Formula', 'Regulation', 'Note'],
  ];

  for (const section of result.sections) {
    for (const item of section.items) {
      // Skip heading-only rows.
      if (item.unit === 'ratio' && item.value === 0 && item.emphasis) continue;
      rows.push([
        section.title,
        `${'  '.repeat(item.indent ?? 0)}${item.label}`,
        item.unit === 'inr' ? Math.round(item.value) : Number(item.value.toFixed(2)),
        item.unit,
        item.unit === 'inr' ? Number((item.value / CRORE).toFixed(4)) : '',
        item.formula ?? '',
        item.regulation ?? '',
        item.note ?? '',
      ]);
    }
  }

  rows.push([]);
  rows.push(['Checks', 'Severity', 'Message']);
  for (const c of result.checks) rows.push(['Check', c.severity, c.message]);

  rows.push([]);
  rows.push(['Warnings']);
  for (const w of result.warnings) rows.push(['Warning', w]);

  rows.push([]);
  rows.push(['Scheme comparison', 'Regulation', 'Incentive FSI (sq.m)', 'Developer carpet (sq.ft)', 'Net profit (Rs. Cr)', 'Margin %', 'Score']);
  for (const s of result.schemeComparison) {
    rows.push([
      s.label + (s.isCurrent ? ' (selected)' : ''),
      s.regulation,
      Number(s.incentiveFsiSqm.toFixed(2)),
      Number(s.developerCarpetSqft.toFixed(2)),
      Number((s.netProfit / CRORE).toFixed(4)),
      Number(s.marginPct.toFixed(2)),
      s.score,
    ]);
  }

  rows.push([]);
  rows.push(['Ruleset', result.ruleset]);
  rows.push(['Generated', result.computedAt]);

  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}
