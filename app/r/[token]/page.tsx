import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { findByShareToken } from "@/lib/server/store";
import { toPublic } from "@/lib/report/paywall";
import { ReportView } from "@/components/ReportView";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

async function load(token: string) {
  const rec = await findByShareToken(token);
  if (!rec || !rec.paid || !rec.report) return null;
  return rec;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const rec = await load((await params).token);
  if (!rec?.report) return { title: BRAND.product };
  const description = rec.report.subtitle.slice(0, 180);
  // the caricature title is what shows up in the WhatsApp link preview
  return {
    title: rec.report.title,
    description,
    openGraph: { title: rec.report.title, description, type: "article" },
    robots: { index: false, follow: false },
  };
}

export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const rec = await load((await params).token);
  if (!rec) notFound();
  const pub = toPublic(rec.report!, { paid: true, shareToken: null, cutoff: rec.cutoff, readMessages: rec.readMessages, totalMessages: rec.stats.totals.messages });
  return (
    <main className="shell">
      <div className="topbar"><Link href="/" className="wordmark">{BRAND.product}</Link><span className="serial">{rec.answers.groupName}</span></div>
      <div style={{ height: 16 }} />
      <ReportView r={pub} />
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>גם לכם יש צ'אט כזה.</div>
        <Link className="pill" href="/setup">שלחו לנו אותו</Link>
      </div>
    </main>
  );
}
