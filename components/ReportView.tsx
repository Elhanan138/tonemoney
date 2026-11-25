import type { PublicReport, Quote, Section } from "@/lib/report/schema";
import { PRICE_ILS } from "@/lib/setup";
import { Cut, Item } from "./receipt";

const fmt = (n: number) => n.toLocaleString("he-IL");

function QuoteBox({ q }: { q: Quote }) {
  return (
    <blockquote className="qbox" style={{ marginInline: 0 }}>
      <div className="m"><span>ציטוט · {q.author}</span></div>
      <div className="t">"{q.text}"</div>
    </blockquote>
  );
}

function SectionBlock({ s, n, cut }: { s: Pick<Section, "title" | "body" | "quotes">; n: number; cut?: boolean }) {
  const paras = s.body.split(/\n\n+/);
  return (
    <section aria-label={`סעיף ${n}: ${s.title}`}>
      <div className="sec-t">סעיף {n} · {s.title}</div>
      {paras.map((p, k) => (
        <div key={k}>
          <p className={cut && k === paras.length - 1 ? "faded" : ""}>{p}</p>
          {k === 0 && s.quotes[0] && <QuoteBox q={s.quotes[0]} />}
        </div>
      ))}
      {!cut && s.quotes.slice(1).map((q, j) => <QuoteBox key={j} q={q} />)}
      {!cut && <Cut />}
    </section>
  );
}

export function ReportView({ r, onPay, paying, shareUrl }: { r: PublicReport; onPay?: () => void; paying?: boolean; shareUrl?: string | null }) {
  const full = r.full;
  return (
    <div className="rep">
      <div className="paper">
        <div className="spread mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-2)" }}>
          <span>השורה התחתונה</span><span>{fmt(r.readMessages)} / {fmt(r.totalMessages)}</span>
        </div>
        <h1>{r.title}</h1>
        <p className="sub">{r.subtitle}</p>
        {r.cutoff && <div className="note" style={{ marginTop: 6 }}>קראתי את ההודעות מ-{new Date(r.cutoff).toLocaleDateString("he-IL", { timeZone: "UTC" })} והלאה. המספרים מחושבים על כל הצ'אט.</div>}
        <Cut />
        {r.opener.split(/\n\n+/).map((p, k) => <p key={k}>{p}</p>)}
        <Cut />

        {full ? (
          <>
            {full.sections.map((s, k) => <SectionBlock key={k} s={s} n={k + 1} />)}
            <section className="quiet" aria-label={full.quiet_item.title}>
              <div className="sec-t">פריט שקט · {full.quiet_item.title}</div>
              {full.quiet_item.body.split(/\n\n+/).map((p, k) => <p key={k}>{p}</p>)}
              {full.quiet_item.quotes.map((q, k) => <QuoteBox key={k} q={q} />)}
            </section>
            <Cut />
            <div className="sec-t">שורה לכל אחד</div>
            {full.lines.map((l) => (
              <div className="line-item" key={l.name}>
                <Item k={l.name} v={l.role} />
                <div className="b">{l.body}</div>
              </div>
            ))}
            <Cut />
            <div className="total"><span>השורה התחתונה</span></div>
            <p style={{ marginTop: 6 }}>{full.bottom_line}</p>
            <div className="note mono" style={{ textAlign: "center", marginTop: 8 }}>*** תודה שדיברתם ***</div>
          </>
        ) : (
          <SectionBlock s={r.first} n={1} cut={r.first.cut} />
        )}
      </div>
      <div className="zig" aria-hidden />

      {!full && r.locked && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="slot"><span className="mouth" aria-hidden /><span style={{ fontSize: 13, color: "var(--on-dark-3)" }}>המדפסת עצרה כאן</span></div>
          <div className="dark-items">
            <Item k={`עוד ${r.locked.sections.length} סעיפים`} v={`${fmt(r.locked.words)} מילים`} />
            <Item k="שורה אישית לכל אחד" v={`× ${r.locked.people}`} />
            <Item k="קישור לשליחה לקבוצה" v="× 1" />
          </div>
          <div style={{ fontSize: 13, color: "var(--on-dark-2)" }}>{r.locked.sections.join(" · ")}</div>
          {onPay && (
            <>
              <div className="due"><span style={{ fontWeight: 700 }}>לתשלום</span><span className="v">₪{PRICE_ILS}.00</span></div>
              <button className="pill" onClick={onPay} disabled={paying}>{paying ? "מעביר לתשלום…" : "להמשיך להדפיס"}</button>
            </>
          )}
        </div>
      )}

      {full && shareUrl && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>הקבלה הזו שייכת לכל הקבוצה.</div>
          <a className="pill" href={`https://wa.me/?text=${encodeURIComponent(`קיבלנו קבלה על הצ'אט שלנו: ${shareUrl}`)}`} target="_blank" rel="noreferrer">שליחה לקבוצה בוואטסאפ</a>
          <label className="composer" style={{ height: 44 }}>
            <span className="sr">קישור לשיתוף</span>
            <input readOnly value={shareUrl} dir="ltr" onFocus={(e) => e.target.select()} style={{ fontSize: 13 }} />
          </label>
        </div>
      )}
    </div>
  );
}
