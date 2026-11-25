import { z } from "zod";

export const QuoteSchema = z.object({ author: z.string(), text: z.string() });
export const SectionSchema = z.object({ title: z.string(), body: z.string(), quotes: z.array(QuoteSchema) });
export const LineSchema = z.object({ name: z.string(), role: z.string(), body: z.string() });
export const ReportSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  opener: z.string(),
  sections: z.array(SectionSchema),
  quiet_item: SectionSchema,
  lines: z.array(LineSchema),
  bottom_line: z.string(),
});

export type Quote = z.infer<typeof QuoteSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Line = z.infer<typeof LineSchema>;
export type Report = z.infer<typeof ReportSchema>;

/** JSON schema for the API's structured output (kept in sync with ReportSchema). */
const quote = { type: "object", additionalProperties: false, required: ["author", "text"], properties: { author: { type: "string" }, text: { type: "string" } } };
const section = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body", "quotes"],
  properties: { title: { type: "string" }, body: { type: "string" }, quotes: { type: "array", items: quote } },
};
export const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "opener", "sections", "quiet_item", "lines", "bottom_line"],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    opener: { type: "string" },
    sections: { type: "array", items: section },
    quiet_item: section,
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role", "body"],
        properties: { name: { type: "string" }, role: { type: "string" }, body: { type: "string" } },
      },
    },
    bottom_line: { type: "string" },
  },
} as const;

/** What the client receives. Locked content never leaves the server before payment. */
export interface PublicReport {
  title: string;
  subtitle: string;
  opener: string;
  first: { title: string; body: string; quotes: Quote[]; cut: boolean };
  locked: { sections: string[]; words: number; people: number } | null;
  full: Report | null;
  cutoff: number | null;
  readMessages: number;
  totalMessages: number;
  paid: boolean;
  shareToken: string | null;
}
