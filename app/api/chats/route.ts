import { NextResponse } from "next/server";
import { gunzipSync, strFromU8 } from "fflate";
import { checkOtp, newId, saveChat } from "@/lib/server/store";
import { computeStats } from "@/lib/chat/stats";
import type { ChatMessage } from "@/lib/chat/types";
import type { SetupAnswers } from "@/lib/setup";

export const maxDuration = 60;

/** Creates the account-less chat record after OTP verification. Stats are recomputed server-side (never trust the client). */
export async function POST(req: Request) {
  type Body = { email: string; code: string; answers: SetupAnswers; messages: ChatMessage[] };
  // The client gzips the body: a 25k-message chat is ~5MB of JSON, over Vercel's 4.5MB request limit.
  let body: Body;
  try {
    body = req.headers.get("content-encoding") === "gzip" || req.headers.get("content-type") === "application/gzip"
      ? JSON.parse(strFromU8(gunzipSync(new Uint8Array(await req.arrayBuffer()))))
      : await req.json();
  } catch {
    return NextResponse.json({ error: "קובץ לא תקין" }, { status: 400 });
  }
  if (!body.email || !body.code || !(await checkOtp(body.email, body.code))) {
    return NextResponse.json({ error: "הקוד שגוי או פג תוקף" }, { status: 401 });
  }
  if (!Array.isArray(body.messages) || body.messages.length < 10) {
    return NextResponse.json({ error: "צ'אט קצר מדי" }, { status: 400 });
  }
  const messages = body.messages.map((m, i) => ({ ...m, i, sender: String(m.sender), text: String(m.text ?? "") }));
  const id = newId();
  await saveChat({
    id,
    createdAt: Date.now(),
    email: body.email.toLowerCase(),
    answers: { ...body.answers, email: body.email.toLowerCase() },
    stats: computeStats(messages),
    messages,
    report: null,
    reportStatus: "none",
    reportAt: null,
    cutoff: null,
    readMessages: 0,
    paid: false,
    paidAt: null,
    shareToken: null,
  });
  return NextResponse.json({ id });
}
