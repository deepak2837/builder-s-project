import { NextResponse } from 'next/server';
import { normaliseInputs } from '@/engine/constants';
import type { FeasibilityInputs } from '@/engine/types';
import { appendChat } from '@/lib/repository';
import { runAssistant } from '@/lib/assistant';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message: string;
      history?: { role: 'user' | 'model'; text: string }[];
      reportId?: string | null;
      /** Live, unsaved state of the calculation page. */
      draftInputs?: Partial<FeasibilityInputs> | null;
    };

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    }

    const result = await runAssistant({
      message: body.message,
      history: body.history ?? [],
      reportId: body.reportId ?? null,
      // The form posts whatever it currently holds, which on a session resumed
      // from an older draft can be short of fields the engine now reads.
      draftInputs: body.draftInputs ? normaliseInputs(body.draftInputs) : null,
    });

    const now = new Date().toISOString();
    await appendChat(body.reportId ?? null, [
      { role: 'user', text: body.message, at: now },
      { role: 'model', text: result.text, citations: result.citations, at: now },
    ]);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat failed';
    return NextResponse.json({ error: message, text: `Something went wrong: ${message}` }, { status: 500 });
  }
}
