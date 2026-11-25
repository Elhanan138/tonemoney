import type { ChatStats } from "../chat/types";
import { FOCUS, LANGS, type SetupAnswers } from "../setup";

const RELATIONSHIP_TONE: Record<SetupAnswers["relationship"], string> = {
  couple: "A couple. Sections about how they love, fight, plan and tease. Warm but honest about patterns.",
  friends: "A friend group. Sub-groups, running jokes, roles, alliances. The lightest register allowed.",
  friend: "Two friends. The friendship's rhythm, who carries it, inside jokes, what they mean to each other.",
  family: "A family group. Generations, logistics, who runs what, love expressed through food, rides and photos.",
  work: "A work chat. Describe the work culture, not careers. Never say anything that could get someone in trouble at work.",
  other: "Unknown relationship type: infer it from the chat.",
};

export const PERSONA = `You are "Kabala" (Hebrew: קבלה, "receipt"): a reader that goes through an entire chat, itemizes it like a receipt, and then writes the bottom line.

Voice:
- First person, singular, masculine in Hebrew ("קראתי", "שמתי לב"). Dry, precise, deadpan. Warm underneath.
- Short sentences. Humor comes from exact observation and understatement, never from insults or exclamation marks.
- He does not summarize. He itemizes what he noticed, with evidence: amounts, places, nicknames, hours, exact phrases, counts.
- He shows each person how they look from the outside. He never takes sides. He describes patterns, never judges people.
- Funny when the chat is light, plain and careful when it is serious. When something genuinely serious comes up (grief, illness, abuse, self-harm, crisis) he drops the jokes, treats it with care, and gently points to real help.
- No generic filler ("communication is key"). Every sentence should only be true of THIS chat.
- No emoji. No hashtags.

Hard rules:
- Quotes must be copied VERBATIM from the chat (same spelling), as short as possible (one line). Never invent or paraphrase a quote. "author" must be the exact sender name as it appears in the chat.
- Use the participants' display names exactly as given.
- Numbers must come from the STATS block or be directly countable in the chat. Never invent statistics.
- Never reveal phone numbers, addresses, ID numbers or passwords, even if they appear in the chat.`;

export function buildSystemPrompt(): string {
  return PERSONA;
}

export function buildUserPrompt(p: {
  answers: SetupAnswers;
  stats: ChatStats;
  chatText: string;
  cutoff: number | null;
  readMessages: number;
  participants: string[];
  /** stage-1 notes covering the WHOLE chat; when present, chatText is only the most recent excerpt */
  notes?: string;
}): string {
  const { answers, stats } = p;
  const lang = LANGS.find((l) => l.id === answers.lang)?.name ?? "Hebrew";
  const focus = answers.focus.map((f) => FOCUS.find((x) => x.id === f)?.hint).filter(Boolean);
  const spice =
    answers.spice >= 80 ? "No discounts: say the uncomfortable patterns plainly, still never cruel." : answers.spice >= 40 ? "Direct, with dry jabs and real insight." : "Gentle: mostly insight and warmth, light humor.";
  const compactStats = {
    totals: stats.totals,
    share: stats.share.top,
    openers: stats.openers.byPerson.slice(0, 5),
    petNames: stats.petNames.top,
    responseTimesMedianMin: stats.responseTimes.slice(0, 5),
    goodMorning: stats.goodMorning,
    shabbat: stats.shabbat,
    peakDay: stats.peakDay,
    streak: stats.streak,
    silence: stats.silence,
    peakHour: stats.hourly.peakHour,
    lateNightPct: stats.hourly.lateNightPct,
    laugh: { byPerson: stats.laugh.byPerson.slice(0, 5), longest: stats.laugh.longest },
    topWords: stats.topWords,
    emoji: stats.emoji,
    voiceNotes: stats.voice,
  };

  return `<setup>
Relationship: ${RELATIONSHIP_TONE[answers.relationship]}
Group / chat name: ${answers.groupName}
Participants: ${p.participants.join(", ")}
The person who ordered the report: ${answers.me ?? "unknown"} (address the group, not only them)
They are most curious about: ${focus.length ? focus.join("; ") : "everything"}
Tone: ${spice}
Write the report in: ${lang}
</setup>

<stats note="computed in code over the WHOLE chat, including parts you do not see">
${JSON.stringify(compactStats)}
</stats>

${p.notes ? `<notes covering="the whole chat, all ${p.readMessages.toLocaleString("en-US")} messages, part by part, in order">
${p.notes}
</notes>

` : ""}<chat format="date-or-time|sender|text — date shown only when it changes; [תמונה ×3] = 3 photos"${p.notes ? ' scope="most recent messages only, for voice and current state; the notes cover everything"' : ` read_messages="${p.readMessages}"`}${
    p.cutoff ? ` older_messages_excluded_before="${new Date(p.cutoff).toISOString().slice(0, 10)}"` : ""
  }>
${p.chatText}
</chat>
${p.notes ? "\nQuotes may come from the notes or the chat, but must be verbatim either way. Use the whole history, not just the recent part.\n" : ""}

Write the receipt as JSON matching the schema:
- title: the bottom line as a headline. One deadpan sentence that makes people tap the link, e.g. "A family dispatch center that happens to hand out love." It becomes the WhatsApp link preview.
- subtitle: one short dry line under the title.
- opener: 2 short paragraphs. Say what you read (${p.readMessages.toLocaleString("en-US")} messages) and what this chat really is, in one exact image.
- sections: 4-6 items. Each has a plain, specific title (e.g. "Who holds the line", "The kitchen as a foreign ministry"), 2-3 short paragraphs separated by \\n\\n, and 1-2 verbatim quotes. Each is about a sub-group, a pair, or a dynamic. Section 1 must be the strongest.
- quiet_item: the sincere item near the end: what is actually good and tender here, with a real quote. No jokes.
- lines: one per participant (skip people with almost no messages): name (exact), role (2-5 words, e.g. "Dispatcher, also the heart"), body (1-2 sentences).
- bottom_line: one short hopeful paragraph that closes the receipt.`;
}
