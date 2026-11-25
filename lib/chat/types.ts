export type MediaKind = "image" | "audio" | "video" | "sticker" | "gif" | "doc" | "media";

export interface ChatMessage {
  /** index in the parsed chat */
  i: number;
  /** local wall-clock time, encoded as UTC epoch ms (no TZ conversion is ever applied) */
  ts: number;
  sender: string;
  text: string;
  media?: MediaKind;
  edited?: boolean;
  deleted?: boolean;
}

export interface ParseResult {
  messages: ChatMessage[];
  /** detected group name (sender that only ever posts system notices), if any */
  groupName: string | null;
  format: "ios" | "android" | "unknown";
  /** raw line count */
  lines: number;
  systemFiltered: number;
}

export interface PersonCount {
  name: string;
  count: number;
  pct: number;
}

export interface ChatStats {
  totals: {
    messages: number;
    participants: number;
    days: number;
    activeDays: number;
    first: number;
    last: number;
    words: number;
  };
  /** screen 1 – calendar heatmap: yyyy-mm-dd -> count */
  calendar: Record<string, number>;
  /** screen 2 */
  share: { top: PersonCount[]; others: number; othersPct: number; all: PersonCount[] };
  openers: { total: number; byPerson: PersonCount[] };
  petNames: { total: number; top: { term: string; count: number; bySender: Record<string, number> }[] };
  /** screen 3 */
  responseTimes: { name: string; medianMin: number; samples: number }[];
  goodMorning: { days: number; firstBy: PersonCount[] };
  shabbat: { total: number; quiet: number };
  peakDay: { date: string; count: number };
  streak: { longestDays: number; from: string; to: string };
  silence: { longestDays: number; from: string; to: string };
  hourly: { counts: number[]; peakHour: number; lateNightPct: number };
  /** screen 4 */
  longest: { sender: string; words: number; text: string; ts: number }[];
  /** screens 5 / 6 */
  firstMessages: Pick<ChatMessage, "sender" | "text" | "ts" | "media">[];
  lastMessages: Pick<ChatMessage, "sender" | "text" | "ts" | "media">[];
  /** screen 7 */
  laugh: { total: number; byPerson: PersonCount[]; longest: { sender: string; length: number } | null };
  topWords: { word: string; count: number }[];
  emoji: { emoji: string; count: number }[];
  voice: { total: number; byPerson: PersonCount[] };
  media: Record<MediaKind, number>;
}
