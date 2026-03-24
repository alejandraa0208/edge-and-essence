import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ReminderBookingRow = {
  id: string;
  start_at: string | null;
  client_name: string | null;
  reminder_preference: string | null;
  reminder_opt_in: boolean | null;
  reminder_phone: string | null;
  reminder_email: string | null;
  reminder_24h_sent: boolean | null;
  reminder_2h_sent: boolean | null;
  service_summary: string | null;
  confirmation_code: string | null;
  stylists:
    | { display_name: string | null }
    | { display_name: string | null }[]
    | null;
};

function shouldSend24HourReminder(startAt: string) {
  const now = new Date().getTime();
  const start = new Date(startAt).getTime();
  const diffHours = (start - now) / (1000 * 60 * 60);
  return diffHours <= 24 && diffHours > 23;
}

function shouldSend2HourReminder(startAt: string) {
  const now = new Date().getTime();
  const start = new Date(startAt).getTime();
  const diffHours = (start - now) / (1000 * 60 * 60);
  return diffHours <= 2 && diffHours > 1;
}

async function sendEmailReminder(to: string, subject: string, body: string) {
  console.log("EMAIL REMINDER", { to, subject, body });
}

async function sendSmsReminder(to: string, body: string) {
  console.log("SMS REMINDER", { to, body });
}

function getStylistName(
  stylists:
    | { display_name: string | null }
    | { display_name: string | null }[]
    | null
    | undefined
) {
  if (!stylists) return "your stylist";
  if (Array.isArray(stylists)) {
    return stylists[0]?.display_name || "your stylist";
  }
  return stylists.display_name || "your stylist";
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        start_at,
        client_name,
        reminder_preference,
        reminder_opt_in,
        reminder_phone,
        reminder_email,
        reminder_24h_sent,
        reminder_2h_sent,
        service_summary,
        confirmation_code,
        stylists (
          display_name
        )
      `)
      .eq("status", "confirmed");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bookings = (data ?? []) as ReminderBookingRow[];
    let remindersSent = 0;

    for (const booking of bookings) {
      if (!booking.start_at || !booking.reminder_opt_in) continue;

      const stylistName = getStylistName(booking.stylists);
      const serviceName = booking.service_summary || "your service";

      const message = `Reminder: your appointment for ${serviceName} with ${stylistName} is coming up. Confirmation code: ${booking.confirmation_code || "N/A"}.`;

      if (shouldSend24HourReminder(booking.start_at) && !booking.reminder_24h_sent) {
        if (
          booking.reminder_preference === "email" ||
          booking.reminder_preference === "both"
        ) {
          if (booking.reminder_email) {
            await sendEmailReminder(
              booking.reminder_email,
              "24-hour appointment reminder",
              message
            );
          }
        }

        if (
          booking.reminder_preference === "text" ||
          booking.reminder_preference === "both"
        ) {
          if (booking.reminder_phone) {
            await sendSmsReminder(booking.reminder_phone, message);
          }
        }

        await supabase
          .from("bookings")
          .update({
            reminder_24h_sent: true,
            reminder_last_sent_at: new Date().toISOString(),
          })
          .eq("id", booking.id);

        remindersSent += 1;
      }

      if (shouldSend2HourReminder(booking.start_at) && !booking.reminder_2h_sent) {
        if (
          booking.reminder_preference === "email" ||
          booking.reminder_preference === "both"
        ) {
          if (booking.reminder_email) {
            await sendEmailReminder(
              booking.reminder_email,
              "2-hour appointment reminder",
              message
            );
          }
        }

        if (
          booking.reminder_preference === "text" ||
          booking.reminder_preference === "both"
        ) {
          if (booking.reminder_phone) {
            await sendSmsReminder(booking.reminder_phone, message);
          }
        }

        await supabase
          .from("bookings")
          .update({
            reminder_2h_sent: true,
            reminder_last_sent_at: new Date().toISOString(),
          })
          .eq("id", booking.id);

        remindersSent += 1;
      }
    }

    return NextResponse.json({ ok: true, remindersSent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}