import { env } from '../config/env.js';
import type { CreateAssignmentInput, QuestionPaper } from '../types/domain.js';
import { buildPrompt } from './prompt.builder.js';
import { parsePaper } from './parser.service.js';
import { logger } from '../utils/logger.js';

/**
 * Groq exposes an OpenAI-compatible REST endpoint, so we keep the integration
 * simple (no extra SDK) and stay vendor-portable: swap GROQ_BASE_URL for any
 * other OpenAI-compatible provider (Together, Fireworks, local Ollama, …) and
 * everything below still works.
 *
 * Default model: openai/gpt-oss-20b — Groq's hosted open-weights GPT, fast and
 * generous on free tier.
 */

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

class AIRequestError extends Error {
  constructor(public status: number, public body: string) {
    super(`AI request failed (${status}): ${body.slice(0, 200)}`);
    this.name = 'AIRequestError';
  }
}

async function callGroq(prompt: string): Promise<string> {
  const url = `${env.GROQ_BASE_URL.replace(/\/$/, '')}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an experienced exam-paper setter for Indian schools (CBSE-style). ' +
            'You always respond with valid, parseable JSON only — no prose, no markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: env.AI_TEMPERATURE,
      max_tokens: env.AI_MAX_TOKENS,
      // The OpenAI-compatible JSON-mode hint. Most Groq models honour it; the
      // parser is defensive enough that providers which ignore it still work.
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AIRequestError(res.status, body);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content.trim()) {
    throw new AIRequestError(502, 'Empty completion');
  }
  logger.debug(
    { tokens: data.usage, model: env.GROQ_MODEL },
    'Groq response received',
  );
  return content;
}

export async function generateQuestionPaper(input: CreateAssignmentInput): Promise<QuestionPaper> {
  const prompt = buildPrompt(input);
  const start = Date.now();

  // One quick retry on transient failures keeps single-blip 5xx from breaking
  // the worker job entirely — BullMQ also retries at a coarser layer.
  let raw: string;
  try {
    raw = await callGroq(prompt);
  } catch (err) {
    if (err instanceof AIRequestError && err.status >= 500) {
      logger.warn({ err: err.message }, 'AI call failed transiently, retrying once');
      await new Promise(r => setTimeout(r, 500));
      raw = await callGroq(prompt);
    } else {
      throw err;
    }
  }

  logger.info({ ms: Date.now() - start }, 'AI generation complete');
  return parsePaper(raw);
}
