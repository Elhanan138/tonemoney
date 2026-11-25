/** The 8 setup questions, asked as a chat. Answers come through 3 input families: quick replies, the composer, a slider. */

export type Relationship = "couple" | "friends" | "friend" | "family" | "work" | "other";
export type Source = "whatsapp" | "imessage" | "instagram" | "messenger" | "kakaotalk" | "line";
export type Focus = "roles" | "humor" | "drama" | "love" | "secrets" | "future";
export type ReportLang = "he" | "en" | "ar" | "ru" | "fr" | "es";

export interface SetupAnswers {
  relationship: Relationship;
  source: Source;
  /** original sender → display name (merge = several originals map to the same name) */
  names: Record<string, string>;
  me: string | null;
  groupName: string;
  focus: Focus[];
  /** 0 = gentle, 100 = no discounts */
  spice: number;
  lang: ReportLang;
  email: string;
}

export const TOTAL_STEPS = 8;

export const RELATIONSHIPS: { id: Relationship; label: string }[] = [
  { id: "couple", label: "זוג" },
  { id: "friends", label: "חבורה של חברים" },
  { id: "friend", label: "חבר או חברה" },
  { id: "family", label: "משפחה" },
  { id: "work", label: "עבודה" },
  { id: "other", label: "משהו אחר" },
];

export const SOURCES: { id: Source; label: string; supported: boolean }[] = [
  { id: "whatsapp", label: "WhatsApp", supported: true },
  { id: "imessage", label: "iMessage", supported: false },
  { id: "instagram", label: "Instagram", supported: false },
  { id: "messenger", label: "Messenger", supported: false },
  { id: "kakaotalk", label: "KakaoTalk", supported: false },
  { id: "line", label: "LINE", supported: false },
];

export const FOCUS: { id: Focus; label: string; hint: string }[] = [
  { id: "roles", label: "מי מה בקבוצה", hint: "the roles each person plays" },
  { id: "humor", label: "מי מצחיק את מי", hint: "humor, running jokes, who makes who laugh" },
  { id: "drama", label: "איפה זה מתפוצץ", hint: "conflicts, tensions and how they get resolved" },
  { id: "love", label: "מי דואג למי", hint: "affection, care, who shows up for whom" },
  { id: "secrets", label: "מה לא נאמר", hint: "subtext, avoided topics, patterns nobody names" },
  { id: "future", label: "לאן זה הולך", hint: "trajectory of the relationship and what could improve" },
];

export const LANGS: { id: ReportLang; label: string; name: string }[] = [
  { id: "he", label: "עברית", name: "Hebrew" },
  { id: "en", label: "English", name: "English" },
  { id: "ar", label: "العربية", name: "Arabic" },
  { id: "ru", label: "Русский", name: "Russian" },
  { id: "fr", label: "Français", name: "French" },
  { id: "es", label: "Español", name: "Spanish" },
];

export const TONE_STEPS = ["עדין, כמו מכתב", "ישר ולעניין", "ישר, עם עקיצות", "בלי הנחות", "שום דבר לא נשאר מתחת לשטיח"];
export const toneCaption = (spice: number) => TONE_STEPS[Math.min(TONE_STEPS.length - 1, Math.floor((spice / 101) * TONE_STEPS.length))];

export const PRICE_ILS = 15;
