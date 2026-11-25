import type { ChatMessage, MediaKind } from "./types";

const MEDIA_LABEL: Record<MediaKind, string> = {
  image: "תמונה", audio: "הקלטה", video: "וידאו", sticker: "סטיקר", gif: "GIF", doc: "מסמך", media: "מדיה",
};

/** Rough token estimate. Hebrew ≈ 2.2 chars/token, Latin ≈ 4. Conservative on purpose. */
export function estimateTokens(text: string): number {
  let heb = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x0590 && c <= 0x05ff) heb++;
  }
  return Math.ceil(heb / 2.2 + (text.length - heb) / 3.5);
}

const pad = (n: number) => String(n).padStart(2, "0");
function stamp(ts: number, prevTs: number | null): string {
  const d = new Date(ts);
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  const p = prevTs !== null ? new Date(prevTs) : null;
  if (p && p.toISOString().slice(0, 10) === d.toISOString().slice(0, 10)) return time;
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${String(d.getUTCFullYear()).slice(2)} ${time}`;
}

export interface Compressed {
  text: string;
  tokens: number;
  includedMessages: number;
  totalMessages: number;
  /** ts of first included message, null when the whole chat fits */
  cutoff: number | null;
}

/**
 * Compact format for the LLM: `stamp|name|text` (date only when it changes),
 * consecutive media from the same sender collapsed into `[תמונה ×3]`,
 * edit / delete markers dropped. Cut from the end backwards until the token budget is spent.
 */
export function compressForLLM(msgs: ChatMessage[], budgetTokens: number): Compressed {
  // 1. collapse
  type Row = { ts: number; sender: string; text: string; firstIdx: number };
  const rows: Row[] = [];
  for (const m of msgs) {
    if (m.deleted) continue;
    const last = rows[rows.length - 1];
    if (m.media) {
      const label = MEDIA_LABEL[m.media];
      const caption = m.text && !m.text.includes("הושמט") && !m.text.includes("omitted") && !m.text.startsWith("<") ? ` ${m.text}` : "";
      const mm = last && last.sender === m.sender ? /^\[([^\]×]+?)(?: ×(\d+))?\]$/.exec(last.text) : null;
      if (mm && mm[1] === label && !caption) {
        last.text = `[${label} ×${(+mm[2] || 1) + 1}]`;
        continue;
      }
      rows.push({ ts: m.ts, sender: m.sender, text: `[${label}]${caption}`, firstIdx: m.i });
      continue;
    }
    rows.push({ ts: m.ts, sender: m.sender, text: m.text.replace(/\n+/g, " / "), firstIdx: m.i });
  }

  // 2. walk backwards
  let used = 0;
  let start = rows.length;
  for (let k = rows.length - 1; k >= 0; k--) {
    const line = `${rows[k].ts}|${rows[k].sender}|${rows[k].text}`; // approximate size, stamp format is shorter
    const t = estimateTokens(line) + 1;
    if (used + t > budgetTokens) break;
    used += t;
    start = k;
  }
  const kept = rows.slice(start);
  const lines: string[] = [];
  let prevTs: number | null = null;
  for (const r of kept) {
    lines.push(`${stamp(r.ts, prevTs)}|${r.sender}|${r.text}`);
    prevTs = r.ts;
  }
  const text = lines.join("\n");
  const includedMessages = kept.length ? msgs.length - kept[0].firstIdx : 0;
  return {
    text,
    tokens: estimateTokens(text),
    includedMessages,
    totalMessages: msgs.length,
    cutoff: start > 0 && kept.length ? kept[0].ts : null,
  };
}
