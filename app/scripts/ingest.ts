/**
 * Knowledge-base ingestion.
 *
 * Reads every source document the client has shared - regulations as PDFs, and
 * completed feasibility reports as PDFs or workbooks - extracts text, chunks it
 * (by regulation number where the document is a regulation, by sheet where it is
 * a workbook), and writes the chunks into the `kb_documents` collection.
 *
 * Drop a new feasibility report into the project folder, add a line to SOURCES,
 * and re-run. Anything with "feasibility" or "project report" in the filename is
 * picked up automatically even without a SOURCES entry.
 *
 * Run with:  npm run ingest
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import ExcelJS from 'exceljs';
import { getStore, newId } from '../src/lib/store';
import type { KbChunk } from '../src/lib/kb/corpus';

// `next` loads .env.local for the application; a bare tsx script does not. Left
// unloaded, MONGODB_URI is unset here, the store quietly falls back to the JSON
// files, and a freshly ingested report never reaches the database the running
// app reads from - the ingest reports success and the assistant never sees it.
try {
  process.loadEnvFile(path.resolve(process.cwd(), '.env.local'));
} catch {
  // No .env.local - the store's own defaults apply.
}

const require = createRequire(import.meta.url);

/** The supplied documents live one directory up from the app. */
const SOURCE_DIR = path.resolve(process.cwd(), '..');

const SOURCES: { file: string; source: string; docType: KbChunk['docType'] }[] = [
  { file: 'UDCPR_compressed_2.pdf', source: 'UDCPR-2020', docType: 'regulation' },
  {
    file: 'Maharashtra-Urban-Development-Control-and-Promotion-Rules-Amendment-Bill-2026-MARCH162026.pdf',
    source: 'UDCPR Amendment Bill 2026',
    docType: 'regulation',
  },
  { file: 'Project Report Sita Smruti 25% Additonal.pdf', source: 'Project Report - Sita Smruti', docType: 'report' },
  {
    file: 'Feasibility Report of Dharti CHS Versova_3.xlsx',
    source: 'Feasibility Report - Dharti CHS, Versova (DCPR-2034)',
    docType: 'report',
  },
  {
    file: 'Format of Revelopement Calculation.xlsx',
    source: 'Format of Redevelopment Calculation (internal)',
    docType: 'format',
  },
];

/** Filenames that look like a feasibility report, for auto-discovery. */
const REPORT_HINTS = [/feasibility/i, /project\s*report/i, /redevelopment/i];

const MAX_CHARS = 2400;
const MIN_CHARS = 200;

async function extract(filePath: string): Promise<{ text: string; pages: number }> {
  // pdf-parse is CommonJS and runs an internal self-test on import when the
  // module is the entry point; requiring the lib directly avoids that.
  const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
    b: Buffer,
    o?: Record<string, unknown>,
  ) => Promise<{ text: string; numpages: number }>;
  const buf = await fs.readFile(filePath);
  const out = await pdfParse(buf);
  return { text: out.text, pages: out.numpages };
}

/**
 * UDCPR is written as numbered regulations, so split on the regulation heading
 * rather than on a fixed window. Citations then carry a real regulation number.
 */
function chunkByRegulation(text: string, source: string, docType: KbChunk['docType']): KbChunk[] {
  const lines = text.split('\n');
  const chunks: KbChunk[] = [];

  let current: { reg?: string; title: string; body: string[] } = { title: 'Preamble', body: [] };
  const headingRe = /^\s*((?:\d{1,2})(?:\.\d{1,2}){1,3})\s*[*#()\d]*\s+([A-Z][A-Za-z0-9 ,.\-/&()']{4,90})\s*$/;

  const flush = () => {
    const body = current.body.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (body.length < MIN_CHARS) return;
    // Split oversized regulations into windows so retrieval stays sharp.
    for (let i = 0; i < body.length; i += MAX_CHARS) {
      const slice = body.slice(i, i + MAX_CHARS);
      if (slice.trim().length < MIN_CHARS && i > 0) break;
      chunks.push({
        id: `${source}-${current.reg ?? 'x'}-${chunks.length}`.replace(/\s+/g, '-').toLowerCase(),
        source,
        docType,
        regulation: current.reg ? `Reg. ${current.reg}` : undefined,
        title: current.title.slice(0, 120),
        text: slice,
      });
    }
  };

  for (const line of lines) {
    const m = line.match(headingRe);
    if (m) {
      flush();
      current = { reg: m[1], title: m[2].trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  flush();
  return chunks;
}

/**
 * Flattens a feasibility workbook into readable lines.
 *
 * A spreadsheet carries its meaning in the label next to the number, so each row
 * is emitted as "label: value" with the formula alongside where there is one -
 * that is what lets the assistant explain how a figure was arrived at rather
 * than merely repeat it. Blank and decorative rows are dropped.
 */
async function extractWorkbook(filePath: string): Promise<{ text: string; sheets: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const cellText = (cell: ExcelJS.Cell): string => {
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'object') {
      const o = v as unknown as Record<string, unknown>;
      if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
      if ('result' in o) {
        const result = o.result;
        const formula = typeof o.formula === 'string' ? o.formula : '';
        const shown = typeof result === 'number' ? String(Math.round(result * 100) / 100) : String(result ?? '');
        return formula ? `${shown} [=${formula}]` : shown;
      }
      if ('text' in o) return String(o.text);
      return '';
    }
    if (typeof v === 'number') return String(Math.round(v * 10000) / 10000);
    return String(v);
  };

  const out: string[] = [];
  for (const ws of wb.worksheets) {
    out.push(`\n## Sheet: ${ws.name}`);
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const t = cellText(cell).trim();
        if (t) cells.push(t);
      });
      // A row with a single number and no label carries no meaning on its own.
      if (cells.length < 2) return;
      out.push(cells.join(' | '));
    });
  }
  return { text: out.join('\n'), sheets: wb.worksheets.length };
}

/** Fixed-window chunking for documents that are not regulation-structured. */
function chunkByWindow(text: string, source: string, docType: KbChunk['docType']): KbChunk[] {
  const clean = text.replace(/\n{3,}/g, '\n\n').trim();
  const chunks: KbChunk[] = [];
  for (let i = 0; i < clean.length; i += MAX_CHARS) {
    const slice = clean.slice(i, i + MAX_CHARS);
    if (slice.trim().length < MIN_CHARS) continue;
    chunks.push({
      id: `${source}-${chunks.length}`.replace(/\s+/g, '-').toLowerCase(),
      source,
      docType,
      title: `${source} - part ${chunks.length + 1}`,
      text: slice,
    });
  }
  return chunks;
}

/**
 * Every report the client has dropped into the project folder, whether or not
 * it is named in SOURCES. New feasibility reports are meant to be usable by
 * simply saving them next to the app and re-running the ingest.
 */
async function discoverSources() {
  const listed = new Set(SOURCES.map((s) => s.file));
  const found = [...SOURCES];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(SOURCE_DIR);
  } catch {
    return found;
  }
  for (const file of entries) {
    if (listed.has(file)) continue;
    if (!/\.(pdf|xlsx|xlsm)$/i.test(file)) continue;
    if (!REPORT_HINTS.some((re) => re.test(file))) continue;
    found.push({ file, source: `Feasibility Report - ${path.parse(file).name}`, docType: 'report' });
  }
  return found;
}

async function main() {
  const store = await getStore();
  console.log(`Store backend: ${store.backend} (${store.detail})`);
  console.log(`Reading source documents from ${SOURCE_DIR}\n`);

  let totalChunks = 0;
  const sources = await discoverSources();

  for (const src of sources) {
    const filePath = path.join(SOURCE_DIR, src.file);
    try {
      await fs.access(filePath);
    } catch {
      console.log(`SKIP  ${src.file} - not found`);
      continue;
    }

    const isWorkbook = /\.(xlsx|xlsm)$/i.test(src.file);
    let text: string;
    let units: number;
    let unitLabel: string;

    if (isWorkbook) {
      const out = await extractWorkbook(filePath);
      text = out.text;
      units = out.sheets;
      unitLabel = 'sheets';
    } else {
      const out = await extract(filePath);
      text = out.text;
      units = out.pages;
      unitLabel = 'pages';

      const density = text.replace(/\s/g, '').length / Math.max(1, out.pages);
      if (density < 50) {
        console.log(
          `WARN  ${src.file} - ${out.pages} pages but only ${Math.round(density)} characters per page.\n` +
            `      This is a scanned PDF with no text layer. It needs OCR before it can be indexed;\n` +
            `      the assistant will not be able to cite it until then.`,
        );
        continue;
      }
    }

    if (text.trim().length < MIN_CHARS) {
      console.log(`SKIP  ${src.file} - no readable content`);
      continue;
    }

    const chunks =
      src.docType === 'regulation'
        ? chunkByRegulation(text, src.source, src.docType)
        : chunkByWindow(text, src.source, src.docType);

    const existing = await store.findOne<{ _id: string }>('kb_documents', { filename: src.file });
    if (existing) await store.remove('kb_documents', existing._id);

    await store.insert('kb_documents', {
      _id: newId('kb'),
      filename: src.file,
      source: src.source,
      docType: src.docType,
      pages: units,
      chunkCount: chunks.length,
      chunks,
      ingestedAt: new Date().toISOString(),
    });

    totalChunks += chunks.length;
    console.log(`OK    ${src.file} - ${units} ${unitLabel} -> ${chunks.length} chunks`);
  }

  console.log(`\nIngested ${totalChunks} chunks. The curated corpus in src/lib/kb/corpus.ts is always available on top of this.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
