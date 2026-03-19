import { NextResponse } from 'next/server';
import { listAudit } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ entries: await listAudit(id) });
}
