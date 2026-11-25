import { NextResponse } from "next/server";
import { getChat, updateChat } from "@/lib/server/store";
import { generateReport } from "@/lib/report/generate";
import { toPublic } from "@/lib/report/paywall";

export const maxDuration = 300;

/** Idempotent: generates once, then returns the stored report (redacted unless paid). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let rec = await getChat(id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (rec.reportStatus !== "done") {
    if (rec.reportStatus === "writing" && rec.reportAt && Date.now() - rec.reportAt < 5 * 60_000) {
      return NextResponse.json({ status: "writing" }, { status: 202 });
    }
    if (!rec.messages) return NextResponse.json({ error: "הצ'אט נמחק" }, { status: 410 });
    await updateChat({ ...rec, reportStatus: "writing", reportAt: Date.now() });
    try {
      const out = await generateReport(rec.messages, rec.stats, rec.answers);
      console.log(`[report] ${id} model=${out.model} read=${out.readMessages} droppedQuotes=${out.droppedQuotes}`, out.usage ?? "");
      rec = { ...rec, report: out.report, reportStatus: "done", reportAt: Date.now(), cutoff: out.cutoff, readMessages: out.readMessages };
      await updateChat(rec);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await updateChat({ ...rec, reportStatus: "error", reportError: msg });
      return NextResponse.json({ error: "המדפסת נתקעה. נסו שוב בעוד רגע." , detail: msg }, { status: 500 });
    }
  }
  return NextResponse.json(
    toPublic(rec.report!, {
      paid: rec.paid,
      shareToken: rec.shareToken,
      cutoff: rec.cutoff,
      readMessages: rec.readMessages,
      totalMessages: rec.stats.totals.messages,
    }),
  );
}
