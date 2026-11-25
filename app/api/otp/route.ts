import { NextResponse } from "next/server";
import { issueOtp } from "@/lib/server/store";

export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  const code = await issueOtp(email);
  // TODO production: send with your email provider (Supabase Auth OTP / Resend). Never return the code.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[otp] ${email} → ${code}`);
    return NextResponse.json({ ok: true, devCode: code });
  }
  return NextResponse.json({ ok: true });
}
