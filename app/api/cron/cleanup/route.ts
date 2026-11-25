import { NextResponse } from "next/server";
import { cleanup } from "@/lib/server/store";

/** Privacy policy: raw chat deleted 48h after upload if no report was bought, or 7 days after the report. */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await cleanup());
}
