import type { ChatMessage, ChatStats, MediaKind, PersonCount } from "./types";
import { GOOD_MORNING, PET_NAMES, STOP_WORDS } from "./lexicon";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export interface StatsOptions {
  /** silence before a message counts as "opening" a conversation */
  openerGapHours?: number;
  /** max gap counted as a response */
  responseMaxHours?: number;
  /** minimum responses for a person to appear in the response-time podium */
  responseMinSamples?: number;
  /** Shabbat is "quiet" if it has at most this many messages */
  shabbatQuietMax?: number;
}

const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const dayIndex = (ts: number) => Math.floor(ts / DAY);
const keyOfIndex = (idx: number) => new Date(idx * DAY).toISOString().slice(0, 10);

function toPersonCounts(map: Map<string, number>, total?: number): PersonCount[] {
  const sum = total ?? [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count, pct: sum ? Math.round((count / sum) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count);
}

function inc<K>(map: Map<K, number>, key: K, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Approximate candle-lighting / havdalah in Israel by month (local time, hours).
 * Good enough for a "quiet Shabbat" metric; swap for a proper sunset calc if needed.
 */
const SHABBAT_WINDOW: [number, number][] = [
  [16.5, 17.6], [17.0, 18.1], [17.4, 18.5], [18.6, 19.7], [19.0, 20.1], [19.4, 20.6],
  [19.5, 20.6], [19.2, 20.2], [18.6, 19.6], [17.9, 18.9], [16.4, 17.4], [16.2, 17.3],
];

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter() : null;
const PICTO = /\p{Extended_Pictographic}/u;

function* emojisOf(text: string): Generator<string> {
  if (!segmenter) return;
  for (const { segment } of segmenter.segment(text)) {
    if (PICTO.test(segment)) yield segment.replace(/️/g, "") === "❤" ? "❤️" : segment;
  }
}

const isText = (m: ChatMessage) => !m.media && !m.deleted && m.text.length > 0;

export function computeStats(msgs: ChatMessage[], opts: StatsOptions = {}): ChatStats {
  const openerGap = (opts.openerGapHours ?? 3) * HOUR;
  const responseMax = (opts.responseMaxHours ?? 6) * HOUR;
  const minSamples = opts.responseMinSamples ?? 5;
  const shabbatQuietMax = opts.shabbatQuietMax ?? 5;

  const total = msgs.length;
  const perPerson = new Map<string, number>();
  const calendar: Record<string, number> = {};
  const hourly = new Array(24).fill(0) as number[];
  const openers = new Map<string, number>();
  const responses = new Map<string, number[]>();
  const petByTerm = new Map<string, Map<string, number>>();
  const gmFirst = new Map<string, number>();
  const gmDays = new Set<string>();
  const laughBy = new Map<string, number>();
  let laughLongest: { sender: string; length: number } | null = null;
  const wordCounts = new Map<string, number>();
  const emojiCounts = new Map<string, number>();
  const voiceBy = new Map<string, number>();
  const media: Record<MediaKind, number> = { image: 0, audio: 0, video: 0, sticker: 0, gif: 0, doc: 0, media: 0 };
  const longest: { sender: string; words: number; text: string; ts: number }[] = [];
  let totalWords = 0;

  const petRes = PET_NAMES.map((t) => ({
    term: t,
    // whole-word match, Hebrew letters count as word chars
    re: new RegExp(`(^|[^\\p{L}])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}])`, "giu"),
  }));
  const gmRe = new RegExp(`(^|[^\\p{L}])(${GOOD_MORNING.join("|")})(?=$|[^\\p{L}])`, "iu");

  for (let k = 0; k < msgs.length; k++) {
    const m = msgs[k];
    const prev = k > 0 ? msgs[k - 1] : null;
    inc(perPerson, m.sender);
    const dk = dayKey(m.ts);
    calendar[dk] = (calendar[dk] ?? 0) + 1;
    hourly[new Date(m.ts).getUTCHours()]++;

    // openers: first message, or first after > N hours of silence
    if (!prev || m.ts - prev.ts > openerGap) inc(openers, m.sender);

    // response time: gap until a message from someone else
    if (prev && prev.sender !== m.sender) {
      const gap = m.ts - prev.ts;
      if (gap >= 0 && gap <= responseMax) {
        const arr = responses.get(m.sender) ?? [];
        arr.push(gap / MIN);
        responses.set(m.sender, arr);
      }
    }

    if (m.media) {
      media[m.media]++;
      if (m.media === "audio") inc(voiceBy, m.sender);
    }
    if (!isText(m)) continue;

    const ws = words(m.text);
    totalWords += ws.length;
    longest.push({ sender: m.sender, words: ws.length, text: m.text, ts: m.ts });

    for (const { term, re } of petRes) {
      re.lastIndex = 0;
      const hits = m.text.match(re);
      if (hits) {
        const bySender = petByTerm.get(term) ?? new Map<string, number>();
        inc(bySender, m.sender, hits.length);
        petByTerm.set(term, bySender);
      }
    }

    if (gmRe.test(m.text) && !gmDays.has(dk)) {
      gmDays.add(dk);
      inc(gmFirst, m.sender);
    }

    // laugh fingerprint: runs of ח (2+), plus haha / lol
    for (const run of m.text.match(/ח{2,}|(?:ha){2,}|(?:ja){2,}|lo+l|x{2,}d/giu) ?? []) {
      inc(laughBy, m.sender);
      if (/^ח+$/.test(run) && (!laughLongest || run.length > laughLongest.length)) {
        laughLongest = { sender: m.sender, length: run.length };
      }
    }

    for (const w of ws) {
      const clean = w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
      if (clean.length < 3 || STOP_WORDS.has(clean) || /^ח+$/.test(clean) || /^(ha)+$/.test(clean)) continue;
      if (!/^[\p{L}'"״׳-]+$/u.test(clean)) continue;
      inc(wordCounts, clean);
    }
    for (const e of emojisOf(m.text)) inc(emojiCounts, e);
  }

  // calendar-derived metrics
  const dayKeys = Object.keys(calendar).sort();
  const first = msgs[0]?.ts ?? 0;
  const last = msgs[msgs.length - 1]?.ts ?? 0;
  const firstIdx = dayIndex(first);
  const lastIdx = dayIndex(last);

  let peakDay = { date: "", count: 0 };
  for (const d of dayKeys) if (calendar[d] > peakDay.count) peakDay = { date: d, count: calendar[d] };

  let streak = { longestDays: 0, from: "", to: "" };
  let silence = { longestDays: 0, from: "", to: "" };
  let runStart = -1;
  let prevIdx = -1;
  for (const d of dayKeys) {
    const idx = Math.floor(Date.parse(d) / DAY);
    if (prevIdx >= 0 && idx === prevIdx + 1) {
      // continues run
    } else {
      if (prevIdx >= 0) {
        const gapDays = idx - prevIdx - 1;
        if (gapDays > silence.longestDays) silence = { longestDays: gapDays, from: keyOfIndex(prevIdx + 1), to: keyOfIndex(idx - 1) };
      }
      runStart = idx;
    }
    const len = idx - runStart + 1;
    if (len > streak.longestDays) streak = { longestDays: len, from: keyOfIndex(runStart), to: d };
    prevIdx = idx;
  }

  // Shabbat: Friday candle-lighting → Saturday havdalah
  let shabbatTotal = 0;
  let shabbatQuiet = 0;
  if (msgs.length) {
    // first Friday on/after the first day
    let fri = firstIdx;
    while (new Date(fri * DAY).getUTCDay() !== 5) fri++;
    let ptr = 0;
    for (; fri + 1 <= lastIdx; fri += 7) {
      const month = new Date(fri * DAY).getUTCMonth();
      const [enter, exit] = SHABBAT_WINDOW[month];
      const start = fri * DAY + enter * HOUR;
      const end = (fri + 1) * DAY + exit * HOUR;
      while (ptr < msgs.length && msgs[ptr].ts < start) ptr++;
      let n = 0;
      for (let q = ptr; q < msgs.length && msgs[q].ts < end; q++) n++;
      shabbatTotal++;
      if (n <= shabbatQuietMax) shabbatQuiet++;
    }
  }

  const lateNight = hourly.slice(22).reduce((a, b) => a + b, 0) + hourly.slice(0, 6).reduce((a, b) => a + b, 0);
  const peakHour = hourly.indexOf(Math.max(...hourly));

  const share = toPersonCounts(perPerson, total);
  const top = share.slice(0, 5);
  const others = share.slice(5).reduce((a, p) => a + p.count, 0);

  // longest message: top entry per distinct sender (3 people)
  longest.sort((a, b) => b.words - a.words);
  const longestDistinct: typeof longest = [];
  for (const l of longest) {
    if (longestDistinct.some((x) => x.sender === l.sender)) continue;
    longestDistinct.push({ ...l, text: l.text.length > 600 ? l.text.slice(0, 600) + "…" : l.text });
    if (longestDistinct.length === 3) break;
  }

  const pick = (m: ChatMessage) => ({ sender: m.sender, text: m.text, ts: m.ts, media: m.media });
  const voiceTotal = media.audio;

  return {
    totals: {
      messages: total,
      participants: perPerson.size,
      days: msgs.length ? lastIdx - firstIdx + 1 : 0,
      activeDays: dayKeys.length,
      first,
      last,
      words: totalWords,
    },
    calendar,
    share: { top, others, othersPct: total ? Math.round((others / total) * 1000) / 10 : 0, all: share },
    openers: { total: [...openers.values()].reduce((a, b) => a + b, 0), byPerson: toPersonCounts(openers) },
    petNames: {
      total: [...petByTerm.values()].reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y, 0), 0),
      top: [...petByTerm.entries()]
        .map(([term, by]) => ({ term, count: [...by.values()].reduce((a, b) => a + b, 0), bySender: Object.fromEntries(by) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
    responseTimes: [...responses.entries()]
      .filter(([, xs]) => xs.length >= minSamples)
      .map(([name, xs]) => ({ name, medianMin: Math.round(median(xs) * 10) / 10, samples: xs.length }))
      .sort((a, b) => a.medianMin - b.medianMin),
    goodMorning: { days: gmDays.size, firstBy: toPersonCounts(gmFirst) },
    shabbat: { total: shabbatTotal, quiet: shabbatQuiet },
    peakDay,
    streak,
    silence,
    hourly: { counts: hourly, peakHour, lateNightPct: total ? Math.round((lateNight / total) * 1000) / 10 : 0 },
    longest: longestDistinct,
    firstMessages: msgs.slice(0, 5).map(pick),
    lastMessages: msgs.slice(-5).map(pick),
    laugh: {
      total: [...laughBy.values()].reduce((a, b) => a + b, 0),
      byPerson: toPersonCounts(laughBy),
      longest: laughLongest,
    },
    topWords: [...wordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word, count]) => ({ word, count })),
    emoji: [...emojiCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([emoji, count]) => ({ emoji, count })),
    voice: { total: voiceTotal, byPerson: toPersonCounts(voiceBy) },
    media,
  };
}
