"use client";

import { useEffect, useMemo, useState } from "react";
import AdminBookingActions from "./AdminBookingActions";
import CalendarView from "./CalendarView";

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
    | { id: string; display_name: string }
    | { id: string; display_name: string }[]
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
  stylist: { id: string; display_name: string } | null;
};

type Tab = "overview" | "bookings" | "calendar";

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
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
    month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
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
      const addonCount = Array.isArray(parsed.addonServiceIds) ? parsed.addonServiceIds.length : 0;
      return addonCount > 0 ? `Service selected + ${addonCount} add-on${addonCount > 1 ? "s" : ""}` : "Service selected";
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
  if ((booking.paid_deposit_cents ?? 0) > 0) return booking.paid_deposit_cents ?? 0;
  if ((booking.stripe_payment_status ?? "").toLowerCase() === "succeeded") return booking.deposit_cents ?? 0;
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
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isFuture(iso: string | null | undefined) {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

function statusPill(status: string | null | undefined) {
  const value = (status ?? "—").toLowerCase();
  let bg = "#1f2937", color = "#e5e7eb";
  if (value === "confirmed") { bg = "#052e16"; color = "#86efac"; }
  else if (value === "pending") { bg = "#3f2b07"; color = "#fcd34d"; }
  else if (["cancelled", "canceled", "cancelled_late", "cancelled_refunded"].includes(value)) { bg = "#3f1111"; color = "#fca5a5"; }
  else if (value === "no_show") { bg = "#3f1111"; color = "#fca5a5"; }
  else if (value === "completed") { bg = "#0c4a6e"; color = "#7dd3fc"; }
  return (
    <span style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: bg, color, display: "inline-block" }}>
      {status ?? "—"}
    </span>
  );
}

function stripePill(status: string | null | undefined) {
  const value = (status ?? "—").toLowerCase();
  let bg = "#1f2937", color = "#e5e7eb";
  if (value === "succeeded") { bg = "#052e16"; color = "#86efac"; }
  else if (["pending", "processing"].includes(value)) { bg = "#3f2b07"; color = "#fcd34d"; }
  else if (value === "failed") { bg = "#3f1111"; color = "#fca5a5"; }
  return (
    <span style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: bg, color, display: "inline-block" }}>
      {status ?? "—"}
    </span>
  );
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "bookings", label: "All Bookings", icon: "📋" },
    { id: "calendar", label: "Calendar", icon: "📅" },
  ];
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 24, borderBottom: "1px solid #1e293b", paddingBottom: 0 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          style={{
            padding: "10px 20px",
            borderRadius: "10px 10px 0 0",
            border: "1px solid",
            borderColor: active === t.id ? "#1e293b" : "transparent",
            borderBottom: active === t.id ? "1px solid #0b1220" : "1px solid transparent",
            background: active === t.id ? "#0b1220" : "transparent",
            color: active === t.id ? "#f1f5f9" : "#64748b",
            fontWeight: active === t.id ? 900 : 700,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginBottom: -1,
            transition: "all 0.15s",
          }}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  async function loadBookings() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/bookings/list", { method: "GET", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load bookings");
      setBookings(normalizeBookings(json.bookings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBookings(); }, []);

  const todaysBookings = useMemo(() => bookings.filter((b) => isToday(b.start_at)), [bookings]);
  const upcomingBookings = useMemo(() =>
    bookings.filter((b) => isFuture(b.start_at))
      .sort((a, b) => new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime())
      .slice(0, 8),
    [bookings]
  );
  const todaysProjectedRevenue = useMemo(() => todaysBookings.reduce((sum, b) => sum + (b.total_cents ?? 0), 0), [todaysBookings]);
  const todaysDepositsCollected = useMemo(() => todaysBookings.reduce((sum, b) => sum + getEffectiveDepositPaidCents(b), 0), [todaysBookings]);
  const pendingBookingsCount = useMemo(() => bookings.filter((b) => (b.status ?? "").toLowerCase() === "pending").length, [bookings]);
  const confirmedBookingsCount = useMemo(() => bookings.filter((b) => (b.status ?? "").toLowerCase() === "confirmed").length, [bookings]);

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>Salon Command Center</h1>
          <p style={{ opacity: 0.55, marginTop: 4, margin: "4px 0 0 0", fontSize: 14 }}>Edge & Essence · Phoenix, AZ</p>
        </div>
        <button
          type="button"
          onClick={loadBookings}
          style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid #1e293b", background: "transparent", color: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
        >
          ↻ Refresh
        </button>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop: 24 }}>
        {loading && <div style={{ opacity: 0.6 }}>Loading bookings...</div>}
        {error && (
          <div style={{ padding: 14, border: "1px solid #7f1d1d", borderRadius: 12, color: "#fecaca", background: "#1f1111" }}>
            Failed to load bookings: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
                  <StatCard label="Today's Appointments" value={String(todaysBookings.length)} subtext="Scheduled today" accent="#60a5fa" />
                  <StatCard label="Projected Revenue Today" value={formatMoney(todaysProjectedRevenue)} subtext="Based on today's bookings" accent="#a78bfa" />
                  <StatCard label="Deposits Collected Today" value={formatMoney(todaysDepositsCollected)} subtext="Paid deposit total" accent="#34d399" />
                  <StatCard label="Pending" value={String(pendingBookingsCount)} subtext="Need attention" accent="#fbbf24" />
                  <StatCard label="Confirmed" value={String(confirmedBookingsCount)} subtext="Secured bookings" accent="#86efac" />
                </div>

                <div style={{ border: "1px solid #1e293b", borderRadius: 16, padding: 20 }}>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 900 }}>Upcoming Appointments</h2>
                  <p style={{ margin: "0 0 16px 0", opacity: 0.55, fontSize: 13 }}>Next {upcomingBookings.length} upcoming</p>
                  {upcomingBookings.length === 0 ? (
                    <div style={{ opacity: 0.5, fontSize: 14 }}>No upcoming bookings.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {upcomingBookings.map((b) => (
                        <div key={b.id} style={{ border: "1px solid #1e293b", borderRadius: 12, padding: "14px 16px", background: "#0b1220", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 15 }}>{b.client_name || "—"}</div>
                            <div style={{ opacity: 0.6, fontSize: 13, marginTop: 2 }}>
                              {cleanServiceSummary(b.service_summary)} · {b.stylist?.display_name || "—"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>{formatShortDateTime(b.start_at)}</div>
                            <div style={{ marginTop: 4 }}>{statusPill(b.status)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ALL BOOKINGS TAB ── */}
            {activeTab === "bookings" && (
              <div>
                <div style={{ marginBottom: 14, fontSize: 14, opacity: 0.55 }}>{bookings.length} total bookings</div>
                {bookings.length === 0 ? (
                  <div style={{ opacity: 0.5 }}>No bookings found.</div>
                ) : (
                  <div style={{ overflowX: "auto", border: "1px solid #1e293b", borderRadius: 14 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1400 }}>
                      <thead>
                        <tr style={{ background: "#0f172a" }}>
                          <th style={thStyle}>Date / Time</th>
                          <th style={thStyle}>Client</th>
                          <th style={thStyle}>Service</th>
                          <th style={thStyle}>Stylist</th>
                          <th style={thStyle}>Status</th>
                          <th style={thStyle}>Total</th>
                          <th style={thStyle}>Deposit</th>
                          <th style={thStyle}>Paid</th>
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
                            <tr key={b.id} style={{ borderTop: "1px solid #1e293b" }}>
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 700 }}>{formatDateTime(b.start_at)}</div>
                                <div style={{ opacity: 0.5, fontSize: 12, marginTop: 2 }}>ends {formatDateTime(b.end_at)}</div>
                              </td>
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 800 }}>{b.client_name || "—"}</div>
                                <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{b.client_email || "—"}</div>
                                <div style={{ opacity: 0.6, fontSize: 12 }}>{b.client_phone || "—"}</div>
                              </td>
                              <td style={tdStyle}>{cleanServiceSummary(b.service_summary)}</td>
                              <td style={tdStyle}>{b.stylist?.display_name ?? "—"}</td>
                              <td style={tdStyle}>{statusPill(b.status)}</td>
                              <td style={tdStyle}>{formatMoney(b.total_cents)}</td>
                              <td style={tdStyle}>{formatMoney(b.deposit_cents)}</td>
                              <td style={tdStyle}>{formatMoney(getEffectiveDepositPaidCents(b))}</td>
                              <td style={tdStyle}>{formatMoney(remaining)}</td>
                              <td style={tdStyle}>{stripePill(b.stripe_payment_status)}</td>
                              <td style={tdStyle}>
                                {b.late_cancel ? (
                                  <div style={{ fontSize: 12, color: "#fca5a5", fontWeight: 800 }}>
                                    Fee: {formatMoney(b.cancellation_fee_cents)}
                                  </div>
                                ) : b.remaining_paid_method ? (
                                  <div style={{ fontSize: 12, color: "#86efac", fontWeight: 800 }}>
                                    Paid via {b.remaining_paid_method}
                                  </div>
                                ) : (
                                  <span style={{ opacity: 0.4 }}>—</span>
                                )}
                              </td>
                              <td style={tdStyle}>
                                <AdminBookingActions bookingId={b.id} status={b.status} remainingCents={remaining} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── CALENDAR TAB ── */}
            {activeTab === "calendar" && (
              <CalendarView
                bookings={bookings.map((b) => ({
                  id: b.id,
                  start_at: b.start_at,
                  end_at: b.end_at,
                  status: b.status,
                  client_name: b.client_name,
                  service_summary: b.service_summary,
                  total_cents: b.total_cents,
                  deposit_cents: b.deposit_cents,
                  paid_deposit_cents: b.paid_deposit_cents,
                  stripe_payment_status: b.stripe_payment_status,
                  remaining_paid_cents: b.remaining_paid_cents,
                  stylist: b.stylist,
                }))}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, subtext, accent }: {
  label: string; value: string; subtext: string; accent: string;
}) {
  return (
    <div style={{ border: "1px solid #1e293b", borderRadius: 14, padding: "18px 20px", background: "#0b1220" }}>
      <div style={{ fontSize: 12, opacity: 0.55, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900, color: accent }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.5 }}>{subtext}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "12px 14px", fontSize: 13, fontWeight: 900,
  whiteSpace: "nowrap", opacity: 0.7,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px", verticalAlign: "top", fontSize: 13,
};