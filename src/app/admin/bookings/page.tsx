"use client";

import { useEffect, useMemo, useState } from "react";
import AdminBookingActions from "./AdminBookingActions";

type RawBookingRow = {
  id: string;
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
  remaining_paid_cents: number | null;
  remaining_paid_method: string | null;
  late_cancel: boolean | null;
  cancellation_fee_cents: number | null;
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

type BookingRow = {
  id: string;
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
  remaining_paid_cents: number | null;
  remaining_paid_method: string | null;
  late_cancel: boolean;
  cancellation_fee_cents: number | null;
  stylist: {
    id: string;
    display_name: string;
  } | null;
};

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatShortDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cleanServiceSummary(value: string | null | undefined) {
  if (!value) return "—";

  try {
    const parsed = JSON.parse(value) as {
      primaryServiceId?: string;
      addonServiceIds?: string[];
      totalDurationMinutes?: number;
    };

    if (parsed.primaryServiceId) {
      const addonCount = Array.isArray(parsed.addonServiceIds)
        ? parsed.addonServiceIds.length
        : 0;

      return addonCount > 0
        ? `Service selected + ${addonCount} add-on${addonCount > 1 ? "s" : ""}`
        : "Service selected";
    }
  } catch {
    return value;
  }

  return value;
}

function normalizeBookings(rows: unknown): BookingRow[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const r = row as RawBookingRow;

    let stylist: BookingRow["stylist"] = null;

    if (Array.isArray(r.stylists)) {
      stylist = r.stylists.length > 0 ? r.stylists[0] : null;
    } else if (r.stylists && typeof r.stylists === "object") {
      stylist = r.stylists;
    }

    return {
      id: r.id,
      start_at: r.start_at,
      end_at: r.end_at,
      status: r.status,
      client_name: r.client_name,
      client_email: r.client_email,
      client_phone: r.client_phone,
      service_summary: r.service_summary,
      total_cents: r.total_cents,
      deposit_cents: r.deposit_cents,
      paid_deposit_cents: r.paid_deposit_cents,
      stripe_payment_status: r.stripe_payment_status,
      remaining_paid_cents: r.remaining_paid_cents,
      remaining_paid_method: r.remaining_paid_method,
      late_cancel: !!r.late_cancel,
      cancellation_fee_cents: r.cancellation_fee_cents,
      stylist,
    };
  });
}

function getEffectiveDepositPaidCents(booking: BookingRow) {
  if ((booking.paid_deposit_cents ?? 0) > 0) {
    return booking.paid_deposit_cents ?? 0;
  }

  if ((booking.stripe_payment_status ?? "").toLowerCase() === "succeeded") {
    return booking.deposit_cents ?? 0;
  }

  return 0;
}

function getRemainingBalanceCents(booking: BookingRow) {
  const total = booking.total_cents ?? 0;
  const depositPaid = getEffectiveDepositPaidCents(booking);
  const remainingPaid = booking.remaining_paid_cents ?? 0;
  return Math.max(total - depositPaid - remainingPaid, 0);
}

function isToday(iso: string | null | undefined) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isFuture(iso: string | null | undefined) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getTime() > Date.now();
}

function statusPill(status: string | null | undefined) {
  const value = (status ?? "—").toLowerCase();

  let bg = "#1f2937";
  let color = "#e5e7eb";

  if (value === "confirmed") {
    bg = "#052e16";
    color = "#86efac";
  } else if (value === "pending") {
    bg = "#3f2b07";
    color = "#fcd34d";
  } else if (value === "cancelled" || value === "canceled") {
    bg = "#3f1111";
    color = "#fca5a5";
  } else if (value === "no_show") {
    bg = "#3f1111";
    color = "#fca5a5";
  } else if (value === "completed") {
    bg = "#0c4a6e";
    color = "#7dd3fc";
  }

  return (
    <span
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: bg,
        color,
        display: "inline-block",
      }}
    >
      {status ?? "—"}
    </span>
  );
}

function stripePill(status: string | null | undefined) {
  const value = (status ?? "—").toLowerCase();

  let bg = "#1f2937";
  let color = "#e5e7eb";

  if (value === "succeeded") {
    bg = "#052e16";
    color = "#86efac";
  } else if (value === "pending" || value === "processing") {
    bg = "#3f2b07";
    color = "#fcd34d";
  } else if (value === "failed") {
    bg = "#3f1111";
    color = "#fca5a5";
  }

  return (
    <span
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: bg,
        color,
        display: "inline-block",
      }}
    >
      {status ?? "—"}
    </span>
  );
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBookings() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/bookings/list", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load bookings");
      }

      setBookings(normalizeBookings(json.bookings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  const todaysBookings = useMemo(
    () => bookings.filter((b) => isToday(b.start_at)),
    [bookings]
  );

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((b) => isFuture(b.start_at))
        .sort((a, b) => {
          const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
          const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
          return aTime - bTime;
        })
        .slice(0, 8),
    [bookings]
  );

  const todaysProjectedRevenue = useMemo(
    () => todaysBookings.reduce((sum, b) => sum + (b.total_cents ?? 0), 0),
    [todaysBookings]
  );

  const todaysDepositsCollected = useMemo(
    () =>
      todaysBookings.reduce(
        (sum, b) => sum + getEffectiveDepositPaidCents(b),
        0
      ),
    [todaysBookings]
  );

  const pendingBookingsCount = useMemo(
    () =>
      bookings.filter((b) => (b.status ?? "").toLowerCase() === "pending")
        .length,
    [bookings]
  );

  const confirmedBookingsCount = useMemo(
    () =>
      bookings.filter((b) => (b.status ?? "").toLowerCase() === "confirmed")
        .length,
    [bookings]
  );

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0 }}>
        Salon Command Center
      </h1>
      <p style={{ opacity: 0.75, marginTop: 8 }}>
        Edge & Essence admin bookings overview
      </p>

      {loading ? (
        <div style={{ marginTop: 20, opacity: 0.75 }}>Loading bookings...</div>
      ) : null}

      {error ? (
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
          Failed to load bookings: {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <section
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <StatCard
              label="Today's Appointments"
              value={String(todaysBookings.length)}
              subtext="Appointments scheduled today"
            />
            <StatCard
              label="Today's Projected Revenue"
              value={formatMoney(todaysProjectedRevenue)}
              subtext="Based on today's bookings"
            />
            <StatCard
              label="Deposits Collected Today"
              value={formatMoney(todaysDepositsCollected)}
              subtext="Paid deposit total"
            />
            <StatCard
              label="Pending Bookings"
              value={String(pendingBookingsCount)}
              subtext="Need attention"
            />
            <StatCard
              label="Confirmed Bookings"
              value={String(confirmedBookingsCount)}
              subtext="Already secured"
            />
          </section>

          <section
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "1.1fr 2fr",
              gap: 18,
            }}
          >
            <div
              style={{
                border: "1px solid #334155",
                borderRadius: 16,
                padding: 18,
                minHeight: 240,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
                Upcoming Bookings
              </h2>
              <p style={{ marginTop: 8, opacity: 0.7 }}>
                Next {upcomingBookings.length} upcoming appointments
              </p>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {upcomingBookings.length === 0 ? (
                  <div style={{ opacity: 0.7 }}>No upcoming bookings.</div>
                ) : (
                  upcomingBookings.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        border: "1px solid #263244",
                        borderRadius: 12,
                        padding: 12,
                        background: "#0b1220",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>
                        {cleanServiceSummary(b.service_summary)}
                      </div>
                      <div style={{ marginTop: 4, opacity: 0.8, fontSize: 14 }}>
                        {b.client_name || "—"} • {b.stylist?.display_name || "—"}
                      </div>
                      <div style={{ marginTop: 4, opacity: 0.7, fontSize: 13 }}>
                        {formatShortDateTime(b.start_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #334155",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
                All Bookings
              </h2>
              <p style={{ marginTop: 8, opacity: 0.7 }}>
                Full booking list with deposits, remaining balances, and actions
              </p>

              {bookings.length === 0 ? (
                <div style={{ marginTop: 16, opacity: 0.7 }}>
                  No bookings found.
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 16,
                    overflowX: "auto",
                    border: "1px solid #334155",
                    borderRadius: 14,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: 1500,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#0f172a" }}>
                        <th style={thStyle}>Date / Time</th>
                        <th style={thStyle}>Client</th>
                        <th style={thStyle}>Service</th>
                        <th style={thStyle}>Stylist</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Total</th>
                        <th style={thStyle}>Deposit</th>
                        <th style={thStyle}>Deposit Paid</th>
                        <th style={thStyle}>Remaining</th>
                        <th style={thStyle}>Stripe</th>
                        <th style={thStyle}>Policy</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => {
                        const remaining = getRemainingBalanceCents(b);

                        return (
                          <tr key={b.id} style={{ borderTop: "1px solid #334155" }}>
                            <td style={tdStyle}>
                              <div>{formatDateTime(b.start_at)}</div>
                              <div style={{ opacity: 0.65, fontSize: 13 }}>
                                Ends: {formatDateTime(b.end_at)}
                              </div>
                            </td>

                            <td style={tdStyle}>
                              <div style={{ fontWeight: 800 }}>
                                {b.client_name || "—"}
                              </div>
                              <div style={{ opacity: 0.75, fontSize: 13 }}>
                                {b.client_email || "—"}
                              </div>
                              <div style={{ opacity: 0.75, fontSize: 13 }}>
                                {b.client_phone || "—"}
                              </div>
                            </td>

                            <td style={tdStyle}>
                              {cleanServiceSummary(b.service_summary)}
                            </td>

                            <td style={tdStyle}>
                              {b.stylist?.display_name ?? "—"}
                            </td>

                            <td style={tdStyle}>{statusPill(b.status)}</td>

                            <td style={tdStyle}>{formatMoney(b.total_cents)}</td>

                            <td style={tdStyle}>{formatMoney(b.deposit_cents)}</td>

                            <td style={tdStyle}>
                              {formatMoney(getEffectiveDepositPaidCents(b))}
                            </td>

                            <td style={tdStyle}>{formatMoney(remaining)}</td>

                            <td style={tdStyle}>
                              {stripePill(b.stripe_payment_status)}
                            </td>

                            <td style={tdStyle}>
                              {b.late_cancel ? (
                                <div style={{ fontSize: 13, color: "#fca5a5", fontWeight: 800 }}>
                                  Late cancel fee due: {formatMoney(b.cancellation_fee_cents)}
                                </div>
                              ) : b.remaining_paid_method ? (
                                <div style={{ fontSize: 13, color: "#86efac", fontWeight: 800 }}>
                                  Remaining paid via {b.remaining_paid_method}
                                </div>
                              ) : (
                                <span style={{ opacity: 0.7 }}>—</span>
                              )}
                            </td>

                            <td style={tdStyle}>
                              <AdminBookingActions
                                bookingId={b.id}
                                status={b.status}
                                remainingCents={remaining}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: 16,
        padding: 18,
        background: "#0b1220",
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.72 }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900 }}>
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.65 }}>{subtext}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: 14,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  verticalAlign: "top",
  fontSize: 14,
};