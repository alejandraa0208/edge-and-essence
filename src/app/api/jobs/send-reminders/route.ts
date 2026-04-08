import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "reminders@edgeandessence.com";

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
  reminder_1w_sent: boolean | null;
  service_summary: string | null;
  confirmation_code: string | null;
  stylists:
    | { display_name: string | null }
    | { display_name: string | null }[]
    | null;
};

function shouldSend1WeekReminder(startAt: string) {
  const now = new Date().getTime();
  const start = new Date(startAt).getTime();
  const diffHours = (start - now) / (1000 * 60 * 60);
  return diffHours <= 168 && diffHours > 167;
}

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

function getStylistName(
  stylists:
    | { display_name: string | null }
    | { display_name: string | null }[]
    | null
    | undefined
) {
  if (!stylists) return "your stylist";
  if (Array.isArray(stylists)) return stylists[0]?.display_name || "your stylist";
  return stylists.display_name || "your stylist";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Phoenix",
  });
}

function buildEmailHtml({
  clientName,
  stylistName,
  serviceName,
  startAt,
  confirmationCode,
  headline,
  subtext,
}: {
  clientName: string;
  stylistName: string;
  serviceName: string;
  startAt: string;
  confirmationCode: string;
  headline: string;
  subtext: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <p style="margin:0;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#c9a55a;font-weight:700;">Edge & Essence</p>
            </td>
          </tr>
          <tr>
            <td style="background:#111318;border:1px solid #1e293b;border-radius:16px;padding:32px 28px;">
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:900;color:#f1f5f9;">${headline}</p>
              <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">${subtext}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e293b;border-radius:10px;overflow:hidden;">
                <tr style="background:#0f1a2e;">
                  <td style="padding:10px 14px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Client</td>
                  <td style="padding:10px 14px;font-size:14px;color:#f1f5f9;font-weight:700;">${clientName}</td>
                </tr>
                <tr style="border-top:1px solid #1e293b;">
                  <td style="padding:10px 14px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Service</td>
                  <td style="padding:10px 14px;font-size:14px;color:#f1f5f9;font-weight:700;">${serviceName}</td>
                </tr>
                <tr style="border-top:1px solid #1e293b;">
                  <td style="padding:10px 14px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Stylist</td>
                  <td style="padding:10px 14px;font-size:14px;color:#f1f5f9;font-weight:700;">${stylistName}</td>
                </tr>
                <tr style="border-top:1px solid #1e293b;">
                  <td style="padding:10px 14px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Date & Time</td>
                  <td style="padding:10px 14px;font-size:14px;color:#f1f5f9;font-weight:700;">${formatDateTime(startAt)}</td>
                </tr>
                <tr style="border-top:1px solid #1e293b;">
                  <td style="padding:10px 14px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Code</td>
                  <td style="padding:10px 14px;font-size:14px;color:#c9a55a;font-weight:900;letter-spacing:0.06em;">${confirmationCode}</td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:12px;color:#475569;line-height:1.6;border-top:1px solid #1e293b;padding-top:16px;">
                Need to reschedule? Please contact us as early as possible. Cancellations within 24 hours may be subject to a fee.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#334155;">Edge & Essence · Phoenix, AZ</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

async function sendEmailReminder({
  to,
  subject,
  clientName,
  stylistName,
  serviceName,
  startAt,
  confirmationCode,
  headline,
  subtext,
}: {
  to: string;
  subject: string;
  clientName: string;
  stylistName: string;
  serviceName: string;
  startAt: string;
  confirmationCode: string;
  headline: string;
  subtext: string;
}) {
  const html = buildEmailHtml({ clientName, stylistName, serviceName, startAt, confirmationCode, headline, subtext });
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function GET(req: Request) {
  // ── Verify cron secret ────────────────────────────────────────────────────
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        reminder_1w_sent,
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
    const errors: string[] = [];

    for (const booking of bookings) {
      if (!booking.start_at || !booking.reminder_opt_in) continue;
      if (!booking.reminder_email) continue;

      const stylistName = getStylistName(booking.stylists);
      const serviceName = booking.service_summary || "your appointment";
      const clientName = booking.client_name || "there";
      const confirmationCode = booking.confirmation_code || "N/A";

      // ── 1 week reminder ──────────────────────────────────────────────────
      if (shouldSend1WeekReminder(booking.start_at) && !booking.reminder_1w_sent) {
        try {
          await sendEmailReminder({
            to: booking.reminder_email,
            subject: "Your appointment is one week away — Edge & Essence",
            clientName,
            stylistName,
            serviceName,
            startAt: booking.start_at,
            confirmationCode,
            headline: `See you in a week, ${clientName.split(" ")[0]}!`,
            subtext: "Your appointment is coming up in 7 days. Here are your details.",
          });
          await supabase
            .from("bookings")
            .update({ reminder_1w_sent: true, reminder_last_sent_at: new Date().toISOString() })
            .eq("id", booking.id);
          remindersSent += 1;
        } catch (e) {
          errors.push(`1w email for ${booking.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // ── 24 hour reminder ─────────────────────────────────────────────────
      if (shouldSend24HourReminder(booking.start_at) && !booking.reminder_24h_sent) {
        try {
          await sendEmailReminder({
            to: booking.reminder_email,
            subject: "Your appointment is tomorrow — Edge & Essence",
            clientName,
            stylistName,
            serviceName,
            startAt: booking.start_at,
            confirmationCode,
            headline: `Tomorrow's the day, ${clientName.split(" ")[0]}!`,
            subtext: "Your appointment is in 24 hours. We can't wait to see you.",
          });
          await supabase
            .from("bookings")
            .update({ reminder_24h_sent: true, reminder_last_sent_at: new Date().toISOString() })
            .eq("id", booking.id);
          remindersSent += 1;
        } catch (e) {
          errors.push(`24h email for ${booking.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // ── 2 hour reminder ──────────────────────────────────────────────────
      if (shouldSend2HourReminder(booking.start_at) && !booking.reminder_2h_sent) {
        try {
          await sendEmailReminder({
            to: booking.reminder_email,
            subject: "Your appointment is in 2 hours — Edge & Essence",
            clientName,
            stylistName,
            serviceName,
            startAt: booking.start_at,
            confirmationCode,
            headline: `Almost time, ${clientName.split(" ")[0]}!`,
            subtext: "Your appointment is in about 2 hours. See you soon!",
          });
          await supabase
            .from("bookings")
            .update({ reminder_2h_sent: true, reminder_last_sent_at: new Date().toISOString() })
            .eq("id", booking.id);
          remindersSent += 1;
        } catch (e) {
          errors.push(`2h email for ${booking.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    return NextResponse.json({ ok: true, remindersSent, errors: errors.length > 0 ? errors : undefined });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}