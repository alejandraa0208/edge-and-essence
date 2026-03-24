"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
    reminder_phone: string | null;
    reminder_email: string | null;
    stylists:
      | {
          id: string;
          display_name: string;
        }
      | {
          id: string;
          display_name: string;
        }[]
      | null;
  };
  error?: string;
};

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function getStylistName(
  stylists:
    | { id: string; display_name: string }
    | { id: string; display_name: string }[]
    | null
    | undefined
) {
  if (!stylists) return "—";
  if (Array.isArray(stylists)) {
    return stylists[0]?.display_name ?? "—";
  }
  return stylists.display_name;
}

function getDepositPaid(booking: NonNullable<BookingResponse["booking"]>) {
  if ((booking.paid_deposit_cents ?? 0) > 0) {
    return booking.paid_deposit_cents ?? 0;
  }
  if ((booking.stripe_payment_status ?? "").toLowerCase() === "succeeded") {
    return booking.deposit_cents ?? 0;
  }
  return 0;
}

export default function BookingConfirmedPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingResponse["booking"] | null>(null);

  useEffect(() => {
    async function loadBooking() {
      try {
        if (!bookingId) {
          throw new Error("Missing bookingId");
        }

        setLoading(true);
        setError(null);

        const res = await fetch(`/api/bookings/${bookingId}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as BookingResponse;

        if (!res.ok || !json.ok || !json.booking) {
          throw new Error(json.error || "Failed to load booking");
        }

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
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900 }}>Loading confirmation...</h1>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900 }}>Booking Confirmation</h1>
        <div
          style={{
            marginTop: 20,
            padding: 14,
            border: "1px solid #7f1d1d",
            borderRadius: 12,
            color: "#fecaca",
            background: "#1f1111",
          }}
        >
          {error || "Booking not found"}
        </div>
      </main>
    );
  }

  const depositPaid = getDepositPaid(booking);
  const remainingBalance = Math.max((booking.total_cents ?? 0) - depositPaid, 0);

  return (
    <main style={{ padding: 24, maxWidth: 860 }}>
      <div
        style={{
          border: "1px solid #334155",
          borderRadius: 18,
          padding: 24,
          background: "#0b1220",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 999,
            background: "#052e16",
            color: "#86efac",
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          Booking Confirmed
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 900, marginTop: 16, marginBottom: 8 }}>
          You’re booked
        </h1>

        <p style={{ opacity: 0.8, marginTop: 0 }}>
          Your appointment has been confirmed and your deposit was received.
        </p>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <InfoCard label="Confirmation Code" value={booking.confirmation_code || "Pending"} />
          <InfoCard label="Stylist" value={getStylistName(booking.stylists)} />
          <InfoCard label="Appointment Time" value={formatDateTime(booking.start_at)} />
          <InfoCard label="Service" value={booking.service_summary || "—"} />
          <InfoCard label="Total" value={formatMoney(booking.total_cents)} />
          <InfoCard label="Deposit Paid" value={formatMoney(depositPaid)} />
          <InfoCard label="Remaining Balance" value={formatMoney(remainingBalance)} />
          <InfoCard
            label="Reminders"
            value={
              booking.reminder_opt_in
                ? booking.reminder_preference || "enabled"
                : "not enabled"
            }
          />
        </div>

        <div
          style={{
            marginTop: 24,
            border: "1px solid #334155",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Important</div>
          <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
            Please keep your confirmation code for your records.  
            Remaining balance is due at your appointment unless otherwise arranged.
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7 }}>{label}</div>
      <div style={{ marginTop: 8, fontWeight: 900, fontSize: 18 }}>{value}</div>
    </div>
  );
}