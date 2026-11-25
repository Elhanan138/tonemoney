import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ChatStats } from "../chat/types";
import { compressForLLM } from "../chat/compress";
import type { SetupAnswers } from "../setup";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { REPORT_JSON_SCHEMA, ReportSchema, type Report } from "./schema";
import { verifyQuotes } from "./verify";
import { mockReport } from "./mock";
import { chunkChat, formatNotes, NOTES_MODEL, takeNotes } from "./notes";

export interface GenerateResult {
  report: Report;
  cutoff: number | null;
  readMessages: number;
  droppedQuotes: number;
  model: string;
  usage?: { notesIn: number; notesOut: number; notesCalls: number; writerIn: number; writerOut: number; costUsd: number };
}

/** $ per 1M tokens [input, output] – used only for the cost line in the logs. */
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};
const cost = (model: string, inp: number, out: number) => {
  const [a, b] = PRICES[model] ?? [0, 0];
  return (inp * a + out * b) / 1e6;
};

/** Small chats are read directly by the writer; bigger ones go through the two-stage read. */
const DIRECT_READ_TOKENS = Number(process.env.DIRECT_READ_TOKENS ?? 60_000);
/** Size of the recent raw excerpt the writer sees next to the notes. */
const RECENT_TOKENS = Number(process.env.RECENT_TOKENS ?? 25_000);

export async function generateReport(msgs: ChatMessage[], stats: ChatStats, answers: SetupAnswers): Promise<GenerateResult> {
  const whole = compressForLLM(msgs, Number.POSITIVE_INFINITY);
  const participants = stats.share.all.map((p) => p.name);

  if (!process.env.ANTHROPIC_API_KEY) {
    const report = mockReport(msgs, stats, answers, msgs.length);
    const v = verifyQuotes(report, msgs);
    return { report: v.report, cutoff: null, readMessages: msgs.length, droppedQuotes: v.dropped, model: "mock" };
  }

  const client = new Anthropic();
  const model = process.env.REPORT_MODEL ?? "claude-sonnet-5-5";

  // Stage 1 – the cheap model reads everything (only when the chat is too big to read directly).
  let notesText: string | undefined;
  let chatText = whole.text;
  let notesUsage = { input: 0, output: 0, calls: 0 };
  if (whole.tokens > DIRECT_READ_TOKENS) {
    const chunks = chunkChat(whole.text);
    const t0 = Date.now();
    const res = await takeNotes(client, chunks);
    notesUsage = res.usage;
    console.log(`[notes] ${res.notes.length}/${chunks.length} chunks in ${Math.round((Date.now() - t0) / 1000)}s`);
    if (res.notes.length) notesText = formatNotes(res.notes);
    chatText = compressForLLM(msgs, notesText ? RECENT_TOKENS : 150_000).text;
  }

  // Stage 2 – the writer.
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 32_000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: REPORT_JSON_SCHEMA } },
    system: buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildUserPrompt({ answers, stats, chatText, cutoff: null, readMessages: msgs.length, participants, notes: notesText }),
      },
    ],
  });
  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") throw new Error("The model declined to write this report.");
  if (msg.stop_reason === "max_tokens") throw new Error("Report was cut off (max_tokens).");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = ReportSchema.parse(JSON.parse(text));
  const v = verifyQuotes(parsed, msgs);
  const usage = {
    notesIn: notesUsage.input,
    notesOut: notesUsage.output,
    notesCalls: notesUsage.calls,
    writerIn: msg.usage.input_tokens,
    writerOut: msg.usage.output_tokens,
    costUsd: 0,
  };
  usage.costUsd = Math.round((cost(NOTES_MODEL, usage.notesIn, usage.notesOut) + cost(model, usage.writerIn, usage.writerOut)) * 10000) / 10000;
  // Notes cover the whole chat, so nothing is cut off; without notes, the writer read up to 150k tokens from the end.
  const cutoff = notesText || whole.tokens <= DIRECT_READ_TOKENS ? null : compressForLLM(msgs, 150_000).cutoff;
  return { report: v.report, cutoff, readMessages: msgs.length, droppedQuotes: v.dropped, model: msg.model, usage };
}
