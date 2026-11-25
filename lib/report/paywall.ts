import type { PublicReport, Report } from "./schema";

/** Cut section 1 mid-sentence: keep ~55% of the body and end on a word, no punctuation. */
export function cutMidSentence(body: string, ratio = 0.55): string {
  const target = Math.max(80, Math.floor(body.length * ratio));
  if (body.length <= target) return body;
  let cut = body.lastIndexOf(" ", target);
  if (cut < target * 0.6) cut = target;
  return body.slice(0, cut).replace(/[.!?…,:;\-–—\s]+$/u, "");
}

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function toPublic(
  report: Report,
  meta: { paid: boolean; shareToken: string | null; cutoff: number | null; readMessages: number; totalMessages: number },
): PublicReport {
  const s1 = report.sections[0];
  const base = { title: report.title, subtitle: report.subtitle, opener: report.opener, ...meta };
  if (meta.paid) return { ...base, first: { ...s1, cut: false }, locked: null, full: report };
  const rest = report.sections.slice(1);
  const words =
    rest.reduce((a, s) => a + countWords(s.body), 0) +
    countWords(report.quiet_item.body) +
    report.lines.reduce((a, l) => a + countWords(l.body), 0) +
    countWords(report.bottom_line) +
    Math.max(0, countWords(s1.body) - countWords(cutMidSentence(s1.body)));
  return {
    ...base,
    first: { title: s1.title, body: cutMidSentence(s1.body), quotes: s1.quotes.slice(0, 1), cut: true },
    locked: { sections: [...rest.map((s) => s.title), report.quiet_item.title], words, people: report.lines.length },
    full: null,
    shareToken: null,
  };
}
