"use client";

import { useState, useMemo } from "react";

type CalendarBooking = {
  id: string;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  client_name: string | null;
  service_summary: string | null;
  total_cents: number | null;
  deposit_cents: number | null;
  paid_deposit_cents: number | null;
  stripe_payment_status: string | null;
  remaining_paid_cents: number | null;
  stylist: { id: string; display_name: string } | null;
};

const STYLIST_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  default0: { bg: "rgba(96,165,250,0.15)", border: "#60a5fa", text: "#93c5fd" },
  default1: { bg: "rgba(167,139,250,0.15)", border: "#a78bfa", text: "#c4b5fd" },
  default2: { bg: "rgba(52,211,153,0.15)", border: "#34d399", text: "#6ee7b7" },
  default3: { bg: "rgba(251,191,36,0.15)", border: "#fbbf24", text: "#fcd34d" },
  default4: { bg: "rgba(249,115,22,0.15)", border: "#f97316", text: "#fb923c" },
  default5: { bg: "rgba(236,72,153,0.15)", border: "#ec4899", text: "#f472b6" },
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am to 8pm
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatHour(h: number) {
  if (h === 12) return "12 PM";
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
}

function getWeekDates(referenceDate: Date): Date[] {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1); // start from Monday
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getEffectiveDepositPaid(booking: CalendarBooking) {
  if ((booking.paid_deposit_cents ?? 0) > 0) return booking.paid_deposit_cents ?? 0;
  if ((booking.stripe_payment_status ?? "").toLowerCase() === "succeeded") return booking.deposit_cents ?? 0;
  return 0;
}

function getRemainingCents(booking: CalendarBooking) {
  const total = booking.total_cents ?? 0;
  const depositPaid = getEffectiveDepositPaid(booking);
  const remainingPaid = booking.remaining_paid_cents ?? 0;
  return Math.max(total - depositPaid - remainingPaid, 0);
}

function statusColor(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "confirmed") return "#86efac";
  if (s === "completed") return "#7dd3fc";
  if (s === "no_show") return "#fca5a5";
  if (s.includes("cancel")) return "#fca5a5";
  if (s === "pending") return "#fcd34d";
  return "#94a3b8";
}

// ── Appointment block ─────────────────────────────────────────────────────────

function AppointmentBlock({
  booking,
  color,
  topPct,
  heightPct,
  onClick,
}: {
  booking: CalendarBooking;
  color: { bg: string; border: string; text: string };
  topPct: number;
  heightPct: number;
  onClick: () => void;
}) {
  const isShort = heightPct < 6;
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        top: `${topPct}%`,
        height: `${Math.max(heightPct, 3)}%`,
        left: 2, right: 2,
        background: color.bg,
        border: `1px solid ${color.border}`,
        borderRadius: 6,
        padding: isShort ? "2px 6px" : "5px 8px",
        cursor: "pointer",
        overflow: "hidden",
        zIndex: 2,
        transition: "filter 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.2)")}
      onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
    >
      <div style={{ fontWeight: 800, fontSize: 11, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {booking.client_name || "—"}
      </div>
      {!isShort && (
        <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: color.text }}>
          {booking.service_summary || "—"}
        </div>
      )}
    </div>
  );
}

// ── Booking detail modal ──────────────────────────────────────────────────────

function BookingModal({ booking, onClose }: { booking: CalendarBooking; onClose: () => void }) {
  const start = booking.start_at ? new Date(booking.start_at) : null;
  const end = booking.end_at ? new Date(booking.end_at) : null;
  const remaining = getRemainingCents(booking);

  function fmt(d: Date | null) {
    if (!d) return "—";
    return d.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
      timeZone: "America/Phoenix",
    });
  }

  function fmtTime(d: Date | null) {
    if (!d) return "—";
    return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Phoenix" });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
      <div style={{ position: "relative", background: "#0b1220", border: "1px solid #1e293b", borderRadius: 16, padding: "24px 22px", width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{booking.client_name || "—"}</div>
            <div style={{ fontSize: 13, opacity: 0.55, marginTop: 2 }}>{booking.stylist?.display_name || "—"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: "rgba(0,0,0,0.3)", color: statusColor(booking.status), border: `1px solid ${statusColor(booking.status)}` }}>
              {booking.status ?? "—"}
            </span>
            <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #1e293b", paddingTop: 14 }}>
          <DetailItem icon="💇" label="Service" value={booking.service_summary || "—"} />
          <DetailItem icon="📅" label="Date" value={fmt(start)} />
          <DetailItem icon="⏱" label="Time" value={`${fmtTime(start)} – ${fmtTime(end)}`} />
          <DetailItem icon="💵" label="Total" value={formatMoney(booking.total_cents)} />
          <DetailItem icon="✅" label="Deposit Paid" value={formatMoney(getEffectiveDepositPaid(booking))} />
          <DetailItem
            icon="⏳"
            label="Remaining"
            value={formatMoney(remaining)}
            valueColor={remaining > 0 ? "#fbbf24" : "#86efac"}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 4, padding: "11px", borderRadius: 10, border: "1px solid #1e293b", background: "transparent", color: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <div style={{ display: "flex", gap: 7, alignItems: "center", opacity: 0.55, fontSize: 13 }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <span style={{ fontWeight: 800, fontSize: 13, color: valueColor || "inherit", textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

// ── Main Calendar component ───────────────────────────────────────────────────

export default function CalendarView({ bookings }: { bookings: CalendarBooking[] }) {
  const [view, setView] = useState<"week" | "day">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);

  // Assign colors to stylists
  const stylistColorMap = useMemo(() => {
    const map = new Map<string, typeof STYLIST_COLORS[string]>();
    let i = 0;
    for (const b of bookings) {
      const sid = b.stylist?.id;
      if (sid && !map.has(sid)) {
        map.set(sid, STYLIST_COLORS[`default${i % 6}`]);
        i++;
      }
    }
    return map;
  }, [bookings]);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  // For day view — filter bookings for current day
  const dayBookings = useMemo(() => {
    return bookings.filter(b => {
      if (!b.start_at) return false;
      const d = new Date(b.start_at);
      return sameDay(d, currentDate);
    });
  }, [bookings, currentDate]);

  // For week view — group bookings by day
  const weekBookingsByDay = useMemo(() => {
    return weekDates.map(date =>
      bookings.filter(b => {
        if (!b.start_at) return false;
        const d = new Date(b.start_at);
        return sameDay(d, date);
      })
    );
  }, [bookings, weekDates]);

  // Convert time to % position within the grid (8am=0%, 8pm=100%)
  function timeToPercent(date: Date) {
    const hours = date.getHours() + date.getMinutes() / 60;
    return ((hours - 8) / 12) * 100;
  }

  function prevPeriod() {
    const d = new Date(currentDate);
    if (view === "week") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  }

  function nextPeriod() {
    const d = new Date(currentDate);
    if (view === "week") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  }

  function goToday() { setCurrentDate(new Date()); }

  const today = new Date();

  // ── Time grid (shared between views) ─────────────────────────────────────

  function TimeGrid({ dayBookingsList, dateLabels }: {
    dayBookingsList: CalendarBooking[][];
    dateLabels: Date[];
  }) {
    const GRID_HEIGHT = 600;
    return (
      <div style={{ display: "flex", overflowX: "auto" }}>
        {/* Hour labels */}
        <div style={{ flexShrink: 0, width: 52 }}>
          <div style={{ height: 40 }} /> {/* header spacer */}
          <div style={{ position: "relative", height: GRID_HEIGHT }}>
            {HOURS.map((h, i) => (
              <div key={h} style={{
                position: "absolute",
                top: `${(i / 12) * 100}%`,
                right: 8,
                fontSize: 10,
                opacity: 0.4,
                fontWeight: 700,
                transform: "translateY(-50%)",
                whiteSpace: "nowrap",
              }}>
                {formatHour(h)}
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${dateLabels.length}, minmax(100px, 1fr))`, minWidth: dateLabels.length * 100 }}>
          {dateLabels.map((date, colIdx) => {
            const isToday = sameDay(date, today);
            const colBookings = dayBookingsList[colIdx] ?? [];
            return (
              <div key={colIdx}>
                {/* Day header */}
                <div style={{
                  height: 40, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", borderBottom: "1px solid #1e293b",
                  borderLeft: colIdx > 0 ? "1px solid #1e293b" : "none",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, textTransform: "uppercase" }}>
                    {DAY_LABELS[date.getDay()]}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 900,
                    width: 26, height: 26, borderRadius: "50%",
                    background: isToday ? "#60a5fa" : "transparent",
                    color: isToday ? "#0f172a" : "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {date.getDate()}
                  </div>
                </div>

                {/* Time slots */}
                <div style={{
                  position: "relative", height: GRID_HEIGHT,
                  borderLeft: colIdx > 0 ? "1px solid #1e293b" : "none",
                }}>
                  {/* Hour lines */}
                  {HOURS.map((_, i) => (
                    <div key={i} style={{
                      position: "absolute", top: `${(i / 12) * 100}%`,
                      left: 0, right: 0, borderTop: "1px solid #1e293b", opacity: 0.4,
                    }} />
                  ))}

                  {/* Today highlight */}
                  {isToday && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(96,165,250,0.03)", pointerEvents: "none" }} />
                  )}

                  {/* Appointment blocks */}
                  {colBookings.map((b) => {
                    if (!b.start_at || !b.end_at) return null;
                    const start = new Date(b.start_at);
                    const end = new Date(b.end_at);
                    const topPct = Math.max(timeToPercent(start), 0);
                    const bottomPct = Math.min(timeToPercent(end), 100);
                    const heightPct = bottomPct - topPct;
                    const color = stylistColorMap.get(b.stylist?.id ?? "") ?? STYLIST_COLORS.default0;
                    return (
                      <AppointmentBlock
                        key={b.id}
                        booking={b}
                        color={color}
                        topPct={topPct}
                        heightPct={heightPct}
                        onClick={() => setSelectedBooking(b)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Legend ────────────────────────────────────────────────────────────────

  const uniqueStylists = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of bookings) {
      if (b.stylist?.id && !seen.has(b.stylist.id)) {
        seen.set(b.stylist.id, b.stylist.display_name);
      }
    }
    return Array.from(seen.entries());
  }, [bookings]);

  // ── Render ────────────────────────────────────────────────────────────────

  const periodLabel = view === "week"
    ? `${MONTH_LABELS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[6].getDate()}, ${weekDates[6].getFullYear()}`
    : currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={prevPeriod} style={navBtn}>‹</button>
          <button type="button" onClick={goToday} style={navBtn}>Today</button>
          <button type="button" onClick={nextPeriod} style={navBtn}>›</button>
          <span style={{ fontWeight: 900, fontSize: 16, marginLeft: 6 }}>{periodLabel}</span>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {(["week", "day"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} style={{
              padding: "7px 14px", borderRadius: 8,
              border: `1px solid ${view === v ? "#60a5fa" : "#1e293b"}`,
              background: view === v ? "rgba(96,165,250,0.1)" : "transparent",
              color: view === v ? "#60a5fa" : "#64748b",
              fontWeight: 800, fontSize: 13, cursor: "pointer",
              textTransform: "capitalize",
            }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      {uniqueStylists.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          {uniqueStylists.map(([id, name]) => {
            const color = stylistColorMap.get(id) ?? STYLIST_COLORS.default0;
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color.border }} />
                <span style={{ opacity: 0.8 }}>{name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar grid */}
      <div style={{ border: "1px solid #1e293b", borderRadius: 14, overflow: "hidden", background: "#0b1220" }}>
        {view === "week" && (
          <TimeGrid dayBookingsList={weekBookingsByDay} dateLabels={weekDates} />
        )}
        {view === "day" && (
          <TimeGrid dayBookingsList={[dayBookings]} dateLabels={[currentDate]} />
        )}
      </div>

      {/* No bookings message */}
      {bookings.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, opacity: 0.5, fontSize: 14 }}>
          No bookings to display for this period.
        </div>
      )}

      {/* Booking detail modal */}
      {selectedBooking && (
        <BookingModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8, border: "1px solid #1e293b",
  background: "transparent", color: "inherit", fontWeight: 800,
  fontSize: 13, cursor: "pointer",
};