import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2026-01-28.clover",
});

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

export async function POST(req: Request) {
    try {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) {
            return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
        }

        const rawBody = await req.text();
        const signature = req.headers.get("stripe-signature");
        if (!signature) {
            return NextResponse.json({ error: "Missing stripe-signature header"}, { status: 400 });
        }

        const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

        if (event.type === "payment_intent.succeeded") {
            const pi = event.data.object as Stripe.PaymentIntent;

            const depositPaid = typeof pi.amount_received === "number" ? pi.amount_received : 0;

            const { error } = await supabaseAdmin
                .from("bookings")
                .update({
                    status: "confirmed",
                    stripe_payment_status: "succeeded",
                    paid_deposit_cents: depositPaid,
                    paid_at: new Date().toISOString(),
                })
                .eq("stripe_payment_intent_id", pi.id);
            if (error) {
                return NextResponse.json({ error: "Supabase update failed", details: error.message }, {status: 500 });
            }

            return NextResponse.json({ ok: true });
        }

        if (event.type === "payment_intent.payment_failed") {
            const pi = event.data.object as Stripe.PaymentIntent;

            const { error } = await supabaseAdmin
                .from("bookings")
                .update({
                    status: "payment_failed",
                    stripe_payment_status: "failed",
                })
                .eq("stripe_payment_intent_id", pi.id);
            
            if (error) {
                return NextResponse.json({ error: "Supabase upddate failed", details: error.message }, { status: 500 });
            }

            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ ok: true, ignored: event.type });
    } catch (e: unknown) {
        const details =
            e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
        return NextResponse.json(
            { error: "Webhook error", details },
            { status: 400 }
        );
    }
}