import type { ChatMessage } from "../chat/types";
import type { Report, Quote } from "./schema";

const norm = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[‎‏‪-‮️]/g, "")
    .replace(/["'״׳“”‘’`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Keep only quotes that appear verbatim (after light normalization) in the chat.
 * Author must match the real sender; if the model got the author wrong but the
 * text exists, the author is corrected rather than the quote dropped.
 */
export function verifyQuotes(report: Report, msgs: ChatMessage[]): { report: Report; dropped: number } {
  const corpus = msgs.filter((m) => !m.media && m.text).map((m) => ({ sender: m.sender, text: norm(m.text) }));
  let dropped = 0;
  const fix = (qs: Quote[]): Quote[] =>
    qs.flatMap((q) => {
      const t = norm(q.text);
      if (t.length < 2) return (dropped++, []);
      const exact = corpus.find((c) => c.sender === q.author && c.text.includes(t));
      if (exact) return [q];
      const any = corpus.find((c) => c.text.includes(t));
      if (any) return [{ ...q, author: any.sender }];
      dropped++;
      return [];
    });
  return {
    report: {
      ...report,
      sections: report.sections.map((c) => ({ ...c, quotes: fix(c.quotes) })),
      quiet_item: { ...report.quiet_item, quotes: fix(report.quiet_item.quotes) },
    },
    dropped,
  };
}
