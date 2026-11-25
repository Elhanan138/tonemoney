import Anthropic from "@anthropic-ai/sdk";
import { estimateTokens } from "../chat/compress";

/**
 * Stage 1 of the two-stage read: a cheap model reads the WHOLE chat in chunks
 * and writes structured notes. Stage 2 (the writer) works from these notes
 * plus a short recent excerpt, instead of reading only the last N messages.
 */

export const NOTES_MODEL = process.env.NOTES_MODEL ?? "claude-haiku-5-5";
/** Keep each chunk well under 100K prompt tokens: Haiku 5.5 is billed at a higher rate above that. */
const CHUNK_TOKENS = Number(process.env.NOTES_CHUNK_TOKENS ?? 70_000);
const CONCURRENCY = 4;

export interface ChunkNotes {
  period: string;
  summary: string;
  dynamics: string[];
  moments: { when: string; who: string; what: string }[];
  running_jokes: string[];
  quotes: { author: string; text: string; why: string }[];
}

const NOTES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["period", "summary", "dynamics", "moments", "running_jokes", "quotes"],
  properties: {
    period: { type: "string" },
    summary: { type: "string" },
    dynamics: { type: "array", items: { type: "string" } },
    moments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["when", "who", "what"],
        properties: { when: { type: "string" }, who: { type: "string" }, what: { type: "string" } },
      },
    },
    running_jokes: { type: "array", items: { type: "string" } },
    quotes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["author", "text", "why"],
        properties: { author: { type: "string" }, text: { type: "string" }, why: { type: "string" } },
      },
    },
  },
} as const;

const NOTES_SYSTEM = `You read one part of a group chat and take notes for a writer who will write about the whole chat later.
Be concrete: names, dates, amounts, places, nicknames, recurring phrases. No judgement, no jokes, just observations.
- dynamics: who does what in the group, alliances, tensions, care, roles (5-10 items).
- moments: notable events with date and who (up to 12).
- running_jokes: recurring jokes, phrases, nicknames (up to 8).
- quotes: up to 12 short lines copied EXACTLY from the chat (same spelling, one line each), the most telling or funny ones. "author" is the exact sender name.
Never include phone numbers, addresses, ID numbers or passwords.
Write the notes in the same language as the chat.`;

/** Split the compressed chat (one message per line) into chunks under the token limit. */
export function chunkChat(text: string, maxTokens = CHUNK_TOKENS): string[] {
  const chunks: string[] = [];
  let cur: string[] = [];
  let used = 0;
  for (const line of text.split("\n")) {
    const t = estimateTokens(line) + 1;
    if (used + t > maxTokens && cur.length) {
      chunks.push(cur.join("\n"));
      cur = [];
      used = 0;
    }
    cur.push(line);
    used += t;
  }
  if (cur.length) chunks.push(cur.join("\n"));
  return chunks;
}

export interface NotesUsage {
  input: number;
  output: number;
  calls: number;
}

async function notesForChunk(client: Anthropic, chunk: string, idx: number, total: number, usage: NotesUsage): Promise<ChunkNotes | null> {
  const msg = await client.messages.create({
    model: NOTES_MODEL,
    max_tokens: 8_000,
    output_config: { effort: "low", format: { type: "json_schema", schema: NOTES_SCHEMA } },
    system: NOTES_SYSTEM,
    messages: [
      {
        role: "user",
        content: `<chat part="${idx + 1} of ${total}" format="date-or-time|sender|text">\n${chunk}\n</chat>\n\nTake notes on this part as JSON.`,
      },
    ],
  });
  usage.input += msg.usage.input_tokens;
  usage.output += msg.usage.output_tokens;
  usage.calls++;
  if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") return null;
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return JSON.parse(text) as ChunkNotes;
  } catch {
    return null;
  }
}

/** Runs stage 1 over all chunks with limited concurrency. Failed chunks are skipped, not fatal. */
export async function takeNotes(client: Anthropic, chunks: string[]): Promise<{ notes: ChunkNotes[]; usage: NotesUsage }> {
  const usage: NotesUsage = { input: 0, output: 0, calls: 0 };
  const results: (ChunkNotes | null)[] = new Array(chunks.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < chunks.length) {
      const i = next++;
      try {
        results[i] = await notesForChunk(client, chunks[i], i, chunks.length, usage);
      } catch (e) {
        console.error(`[notes] chunk ${i + 1}/${chunks.length} failed:`, e instanceof Error ? e.message : e);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));
  return { notes: results.filter((n): n is ChunkNotes => n !== null), usage };
}

/** Compact text form of the notes for the writer's prompt. */
export function formatNotes(notes: ChunkNotes[]): string {
  return notes
    .map((n, i) =>
      [
        `## Part ${i + 1} · ${n.period}`,
        n.summary,
        n.dynamics.length ? `Dynamics:\n- ${n.dynamics.join("\n- ")}` : "",
        n.moments.length ? `Moments:\n- ${n.moments.map((m) => `${m.when} · ${m.who}: ${m.what}`).join("\n- ")}` : "",
        n.running_jokes.length ? `Running jokes:\n- ${n.running_jokes.join("\n- ")}` : "",
        n.quotes.length ? `Quotes (verbatim):\n- ${n.quotes.map((q) => `${q.author}: "${q.text}" (${q.why})`).join("\n- ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
