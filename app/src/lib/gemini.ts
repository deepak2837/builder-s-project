/**
 * Thin Gemini REST client.
 *
 * Deliberately dependency-free: the generateContent endpoint is stable and this
 * avoids pinning an SDK version for a POC. Supports function calling, which is
 * how the assistant edits the document - it never writes numbers itself, it
 * calls a tool and the engine recomputes.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Tried in order; the first model that responds is cached for the process. */
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

let resolvedModel: string | null = null;

export type GeminiRole = 'user' | 'model' | 'function';

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface GenerateOptions {
  contents: GeminiContent[];
  systemInstruction?: string;
  tools?: FunctionDeclaration[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateResult {
  text: string;
  functionCalls: { name: string; args: Record<string, unknown> }[];
  model: string;
  raw: unknown;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiError('GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.');
  }
  return key;
}

async function callModel(model: string, options: GenerateOptions): Promise<GenerateResult> {
  const body: Record<string, unknown> = {
    contents: options.contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      // Generous, because 2.5-series models spend part of this budget on
      // internal reasoning before any visible output is produced.
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  };
  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }
  if (options.tools?.length) {
    body.tools = [{ functionDeclarations: options.tools }];
  }

  const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new GeminiError(`Gemini ${model} returned ${res.status}: ${detail.slice(0, 400)}`, res.status);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new GeminiError(`Request blocked: ${json.promptFeedback.blockReason}`);
  }

  const candidate = json.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  // An empty candidate is almost always the thinking budget eating the whole
  // output allowance. Surface it rather than returning a silent blank.
  if (parts.length === 0) {
    const reason = candidate?.finishReason ?? 'UNKNOWN';
    console.warn(`[gemini] ${model} returned no content parts (finishReason=${reason})`);
    if (reason === 'MAX_TOKENS') {
      throw new GeminiError(
        `${model} hit the output token limit before producing a reply. Raise maxOutputTokens or shorten the request.`,
      );
    }
  }

  return {
    text: parts
      .map((p) => p.text ?? '')
      .join('')
      .trim(),
    functionCalls: parts.filter((p) => p.functionCall).map((p) => p.functionCall!),
    model,
    raw: json,
  };
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const preferred = process.env.GEMINI_MODEL;
  const candidates = resolvedModel
    ? [resolvedModel]
    : [...new Set([preferred, ...MODEL_FALLBACKS].filter(Boolean) as string[])];

  let lastError: unknown;
  for (const model of candidates) {
    try {
      const result = await callModel(model, options);
      resolvedModel = model;
      return result;
    } catch (err) {
      lastError = err;
      // Only fall through on "model not found / not supported"; a 400 on our
      // own payload will fail the same way on every model.
      const status = err instanceof GeminiError ? err.status : undefined;
      if (status !== 404 && status !== 400) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new GeminiError('All Gemini models failed');
}

export function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
