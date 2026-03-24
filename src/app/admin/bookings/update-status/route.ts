import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ActionType = "cancel" | "no_show" | "mark_remaining_paid";

function getEffectiveDepositPaidCents(booking: {
  paid_deposit_cents: number | null;
  deposit_cents: number | null;
  stripe_payment_status: string | null;
}) {
  if ((booking.paid_deposit_cents ?? 0) > 0) {
    return booking.paid_deposit_cents ?? 0;
  }

  if ((booking.stripe_payment_status ?? "").toLowerCase() === "succeeded") {
    return booking.deposit_cents ?? 0;
  }

  return 0;
}

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const body = (await req.json()) as {
      action: ActionType;
      bookingId: string;
      reason?: string;
      paymentMethod?: string;
      notes?: string;
    };

    const { action, bookingId, reason, paymentMethod, notes } = body;

    if (!action || !bookingId) {
      return NextResponse.json(
        { error: "Missing action or bookingId" },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        start_at,
        status,
        total_cents,
        deposit_cents,
        paid_deposit_cents,
        stripe_payment_status,
        remaining_paid_cents
      `
      )
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found", details: bookingError?.message },
        { status: 404 }
      );
    }

    const effectiveDepositPaid = getEffectiveDepositPaidCents(booking);
    const remainingBalance = Math.max(
      (booking.total_cents ?? 0) - effectiveDepositPaid - (booking.remaining_paid_cents ?? 0),
      0
    );

    const now = new Date();
    const startAt = booking.start_at ? new Date(booking.start_at) : null;
    const hoursUntilAppointment =
      startAt ? (startAt.getTime() - now.getTime()) / (1000 * 60 * 60) : null;

    if (action === "cancel") {
      const isLateCancel =
        hoursUntilAppointment !== null &&
        hoursUntilAppointment <= 24 &&
        hoursUntilAppointment >= 0;

      const cancellationReason = isLateCancel
        ? reason?.trim() ||
          "Late cancellation within 24 hours. Remaining balance is due."
        : reason?.trim() || "Cancelled by admin";

      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          canceled_at: now.toISOString(),
          cancellation_reason: cancellationReason,
          late_cancel: isLateCancel,
          cancellation_fee_cents: isLateCancel ? remainingBalance : 0,
          cancellation_policy_applied: isLateCancel,
        })
        .eq("id", bookingId);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to cancel booking", details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        action,
        lateCancel: isLateCancel,
        cancellationFeeCents: isLateCancel ? remainingBalance : 0,
      });
    }

    if (action === "no_show") {
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          status: "no_show",
          canceled_at: now.toISOString(),
          cancellation_reason:
            reason?.trim() || "No-show. Remaining balance is due.",
          late_cancel: true,
          cancellation_fee_cents: remainingBalance,
          cancellation_policy_applied: true,
          remaining_charge_attempted: false,
          remaining_charge_succeeded: false,
        })
        .eq("id", bookingId);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to mark no-show", details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        action,
        noShowFeeCents: remainingBalance,
      });
    }

    if (action === "mark_remaining_paid") {
      if (remainingBalance <= 0) {
        return NextResponse.json({
          ok: true,
          action,
          message: "No remaining balance to mark as paid.",
        });
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          remaining_paid_cents: (booking.remaining_paid_cents ?? 0) + remainingBalance,
          remaining_paid_at: now.toISOString(),
          remaining_paid_method: paymentMethod?.trim() || "other",
          remaining_paid_notes: notes?.trim() || null,
          remaining_charge_succeeded: true,
          status: "completed",
        })
        .eq("id", bookingId);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to mark remaining as paid", details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        action,
        remainingPaidCents: remainingBalance,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}