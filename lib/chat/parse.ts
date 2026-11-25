import type { ChatMessage, MediaKind, ParseResult } from "./types";

// Directional / invisible marks WhatsApp sprinkles into exports.
const LEADING_MARKS = /^[\u200e\u200f\u202a\u202c\u202d\u202e\ufeff\u2066-\u2069]+/;
const ALL_MARKS = /[\u200e\u200f\u202a-\u202e\ufeff\u2066-\u2069]/g;
const SYSTEM_MARK = "\u202b";

const DATE = String.raw`(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[\s\u202f\u00a0]*([AaPp])\.?\s?[Mm]\.?)?`;
const IOS_RE = new RegExp(String.raw`^\[${DATE}\]\s*(.*)$`);
const ANDROID_RE = new RegExp(String.raw`^${DATE}\s+-\s+(.*)$`);

/** Localized media placeholders. Order matters: more specific first. */
const MEDIA_STRINGS: [MediaKind, string[]][] = [
  ["sticker", ["סטיקר הושמט", "sticker omitted", "-STICKER-", "STICKER"]],
  ["gif", ["GIF הושמט", "GIF omitted", "-GIF-"]],
  ["video", ["סרטון הווידאו הושמט", "הווידאו הושמט", "video omitted", "-VIDEO-"]],
  ["audio", ["השמע הושמט", "audio omitted", "-AUDIO-", "PTT-"]],
  ["image", ["התמונה הושמטה", "image omitted", "-PHOTO-"]],
  ["doc", ["מסמך הושמט", "document omitted", "Contact card omitted", "כרטיס איש הקשר הושמט"]],
  ["media", ["<המדיה לא נכללה>", "<Media omitted>", "<attached:", "<מצורף:"]],
];

const EDITED = ["<ההודעה נערכה>", "<This message was edited>", "\u200f<ההודעה נערכה>"];
const DELETED = ["מחקת את ההודעה הזו", "ההודעה הזו נמחקה", "הודעה זו נמחקה", "This message was deleted", "You deleted this message"];
const SYSTEM_PHRASES = [
  "מוצפנות מקצה לקצה",
  "end-to-end encrypted",
  "created group",
  "יצר/ה את הקבוצה",
  "יצר את הקבוצה",
  "יצרה את הקבוצה",
  "changed the subject",
  "changed this group",
  "added you",
  "הוסיף/ה אותך",
];

export function classifyMedia(text: string): MediaKind | undefined {
  for (const [kind, needles] of MEDIA_STRINGS) {
    if (needles.some((n) => text.includes(n))) return kind;
  }
  return undefined;
}

interface RawHit {
  d1: number;
  d2: number;
  y: number;
  h: number;
  m: number;
  s: number;
  ampm?: string;
  rest: string;
  format: "ios" | "android";
  system: boolean;
}

function matchLine(rawLine: string): RawHit | null {
  const system = rawLine.startsWith(SYSTEM_MARK);
  const line = rawLine.replace(LEADING_MARKS, "").replace(/^\u202b/, "");
  let m = IOS_RE.exec(line);
  let format: "ios" | "android" = "ios";
  if (!m) {
    m = ANDROID_RE.exec(line);
    format = "android";
  }
  if (!m) return null;
  return {
    d1: +m[1],
    d2: +m[2],
    y: +m[3],
    h: +m[4],
    m: +m[5],
    s: m[6] ? +m[6] : 0,
    ampm: m[7],
    rest: m[8],
    format,
    system,
  };
}

/**
 * Parse a WhatsApp `_chat.txt` (iPhone `[d.m.yyyy, hh:mm:ss] name: text`
 * or Android `dd/mm/yyyy, hh:mm - name: text`).
 */
export function parseWhatsApp(input: string): ParseResult {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const hits: (RawHit | null)[] = lines.map(matchLine);

  // Day-first vs month-first: decide once for the whole file.
  let dayFirst = true;
  let sawD1Over12 = false;
  let sawD2Over12 = false;
  for (const h of hits) {
    if (!h) continue;
    if (h.d1 > 12) sawD1Over12 = true;
    if (h.d2 > 12) sawD2Over12 = true;
  }
  if (sawD2Over12 && !sawD1Over12) dayFirst = false;

  type Draft = { ts: number; sender: string | null; text: string; system: boolean };
  const drafts: Draft[] = [];
  let format: ParseResult["format"] = "unknown";

  for (let li = 0; li < lines.length; li++) {
    const h = hits[li];
    if (!h) {
      // continuation line → append to previous message
      if (drafts.length) drafts[drafts.length - 1].text += "\n" + lines[li].replace(ALL_MARKS, "");
      continue;
    }
    if (format === "unknown") format = h.format;
    const day = dayFirst ? h.d1 : h.d2;
    const month = dayFirst ? h.d2 : h.d1;
    const year = h.y < 100 ? 2000 + h.y : h.y;
    let hour = h.h;
    if (h.ampm) {
      const pm = h.ampm.toLowerCase() === "p";
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }
    const ts = Date.UTC(year, month - 1, day, hour, h.m, h.s);

    const sep = h.rest.indexOf(": ");
    let sender: string | null = null;
    let text = h.rest;
    // Android system lines have no "name: " part. A colon very deep in the line is text, not a name.
    if (sep > 0 && sep < 80) {
      sender = h.rest.slice(0, sep).replace(ALL_MARKS, "").trim();
      text = h.rest.slice(sep + 2);
    } else if (h.rest.endsWith(":") && h.rest.length < 80) {
      sender = h.rest.slice(0, -1).replace(ALL_MARKS, "").trim();
      text = "";
    }
    const system = h.system || text.startsWith(SYSTEM_MARK) || sender === null;
    drafts.push({ ts, sender, text, system });
  }

  // A "group name" is a sender whose every line is a system-ish notice (starts with LRM, no real text).
  const senderStats = new Map<string, { total: number; marked: number }>();
  for (const d of drafts) {
    if (!d.sender) continue;
    const s = senderStats.get(d.sender) ?? { total: 0, marked: 0 };
    s.total++;
    if (/^[\u200e\u202b]/.test(d.text) && !classifyMedia(d.text) && !DELETED.some((e) => d.text.includes(e))) s.marked++;
    senderStats.set(d.sender, s);
  }
  let groupName: string | null = null;
  for (const [name, s] of senderStats) {
    if (s.total > 0 && s.marked === s.total) {
      groupName = name;
      break;
    }
  }

  const messages: ChatMessage[] = [];
  let systemFiltered = 0;
  for (const d of drafts) {
    const cleanText = d.text.replace(ALL_MARKS, "").trim();
    const isSystem =
      d.system ||
      d.sender === groupName ||
      (/^[\u200e]/.test(d.text) && SYSTEM_PHRASES.some((p) => cleanText.includes(p)));
    if (isSystem || !d.sender) {
      systemFiltered++;
      continue;
    }
    const msg: ChatMessage = { i: messages.length, ts: d.ts, sender: d.sender, text: cleanText };
    const media = classifyMedia(d.text);
    if (media) msg.media = media;
    if (EDITED.some((e) => cleanText.includes(e))) {
      msg.edited = true;
      msg.text = EDITED.reduce((t, e) => t.split(e).join(""), msg.text).trim();
    }
    if (DELETED.some((e) => cleanText === e || cleanText.endsWith(e))) msg.deleted = true;
    messages.push(msg);
  }

  return { messages, groupName, format, lines: lines.length, systemFiltered };
}

/** Rename / merge senders. `map` maps original sender → final display name. */
export function applyNames(messages: ChatMessage[], map: Record<string, string>): ChatMessage[] {
  return messages.map((m) => (map[m.sender] && map[m.sender] !== m.sender ? { ...m, sender: map[m.sender] } : m));
}
