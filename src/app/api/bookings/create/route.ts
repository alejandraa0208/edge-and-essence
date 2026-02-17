import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// IMPORTANT: do NOT set apiVersion (it caused your clover type error)
const stripe = new Stripe(STRIPE_SECRET_KEY);

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
  // America/Phoenix is UTC-07:00 (no DST)
  return new Date(`${dayDate}T${hhStr}:${mmStr}:00-07:00`);
}

function calcDeposit(totalCents: number) {
  // Global rule: if total <= $25 => deposit $0
  if (totalCents <= 2500) return 0;
  return Math.max(0, Math.round(totalCents * 0.3));
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
    }

    const body = await req.json();

    const stylistId = String(body.stylistId || "");
    const serviceId = String(body.serviceId || "");
    const dayDate = String(body.dayDate || ""); // YYYY-MM-DD
    const startTime = String(body.startTime || ""); // "10:00 AM"

    const clientName = String(body.clientName || "");
    const clientEmail = String(body.clientEmail || "");
    const clientPhone = String(body.clientPhone || "");
    const notes = String(body.notes || "");

    const addonServiceIds: string[] = Array.isArray(body.addonServiceIds)
      ? body.addonServiceIds.map(String)
      : [];

    // PaymentIntent id from client after Stripe confirmPayment()
    const stripePaymentIntentId = body.stripePaymentIntentId
      ? String(body.stripePaymentIntentId)
      : null;

    if (!stylistId || !serviceId || !dayDate || !startTime) {
      return NextResponse.json(
        { error: "Missing required fields: stylistId, serviceId, dayDate, startTime" },
        { status: 400 }
      );
    }

    // --- 1) Build list of all services in this booking (primary + addons) ---
    const allServiceIds = [serviceId, ...addonServiceIds];

    // --- 2) Pull durations + names from services table (for time + summary) ---
    const { data: servicesRows, error: servicesErr } = await supabaseAdmin
      .from("services")
      .select("id,name,duration_minutes")
      .in("id", allServiceIds);

    if (servicesErr || !servicesRows || servicesRows.length === 0) {
      return NextResponse.json(
        { error: "Service(s) not found", details: servicesErr?.message || null },
        { status: 404 }
      );
    }

    const serviceMap = new Map(servicesRows.map((s: any) => [s.id, s]));
    const missingIds = allServiceIds.filter((id) => !serviceMap.has(id));
    if (missingIds.length) {
      return NextResponse.json(
        { error: "Some services not found", missingServiceIds: missingIds },
        { status: 404 }
      );
    }

    const totalMinutes = allServiceIds.reduce((sum, id) => {
      const r: any = serviceMap.get(id);
      return sum + (Number(r.duration_minutes) || 0);
    }, 0);

    const startAt = buildPhoenixDate(dayDate, startTime);
    const endAt = new Date(startAt.getTime() + totalMinutes * 60_000);

    // --- 3) Pull server-truth prices from stylist_services ---
    const { data: ssRows, error: ssErr } = await supabaseAdmin
      .from("stylist_services")
      .select("service_id, price_cents")
      .eq("stylist_id", stylistId)
      .in("service_id", allServiceIds);

    if (ssErr || !ssRows || ssRows.length === 0) {
      return NextResponse.json(
        { error: "Stylist pricing not found for services", details: ssErr?.message || null },
        { status: 404 }
      );
    }

    const priceMap = new Map<string, number>(
      (ssRows as any[]).map((r) => [String(r.service_id), Number(r.price_cents) || 0])
    );

    const missingPrices = allServiceIds.filter((id) => !priceMap.has(id));
    if (missingPrices.length) {
      return NextResponse.json(
        { error: "Missing stylist pricing for some services", missingPriceServiceIds: missingPrices },
        { status: 404 }
      );
    }

    const totalCents = allServiceIds.reduce((sum, id) => sum + (priceMap.get(id) || 0), 0);
    const depositCents = calcDeposit(totalCents);

    // --- 4) Prevent overlap double booking (confirmed + pending_payment) ---
    const { data: overlaps, error: overlapErr } = await supabaseAdmin
      .from("bookings")
      .select("id,start_at,end_at,status")
      .eq("stylist_id", stylistId)
      .in("status", ["confirmed", "pending_payment"])
      .lt("start_at", endAt.toISOString())
      .gt("end_at", startAt.toISOString());

    if (overlapErr) {
      return NextResponse.json(
        { error: "Failed overlap check", details: overlapErr.message },
        { status: 500 }
      );
    }

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json(
        { error: "Time is no longer available. Please pick another time." },
        { status: 409 }
      );
    }

    // --- 5) If deposit required, verify Stripe PaymentIntent succeeded + amount matches ---
    let bookingStatus: "confirmed" | "pending_payment" = "confirmed";
    let stripePaymentStatus: string | null = null;

    if (depositCents > 0) {
      if (!STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
      }
      if (!stripePaymentIntentId) {
        return NextResponse.json(
          { error: "Deposit required. Missing stripePaymentIntentId." },
          { status: 400 }
        );
      }

      const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

      // Must be succeeded to confirm booking
      if (pi.status !== "succeeded") {
        bookingStatus = "pending_payment";
        stripePaymentStatus = pi.status;
        return NextResponse.json(
          {
            error: "Deposit payment not completed",
            paymentIntentStatus: pi.status,
          },
          { status: 402 }
        );
      }

      // Must match our deposit amount
      if ((pi.amount || 0) !== depositCents) {
        return NextResponse.json(
          {
            error: "Deposit amount mismatch",
            expectedDepositCents: depositCents,
            paymentIntentAmount: pi.amount,
          },
          { status: 400 }
        );
      }

      bookingStatus = "confirmed";
      stripePaymentStatus = pi.status;
    }

    // --- 6) Build summary string (no long UI summary blocks, just simple) ---
    const primaryName = String((serviceMap.get(serviceId) as any).name || "Service");
    const addonNames = addonServiceIds.map((id) => String((serviceMap.get(id) as any).name || ""));
    const serviceSummary =
      addonNames.length > 0 ? `${primaryName} + ${addonNames.join(", ")}` : primaryName;

    const { data: booking, error: insertErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        stylist_id: stylistId,
        primary_service_id: serviceId,
        addon_service_ids: addonServiceIds,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        status: bookingStatus,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        notes,
        service_summary: serviceSummary,
        total_cents: totalCents,
        deposit_cents: depositCents,
        stripe_payment_intent_id: stripePaymentIntentId,
        stripe_payment_status: stripePaymentStatus,
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
  } catch (e: any) {
    return NextResponse.json(
      { error: "failed to create booking", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

