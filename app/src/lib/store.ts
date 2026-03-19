import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Minimal document store.
 *
 * The client asked for a local MongoDB. That is the primary target: point
 * MONGODB_URI at mongodb://localhost:27017 and the app writes to the
 * `asmita_feasibility` database, creating it and its collections on first use.
 *
 * If Mongo is not reachable (it is not installed on every machine that will run
 * this POC) the same interface is served from JSON files under .data/ so the
 * application still works end to end. The active backend is reported by
 * `storeBackend()` and shown in the UI, so nobody is misled about where their
 * data went.
 */

export interface Doc {
  _id: string;
}
export type Query = Record<string, unknown>;

export interface Store {
  backend: 'mongodb' | 'file';
  detail: string;
  /** Set when the file fallback is active somewhere it will lose data. */
  degraded?: boolean;
  degradedReason?: string;
  find<T extends Doc>(collection: string, query?: Query, sort?: { field: string; dir: 1 | -1 }, limit?: number): Promise<T[]>;
  findOne<T extends Doc>(collection: string, query: Query): Promise<T | null>;
  insert<T extends Doc>(collection: string, doc: T): Promise<T>;
  update(collection: string, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
  count(collection: string, query?: Query): Promise<number>;
}

export const COLLECTIONS = [
  'projects',
  'inputs',
  'reports',
  'rate_masters',
  'chat_sessions',
  'kb_documents',
  'audit_log',
] as const;

function matches(doc: Doc, query: Query): boolean {
  const bag = doc as unknown as Record<string, unknown>;
  return Object.entries(query).every(([k, v]) => {
    const actual = k.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], bag);
    if (v && typeof v === 'object' && '$in' in (v as object)) {
      return (v as { $in: unknown[] }).$in.includes(actual);
    }
    return actual === v;
  });
}

// ---------------------------------------------------------------- file store

/**
 * Serverless runtimes mount the deploy read-only apart from the temp
 * directory, so the fallback writes there when we are not on a dev machine.
 * That storage is per-container and evaporates - hence the loud warning in the
 * UI when this backend is ever active in production.
 */
const DATA_DIR =
  process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join(os.tmpdir(), 'asmita-feasibility')
    : path.join(process.cwd(), '.data');

class FileStore implements Store {
  backend = 'file' as const;
  detail = `JSON files in ${DATA_DIR}`;
  degraded: boolean;
  degradedReason?: string;

  constructor(reason?: string) {
    // On a developer machine the fallback is a convenience. On a deployed
    // serverless host it means reports will vanish, so it must be shouted about.
    this.degraded = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.degradedReason = reason;
  }

  private file(collection: string) {
    return path.join(DATA_DIR, `${collection}.json`);
  }

  private async read<T extends Doc>(collection: string): Promise<T[]> {
    try {
      const raw = await fs.readFile(this.file(collection), 'utf8');
      return JSON.parse(raw) as T[];
    } catch {
      return [];
    }
  }

  private async write<T extends Doc>(collection: string, docs: T[]) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(this.file(collection), JSON.stringify(docs, null, 2), 'utf8');
  }

  async find<T extends Doc>(collection: string, query: Query = {}, sort?: { field: string; dir: 1 | -1 }, limit?: number) {
    let docs = (await this.read<T>(collection)).filter((d) => matches(d, query));
    if (sort) {
      docs = docs.sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[sort.field] as string | number;
        const bv = (b as unknown as Record<string, unknown>)[sort.field] as string | number;
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * sort.dir;
      });
    }
    return typeof limit === 'number' ? docs.slice(0, limit) : docs;
  }

  async findOne<T extends Doc>(collection: string, query: Query): Promise<T | null> {
    const docs = await this.find<T>(collection, query);
    return docs[0] ?? null;
  }

  async insert<T extends Doc>(collection: string, doc: T) {
    const docs = await this.read<T>(collection);
    docs.push(doc);
    await this.write(collection, docs);
    return doc;
  }

  async update(collection: string, id: string, patch: Record<string, unknown>) {
    const docs = await this.read(collection);
    const idx = docs.findIndex((d) => d._id === id);
    if (idx >= 0) {
      docs[idx] = { ...docs[idx], ...patch } as Doc;
      await this.write(collection, docs);
    }
  }

  async remove(collection: string, id: string) {
    const docs = await this.read(collection);
    await this.write(
      collection,
      docs.filter((d) => d._id !== id),
    );
  }

  async count(collection: string, query: Query = {}) {
    return (await this.find(collection, query)).length;
  }
}

// --------------------------------------------------------------- mongo store

class MongoStore implements Store {
  backend = 'mongodb' as const;
  detail: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(db: any, redactedUri: string, dbName: string) {
    this.db = db;
    const host = redactedUri.replace(/^mongodb(\+srv)?:\/\/[^@]*@?/, '').split('/')[0];
    this.detail = `${host} (db: ${dbName})`;
  }

  async find<T extends Doc>(collection: string, query: Query = {}, sort?: { field: string; dir: 1 | -1 }, limit?: number) {
    let cursor = this.db.collection(collection).find(query);
    if (sort) cursor = cursor.sort({ [sort.field]: sort.dir });
    if (typeof limit === 'number') cursor = cursor.limit(limit);
    return (await cursor.toArray()) as T[];
  }

  async findOne<T extends Doc>(collection: string, query: Query) {
    return (await this.db.collection(collection).findOne(query)) as T | null;
  }

  async insert<T extends Doc>(collection: string, doc: T) {
    await this.db.collection(collection).insertOne(doc);
    return doc;
  }

  async update(collection: string, id: string, patch: Record<string, unknown>) {
    await this.db.collection(collection).updateOne({ _id: id }, { $set: patch });
  }

  async remove(collection: string, id: string) {
    await this.db.collection(collection).deleteOne({ _id: id });
  }

  async count(collection: string, query: Query = {}) {
    return this.db.collection(collection).countDocuments(query);
  }
}

// ------------------------------------------------------------------ resolver

/**
 * Cached on globalThis so a warm serverless container and Next's dev-mode
 * module reloading both reuse one client instead of opening a new pool per
 * invocation - which Atlas would rate-limit.
 */
const globalCache = globalThis as unknown as { __asmitaStore?: Promise<Store> };

function redact(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

async function connect(): Promise<Store> {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB ?? 'asmita_feasibility';
  const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1');

  try {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(uri, {
      // A local mongod either answers immediately or is not running. A remote
      // Atlas cluster needs room for SRV lookup, TLS and a cold primary.
      serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS ?? (isLocal ? 1500 : 15000)),
      maxPoolSize: 10,
      retryWrites: true,
    });
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });

    // Create the collections up front so the database is visible in Compass
    // even before the first report is generated.
    const existing = new Set((await db.listCollections().toArray()).map((c: { name: string }) => c.name));
    for (const name of COLLECTIONS) {
      if (!existing.has(name)) await db.createCollection(name).catch(() => undefined);
    }
    await db.collection('reports').createIndex({ createdAt: -1 }).catch(() => undefined);
    await db.collection('reports').createIndex({ projectId: 1 }).catch(() => undefined);
    await db.collection('audit_log').createIndex({ reportId: 1 }).catch(() => undefined);

    console.log(`[store] connected to MongoDB at ${redact(uri)} (db: ${dbName})`);
    return new MongoStore(db, redact(uri), dbName);
  } catch (err) {
    const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
    console.warn(`[store] MongoDB unavailable (${reason}) - falling back to JSON files in ${DATA_DIR}`);
    return new FileStore(reason);
  }
}

export function getStore(): Promise<Store> {
  if (!globalCache.__asmitaStore) globalCache.__asmitaStore = connect();
  return globalCache.__asmitaStore;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
