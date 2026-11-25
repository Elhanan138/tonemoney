import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getChat, saveChat } from "@/lib/server/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await getChat(id);
  if (!rec || rec.reportStatus !== "done") return NextResponse.json({ error: "not ready" }, { status: 400 });
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;

  if (!process.env.STRIPE_SECRET_KEY) {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "payments not configured" }, { status: 500 });
    return NextResponse.json({ url: `${base}/c/${id}?session_id=mock` });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: rec.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "ils",
          unit_amount: Number(process.env.REPORT_PRICE_AGOROT ?? 1500),
          product_data: { name: `קבלה מלאה – ${rec.answers.groupName}` },
        },
      },
    ],
    metadata: { chatId: id },
    success_url: `${base}/c/${id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/c/${id}`,
  });
  await saveChat({ ...rec, stripeSessionId: session.id });
  return NextResponse.json({ url: session.url });
}
