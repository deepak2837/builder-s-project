import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { formatCrore, formatPercent, formatValue } from '@/engine/format';
import type { FeasibilityResult, ReportSection } from '@/engine/types';

/** Strips the editor's HTML back to plain paragraphs for Word. */
function proseToParagraphs(html?: string): Paragraph[] {
  if (!html) return [];
  return html
    .split(/<\/p>|<br\s*\/?>/i)
    .map((s) => s.replace(/<[^>]+>/g, '').replace(/&mdash;/g, '—').replace(/&amp;/g, '&').trim())
    .filter(Boolean)
    .map(
      (text) =>
        new Paragraph({
          children: [new TextRun({ text, italics: true, size: 20, color: '555555' })],
          spacing: { after: 120 },
        }),
    );
}

function cell(text: string, opts: { bold?: boolean; align?: typeof AlignmentType.RIGHT; width?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, bold: opts.bold, size: 18 })],
      }),
    ],
  });
}

function sectionTable(section: ReportSection): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell('Particulars', { bold: true, width: 52 }),
        cell('Value', { bold: true, align: AlignmentType.RIGHT, width: 20 }),
        cell('Formula / Regulation', { bold: true, width: 28 }),
      ],
    }),
  ];

  for (const item of section.items) {
    if (item.unit === 'ratio' && item.value === 0 && item.emphasis) {
      rows.push(new TableRow({ children: [cell(item.label, { bold: true }), cell(''), cell('')] }));
      continue;
    }
    const indent = '    '.repeat(item.indent ?? 0);
    rows.push(
      new TableRow({
        children: [
          cell(indent + item.label, { bold: item.emphasis }),
          cell(formatValue(item.value, item.unit), { bold: item.emphasis, align: AlignmentType.RIGHT }),
          cell([item.formula, item.regulation, item.note].filter(Boolean).join(' | ')),
        ],
      }),
    );
  }

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

export async function buildDocx(result: FeasibilityResult): Promise<Buffer> {
  const i = result.inputs;

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'PROJECT REPORT', bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${i.projectName}, ${i.surveyNo}, Village - ${i.village}`, size: 24 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${i.authority}  |  ${result.ruleset}  |  Date: ${i.reportDate}`,
          size: 20,
          color: '666666',
        }),
      ],
      spacing: { after: 300 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Verdict: ', bold: true, size: 22 }),
        new TextRun({ text: `${result.score.verdict} `, bold: true, size: 22 }),
        new TextRun({
          text: `(score ${result.score.score}/100)  -  Net profit ${formatCrore(result.summary.netProfit)} on income of ${formatCrore(
            result.summary.totalIncome,
          )}, margin ${formatPercent(result.summary.marginPct)}.`,
          size: 22,
        }),
      ],
      spacing: { after: 300 },
    }),
  ];

  for (const section of result.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: section.title, bold: true, size: 26 })],
        spacing: { before: 360, after: 120 },
      }),
    );
    if (section.subtitle) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.subtitle, italics: true, size: 20, color: '666666' })],
          spacing: { after: 120 },
        }),
      );
    }
    children.push(...proseToParagraphs(section.prose));
    children.push(sectionTable(section));
  }

  if (result.warnings.length) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: 'Warnings', bold: true, size: 26 })],
        spacing: { before: 360, after: 120 },
      }),
    );
    for (const warning of result.warnings) {
      children.push(new Paragraph({ children: [new TextRun({ text: `- ${warning}`, size: 20 })] }));
    }
  }

  children.push(
    new Paragraph({
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: 'Note: stamp duty, registration fees, corpus fund, Estate Investment NOC cost, ULC NOC (if applicable) and all other construction costs will be subtracted when figuring out the profit. The numbers and areas in this report are estimates and could change based on actual market rates.',
          italics: true,
          size: 18,
          color: '666666',
        }),
      ],
    }),
  );

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
}
