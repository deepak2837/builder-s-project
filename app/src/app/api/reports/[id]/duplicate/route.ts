import { NextResponse } from 'next/server';
import { duplicateReport } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const copy = await duplicateReport(id);
  if (!copy) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  return NextResponse.json({ id: copy._id, version: copy.version });
}
