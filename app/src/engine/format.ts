import { CRORE } from './constants';
import type { Unit } from './types';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Rupees with Indian digit grouping, e.g. 6,32,19,233. */
export function formatRupees(value: number): string {
  return inr.format(Math.round(value));
}

/** Crore with two decimals, e.g. "Rs. 43.97 Cr". */
export function formatCrore(value: number): string {
  const cr = value / CRORE;
  const sign = cr < 0 ? '-' : '';
  return `${sign}Rs. ${inr2.format(Math.abs(cr))} Cr`;
}

export function toCrore(value: number): number {
  return value / CRORE;
}

/** Areas carry two decimals throughout, matching the source report. */
export function formatArea(value: number, unit: 'sqm' | 'sqft' = 'sqm'): string {
  return `${plain2.format(value)} ${unit === 'sqm' ? 'Sq.mt.' : 'Sq.ft.'}`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${formatNumber(value, decimals)}%`;
}

/** Renders a LineItem value according to its unit. */
export function formatValue(value: number, unit: Unit): string {
  switch (unit) {
    case 'inr':
      return `Rs. ${formatRupees(value)}`;
    case 'cr':
      return formatCrore(value);
    case 'sqm':
      return formatArea(value, 'sqm');
    case 'sqft':
      return formatArea(value, 'sqft');
    case 'pct':
      return formatPercent(value);
    case 'ratio':
      return formatNumber(value, 2);
    case 'count':
      return formatNumber(value, 0);
    case 'months':
      return `${formatNumber(value, 0)} months`;
    case 'm':
      return `${formatNumber(value, 2)} m`;
    default:
      return formatNumber(value);
  }
}

/** Rounds to `dp` decimal places without floating-point drift in the last digit. */
export function round(value: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((value + Number.EPSILON) * f) / f;
}
