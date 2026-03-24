import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  _req: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await context.params;

    if (!bookingId) {
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        id,
        confirmation_code,
        start_at,
        end_at,
        status,
        client_name,
        client_email,
        client_phone,
        service_summary,
        total_cents,
        deposit_cents,
        paid_deposit_cents,
        stripe_payment_status,
        reminder_preference,
        reminder_opt_in,
        reminder_phone,
        reminder_email,
        stylists:stylists (
          id,
          display_name
        )
      `
      )
      .eq("id", bookingId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Booking not found", details: error?.message },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, booking: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}