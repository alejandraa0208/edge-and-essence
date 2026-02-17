import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  // do NOT set apiVersion unless you explicitly want it
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Phoenix is UTC-07:00 (no DST). We store ISO strings; comparing Date objects is fine.
const H48_MS = 48 * 60 * 60 * 1000;

function mustEnv(name: string, val: string | undefined) {
  if (!val) throw new Error(`Missing env var: ${name}`);
}

async function refundDepositIfPossible(opts: {
  paymentIntentId: string;
  amountCents?: number | null;
}) {
  const { paymentIntentId, amountCents } = opts;

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  // If deposit never got captured, there may be no charge to refund.
  // latest_charge can be string or object.
  const latestCharge =
    typeof (pi as any).latest_charge === "string"
      ? (pi as any).latest_charge
      : (pi as any).latest_charge?.id;

  if (!latestCharge) {
    return { refunded: false, reason: "no_charge_to_refund" as const };
  }

  // Refund full deposit by default.
  // If you ever need partial refunds, you can pass amount.
  const refund = await stripe.refunds.create({
    charge: latestCharge,
    ...(amountCents && amountCents > 0 ? { amount: amountCents } : {}),
  });

  return { refunded: true, refundId: refund.id };
}

export async function POST(req: Request) {
  try {
    mustEnv("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY);
    mustEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    mustEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();

    const bookingId = String(body.bookingId || "");
    const reason = body.reason ? String(body.reason) : null;

    if (!bookingId) {
      return NextResponse.json(
        { error: "Missing required field: bookingId" },
        { status: 400 }
      );
    }

    // 1) Load booking
    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .select(
        "id,status,start_at,deposit_cents,total_cents,stripe_payment_intent_id,stripe_payment_status"
      )
      .eq("id", bookingId)
      .single();

    if (bErr || !booking) {
      return NextResponse.json(
        { error: "Booking not found", details: bErr?.message || null },
        { status: 404 }
      );
    }

    // If already cancelled, don't double-process.
    const alreadyCancelled =
      String(booking.status || "").startsWith("cancelled") ||
      String(booking.status || "") === "no_show_charged" ||
      String(booking.status || "") === "no_show_failed_charge";

    if (alreadyCancelled) {
      return NextResponse.json({
        ok: true,
        note: "Booking already in a final state; no action taken.",
        booking,
      });
    }

    const startAt = new Date(String(booking.start_at));
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json(
        { error: "Invalid booking.start_at", start_at: booking.start_at },
        { status: 500 }
      );
    }

    const now = new Date();
    const msUntil = startAt.getTime() - now.getTime();
    const is48Plus = msUntil >= H48_MS;

    const depositCents = Number(booking.deposit_cents ?? 0);
    const paymentIntentId = booking.stripe_payment_intent_id
      ? String(booking.stripe_payment_intent_id)
      : null;

    // 2) Decide cancel outcome
    let nextStatus: string;
    let refundResult: any = null;

    if (is48Plus) {
      // Cancel 48+ hours before => refund deposit (if there was one)
      nextStatus = "cancelled_refunded";

      if (depositCents > 0 && paymentIntentId) {
        try {
          refundResult = await refundDepositIfPossible({
            paymentIntentId,
            amountCents: depositCents,
          });
        } catch (e: any) {
          // Refund failure should not silently succeed; mark as special state.
          nextStatus = "cancelled_refund_failed";
          refundResult = { refunded: false, error: e?.message ?? String(e) };
        }
      } else {
        refundResult = {
          refunded: false,
          note: "No deposit/payment intent to refund.",
        };
      }
    } else {
      // Cancel within 48 hours => keep deposit
      nextStatus = "cancelled_late";
      refundResult = { refunded: false, note: "Late cancellation. Deposit kept." };
    }

    // 3) Update booking row
    const { data: updated, error: uErr } = await supabaseAdmin
      .from("bookings")
      .update({
        status: nextStatus,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq("id", bookingId)
      .select("*")
      .single();

    if (uErr) {
      return NextResponse.json(
        { error: "Failed to update booking", details: uErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      booking: updated,
      is48Plus,
      refundResult,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "server error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
