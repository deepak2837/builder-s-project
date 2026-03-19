import { NextResponse } from 'next/server';
import { isConfigured } from '@/lib/gemini';
import { kbStats } from '@/lib/kb/retrieve';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await getStore();
  const kb = await kbStats();
  return NextResponse.json({
    store: {
      backend: store.backend,
      detail: store.detail,
      degraded: Boolean(store.degraded),
      degradedReason: store.degradedReason ?? null,
    },
    gemini: { configured: isConfigured(), model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash' },
    knowledgeBase: kb,
  });
}
