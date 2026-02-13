import { NextResponse } from "next/server";
import { supabaseServerPublic } from "@/lib/supabase-server-public";

function isValidISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d); // YYYY-MM-DD
}

function timeToMinutes(t: string) {
  // accepts "HH:MM:SS" or "HH:MM"
  const [hh, mm] = t.split(":");
  return Number(hh) * 60 + Number(mm);
}

function minutesToTimeString(mins: number) {
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

function formatToAmPm(dayDate: string, time24: string) {
  // dayDate is YYYY-MM-DD, time24 is "HH:MM:SS"
  const iso = `${dayDate}T${time24}`;
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

type ScheduleRow = {
  is_closed: boolean;
  start_time: string; // time
  end_time: string; // time
  latest_start_time: string; // time
};

type BookingRow = {
  start_at: string; // timestamptz
  end_at: string; // timestamptz
  status: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const stylistId = url.searchParams.get("stylistId") ?? "";
  const dayDate = url.searchParams.get("dayDate") ?? "";
  const durationMinutesRaw = url.searchParams.get("durationMinutes") ?? "";
  const debug = url.searchParams.get("debug") === "1";

  const missing: string[] = [];
  if (!stylistId) missing.push("stylistId");
  if (!dayDate) missing.push("dayDate");
  if (!durationMinutesRaw) missing.push("durationMinutes");

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "missing params",
        missing,
        got: {
          stylistId: stylistId || null,
          dayDate: dayDate || null,
          durationMinutes: durationMinutesRaw || null,
        },
        example:
          "/api/availability?stylistId=...&dayDate=2026-02-14&durationMinutes=60",
      },
      { status: 400 }
    );
  }

  if (!isValidISODate(dayDate)) {
    return NextResponse.json(
      { error: "invalid dayDate. Must be YYYY-MM-DD", dayDate },
      { status: 400 }
    );
  }

  const durationMinutes = Number(durationMinutesRaw);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return NextResponse.json(
      { error: "invalid durationMinutes", durationMinutesRaw },
      { status: 400 }
    );
  }

  // Use UTC day-of-week so it doesn't shift based on local timezone
  const dayOfWeek = new Date(`${dayDate}T00:00:00Z`).getUTCDay(); // 0=Sun ... 6=Sat

  const sb = supabaseServerPublic();

  // 1) Try override for this exact day
  const { data: override, error: overrideErr } = await sb
    .from("stylist_schedule_overrides")
    .select("is_closed,start_time,end_time,latest_start_time")
    .eq("stylist_id", stylistId)
    .eq("day_date", dayDate)
    .maybeSingle<ScheduleRow>();

  // 2) Otherwise use weekly schedule
  const { data: weekly, error: weeklyErr } = await sb
    .from("stylist_schedules")
    .select("is_closed,start_time,end_time,latest_start_time")
    .eq("stylist_id", stylistId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle<ScheduleRow>();

  const using = override ? "override" : "weekly";
  const schedule = (override ?? weekly) as ScheduleRow | null;

  if (!schedule) {
    return NextResponse.json(
      {
        slots: [],
        ...(debug
          ? { debug: true, stylistId, dayDate, durationMinutes, dayOfWeek, override, weekly, overrideErr, weeklyErr, using }
          : {}),
      },
      { status: 200 }
    );
  }

  if (schedule.is_closed) {
    return NextResponse.json(
      {
        slots: [],
        ...(debug
          ? {
              debug: true,
              stylistId,
              dayDate,
              durationMinutes,
              dayOfWeek,
              using,
              schedule,
              overrideErr,
              weeklyErr,
              bookedRanges: [],
            }
          : {}),
      },
      { status: 200 }
    );
  }

  // Pull bookings for that day
  const dayStart = new Date(`${dayDate}T00:00:00Z`).toISOString();
  const dayEnd = new Date(`${dayDate}T23:59:59Z`).toISOString();

  const { data: bookings, error: bookingsErr } = await sb
    .from("bookings")
    .select("start_at,end_at,status")
    .eq("stylist_id", stylistId)
    .gte("start_at", dayStart)
    .lte("start_at", dayEnd);

  if (bookingsErr) {
    return NextResponse.json(
      { error: bookingsErr.message },
      { status: 500 }
    );
  }

  const bookedRanges = ((bookings ?? []) as BookingRow[])
    .filter((b) => (b.status ?? "confirmed") !== "cancelled")
    .map((b) => ({
      start: b.start_at,
      end: b.end_at,
    }));

  // Generate slots every 30 min from start_time to latest_start_time
  const startM = timeToMinutes(schedule.start_time);
  const latestStartM = timeToMinutes(schedule.latest_start_time);

  const slots: { time: string; squeeze: boolean }[] = [];

  for (let m = startM; m <= latestStartM; m += 30) {
    const slotStart = new Date(`${dayDate}T${minutesToTimeString(m)}Z`);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

    // overlap check: bookingStart < slotEnd && bookingEnd > slotStart
    const overlaps = bookedRanges.some((r) => {
      const bStart = new Date(r.start);
      const bEnd = new Date(r.end);
      return bStart < slotEnd && bEnd > slotStart;
    });

    if (!overlaps) {
      slots.push({
        time: formatToAmPm(dayDate, minutesToTimeString(m)),
        squeeze: false,
      });
    }
  }

  return NextResponse.json({
    slots,
    ...(debug
      ? {
          debug: true,
          stylistId,
          dayDate,
          durationMinutes,
          dayOfWeek,
          using,
          weeklyTableUsed: "stylist_schedules",
          schedule,
          bookedRanges,
        }
      : {}),
  });
}



