import { NextResponse } from "next/server";
import { deleteChat, listChats, saveChat } from "@/lib/server/store";

const H = 3_600_000;

/** Privacy policy: raw chat deleted 48h after upload if no report was bought, or 7 days after the last report. */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = Date.now();
  let deleted = 0;
  let purged = 0;
  for (const rec of await listChats()) {
    if (!rec.paid && now - rec.createdAt > 48 * H) {
      await deleteChat(rec.id);
      deleted++;
    } else if (rec.paid && rec.messages && rec.reportAt && now - rec.reportAt > 7 * 24 * H) {
      await saveChat({ ...rec, messages: null }); // keep the paid report so the share link still works
      purged++;
    }
  }
  return NextResponse.json({ deleted, purged });
}
