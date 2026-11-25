import { NextResponse } from "next/server";
import Stripe from "stripe";
import { demoMode, getChat, newId, updateChat } from "@/lib/server/store";

/** Called on return from Checkout. Verifies payment with Stripe, then unlocks + mints the share token. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session_id } = (await req.json()) as { session_id?: string };
  const rec = await getChat(id);
  if (!rec || !session_id) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (rec.paid) return NextResponse.json({ paid: true });

  let paid = false;
  if (!process.env.STRIPE_SECRET_KEY) {
    paid = demoMode() && session_id === "mock";
  } else {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const s = await stripe.checkout.sessions.retrieve(session_id);
    paid = s.payment_status === "paid" && s.metadata?.chatId === id;
  }
  if (!paid) return NextResponse.json({ paid: false }, { status: 402 });
  await updateChat({ ...rec, paid: true, paidAt: Date.now(), shareToken: newId(24) });
  return NextResponse.json({ paid: true });
}
