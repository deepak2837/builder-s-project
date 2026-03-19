'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AreaMixControls } from '@/components/AreaMixControls';
import { ChatPanel, type ChatChange } from '@/components/ChatPanel';
import { DerivedPanel } from '@/components/DerivedPanel';
import { MobilePaneToggle } from '@/components/MobilePaneToggle';
import { PrimaryDrivers } from '@/components/PrimaryDrivers';
import { ReportDocument } from '@/components/ReportDocument';
import { ResidualPanel } from '@/components/ResidualPanel';
import type { FeasibilityInputs, FeasibilityResult } from '@/engine/types';

const SUGGESTIONS = [
  'Why is the TDR cost this high?',
  'Change the tenant uplift to 20% and tell me what happens to the profit',
  'What if construction goes to Rs 4,500 per sq.ft?',
  'Which regulation gives the 30% incentive FSI?',
];

interface ReportMeta {
  id: string;
  version: number;
  projectName: string;
}

export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [result, setResult] = useState<FeasibilityResult | null>(null);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<'doc' | 'chat'>('doc');

  const load = useCallback(async () => {
    const res = await fetch(`/api/reports/${id}`);
    if (!res.ok) {
      setError('Report not found.');
      return;
    }
    const data = await res.json();
    setResult(data.result);
    setMeta({ id: data.report.id ?? id, version: data.report.version, projectName: data.report.projectName });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = useCallback((fields: string[]) => {
    setChangedFields(new Set(fields));
    setTimeout(() => setChangedFields(new Set()), 2600);
  }, []);

  const patch = useCallback(
    async (body: Record<string, unknown>, touched: string[] = []) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/reports/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok) {
          setResult(data.result);
          if (touched.length) flash(touched);
        } else {
          setError(data.error ?? 'Save failed');
        }
      } finally {
        setSaving(false);
      }
    },
    [id, flash],
  );

  const handleUpdateInput = useCallback(
    (p: Partial<FeasibilityInputs>) => patch({ inputs: p }, Object.keys(p)),
    [patch],
  );

  const handleOverride = useCallback(
    (key: string, value: number | null) =>
      value === null
        ? patch({ inputs: {}, releaseOverrides: [key] }, [key])
        : patch({ inputs: { [key]: value } }, [key]),
    [patch],
  );

  const handleEditProse = useCallback(
    (sectionId: string, html: string) => patch({ prose: { sectionId, html } }),
    [patch],
  );

  const handleRemoveItem = useCallback(
    (sectionId: string, itemId: string) => patch({ removeItemId: { sectionId, itemId } }),
    [patch],
  );

  const handleAssistantChanges = useCallback(
    async (changes: ChatChange[]) => {
      await load();
      flash(changes.map((c) => c.field));
      // On a phone the document is behind the chat, so bring it forward.
      if (changes.length) setPane('doc');
    },
    [load, flash],
  );

  async function duplicate() {
    const res = await fetch(`/api/reports/${id}/duplicate`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) router.push(`/workspace/${data.id}`);
  }

  if (error) {
    return (
      <div className="grid h-[calc(100vh-3.5rem)] place-items-center">
        <div className="text-center">
          <p className="text-[14px] text-ink-700">{error}</p>
          <Link href="/history" className="btn-secondary mt-3">
            Back to history
          </Link>
        </div>
      </div>
    );
  }

  if (!result || !meta) {
    return (
      <div className="grid h-[calc(100vh-3.5rem)] place-items-center">
        <p className="text-[13px] text-ink-400">Loading report…</p>
      </div>
    );
  }

  const paneOptions = [
    { value: 'doc' as const, label: 'Report' },
    { value: 'chat' as const, label: 'Assistant' },
  ];

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      {/* -------------------------------------------------- document */}
      <div
        className={`flex-1 flex-col overflow-hidden print-full ${
          pane === 'chat' ? 'hidden' : 'flex'
        } lg:flex`}
      >
        <div className="no-print border-b border-ink-200 bg-white px-4 py-2 sm:px-5">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink-900">
                {meta.projectName}
                <span className="ml-2 font-normal text-ink-400">v{meta.version}</span>
              </p>
            </div>
            {saving && <span className="shrink-0 text-[11px] text-ink-400">saving…</span>}

            {/* Export actions scroll sideways on a phone instead of wrapping */}
            <div className="thin-scroll flex shrink-0 items-center gap-1.5 overflow-x-auto">
              {/* Round trip back to the input form, carrying this report's
                  values, so nothing has to be re-entered. */}
              <Link href={`/?from=${id}`} className="btn-secondary h-8 shrink-0">
                <span className="hidden sm:inline">Edit inputs</span>
                <span className="sm:hidden">Inputs</span>
              </Link>
              <button onClick={duplicate} className="btn-secondary h-8 shrink-0">
                <span className="hidden sm:inline">Duplicate &amp; tweak</span>
                <span className="sm:hidden">Copy</span>
              </button>
              <a href={`/api/export/${id}?format=xlsx`} className="btn-secondary h-8 shrink-0">
                Excel
              </a>
              <a href={`/api/export/${id}?format=docx`} className="btn-secondary h-8 shrink-0">
                Word
              </a>
              <a href={`/api/export/${id}?format=csv`} className="btn-secondary h-8 shrink-0">
                CSV
              </a>
              <button onClick={() => window.print()} className="btn-secondary h-8 shrink-0">
                PDF
              </button>
            </div>
          </div>

          <div className="mt-2 lg:hidden">
            <MobilePaneToggle value={pane} onChange={setPane} options={paneOptions} />
          </div>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto print-full">
          <div className="no-print mx-auto max-w-3xl space-y-3 px-3 pt-5 sm:px-6">
            <PrimaryDrivers inputs={result.inputs} onChange={handleUpdateInput} busy={saving} />
            <DerivedPanel
              derived={result.derived}
              schemes={result.schemes}
              rulebook={result.rulebook}
              onOverride={handleOverride}
            />
            <AreaMixControls
              inputs={result.inputs}
              preview={result}
              onChange={handleUpdateInput}
              disabled={saving}
            />
            <ResidualPanel inputs={result.effectiveInputs} />
          </div>

          <ReportDocument
            result={result}
            changedFields={changedFields}
            onUpdateInput={handleUpdateInput}
            onEditProse={handleEditProse}
            onRemoveItem={handleRemoveItem}
          />
        </div>
      </div>

      {/* -------------------------------------------------- assistant */}
      <aside
        className={`no-print w-full shrink-0 border-ink-200 lg:block lg:w-[420px] lg:border-l ${
          pane === 'chat' ? 'block' : 'hidden'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-ink-200 bg-white px-4 py-2.5 lg:hidden">
            <MobilePaneToggle value={pane} onChange={setPane} options={paneOptions} />
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel
              reportId={id}
              title="Report assistant"
              intro="Ask me anything about this report, or tell me what to change. I see the same figures you do, and every change goes back through the engine — I never edit a number by hand."
              suggestions={SUGGESTIONS}
              draftInputs={result.inputs}
              onReportUpdated={handleAssistantChanges}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
