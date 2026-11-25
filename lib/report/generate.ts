import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ChatStats } from "../chat/types";
import { compressForLLM } from "../chat/compress";
import type { SetupAnswers } from "../setup";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { REPORT_JSON_SCHEMA, ReportSchema, type Report } from "./schema";
import { verifyQuotes } from "./verify";
import { mockReport } from "./mock";

export interface GenerateResult {
  report: Report;
  cutoff: number | null;
  readMessages: number;
  droppedQuotes: number;
  model: string;
  usage?: { input: number; output: number };
}

export async function generateReport(msgs: ChatMessage[], stats: ChatStats, answers: SetupAnswers): Promise<GenerateResult> {
  const budget = Number(process.env.REPORT_TOKEN_BUDGET ?? 200_000);
  const compressed = compressForLLM(msgs, budget);
  const participants = stats.share.all.map((p) => p.name);

  if (!process.env.ANTHROPIC_API_KEY) {
    const report = mockReport(msgs, stats, answers, compressed.includedMessages);
    const v = verifyQuotes(report, msgs);
    return { report: v.report, cutoff: compressed.cutoff, readMessages: compressed.includedMessages, droppedQuotes: v.dropped, model: "mock" };
  }

  const client = new Anthropic();
  const model = process.env.REPORT_MODEL ?? "claude-opus-5-5";
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
        content: buildUserPrompt({
          answers,
          stats,
          chatText: compressed.text,
          cutoff: compressed.cutoff,
          readMessages: compressed.includedMessages,
          participants,
        }),
      },
    ],
  });
  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") throw new Error("The model declined to write this report.");
  if (msg.stop_reason === "max_tokens") throw new Error("Report was cut off (max_tokens).");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = ReportSchema.parse(JSON.parse(text));
  const v = verifyQuotes(parsed, msgs);
  return {
    report: v.report,
    cutoff: compressed.cutoff,
    readMessages: compressed.includedMessages,
    droppedQuotes: v.dropped,
    model: msg.model,
    usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
  };
}
