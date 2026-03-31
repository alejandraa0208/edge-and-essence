"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

export type ServiceOption = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
  deposit_cents: number | null;
  category: string | null;
  pricing_note: string | null;
};

type Slot = { time: string; squeeze: boolean };

type CreatePaymentIntentOk = {
  ok: true;
  clientSecret: string;
  paymentIntentId: string;
  depositCents: number;
  totalCents: number;
};

type CreatePaymentIntentErr = { ok?: false; error: string; details?: string };
type CreateBookingOk = { ok: true; booking: unknown };
type CreateBookingErr = { error: string; details?: string };

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function onlyDigits(v: string) { return v.replace(/\D/g, ""); }
function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
function prettyPhone(v: string) {
  const d = onlyDigits(v);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

// ── Inline Calendar ────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function InlineCalendar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const selected = value ? new Date(value + "T00:00:00") : null;

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    if (d < today) return; // no past dates
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    onChange(`${yyyy}-${mm}-${dd}`);
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ background: "#0f1a2e", border: "1px solid #1e293b", borderRadius: 14, padding: 16, userSelect: "none" }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button type="button" onClick={prevMonth} style={navBtnStyle}>‹</button>
        <span style={{ fontWeight: 900, fontSize: 15 }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} style={navBtnStyle}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, opacity: 0.4, padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;

          const thisDate = new Date(viewYear, viewMonth, day);
          thisDate.setHours(0, 0, 0, 0);
          const isPast = thisDate < today;
          const isSelected = selected
            ? selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day
            : false;
          const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

          return (
            <button
              key={i}
              type="button"
              onClick={() => !isPast && selectDay(day)}
              style={{
                padding: "8px 0",
                borderRadius: 8,
                border: isSelected ? "2px solid #60a5fa" : isToday ? "1px solid rgba(96,165,250,0.4)" : "1px solid transparent",
                background: isSelected ? "rgba(96,165,250,0.15)" : "transparent",
                color: isPast ? "rgba(255,255,255,0.2)" : "inherit",
                fontWeight: isSelected || isToday ? 900 : 600,
                fontSize: 13,
                cursor: isPast ? "not-allowed" : "pointer",
                textAlign: "center",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid #1e293b", borderRadius: 8,
  color: "inherit", width: 32, height: 32, cursor: "pointer",
  fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: 900,
};

// ── StepShell ─────────────────────────────────────────────────────────────────

function StepShell({ step, title, subtitle, children }: {
  step: number; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "40px 16px 80px" }}>
      <div style={{ width: "100%", maxWidth: 560, marginBottom: 28, display: "flex", gap: 6 }}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={{ flex: 1, height: 4, borderRadius: 99, background: n <= step ? "#60a5fa" : "rgba(255,255,255,0.08)", transition: "background 0.3s ease" }} />
        ))}
      </div>
      <div style={{ width: "100%", maxWidth: 560, border: "1px solid #1e293b", borderRadius: 20, padding: "32px 28px", background: "#0b1220", boxSizing: "border-box", overflow: "hidden" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 4px 0" }}>{title}</h2>
        {subtitle && <p style={{ margin: "0 0 24px 0", opacity: 0.6, fontSize: 14 }}>{subtitle}</p>}
        {!subtitle && <div style={{ marginBottom: 24 }} />}
        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingForm({ stylistId, stylistName, services }: {
  stylistId: string; stylistName: string; services: ServiceOption[];
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [primaryServiceId, setPrimaryServiceId] = useState<string>(services[0]?.id ?? "");
  const [showAddons, setShowAddons] = useState(false);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [dayDate, setDayDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [piLoading, setPiLoading] = useState(false);
  const [piError, setPiError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [computedDepositCents, setComputedDepositCents] = useState<number>(0);
  const [computedTotalCents, setComputedTotalCents] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reminderOptIn, setReminderOptIn] = useState(true);
  const [reminderPreference, setReminderPreference] = useState<"email" | "text" | "both" | "none">("email");
  const [reminder24h, setReminder24h] = useState(true);
  const [reminder2h, setReminder2h] = useState(true);
  const [noShowConsent, setNoShowConsent] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const primaryService = useMemo(() => services.find((s) => s.id === primaryServiceId) ?? null, [services, primaryServiceId]);

  const addonServices = useMemo(() => {
    const map = new Map(services.map((s) => [s.id, s]));
    return addonIds.map((id) => map.get(id)).filter(Boolean) as ServiceOption[];
  }, [services, addonIds]);

  const totalMinutes = useMemo(() => {
    const base = primaryService?.duration_minutes ?? 0;
    const add = addonServices.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
    return base + add;
  }, [primaryService, addonServices]);

  const totalCents = useMemo(() => {
    const base = primaryService?.price_cents ?? 0;
    const add = addonServices.reduce((sum, s) => sum + (s.price_cents ?? 0), 0);
    return base + add;
  }, [primaryService, addonServices]);

  const depositCents = useMemo(() => primaryService?.deposit_cents ?? 0, [primaryService]);

  const toggleAddon = (id: string) => {
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  useEffect(() => {
    const shouldFetch = step === 2 && !!dayDate && totalMinutes > 0;
    if (!shouldFetch) return;
    setLoadingSlots(true);
    setSlotsError(null);
    setSlots([]);
    setSelectedTime("");
    const url = `/api/availability?stylistId=${encodeURIComponent(stylistId)}&dayDate=${encodeURIComponent(dayDate)}&durationMinutes=${encodeURIComponent(String(totalMinutes))}`;
    fetch(url)
      .then(async (r) => {
        const json = (await r.json()) as { error?: string; slots?: Slot[] };
        if (!r.ok) throw new Error(json?.error ?? `HTTP ${r.status}`);
        return json;
      })
      .then((json) => setSlots(Array.isArray(json.slots) ? json.slots : []))
      .catch((e) => setSlotsError(e instanceof Error ? e.message : "Failed to load availability"))
      .finally(() => setLoadingSlots(false));
  }, [step, dayDate, totalMinutes, stylistId]);

  const categories = useMemo(() => {
    const grouped = new Map<string, ServiceOption[]>();
    for (const s of services) {
      const cat = s.category?.trim() || "Other";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(s);
    }
    return Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b)).map((cat) => ({
      cat,
      items: (grouped.get(cat) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [services]);

  useEffect(() => {
    setClientSecret(null);
    setPaymentIntentId(null);
    setPiError(null);
    setSubmitError(null);
    setSuccessMsg(null);
  }, [primaryServiceId, addonIds, dayDate, selectedTime]);

  useEffect(() => {
    const shouldCreatePI = step === 3 && !!dayDate && !!selectedTime && !!primaryServiceId;
    if (!shouldCreatePI) return;
    if (depositCents <= 0) {
      setComputedDepositCents(0);
      setComputedTotalCents(totalCents);
      setClientSecret(null);
      setPaymentIntentId(null);
      return;
    }
    setPiLoading(true);
    setPiError(null);
    fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stylistId, serviceId: primaryServiceId, dayDate, startTime: selectedTime, addonServiceIds: addonIds }),
    })
      .then(async (r) => {
        const json = (await r.json()) as CreatePaymentIntentOk | CreatePaymentIntentErr;
        if (!r.ok || !("ok" in json) || json.ok !== true) {
          const msg = "error" in json ? json.details || json.error : `HTTP ${r.status}`;
          throw new Error(msg);
        }
        return json;
      })
      .then((json) => {
        setClientSecret(json.clientSecret);
        setPaymentIntentId(json.paymentIntentId);
        setComputedDepositCents(json.depositCents);
        setComputedTotalCents(json.totalCents);
      })
      .catch((e) => setPiError(e instanceof Error ? e.message : "Failed to start Stripe payment"))
      .finally(() => setPiLoading(false));
  }, [step, dayDate, selectedTime, primaryServiceId, stylistId, addonIds, depositCents, totalCents]);

  const canGoNextFromStep1 = !!primaryServiceId;
  const canGoNextFromStep2 = !!dayDate && !!selectedTime;

  const clientInfoValid = useMemo(() => {
    if (!clientName.trim()) return false;
    if (!isEmail(clientEmail)) return false;
    if (onlyDigits(clientPhone).length < 10) return false;
    if (!noShowConsent) return false;
    return true;
  }, [clientName, clientEmail, clientPhone, noShowConsent]);

  const reminderPayload = { reminderOptIn, reminderPreference, reminder24h, reminder2h };

  // ── STEP 1 ──────────────────────────────────────────────────────────────────
  if (step === 1) return (
    <StepShell step={1} title={`Book with ${stylistName}`} subtitle="Choose your service to get started">
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14, opacity: 0.7 }}>Service</span>
        <select
          value={primaryServiceId}
          onChange={(e) => setPrimaryServiceId(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 12, border: "1px solid #1e293b", background: "#0f1a2e", color: "inherit", fontSize: 15 }}
        >
          {categories.map(({ cat, items }) => (
            <optgroup key={cat} label={cat}>
              {items.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {primaryService && (
        <div style={{ marginTop: 12, padding: "13px 16px", borderRadius: 12, border: "1px solid #1e293b", background: "#0f1a2e", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{primaryService.name}</div>
            <div style={{ fontSize: 13, opacity: 0.55, marginTop: 2 }}>
              {primaryService.duration_minutes} min{primaryService.pricing_note ? ` · ${primaryService.pricing_note}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>{formatMoney(primaryService.price_cents) || "—"}</div>
            {(primaryService.deposit_cents ?? 0) > 0 && (
              <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>{formatMoney(primaryService.deposit_cents)} deposit</div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={() => setShowAddons((v) => !v)}
          style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #1e293b", background: "transparent", color: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          {showAddons ? "− Hide add-ons" : "+ Add services"}
        </button>
      </div>

      {showAddons && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {categories.map(({ cat, items }) => (
            <div key={cat} style={{ border: "1px solid #1e293b", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 11, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.12em" }}>{cat}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {items.filter((s) => s.id !== primaryServiceId).map((s) => {
                  const checked = addonIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleAddon(s.id)} style={{
                      textAlign: "left", padding: "12px", borderRadius: 10,
                      border: checked ? "2px solid #60a5fa" : "1px solid #334155",
                      background: checked ? "rgba(96,165,250,0.06)" : "transparent",
                      color: "inherit", cursor: "pointer", fontWeight: 800,
                      display: "flex", justifyContent: "space-between", gap: 12,
                    }}>
                      <span>{s.name} <span style={{ opacity: 0.55, fontWeight: 600 }}>({s.duration_minutes} min)</span></span>
                      <span style={{ opacity: 0.85 }}>{s.price_cents != null ? `+${formatMoney(s.price_cents)}` : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 13, opacity: 0.5, fontWeight: 700 }}>Total time: {totalMinutes} min</div>

      <button type="button" onClick={() => setStep(2)} disabled={!canGoNextFromStep1} style={primaryBtnStyle(!canGoNextFromStep1)}>
        Pick a date & time →
      </button>
    </StepShell>
  );

  // ── STEP 2 ──────────────────────────────────────────────────────────────────
  if (step === 2) return (
    <StepShell step={2} title="Pick a date & time" subtitle={`${primaryService?.name ?? "Service"} · ${totalMinutes} min`}>

      {/* Inline calendar */}
      <InlineCalendar value={dayDate} onChange={(d) => { setDayDate(d); setSelectedTime(""); }} />

      {/* Time slots */}
      <div style={{ marginTop: 20 }}>
        {!dayDate && (
          <div style={{ opacity: 0.5, fontSize: 14 }}>Select a date above to see available times.</div>
        )}
        {dayDate && loadingSlots && (
          <div style={{ opacity: 0.6, fontSize: 14 }}>Loading times…</div>
        )}
        {dayDate && slotsError && (
          <div style={{ color: "#fca5a5", fontWeight: 800 }}>{slotsError}</div>
        )}
        {dayDate && !loadingSlots && !slotsError && (
          <>
            <div style={{ fontWeight: 800, fontSize: 14, opacity: 0.6, marginBottom: 12 }}>
              Available times for {dayDate}
            </div>
            {slots.length === 0
              ? <div style={{ opacity: 0.5, fontSize: 14 }}>No times available for this date.</div>
              : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {slots.map((s) => {
                    const active = selectedTime === s.time;
                    return (
                      <button
                        key={s.time + (s.squeeze ? "-sq" : "")}
                        type="button"
                        onClick={() => setSelectedTime(s.time)}
                        style={{
                          padding: "12px 16px", borderRadius: 10,
                          border: active ? "2px solid #60a5fa" : "1px solid #1e293b",
                          background: active ? "rgba(96,165,250,0.1)" : "#0f1a2e",
                          color: "inherit", fontWeight: 800, cursor: "pointer", fontSize: 14,
                        }}
                      >
                        {s.time}{s.squeeze ? " (Squeeze-in)" : ""}
                      </button>
                    );
                  })}
                </div>
              )
            }
          </>
        )}
      </div>

      <div style={{ marginTop: 28, display: "flex", gap: 10 }}>
        <button type="button" onClick={() => setStep(1)} style={backBtnStyle}>← Back</button>
        <button type="button" onClick={() => setStep(3)} disabled={!canGoNextFromStep2}
          style={{ ...primaryBtnStyle(!canGoNextFromStep2), marginTop: 0, flex: 3 }}>
          Your info →
        </button>
      </div>
    </StepShell>
  );

  // ── STEP 3 ──────────────────────────────────────────────────────────────────
  return (
    <StepShell step={3} title="Your info + deposit" subtitle={`${primaryService?.name ?? ""} · ${dayDate} at ${selectedTime}`}>

      <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #1e293b", background: "#0f1a2e", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
          <span>Total</span>
          <span>{formatMoney(computedTotalCents || totalCents)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, opacity: 0.65, fontSize: 14 }}>
          <span>Deposit due now</span>
          <span>{formatMoney(computedDepositCents || depositCents)}</span>
        </div>
        {primaryService?.pricing_note && (
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.55 }}>{primaryService.pricing_note}</div>
        )}
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 14, opacity: 0.7 }}>Full name</span>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Your name" style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 14, opacity: 0.7 }}>Email</span>
          <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="you@email.com" style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 14, opacity: 0.7 }}>Phone</span>
          <input value={clientPhone} onChange={(e) => setClientPhone(prettyPhone(e.target.value))} placeholder="(520) 555-1234" style={inputStyle} />
        </label>
      </div>

      <div style={{ marginTop: 22, border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 900, marginBottom: 12 }}>Appointment reminders</div>
        <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.55, marginBottom: 10 }}>How should we reach you?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["email", "text", "both", "none"] as const).map((opt) => (
            <button key={opt} type="button"
              onClick={() => { setReminderPreference(opt); setReminderOptIn(opt !== "none"); }}
              style={{
                padding: "9px 16px", borderRadius: 9,
                border: reminderPreference === opt ? "2px solid #60a5fa" : "1px solid #1e293b",
                background: reminderPreference === opt ? "rgba(96,165,250,0.1)" : "#0f1a2e",
                color: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer",
              }}
            >
              {opt === "text" ? "SMS" : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>

        {reminderPreference !== "none" && (
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.55 }}>When?</div>
            {[
              { key: "24h", checked: reminder24h, set: setReminder24h, label: "24 hours before", sub: "A day-ahead heads-up so you can plan" },
              { key: "2h", checked: reminder2h, set: setReminder2h, label: "2 hours before", sub: "Final reminder so you're never late" },
            ].map(({ key, checked, set, label, sub }) => (
              <label key={key} style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10,
                border: `1px solid ${checked ? "#60a5fa" : "#1e293b"}`,
                background: checked ? "rgba(96,165,250,0.06)" : "#0f1a2e",
                cursor: "pointer", userSelect: "none",
              }}>
                <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer" }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{label}</div>
                  <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>{sub}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 10,
          border: `1px solid ${noShowConsent ? "#f97316" : "#1e293b"}`,
          background: noShowConsent ? "rgba(249,115,22,0.06)" : "#0f1a2e",
          cursor: "pointer", userSelect: "none",
        }}>
          <input type="checkbox" checked={noShowConsent} onChange={(e) => setNoShowConsent(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>
              I agree to the no-show & late cancellation policy <span style={{ color: "#f97316" }}>*</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4, lineHeight: 1.5 }}>
              Cancellations within 24 hours or no-shows may be charged up to the full service amount using the card on file.
            </div>
          </div>
        </label>
        {!noShowConsent && (
          <div style={{ marginTop: 5, fontSize: 12, opacity: 0.45, paddingLeft: 4 }}>Required to complete your booking.</div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        {piLoading && <div style={{ opacity: 0.6, fontSize: 14 }}>Starting secure payment…</div>}
        {piError && <div style={{ color: "#fca5a5", fontWeight: 800, fontSize: 14 }}>{piError}</div>}

        {(computedDepositCents || depositCents) <= 0 ? (
          <NoDepositConfirm
            disabled={!clientInfoValid || submitting}
            submitting={submitting}
            onConfirm={async () => {
              try {
                setSubmitting(true);
                setSubmitError(null);
                setSuccessMsg(null);
                const r = await fetch("/api/bookings/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    stylistId, serviceId: primaryServiceId, dayDate, startTime: selectedTime,
                    clientName: clientName.trim(), clientEmail: clientEmail.trim(), clientPhone: onlyDigits(clientPhone),
                    addonServiceIds: addonIds, notes: "", stripePaymentIntentId: null,
                    depositCents: computedDepositCents || depositCents, totalCents: computedTotalCents || totalCents,
                    ...reminderPayload,
                  }),
                });
                const json = (await r.json()) as CreateBookingOk | CreateBookingErr;
                if (!r.ok || "error" in json) throw new Error("error" in json ? json.details || json.error : `HTTP ${r.status}`);
                setSuccessMsg("Booking confirmed.");
              } catch (e) {
                setSubmitError(e instanceof Error ? e.message : "Failed to create booking.");
              } finally {
                setSubmitting(false);
              }
            }}
          />
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
            <StripePayAndBook
              disabled={!clientInfoValid || submitting}
              submitting={submitting}
              setSubmitting={setSubmitting}
              setSubmitError={setSubmitError}
              setSuccessMsg={setSuccessMsg}
              payload={{
                stylistId, serviceId: primaryServiceId, dayDate, startTime: selectedTime,
                clientName: clientName.trim(), clientEmail: clientEmail.trim(), clientPhone: onlyDigits(clientPhone),
                addonServiceIds: addonIds, depositCents: computedDepositCents || depositCents,
                totalCents: computedTotalCents || totalCents, paymentIntentId,
                ...reminderPayload,
              }}
            />
          </Elements>
        ) : (
          <div style={{ opacity: 0.5, fontSize: 14, marginTop: 8 }}>
            Payment isn't ready yet. If this stays stuck, go back and re-select the time.
          </div>
        )}
      </div>

      {submitError && <div style={{ marginTop: 12, color: "#fca5a5", fontWeight: 800, fontSize: 14 }}>{submitError}</div>}
      {successMsg && <div style={{ marginTop: 12, color: "#86efac", fontWeight: 900 }}>{successMsg}</div>}

      <div style={{ marginTop: 20 }}>
        <button type="button" onClick={() => setStep(2)} style={backBtnStyle}>← Back</button>
      </div>
    </StepShell>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "13px 14px",
  borderRadius: 12, border: "1px solid #1e293b",
  background: "#0f1a2e", color: "inherit", fontSize: 15,
};

const backBtnStyle: React.CSSProperties = {
  padding: "12px 18px", borderRadius: 10, border: "1px solid #1e293b",
  background: "transparent", color: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer",
};

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    marginTop: 24, width: "100%", padding: "15px", borderRadius: 12, border: "none",
    background: disabled ? "#1e293b" : "#60a5fa",
    color: disabled ? "#475569" : "#0f172a",
    fontWeight: 900, fontSize: 16,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.2s", boxSizing: "border-box",
  };
}

// ── NoDepositConfirm ──────────────────────────────────────────────────────────

function NoDepositConfirm(props: { disabled: boolean; submitting: boolean; onConfirm: () => Promise<void> }) {
  return (
    <button type="button" onClick={() => void props.onConfirm()} disabled={props.disabled}
      style={{ marginTop: 8, padding: "15px", borderRadius: 12, border: "none", width: "100%", boxSizing: "border-box",
        background: props.disabled ? "#1e293b" : "#60a5fa", color: props.disabled ? "#475569" : "#0f172a",
        fontWeight: 900, fontSize: 16, cursor: props.disabled ? "not-allowed" : "pointer" }}>
      {props.submitting ? "Booking…" : "Confirm booking"}
    </button>
  );
}

// ── StripePayAndBook ──────────────────────────────────────────────────────────

function StripePayAndBook(props: {
  disabled: boolean; submitting: boolean;
  setSubmitting: (v: boolean) => void; setSubmitError: (v: string | null) => void; setSuccessMsg: (v: string | null) => void;
  payload: {
    stylistId: string; serviceId: string; dayDate: string; startTime: string;
    clientName: string; clientEmail: string; clientPhone: string; addonServiceIds: string[];
    depositCents: number; totalCents: number; paymentIntentId: string | null;
    reminderOptIn: boolean; reminderPreference: "email" | "text" | "both" | "none";
    reminder24h: boolean; reminder2h: boolean;
  };
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handlePayAndBook = async () => {
    try {
      props.setSubmitting(true);
      props.setSubmitError(null);
      props.setSuccessMsg(null);
      if (!stripe || !elements) throw new Error("Stripe not ready yet.");
      const result = await stripe.confirmPayment({ elements, redirect: "if_required" });
      if (result.error) throw new Error(result.error.message || "Payment failed.");
      const r = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stylistId: props.payload.stylistId, serviceId: props.payload.serviceId,
          dayDate: props.payload.dayDate, startTime: props.payload.startTime,
          clientName: props.payload.clientName, clientEmail: props.payload.clientEmail,
          clientPhone: props.payload.clientPhone, addonServiceIds: props.payload.addonServiceIds,
          notes: "", stripePaymentIntentId: props.payload.paymentIntentId,
          depositCents: props.payload.depositCents, totalCents: props.payload.totalCents,
          reminderOptIn: props.payload.reminderOptIn, reminderPreference: props.payload.reminderPreference,
          reminder24h: props.payload.reminder24h, reminder2h: props.payload.reminder2h,
        }),
      });
      const json = (await r.json()) as CreateBookingOk | CreateBookingErr;
      if (!r.ok || "error" in json) throw new Error("error" in json ? json.details || json.error : `HTTP ${r.status}`);
      props.setSuccessMsg("Deposit paid. Booking confirmed.");
    } catch (e) {
      props.setSubmitError(e instanceof Error ? e.message : "Payment or booking failed.");
    } finally {
      props.setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ border: "1px solid #1e293b", borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <PaymentElement />
      </div>
      <button type="button" onClick={() => void handlePayAndBook()} disabled={props.disabled || props.submitting}
        style={{ padding: "15px", borderRadius: 12, border: "none", width: "100%", boxSizing: "border-box",
          background: props.disabled || props.submitting ? "#1e293b" : "#60a5fa",
          color: props.disabled || props.submitting ? "#475569" : "#0f172a",
          fontWeight: 900, fontSize: 16, cursor: props.disabled || props.submitting ? "not-allowed" : "pointer" }}>
        {props.submitting ? "Processing…" : "Pay deposit + book"}
      </button>
    </div>
  );
}