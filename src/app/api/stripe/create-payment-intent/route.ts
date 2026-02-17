import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Lock apiVersion so Stripe doesn't randomly change behavior on you
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json(
        { error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const stylistId = String(body.stylistId || "");
    const serviceId = String(body.serviceId || "");
    const dayDate = body.dayDate ? String(body.dayDate) : null; // YYYY-MM-DD
    const startTime = body.startTime ? String(body.startTime) : null; // "10:00 AM"

    const missing: string[] = [];
    if (!stylistId) missing.push("stylistId");
    if (!serviceId) missing.push("serviceId");

    if (missing.length) {
      return NextResponse.json({ error: "missing params", missing }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // services(name) can come back as an array depending on relationship settings
    const { data: ss, error: ssErr } = await supabase
      .from("stylist_services")
      .select("price_cents, deposit_cents, services(name)")
      .eq("stylist_id", stylistId)
      .eq("service_id", serviceId)
      .maybeSingle();

    if (ssErr || !ss) {
      return NextResponse.json(
        { error: "service not found for stylist", details: ssErr?.message || null },
        { status: 404 }
      );
    }

    const priceCents = Number((ss as any).price_cents ?? 0);

    // Global rule:
    // if price <= $25 => deposit is $0
    let depositCents = Number((ss as any).deposit_cents ?? 0);
    if (priceCents <= 2500) depositCents = 0;

    const serviceName =
      Array.isArray((ss as any).services) && (ss as any).services.length > 0
        ? String((ss as any).services[0]?.name ?? "Service")
        : "Service";

    // No deposit required
    if (depositCents <= 0) {
      return NextResponse.json({
        ok: true,
        depositCents: 0,
        priceCents,
        paymentIntentId: null,
        clientSecret: null,
        note: "No deposit required for this service.",
      });
    }

    const pi = await stripe.paymentIntents.create({
      amount: depositCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `Deposit for ${serviceName}`,
      metadata: {
        stylist_id: stylistId,
        service_id: serviceId,
        ...(dayDate ? { day_date: dayDate } : {}),
        ...(startTime ? { start_time: startTime } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      depositCents,
      priceCents,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "server error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

