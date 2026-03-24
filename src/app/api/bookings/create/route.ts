import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CreateBookingBody = {
  stylistId?: string;
  serviceId?: string;
  dayDate?: string;
  startTime?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  addonServiceIds?: string[];
  notes?: string;
  stripePaymentIntentId?: string | null;
  depositCents?: number | null;
  totalCents?: number | null;
  reminderPreference?: "email" | "text" | "both" | "none";
  reminderOptIn?: boolean;
};

type ServiceRow = {
  id: string;
  name: string | null;
  duration_minutes: number | null;
};

type StylistServiceRow = {
  price_cents: number | null;
  deposit_cents: number | null;
};

function parseTime12hTo24h(time: string) {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error(`Invalid startTime format: ${time}`);

  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();

  if (ap === "AM" && hh === 12) hh = 0;
  if (ap === "PM" && hh !== 12) hh += 12;

  return { hh, mm };
}

function buildPhoenixDate(dayDate: string, startTime: string) {
  const { hh, mm } = parseTime12hTo24h(startTime);
  const hhStr = String(hh).padStart(2, "0");
  const mmStr = String(mm).padStart(2, "0");
  return new Date(`${dayDate}T${hhStr}:${mmStr}:00-07:00`);
}

function generateConfirmationCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `EE-${random}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBookingBody;

    const {
      stylistId,
      serviceId,
      dayDate,
      startTime,
      clientName,
      clientEmail,
      clientPhone,
      addonServiceIds = [],
      notes = "",
      stripePaymentIntentId = null,
      depositCents = null,
      totalCents = null,
      reminderPreference = "email",
      reminderOptIn = true,
    } = body;

    if (!stylistId || !serviceId || !dayDate || !startTime) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: stylistId, serviceId, dayDate, startTime",
        },
        { status: 400 }
      );
    }

    const { data: serviceRow, error: serviceErr } = await supabaseAdmin
      .from("services")
      .select("id,name,duration_minutes")
      .eq("id", serviceId)
      .single<ServiceRow>();

    if (serviceErr || !serviceRow) {
      return NextResponse.json(
        { error: "Service not found", details: serviceErr?.message },
        { status: 404 }
      );
    }

    const startAt = buildPhoenixDate(dayDate, startTime);
    const durationMinutes = serviceRow.duration_minutes ?? 0;
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    let computedTotal = totalCents;
    let computedDeposit = depositCents;

    if (computedTotal == null || computedDeposit == null) {
      const { data: joinRow } = await supabaseAdmin
        .from("stylist_services")
        .select("price_cents,deposit_cents")
        .eq("stylist_id", stylistId)
        .eq("service_id", serviceId)
        .maybeSingle<StylistServiceRow>();

      computedTotal = computedTotal ?? joinRow?.price_cents ?? 0;
      computedDeposit = computedDeposit ?? joinRow?.deposit_cents ?? 0;
    }

    const status = stripePaymentIntentId
      ? "confirmed"
      : computedDeposit && computedDeposit > 0
      ? "pending_payment"
      : "confirmed";

    const confirmationCode = generateConfirmationCode();

    const { data: booking, error: insertErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        stylist_id: stylistId,
        primary_service_id: serviceId,
        addon_service_ids: addonServiceIds,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        status,
        client_name: clientName ?? "",
        client_email: clientEmail ?? "",
        client_phone: clientPhone ?? "",
        notes,
        service_summary: serviceRow.name ?? "",
        total_cents: computedTotal ?? 0,
        deposit_cents: computedDeposit ?? 0,
        stripe_payment_intent_id: stripePaymentIntentId,
        stripe_payment_status: stripePaymentIntentId ? "succeeded" : null,
        paid_deposit_cents: stripePaymentIntentId ? computedDeposit ?? 0 : 0,
        paid_at: stripePaymentIntentId ? new Date().toISOString() : null,
        confirmation_code: confirmationCode,
        reminder_preference: reminderPreference,
        reminder_opt_in: reminderOptIn,
        reminder_phone: clientPhone ?? "",
        reminder_email: clientEmail ?? "",
      })
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: "failed to create booking", details: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, booking });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);

    return NextResponse.json(
      { error: "failed to create booking", details: message },
      { status: 500 }
    );
  }
}

