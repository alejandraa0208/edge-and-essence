// src/app/api/bookings/route.ts
import { NextResponse } from "next/server";
import { supabaseServerPublic } from "@/lib/supabase-server-public";

type CreateBookingBody = {
  stylistId: string;

  dayDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM" (24h) e.g. "11:00"

  primaryServiceId: string;
  addonServiceIds: string[];

  totalDurationMinutes: number;

  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  notes?: string | null;
};

function toLocalISO(dayDate: string, hhmm: string) {
  return `${dayDate}T${hhmm}:00`;
}

export async function POST(req: Request) {
  const sb = supabaseServerPublic();

  let body: CreateBookingBody;
  try {
    body = (await req.json()) as CreateBookingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stylistId = body.stylistId?.trim();
  const dayDate = body.dayDate?.trim();
  const startTime = body.startTime?.trim();
  const primaryServiceId = body.primaryServiceId?.trim();
  const addonServiceIds = Array.isArray(body.addonServiceIds) ? body.addonServiceIds : [];
  const totalDurationMinutes = Number(body.totalDurationMinutes || 0);

  if (!stylistId || !dayDate || !startTime || !primaryServiceId || !totalDurationMinutes) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: stylistId, dayDate, startTime, primaryServiceId, totalDurationMinutes",
      },
      { status: 400 }
    );
  }

  const startLocal = toLocalISO(dayDate, startTime);
  const startAt = new Date(startLocal);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid dayDate/startTime" }, { status: 400 });
  }

  const endAt = new Date(startAt.getTime() + totalDurationMinutes * 60_000);

  // 1) Double-booking protection (overlap check)
  // Overlap rule: existing.start_at < new.end_at AND existing.end_at > new.start_at
  const { data: conflicts, error: conflictErr } = await sb
    .from("bookings")
    .select("id, start_at, end_at, status")
    .eq("stylist_id", stylistId)
    .neq("status", "cancelled")
    .lt("start_at", endAt.toISOString())
    .gt("end_at", startAt.toISOString())
    .limit(1);

  if (conflictErr) {
    return NextResponse.json({ error: conflictErr.message }, { status: 500 });
  }

  if ((conflicts ?? []).length > 0) {
    return NextResponse.json(
      { error: "That time was just booked. Please pick another time." },
      { status: 409 }
    );
  }

  // 2) Insert booking
  const serviceSummary = JSON.stringify({
    primaryServiceId,
    addonServiceIds,
    totalDurationMinutes,
  });

  const insertRow = {
    stylist_id: stylistId,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),

    status: "pending",

    client_name: body.clientName ?? null,
    client_email: body.clientEmail ?? null,
    client_phone: body.clientPhone ?? null,

    notes: body.notes ?? null,
    service_summary: serviceSummary,

    total_cents: 0,
  };

  const { data, error } = await sb.from("bookings").insert(insertRow).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bookingId: data.id });
}
