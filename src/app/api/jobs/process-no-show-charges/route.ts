import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

type NoShowBookingRow = {
  id: string;
  start_at: string | null;
  status: string | null;
  total_cents: number | null;
  deposit_cents: number | null;
  paid_deposit_cents: number | null;
  remaining_paid_cents: number | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  no_show_fee_cents: number | null;
  no_show_charged: boolean | null;
};

function appointmentHasPassedMoreThan15Minutes(startAt: string) {
  const start = new Date(startAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - start) / (1000 * 60);
  return diffMinutes >= 15;
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        start_at,
        status,
        total_cents,
        deposit_cents,
        paid_deposit_cents,
        remaining_paid_cents,
        stripe_customer_id,
        stripe_payment_method_id,
        no_show_fee_cents,
        no_show_charged
      `)
      .eq("status", "confirmed")
      .eq("no_show_charged", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bookings = (data ?? []) as NoShowBookingRow[];
    let chargesCreated = 0;

    for (const booking of bookings) {
      if (!booking.start_at) continue;
      if (!appointmentHasPassedMoreThan15Minutes(booking.start_at)) continue;

      const depositPaid =
        (booking.paid_deposit_cents ?? 0) > 0
          ? booking.paid_deposit_cents ?? 0
          : booking.deposit_cents ?? 0;

      const remainingPaid = booking.remaining_paid_cents ?? 0;
      const total = booking.total_cents ?? 0;
      const noShowFee = Math.max(total - depositPaid - remainingPaid, 0);

      if (noShowFee <= 0) continue;
      if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) continue;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: noShowFee,
        currency: "usd",
        customer: booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: "No-show charge",
      });

      await supabase
        .from("bookings")
        .update({
          status: "no_show",
          no_show_fee_cents: noShowFee,
          no_show_charged: true,
          no_show_charged_at: new Date().toISOString(),
          no_show_charge_payment_intent_id: paymentIntent.id,
          remaining_charge_attempted: true,
          remaining_charge_succeeded: paymentIntent.status === "succeeded",
        })
        .eq("id", booking.id);

      chargesCreated += 1;
    }

    return NextResponse.json({ ok: true, chargesCreated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}