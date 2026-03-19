import { calculateFeasibility } from '@/engine/calculate';
import { normaliseInputs } from '@/engine/constants';
import type { DocumentPatch, FeasibilityInputs, FeasibilityResult, LineItem } from '@/engine/types';
import { getStore, newId, type Doc } from './store';

export interface ProjectDoc extends Doc {
  name: string;
  surveyNo: string;
  village: string;
  authority: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDoc extends Doc {
  projectId: string;
  projectName: string;
  version: number;
  inputs: FeasibilityInputs;
  /** Ad-hoc line items added by the user or the assistant. */
  customItems: LineItem[];
  /** Prose overrides keyed by section id, plus removed line ids. */
  patches: DocumentPatch[];
  /** Denormalised headline figures so the history list does not recompute. */
  netProfit: number;
  totalIncome: number;
  totalExpenditure: number;
  marginPct: number;
  score: number;
  verdict: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDoc {
  role: 'user' | 'model';
  text: string;
  toolCalls?: { name: string; args: Record<string, unknown>; result?: string }[];
  citations?: { source: string; regulation?: string }[];
  at: string;
}

export interface ChatSessionDoc extends Doc {
  reportId: string | null;
  messages: ChatMessageDoc[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  reportId: string;
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  source: 'user' | 'chatbot';
}

export interface AuditDoc extends Doc, AuditEntry {
  at: string;
}

/** Recomputes a stored report. The engine is the only thing that produces numbers. */
export function materialise(report: ReportDoc): FeasibilityResult {
  // Reports outlive the input schema, so bring the stored set up to the current
  // shape before it reaches the engine. `result.inputs` is what the workspace
  // and the wizard round-trip on, so they both get the completed set too.
  const result = calculateFeasibility(normaliseInputs(report.inputs), report.customItems ?? []);

  // Apply document patches: prose edits and removed line items.
  for (const patch of report.patches ?? []) {
    const section = result.sections.find((s) => s.id === patch.sectionId);
    if (!section) continue;
    if (typeof patch.prose === 'string') section.prose = patch.prose;
    if (patch.removedItemIds?.length) {
      section.items = section.items.filter((it) => !patch.removedItemIds!.includes(it.id));
    }
    if (patch.addedItems?.length) section.items.push(...patch.addedItems);
  }
  return result;
}

function headline(result: FeasibilityResult) {
  return {
    netProfit: result.summary.netProfit,
    totalIncome: result.summary.totalIncome,
    totalExpenditure: result.summary.totalExpenditure,
    marginPct: result.summary.marginPct,
    score: result.score.score,
    verdict: result.score.verdict,
  };
}

export async function createReport(inputs: FeasibilityInputs): Promise<ReportDoc> {
  const store = await getStore();
  const now = new Date().toISOString();

  // One project per name + survey no.; new runs become new versions under it.
  let project = await store.findOne<ProjectDoc>('projects', {
    name: inputs.projectName,
    surveyNo: inputs.surveyNo,
  });

  if (!project) {
    project = await store.insert<ProjectDoc>('projects', {
      _id: newId('prj'),
      name: inputs.projectName,
      surveyNo: inputs.surveyNo,
      village: inputs.village,
      authority: inputs.authority,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await store.update('projects', project._id, { updatedAt: now });
  }

  const priorCount = await store.count('reports', { projectId: project._id });
  const result = calculateFeasibility(inputs, []);

  const report: ReportDoc = {
    _id: newId('rpt'),
    projectId: project._id,
    projectName: inputs.projectName,
    version: priorCount + 1,
    inputs,
    customItems: [],
    patches: [],
    ...headline(result),
    createdAt: now,
    updatedAt: now,
  };

  await store.insert('inputs', { _id: newId('inp'), reportId: report._id, version: report.version, inputs, createdAt: now });
  return store.insert('reports', report);
}

export async function getReport(id: string): Promise<ReportDoc | null> {
  const store = await getStore();
  return store.findOne<ReportDoc>('reports', { _id: id });
}

export async function listReports(limit = 100): Promise<ReportDoc[]> {
  const store = await getStore();
  return store.find<ReportDoc>('reports', {}, { field: 'createdAt', dir: -1 }, limit);
}

export async function saveReport(
  id: string,
  changes: { inputs?: FeasibilityInputs; customItems?: LineItem[]; patches?: DocumentPatch[] },
): Promise<ReportDoc | null> {
  const store = await getStore();
  const existing = await getReport(id);
  if (!existing) return null;

  const merged: ReportDoc = {
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  const result = materialise(merged);
  const patch = {
    ...changes,
    ...headline(result),
    updatedAt: merged.updatedAt,
  };
  await store.update('reports', id, patch);
  return { ...merged, ...headline(result) };
}

/** Creates a new version of an existing report rather than overwriting it. */
export async function duplicateReport(id: string): Promise<ReportDoc | null> {
  const store = await getStore();
  const existing = await getReport(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const priorCount = await store.count('reports', { projectId: existing.projectId });
  const copy: ReportDoc = {
    ...existing,
    _id: newId('rpt'),
    version: priorCount + 1,
    createdAt: now,
    updatedAt: now,
  };
  return store.insert('reports', copy);
}

export async function deleteReport(id: string): Promise<void> {
  const store = await getStore();
  await store.remove('reports', id);
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const store = await getStore();
  await store.insert<AuditDoc>('audit_log', { ...entry, _id: newId('aud'), at: new Date().toISOString() });
}

export async function listAudit(reportId: string): Promise<AuditDoc[]> {
  const store = await getStore();
  return store.find<AuditDoc>('audit_log', { reportId }, { field: 'at', dir: -1 }, 200);
}

export async function getChatSession(reportId: string | null): Promise<ChatSessionDoc> {
  const store = await getStore();
  const key = reportId ?? '__form__';
  const existing = await store.findOne<ChatSessionDoc>('chat_sessions', { reportId: key });
  if (existing) return existing;
  const now = new Date().toISOString();
  return store.insert<ChatSessionDoc>('chat_sessions', {
    _id: newId('cht'),
    reportId: key,
    messages: [],
    createdAt: now,
    updatedAt: now,
  });
}

export async function appendChat(reportId: string | null, messages: ChatMessageDoc[]): Promise<void> {
  const store = await getStore();
  const session = await getChatSession(reportId);
  await store.update('chat_sessions', session._id, {
    messages: [...session.messages, ...messages].slice(-200),
    updatedAt: new Date().toISOString(),
  });
}
