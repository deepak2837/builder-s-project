import { getStore, type Doc } from '../store';
import { CURATED_CHUNKS, type KbChunk } from './corpus';

/**
 * Lexical retrieval over the knowledge base.
 *
 * BM25 with an exact-match boost for regulation numbers. The corpus is 5-6
 * documents, so this is both sufficient and offline - the assistant can cite
 * regulations without a network round trip for embeddings. Swap in vector
 * search here if the corpus grows past a few hundred chunks.
 */

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'for', 'on', 'as', 'be', 'by', 'with',
  'that', 'this', 'it', 'at', 'from', 'shall', 'such', 'any', 'i', 'we', 'what', 'how', 'do', 'does',
  'my', 'me', 'you', 'can', 'will', 'would', 'should', 'if', 'not', 'no',
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.\s%]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Pulls "7.6", "11.2.4", "6.3", "Table 6-G" style references out of a query. */
function regulationRefs(text: string): string[] {
  const refs: string[] = [];
  const numeric = text.match(/\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})*\b/g);
  if (numeric) refs.push(...numeric);
  const tables = text.match(/table\s*\d+\s*-?\s*[a-z]\b/gi);
  if (tables) refs.push(...tables.map((t) => t.replace(/\s+/g, ' ').toLowerCase()));
  return refs;
}

interface Indexed extends KbChunk {
  tokens: string[];
  length: number;
}

let cache: { chunks: Indexed[]; df: Map<string, number>; avgLen: number; builtAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

interface KbDoc extends Doc {
  chunks?: KbChunk[];
}

async function loadChunks(): Promise<KbChunk[]> {
  const chunks: KbChunk[] = [...CURATED_CHUNKS];
  try {
    const store = await getStore();
    const docs = await store.find<KbDoc>('kb_documents');
    for (const d of docs) {
      if (Array.isArray(d.chunks)) chunks.push(...d.chunks);
    }
  } catch {
    // Curated corpus alone is a valid state - `npm run ingest` adds the rest.
  }
  // De-duplicate by id, curated wins.
  const seen = new Set<string>();
  return chunks.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

async function index() {
  if (cache && Date.now() - cache.builtAt < CACHE_TTL_MS) return cache;

  const raw = await loadChunks();
  const chunks: Indexed[] = raw.map((c) => {
    const tokens = tokenise(`${c.title} ${c.regulation ?? ''} ${c.text}`);
    return { ...c, tokens, length: tokens.length };
  });

  const df = new Map<string, number>();
  for (const c of chunks) {
    for (const t of new Set(c.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const avgLen = chunks.reduce((s, c) => s + c.length, 0) / Math.max(1, chunks.length);

  cache = { chunks, df, avgLen, builtAt: Date.now() };
  return cache;
}

export interface Retrieved {
  chunk: KbChunk;
  score: number;
}

export async function searchKnowledgeBase(query: string, topK = 5): Promise<Retrieved[]> {
  const { chunks, df, avgLen } = await index();
  if (chunks.length === 0) return [];

  const qTokens = tokenise(query);
  const refs = regulationRefs(query);
  const N = chunks.length;
  const k1 = 1.5;
  const b = 0.75;

  const scored = chunks.map((c) => {
    const tf = new Map<string, number>();
    for (const t of c.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const q of qTokens) {
      const f = tf.get(q);
      if (!f) continue;
      const n = df.get(q) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * c.length) / avgLen)));
    }

    // A query naming a regulation almost always wants that regulation.
    const hay = `${c.regulation ?? ''} ${c.title} ${c.text}`.toLowerCase();
    for (const ref of refs) {
      if (hay.includes(ref.toLowerCase())) score += 8;
    }

    return { chunk: c as KbChunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, topK);
}

/** Formats retrieved chunks for injection into the model prompt. */
export function formatContext(hits: Retrieved[]): string {
  if (hits.length === 0) return '(no matching passages in the knowledge base)';
  return hits
    .map(
      (h, idx) =>
        `[${idx + 1}] Source: ${h.chunk.source}${h.chunk.regulation ? `, ${h.chunk.regulation}` : ''}${
          h.chunk.page ? `, p.${h.chunk.page}` : ''
        }\nTitle: ${h.chunk.title}\n${h.chunk.text}`,
    )
    .join('\n\n---\n\n');
}

export async function kbStats() {
  const { chunks } = await index();
  const bySource = new Map<string, number>();
  for (const c of chunks) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
  return {
    totalChunks: chunks.length,
    sources: [...bySource.entries()].map(([source, count]) => ({ source, count })),
  };
}
