"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const styles = {
  main: {
    padding: "32px 16px",
    maxWidth: 620,
    margin: "0 auto",
  } as React.CSSProperties,
  card: {
    border: "1px solid #334155",
    borderRadius: 16,
    padding: "20px 22px",
    background: "#0b1220",
  } as React.CSSProperties,
};

type BookingResponse = {
  ok: boolean;
  booking?: {
    id: string;
    confirmation_code: string | null;
    start_at: string | null;
    end_at: string | null;
    status: string | null;
    client_name: string | null;
    client_email: string | null;
    client_phone: string | null;
    service_summary: string | null;
    total_cents: number | null;
    deposit_cents: number | null;
    paid_deposit_cents: number | null;
    stripe_payment_status: string | null;
    reminder_preference: string | null;
    reminder_opt_in: boolean;
    reminder_24h: boolean | null;
    reminder_2h: boolean | null;
    reminder_phone: string | null;
    reminder_email: string | null;
    stylists:
      | { id: string; display_name: string }
      | { id: string; display_name: string }[]
      | null;
  };
  error?: string;
};

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getStylistName(
  stylists:
    | { id: string; display_name: string }
    | { id: string; display_name: string }[]
    | null
    | undefined
) {
  if (!stylists) return "—";
  if (Array.isArray(stylists)) return stylists[0]?.display_name ?? "—";
  return stylists.display_name;
}

function getDepositPaid(booking: NonNullable<BookingResponse["booking"]>) {
  if ((booking.paid_deposit_cents ?? 0) > 0) return booking.paid_deposit_cents ?? 0;
  if ((booking.stripe_payment_status ?? "").toLowerCase() === "succeeded") return booking.deposit_cents ?? 0;
  return 0;
}

function reminderSummary(booking: NonNullable<BookingResponse["booking"]>) {
  if (!booking.reminder_opt_in) return "None";
  const channel =
    booking.reminder_preference === "text" ? "SMS"
    : booking.reminder_preference === "both" ? "Email + SMS"
    : booking.reminder_preference === "email" ? "Email"
    : "—";
  const times = [
    booking.reminder_24h && "24h before",
    booking.reminder_2h && "2h before",
  ].filter(Boolean).join(", ");
  return times ? `${channel} · ${times}` : channel;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.45 }}>
      {children}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ fontSize: 20, marginTop: 1, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 3 }}>{label}</div>
        <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>{value}</div>
      </div>
    </div>
  );
}

function PaymentRow({ label, value, highlight, bold }: {
  label: string; value: string; highlight?: "green" | "amber"; bold?: boolean;
}) {
  const color = highlight === "green" ? "#86efac" : highlight === "amber" ? "#fbbf24" : "inherit";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 14, opacity: bold ? 0.9 : 0.7, fontWeight: bold ? 800 : 600 }}>{label}</span>
      <span style={{ fontWeight: 900, fontSize: bold ? 17 : 15, color }}>{value}</span>
    </div>
  );
}

export default function ConfirmedPageInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingResponse["booking"] | null>(null);

  useEffect(() => {
    async function loadBooking() {
      try {
        if (!bookingId) throw new Error("Missing bookingId");
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/bookings/${bookingId}`, { method: "GET", cache: "no-store" });
        const json = (await res.json()) as BookingResponse;
        if (!res.ok || !json.ok || !json.booking) throw new Error(json.error || "Failed to load booking");
        setBooking(json.booking);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load booking");
      } finally {
        setLoading(false);
      }
    }
    loadBooking();
  }, [bookingId]);

  if (loading) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 0" }}>
            <div style={{ fontSize: 36, opacity: 0.4 }}>✦</div>
            <div style={{ fontWeight: 800, opacity: 0.6 }}>Loading your confirmation...</div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={{ padding: "14px 16px", border: "1px solid #7f1d1d", borderRadius: 12, color: "#fca5a5", background: "rgba(127,29,29,0.15)" }}>
            {error || "Booking not found."}
          </div>
        </div>
      </main>
    );
  }

  const depositPaid = getDepositPaid(booking);
  const remainingBalance = Math.max((booking.total_cents ?? 0) - depositPaid, 0);
  const stylistName = getStylistName(booking.stylists);

  return (
    <main style={styles.main}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>✦</div>
        <div style={{ display: "inline-block", padding: "5px 14px", borderRadius: 999, background: "rgba(134,239,172,0.12)", border: "1px solid rgba(134,239,172,0.3)", color: "#86efac", fontWeight: 800, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
          Booking Confirmed
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 900, margin: "0 0 8px 0", lineHeight: 1.1 }}>
          You're all set, {booking.client_name?.split(" ")[0] || "friend"}
        </h1>
        <p style={{ opacity: 0.6, margin: 0, fontSize: 15 }}>
          A copy of this confirmation will be sent to {booking.client_email || "your email"}.
        </p>
      </div>

      {/* Confirmation code banner */}
      <div style={{ ...styles.card, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Confirmation Code</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.06em" }}>{booking.confirmation_code || "Pending"}</div>
        </div>
        <div style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(134,239,172,0.1)", border: "1px solid rgba(134,239,172,0.25)", color: "#86efac", fontWeight: 800, fontSize: 13 }}>
          {booking.status === "confirmed" ? "✓ Confirmed" : booking.status ?? "Pending"}
        </div>
      </div>

      {/* Appointment details */}
      <div style={{ ...styles.card, marginBottom: 16 }}>
        <SectionLabel>Appointment</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
          <DetailRow icon="📅" label="Date & Time" value={formatDateTime(booking.start_at)} />
          <DetailRow icon="⏱" label="End Time" value={formatTime(booking.end_at)} />
          <DetailRow icon="✂️" label="Stylist" value={stylistName} />
          <DetailRow icon="💇" label="Service" value={booking.service_summary || "—"} />
        </div>
      </div>

      {/* Payment summary */}
      <div style={{ ...styles.card, marginBottom: 16 }}>
        <SectionLabel>Payment</SectionLabel>
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <PaymentRow label="Total service price" value={formatMoney(booking.total_cents)} />
          <PaymentRow label="Deposit paid today" value={formatMoney(depositPaid)} highlight="green" />
          <div style={{ borderTop: "1px solid #334155", paddingTop: 10, marginTop: 2 }}>
            <PaymentRow label="Remaining balance due at appointment" value={formatMoney(remainingBalance)} highlight={remainingBalance > 0 ? "amber" : undefined} bold />
          </div>
        </div>
        {remainingBalance > 0 && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)", fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
            Remaining balance of {formatMoney(remainingBalance)} is due at your appointment unless otherwise arranged with your stylist.
          </div>
        )}
      </div>

      {/* Reminders */}
      <div style={{ ...styles.card, marginBottom: 16 }}>
        <SectionLabel>Reminders</SectionLabel>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 28 }}>{booking.reminder_opt_in ? "🔔" : "🔕"}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{reminderSummary(booking)}</div>
            {booking.reminder_opt_in && (
              <div style={{ fontSize: 13, opacity: 0.6, marginTop: 3 }}>
                Sent to {booking.reminder_email || booking.client_email || "—"}
                {booking.reminder_phone ? ` · ${booking.reminder_phone}` : ""}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Policy notice */}
      <div style={{ ...styles.card, background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.2)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 20, marginTop: 1 }}>⚠️</div>
          <div>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>No-show & cancellation policy</div>
            <div style={{ opacity: 0.75, lineHeight: 1.7, fontSize: 14 }}>
              Cancellations within 24 hours of your appointment or no-shows may be charged up to the full service amount using the card on file. Please contact your stylist as early as possible if you need to reschedule.
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}