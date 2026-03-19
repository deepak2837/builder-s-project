import { NextResponse } from 'next/server';
import { FIELD_META_BY_KEY, coerceFieldValue, normaliseInputs } from '@/engine/constants';
import { DERIVED_KEYS } from '@/engine/derive';
import type { FeasibilityInputs } from '@/engine/types';
import { deleteReport, getReport, logAudit, materialise, saveReport } from '@/lib/repository';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  return NextResponse.json({ report: { ...report, id: report._id }, result: materialise(report) });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const existing = await getReport(id);
  if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const body = (await request.json()) as {
    inputs?: Partial<FeasibilityInputs>;
    releaseOverrides?: string[];
    prose?: { sectionId: string; html: string };
    removeItemId?: { sectionId: string; itemId: string };
  };

  // Editing a report saved before a field existed writes the completed set
  // back, so the record heals the first time it is touched.
  let inputs = normaliseInputs(existing.inputs);
  if (body.inputs) {
    inputs = { ...inputs, overrides: [...(inputs.overrides ?? [])] };

    // Releasing a pinned parameter back to the regulation.
    if (Array.isArray(body.releaseOverrides)) {
      inputs.overrides = inputs.overrides.filter((k) => !body.releaseOverrides!.includes(k));
    }

    for (const [key, raw] of Object.entries(body.inputs)) {
      const field = key as keyof FeasibilityInputs;
      if (field === 'overrides') continue;
      if (!FIELD_META_BY_KEY.has(field)) continue;
      const coerced = coerceFieldValue(field, raw);
      if (coerced === undefined) continue;

      // Typing a value into a regulation-derived field means you want that
      // value kept, so pin it - otherwise derivation would overwrite it on the
      // next recompute and the edit would appear to do nothing.
      if (DERIVED_KEYS.has(field) && !inputs.overrides.includes(field)) {
        inputs.overrides = [...inputs.overrides, field];
      }
      if (inputs[field] !== coerced) {
        await logAudit({
          reportId: id,
          field,
          label: FIELD_META_BY_KEY.get(field)?.label ?? field,
          oldValue: inputs[field],
          newValue: coerced,
          source: 'user',
        });
      }
      (inputs as unknown as Record<string, unknown>)[field] = coerced;
    }
  }

  const patches = [...(existing.patches ?? [])];
  if (body.prose) {
    const found = patches.find((p) => p.sectionId === body.prose!.sectionId);
    if (found) found.prose = body.prose.html;
    else patches.push({ sectionId: body.prose.sectionId, prose: body.prose.html });
  }
  if (body.removeItemId) {
    const { sectionId, itemId } = body.removeItemId;
    const found = patches.find((p) => p.sectionId === sectionId);
    if (found) found.removedItemIds = [...new Set([...(found.removedItemIds ?? []), itemId])];
    else patches.push({ sectionId, removedItemIds: [itemId] });
  }

  const updated = await saveReport(id, { inputs, patches });
  if (!updated) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  return NextResponse.json({ report: updated, result: materialise(updated) });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteReport(id);
  return NextResponse.json({ ok: true });
}
