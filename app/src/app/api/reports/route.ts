import { NextResponse } from 'next/server';
import { DEFAULT_INPUTS } from '@/engine/constants';
import type { FeasibilityInputs } from '@/engine/types';
import { createReport, listReports } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const reports = await listReports();
  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r._id,
      projectId: r.projectId,
      projectName: r.projectName,
      version: r.version,
      village: r.inputs.village,
      authority: r.inputs.authority,
      netProfit: r.netProfit,
      totalIncome: r.totalIncome,
      totalExpenditure: r.totalExpenditure,
      marginPct: r.marginPct,
      score: r.score,
      verdict: r.verdict,
      tenantUpliftPct: r.inputs.additionalCarpetToTenantsPct * 100,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { inputs?: Partial<FeasibilityInputs> };
    // Merge over defaults so a partial payload is always a complete input set.
    const inputs: FeasibilityInputs = { ...DEFAULT_INPUTS, ...(body.inputs ?? {}) };
    const report = await createReport(inputs);
    return NextResponse.json({ id: report._id, version: report.version });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
