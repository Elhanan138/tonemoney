import Link from "next/link";
import { PRICE_ILS } from "@/lib/setup";
import { BRAND } from "@/lib/brand";
import { ChatIcon, Cut, Item, Paper } from "@/components/receipt";

export default function Home() {
  return (
    <main className="shell">
      <div className="topbar">
        <span className="wordmark">{BRAND.product}</span>
        <span className="serial">NO. 000001</span>
      </div>

      <h1 style={{ margin: "26px 0 0", fontSize: "clamp(32px, 9vw, 40px)", lineHeight: 1.15, fontWeight: 700 }}>
        שלחו לנו צ'אט.<br />נחזיר לכם קבלה.
      </h1>
      <p style={{ margin: "10px 0 0", fontSize: 16, color: "var(--on-dark-3)" }}>
        כל הודעה נספרת. כל שתיקה נרשמת. ובסוף, מודפס בשורה התחתונה, מה הקבוצה הזו באמת.
      </p>

      <div style={{ margin: "26px 8px 0" }}>
        <Paper tilt label="קבלה לדוגמה">
          <div className="r-head"><div className="t">החזנים מתרחבים</div><div className="s">קבלה מס' 25266 · דוגמה</div></div>
          <Cut />
          <Item k="הודעות" v="25,266" />
          <Item k={'ימים עם "בוקר טוב"'} v="131" />
          <Item k={'"חחח"'} v="643" />
          <Item k="הודעות קוליות" v="44" />
          <Item k="שבתות שקטות" v="130" />
          <Cut />
          <div className="total"><span>סה"כ</span><span style={{ fontFamily: "var(--sans)" }}>משפחה אחת</span></div>
        </Paper>
      </div>

      <div className="grow" style={{ minHeight: 28 }} />
      <Link href="/setup" className="pill"><ChatIcon />בואו נדבר על הצ'אט</Link>
      <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 12 }} className="muted">
        חינם עד השורה התחתונה. הקבלה המלאה ₪{PRICE_ILS}. הצ'אט נמחק אחרי 48 שעות, לא משמש לאימון AI, ואף אדם לא קורא אותו.
      </p>
    </main>
  );
}
