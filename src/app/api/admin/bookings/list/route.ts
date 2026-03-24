import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
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
        remaining_paid_cents,
        remaining_paid_method,
        late_cancel,
        cancellation_fee_cents,
        stylists:stylists (
          id,
          display_name
        )
      `
      )
      .order("start_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { error: "Failed to load bookings", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, bookings: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}