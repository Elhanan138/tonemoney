import type { ChatMessage, ChatStats } from "../chat/types";
import type { SetupAnswers } from "../setup";
import type { Report, Quote } from "./schema";

/** Deterministic stand-in used when ANTHROPIC_API_KEY is not set (dev / demos). Quotes are real lines from the chat. */
export function mockReport(msgs: ChatMessage[], stats: ChatStats, a: SetupAnswers, read: number): Report {
  const texts = msgs.filter((m) => !m.media && !m.deleted && m.text.length > 8 && m.text.length < 90);
  const pick = (name: string, n = 1): Quote[] =>
    texts.filter((m) => m.sender === name).slice(-60).slice(0, n).map((m) => ({ author: m.sender, text: m.text }));
  const top = stats.share.top;
  const fastest = stats.responseTimes[0];
  const opener = stats.openers.byPerson[0];
  const laugh = stats.laugh.byPerson[0];
  const gm = stats.goodMorning.firstBy[0];
  const quietest = stats.share.all[stats.share.all.length - 1];
  const fmt = (n: number) => n.toLocaleString("he-IL");

  return {
    title: `${a.groupName}: מוקד שלא נסגר אף פעם, ובמקרה גם מחלק אהבה.`,
    subtitle: "קבלה לדוגמה. בלי מפתח API, אז כתבתי אותה לבד.",
    opener: `קראתי ${fmt(read)} הודעות. מההתחלה, בלי לדלג.\n\nזה לא צ'אט. זה מוקד: יש מי שמנהל, יש מי שמגיב תוך דקות, ויש מי שמגיע רק כשמזכירים לו.`,
    sections: [
      {
        title: "מי מחזיק את הקו",
        body: `${top[0]?.name ?? "מישהו"} כתב/ה ${top[0]?.pct ?? 0}% מההודעות. ${opener ? `ואחרי שלוש שעות של שקט, ${opener.name} היא זו שמדברת ראשונה, ב-${opener.pct}% מהפעמים.` : ""}\n\nהשעה העמוסה היא ${stats.hourly.peakHour}:00. ${stats.hourly.lateNightPct}% מההודעות נשלחות אחרי עשר בלילה, כלומר אחרי שכולם אמרו שהם הולכים לישון.`,
        quotes: top[0] ? pick(top[0].name) : [],
      },
      {
        title: "יחידת התגובה המהירה",
        body: fastest ? `${fastest.name} עונה אחרי ${fastest.medianMin} דקות, בחציון. זה לא זמן תגובה, זה רפלקס.` : "אף אחד כאן לא ממהר לענות. זה גם סוג של שקט.",
        quotes: fastest ? pick(fastest.name) : [],
      },
      {
        title: "מחלקת הצחוק",
        body: laugh ? `${laugh.name} צוחק/ת כאן ${fmt(laugh.count)} פעמים.${stats.laugh.longest ? ` השיא: ${stats.laugh.longest.length} ח' ברצף, של ${stats.laugh.longest.sender}.` : ""}` : "צחוק שקט. אולי בקול, מחוץ לצ'אט.",
        quotes: laugh ? pick(laugh.name) : [],
      },
      {
        title: "משמרת הבוקר",
        body: gm ? `ב-${fmt(stats.goodMorning.days)} ימים מישהו אמר "בוקר טוב". ב-${gm.pct}% מהם זה היה ${gm.name}.` : "אף אחד לא אומר כאן בוקר טוב. רשמתי.",
        quotes: gm ? pick(gm.name) : [],
      },
    ],
    quiet_item: {
      title: "הנוכחות",
      body: `${stats.streak.longestDays} ימים ברצף לא עבר יום בלי הודעה. זה לא הרגל. זו נוכחות.`,
      quotes: texts.slice(-3, -2).map((m) => ({ author: m.sender, text: m.text })),
    },
    lines: top.map((p, k) => ({
      name: p.name,
      role: ["מוקדן/ית ראשי/ת", "יחידת תגובה מהירה", "מחלקת הבידור", "משמרת בוקר", "הצופה השקט/ה"][k % 5],
      body: `${fmt(p.count)} הודעות, ${p.pct}% מהצ'אט.${quietest && quietest.name === p.name ? " מדבר/ת מעט, נשמע/ת הרבה." : ""}`,
    })),
    bottom_line: "מתחת לכל ההודעות יש אנשים שבוחרים לדבר זה עם זה כל יום. זו השורה התחתונה, והיא טובה.",
  };
}
