"use client";
import type { ReactNode } from "react";
import type { ChatStats } from "@/lib/chat/types";
import { Cut, Item, Paper } from "./receipt";

const fmt = (n: number) => n.toLocaleString("he-IL");
const DAY = 86_400_000;
const d2 = (ts: number | string) => new Date(ts).toLocaleDateString("he-IL", { timeZone: "UTC", day: "numeric", month: "numeric", year: "2-digit" });
const hm = (ts: number) => new Date(ts).toLocaleTimeString("he-IL", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
const mmss = (min: number) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, "0")}`;
const ym = (ts: number) => { const d = new Date(ts); return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`; };
const MEDIA_HE: Record<string, string> = { image: "[תמונה]", audio: "[הקלטה]", video: "[וידאו]", sticker: "[סטיקר]", gif: "[GIF]", doc: "[מסמך]", media: "[מדיה]" };

function Block({ n, title, meta, children, delay }: { n: number; title: string; meta?: string; children: ReactNode; delay: number }) {
  return (
    <section className="printed" style={{ animationDelay: `${delay}ms` }} aria-label={`פריט ${n}: ${title}`}>
      <div className="r-label"><span>פריט {n} · {title}</span>{meta && <span className="mono">{meta}</span>}</div>
      {children}
      <Cut />
    </section>
  );
}

/** Item 1 – one dot per day, ink density on a log scale. */
function Calendar({ s }: { s: ChatStats }) {
  const start = Math.floor(s.totals.first / DAY);
  const end = Math.floor(s.totals.last / DAY);
  const lead = new Date(start * DAY).getUTCDay();
  const max = Math.max(1, ...Object.values(s.calendar));
  const cells: { k: string; v: number }[] = [];
  for (let i = 0; i < lead; i++) cells.push({ k: `p${i}`, v: -1 });
  for (let d = start; d <= end; d++) {
    const k = new Date(d * DAY).toISOString().slice(0, 10);
    cells.push({ k, v: s.calendar[k] ?? 0 });
  }
  const bg = (v: number) => (v < 0 ? "transparent" : v === 0 ? "#e4e4df" : `rgba(17,17,17,${(0.25 + 0.75 * (Math.log1p(v) / Math.log1p(max))).toFixed(2)})`);
  return (
    <>
      <div className="dots" dir="ltr" role="img" aria-label={`לוח שנה: ${fmt(s.totals.activeDays)} ימים פעילים מתוך ${fmt(s.totals.days)}, השיא ${fmt(s.peakDay.count)} הודעות ב-${d2(s.peakDay.date)}`}>
        {cells.map((c) => <i key={c.k} style={{ background: bg(c.v) }} title={c.v >= 0 ? `${d2(c.k)} · ${fmt(c.v)}` : undefined} />)}
      </div>
      <Item k="ימים פעילים" v={`${fmt(s.totals.activeDays)}/${fmt(s.totals.days)}`} />
    </>
  );
}

function Share({ s }: { s: ChatStats }) {
  const rows = [...s.share.top.map((p) => ({ ...p, other: false })), ...(s.share.others ? [{ name: "כל השאר", count: s.share.others, pct: s.share.othersPct, other: true }] : [])];
  const max = Math.max(...rows.map((r) => r.pct), 1);
  const op = s.openers.byPerson[0];
  const pet = s.petNames.top[0];
  const petBy = pet ? Object.entries(pet.bySender).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
  return (
    <>
      <div role="img" aria-label={`נתח מההודעות: ${rows.map((r) => `${r.name} ${r.pct}%`).join(", ")}`} style={{ display: "grid", gap: 3, margin: "2px 0 6px" }}>
        {rows.map((r) => (
          <div key={r.name} style={{ display: "grid", gridTemplateColumns: "64px 1fr 44px", gap: 8, alignItems: "center", fontSize: 13 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            <span className={`seg ${r.other ? "light" : ""}`} style={{ width: `${Math.max(4, (r.pct / max) * 100)}%` }} />
            <span className="mono" style={{ fontSize: 12, textAlign: "left" }}>{r.pct}%</span>
          </div>
        ))}
      </div>
      {op && <Item k={`פותח/ת שיחות: ${op.name}`} v={`${op.pct}%`} />}
      {pet && <Item k={`כינוי חיבה: ${pet.term}${petBy ? ` (בעיקר ${petBy})` : ""}`} v={`×${fmt(pet.count)}`} />}
    </>
  );
}

function Times({ s }: { s: ChatStats }) {
  const gm = s.goodMorning.firstBy[0];
  return (
    <>
      {s.responseTimes.slice(0, 3).map((r, i) => <Item key={r.name} k={`${i === 0 ? "הכי מהיר/ה לענות" : i === 1 ? "מקום שני" : "מקום שלישי"}: ${r.name}`} v={mmss(r.medianMin)} />)}
      <Item k={`יום שיא, ${d2(s.peakDay.date)}`} v={fmt(s.peakDay.count)} />
      <Item k="רצף ימים / שתיקה ארוכה" v={`${s.streak.longestDays} / ${s.silence.longestDays}`} />
      {s.goodMorning.days > 0 && <Item k={`ימים עם "בוקר טוב"${gm ? ` (${gm.name} ראשון/ה ב-${gm.pct}%)` : ""}`} v={fmt(s.goodMorning.days)} />}
      {s.shabbat.total > 0 && <Item k="שבתות שקטות" v={`${s.shabbat.quiet}/${s.shabbat.total}`} />}
      <div className="note" style={{ marginTop: 4 }}>זמן תגובה: חציון, בדקות ושניות. שבת: מהדלקת נרות עד צאת שבת.</div>
    </>
  );
}

/** Item 4 – hour barcode: each bar's thickness is that hour's volume. */
function Barcode({ s }: { s: ChatStats }) {
  const max = Math.max(...s.hourly.counts, 1);
  return (
    <>
      <div className="barcode" dir="ltr" role="img" aria-label={`ברקוד שעות: השעה העמוסה ${s.hourly.peakHour}:00, ${s.hourly.lateNightPct}% מההודעות אחרי 22:00`}>
        {s.hourly.counts.map((c, h) => <span key={h} style={{ width: `${(1 + (c / max) * 6).toFixed(1)}px` }} title={`${h}:00 · ${fmt(c)}`} />)}
      </div>
      <div className="axis" dir="ltr"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      <div className="note">עובי הפס = כמות ההודעות באותה שעה. הפס העבה: {s.hourly.peakHour}:00. אחרי 22:00 נשלחות {s.hourly.lateNightPct}% מההודעות.</div>
    </>
  );
}

function Longest({ s }: { s: ChatStats }) {
  const l = s.longest[0];
  if (!l) return <div className="note">אין כאן נאומים.</div>;
  return (
    <>
      <div className="qbox">
        <div className="m"><span>{l.sender} · {fmt(l.words)} מילים</span><span>{d2(l.ts)} {hm(l.ts)}</span></div>
        <div className="t" style={{ fontSize: 14, fontWeight: 400, whiteSpace: "pre-line", maxHeight: 132, overflow: "hidden" }}>{l.text.length > 280 ? `${l.text.slice(0, 280)}…` : l.text}</div>
      </div>
      {s.longest.slice(1).map((x) => <Item key={x.sender} k={`אחריו/ה: ${x.sender}`} v={`${fmt(x.words)} מילים`} />)}
    </>
  );
}

function Edges({ s }: { s: ChatStats }) {
  const row = (m: ChatStats["firstMessages"][number], k: number) => (
    <div className="row" key={k}><span className="tm">{hm(m.ts)}</span><span className="who">{m.sender}</span><span className="tx">{m.media ? MEDIA_HE[m.media] : m.text}</span></div>
  );
  return (
    <>
      <div className="note" style={{ fontWeight: 700, color: "var(--ink)" }}>ההודעות הראשונות · {d2(s.firstMessages[0]?.ts ?? 0)}</div>
      <div className="mini-thread">{s.firstMessages.slice(0, 4).map(row)}</div>
      <div className="note" style={{ fontWeight: 700, color: "var(--ink)", marginTop: 8 }}>האחרונות · {d2(s.lastMessages[s.lastMessages.length - 1]?.ts ?? 0)}</div>
      <div className="mini-thread">{s.lastMessages.slice(-4).map(row)}</div>
    </>
  );
}

function Fingerprint({ s }: { s: ChatStats }) {
  const laugh = s.laugh.byPerson[0];
  const voice = s.voice.byPerson[0];
  return (
    <>
      {laugh && <Item k={`"חחח" (בעיקר ${laugh.name})`} v={fmt(s.laugh.total)} />}
      {s.laugh.longest && <Item k={`רצף צחוק שיא (${s.laugh.longest.sender})`} v={`${s.laugh.longest.length} ח'`} />}
      <Item k={`הודעות קוליות${voice ? ` (${voice.name} ${voice.pct}%)` : ""}`} v={fmt(s.voice.total)} />
      {s.emoji.length > 0 && <Item k="אימוג'י מובילים" v={<span style={{ fontFamily: "var(--sans)", letterSpacing: 2 }}>{s.emoji.slice(0, 5).map((e) => e.emoji).join("")}</span>} />}
      {s.topWords.length > 0 && <div style={{ fontSize: 13, marginTop: 4 }}><b>המילים שלכם:</b> {s.topWords.slice(0, 8).map((w) => w.word).join(" · ")}</div>}
    </>
  );
}

export function StatsReceipt({ s, groupName, animate = true }: { s: ChatStats; groupName: string; animate?: boolean }) {
  const step = animate ? 380 : 0;
  return (
    <Paper label="קבלה מפורטת">
      <div className="r-head">
        <div className="t">קבלה מפורטת</div>
        <div className="s">{groupName} · <span className="mono">{ym(s.totals.first)}–{ym(s.totals.last)}</span></div>
        <div className="s mono">NO. {String(s.totals.messages).padStart(6, "0")}</div>
      </div>
      <Cut />
      <Block n={1} title="לוח שנה" meta={`${fmt(s.totals.days)} ימים`} delay={step * 1}><Calendar s={s} /></Block>
      <Block n={2} title="מי כותב" delay={step * 2}><Share s={s} /></Block>
      <Block n={3} title="זמנים" delay={step * 3}><Times s={s} /></Block>
      <Block n={4} title="ברקוד השעות" delay={step * 4}><Barcode s={s} /></Block>
      <Block n={5} title="הנאום הארוך" delay={step * 5}><Longest s={s} /></Block>
      <Block n={6} title="ההתחלה והסוף" delay={step * 6}><Edges s={s} /></Block>
      <Block n={7} title="טביעת אצבע" delay={step * 7}><Fingerprint s={s} /></Block>
      <div className="total printed" style={{ animationDelay: `${step * 8}ms` }}><span>סה"כ הודעות</span><span className="v">{fmt(s.totals.messages)}</span></div>
    </Paper>
  );
}
