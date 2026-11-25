import { NextResponse } from "next/server";
import { getChat } from "@/lib/server/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await getChat(id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    stats: rec.stats,
    groupName: rec.answers.groupName,
    me: rec.answers.me,
    relationship: rec.answers.relationship,
    reportStatus: rec.reportStatus,
    paid: rec.paid,
  });
}
