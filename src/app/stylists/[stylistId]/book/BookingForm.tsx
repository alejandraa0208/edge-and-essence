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
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function prettyPhone(v: string) {
  const d = onlyDigits(v);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

export default function BookingForm({
  stylistId,
  stylistName,
  services,
}: {
  stylistId: string;
  stylistName: string;
  services: ServiceOption[];
}) {
  // Step flow (A): service -> date/time -> client info + deposit
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [primaryServiceId, setPrimaryServiceId] = useState<string>(services[0]?.id ?? "");

  // additional services (optional)
  const [showAddons, setShowAddons] = useState(false);
  const [addonIds, setAddonIds] = useState<string[]>([]);

  // date/time
  const [dayDate, setDayDate] = useState<string>(""); // MUST be YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState<string>("");

  // availability
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // STEP 3 client info
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // Stripe + pricing state
  const [piLoading, setPiLoading] = useState(false);
  const [piError, setPiError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [computedDepositCents, setComputedDepositCents] = useState<number>(0);
  const [computedTotalCents, setComputedTotalCents] = useState<number>(0);

  // Booking submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [reminderOptIn, setReminderOptIn] = useState(true);
  const [reminderPreference, setReminderPreference] = useState<"email" | "text" | "both" | "none">("email");

  const primaryService = useMemo(
    () => services.find((s) => s.id === primaryServiceId) ?? null,
    [services, primaryServiceId]
  );

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

  const depositCents = useMemo(() => {
    // Usually you only collect deposit for primary. If you want add-on deposits too,
    // switch to primary + addons sum.
    const base = primaryService?.deposit_cents ?? 0;
    return base;
  }, [primaryService]);

  const toggleAddon = (id: string) => {
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Only fetch slots on Step 2 when dayDate exists and we have a duration
  useEffect(() => {
    const shouldFetch = step === 2 && !!dayDate && totalMinutes > 0;
    if (!shouldFetch) return;

    setLoadingSlots(true);
    setSlotsError(null);
    setSlots([]);
    setSelectedTime("");

    const url =
      `/api/availability?` +
      `stylistId=${encodeURIComponent(stylistId)}` +
      `&dayDate=${encodeURIComponent(dayDate)}` +
      `&durationMinutes=${encodeURIComponent(String(totalMinutes))}`;

    fetch(url)
      .then(async (r) => {
        const json = (await r.json()) as { error?: string; slots?: Slot[] };
        if (!r.ok) throw new Error(json?.error ? `${json.error}` : `HTTP ${r.status}`);
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
    const sortedCats = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
    return sortedCats.map((cat) => ({
      cat,
      items: (grouped.get(cat) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [services]);

  // Reset Stripe state when selection changes (prevents stale clientSecret)
  useEffect(() => {
    setClientSecret(null);
    setPaymentIntentId(null);
    setPiError(null);
    setSubmitError(null);
    setSuccessMsg(null);
  }, [primaryServiceId, addonIds, dayDate, selectedTime]);

  // When we enter Step 3, create a PaymentIntent (only if deposit > 0)
  useEffect(() => {
    const shouldCreatePI = step === 3 && !!dayDate && !!selectedTime && !!primaryServiceId;
    if (!shouldCreatePI) return;

    // If no deposit required, skip Stripe entirely
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
      body: JSON.stringify({
        stylistId,
        serviceId: primaryServiceId,
        dayDate,
        startTime: selectedTime,
        // You can also send addonIds if your server wants it, but not required
        addonServiceIds: addonIds,
      }),
    })
      .then(async (r) => {
        const json = (await r.json()) as CreatePaymentIntentOk | CreatePaymentIntentErr;
        if (!r.ok) {
          const msg =
            "error" in json ? json.details || json.error : `HTTP ${r.status}`;
          throw new Error(msg);
        }
        if (!("ok" in json) || json.ok !== true) {
          const msg = "error" in json ? json.details || json.error : "Failed to create payment intent";
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
    return true;
  }, [clientName, clientEmail, clientPhone]);

  // --- UI ---
  return (
    <section style={{ marginTop: 18 }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Book with {stylistName}</h1>

      {/* STEP 1 */}
      {step === 1 ? (
        <div style={{ marginTop: 20, maxWidth: 780 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 12px 0" }}>Select a service</h2>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 800 }}>Service</span>
            <select
              value={primaryServiceId}
              onChange={(e) => setPrimaryServiceId(e.target.value)}
              style={{
                padding: "14px 14px",
                borderRadius: 14,
                border: "1px solid #334155",
                background: "transparent",
                color: "inherit",
                fontSize: 18,
              }}
            >
              {categories.map(({ cat, items }) => (
                <optgroup key={cat} label={cat}>
                  {items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {/* price display */}
          <div style={{ marginTop: 14, opacity: 0.9 }}>
            <div style={{ fontWeight: 900 }}>Price</div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>
              {formatMoney(primaryService?.price_cents ?? null) || " "}
              <span style={{ fontSize: 18, fontWeight: 700, opacity: 0.8, marginLeft: 12 }}>
                Deposit: {formatMoney(primaryService?.deposit_cents ?? 0) || "$0.00"}
              </span>
            </div>
            {primaryService?.pricing_note ? (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 14 }}>{primaryService.pricing_note}</div>
            ) : null}
          </div>

          {/* Add services button (toggles list) */}
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setShowAddons((v) => !v)}
              style={{
                padding: "14px 18px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                fontWeight: 900,
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              {showAddons ? "Hide add-ons" : "Add services"}
            </button>
          </div>

          {showAddons ? (
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {categories.map(({ cat, items }) => (
                <div key={cat} style={{ border: "1px solid #334155", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>{cat}</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {items
                      .filter((s) => s.id !== primaryServiceId)
                      .map((s) => {
                        const checked = addonIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleAddon(s.id)}
                            style={{
                              textAlign: "left",
                              padding: "12px 12px",
                              borderRadius: 12,
                              border: checked ? "2px solid #60a5fa" : "1px solid #334155",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                              fontWeight: 800,
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <span>
                              {s.name}{" "}
                              <span style={{ opacity: 0.75, fontWeight: 700 }}>
                                ({s.duration_minutes} min)
                              </span>
                            </span>
                            <span style={{ opacity: 0.85 }}>
                              {s.price_cents != null ? `+${formatMoney(s.price_cents)}` : ""}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: 16, opacity: 0.8, fontWeight: 800 }}>
            Total time: {totalMinutes} min
          </div>

          <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canGoNextFromStep1}
              style={{
                padding: "14px 22px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                fontWeight: 900,
                fontSize: 18,
                cursor: !canGoNextFromStep1 ? "not-allowed" : "pointer",
                opacity: !canGoNextFromStep1 ? 0.6 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {/* STEP 2 */}
      {step === 2 ? (
        <div style={{ marginTop: 20, maxWidth: 780 }}>
          <button
            type="button"
            onClick={() => setStep(1)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              opacity: 0.85,
              fontWeight: 800,
              padding: 0,
            }}
          >
            ← Back
          </button>

          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "14px 0 12px 0" }}>Pick a date and time</h2>

          <label style={{ display: "grid", gap: 8, maxWidth: 320 }}>
            <span style={{ fontWeight: 800 }}>Date</span>
            <input
              type="date"
              value={dayDate}
              onChange={(e) => setDayDate(e.target.value)}
              style={{
                padding: "14px 14px",
                borderRadius: 14,
                border: "1px solid #334155",
                background: "transparent",
                color: "inherit",
                fontSize: 18,
              }}
            />
          </label>

          <div style={{ marginTop: 14 }}>
            {dayDate ? (
              <>
                {loadingSlots ? <div style={{ opacity: 0.8 }}>Loading times…</div> : null}
                {slotsError ? <div style={{ color: "#fca5a5", fontWeight: 800 }}>{slotsError}</div> : null}

                {!loadingSlots && !slotsError && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                    {slots.map((s) => {
                      const active = selectedTime === s.time;
                      return (
                        <button
                          key={s.time + (s.squeeze ? "-sq" : "")}
                          type="button"
                          onClick={() => setSelectedTime(s.time)}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 12,
                            border: active ? "2px solid #60a5fa" : "1px solid #334155",
                            background: "transparent",
                            color: "inherit",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          {s.time}
                          {s.squeeze ? " (Squeeze-in)" : ""}
                        </button>
                      );
                    })}
                    {slots.length === 0 && !loadingSlots ? (
                      <div style={{ opacity: 0.75, marginTop: 8 }}>No times available.</div>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.75 }}>Select a date to see times.</div>
            )}
          </div>

          <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                padding: "14px 22px",
                borderRadius: 14,
                border: "1px solid #334155",
                background: "transparent",
                color: "inherit",
                fontWeight: 900,
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!canGoNextFromStep2}
              style={{
                padding: "14px 22px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                fontWeight: 900,
                fontSize: 18,
                cursor: !canGoNextFromStep2 ? "not-allowed" : "pointer",
                opacity: !canGoNextFromStep2 ? 0.6 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {/* STEP 3 */}
      {step === 3 ? (
        <div style={{ marginTop: 20, maxWidth: 780 }}>
          <button
            type="button"
            onClick={() => setStep(2)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              opacity: 0.85,
              fontWeight: 800,
              padding: 0,
            }}
          >
            ← Back
          </button>

          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "14px 0 12px 0" }}>Your info + deposit</h2>

          <div style={{ opacity: 0.8, lineHeight: 1.7 }}>
            Selected date: <b>{dayDate}</b>
            <br />
            Selected time: <b>{selectedTime}</b>
            <br />
            Total time: <b>{totalMinutes} min</b>
          </div>

          {/* Totals */}
          <div
            style={{
              marginTop: 14,
              border: "1px solid #334155",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
              <span>Total</span>
              <span>{formatMoney(computedTotalCents || totalCents)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, opacity: 0.9 }}>
              <span>Deposit due now</span>
              <span>{formatMoney(computedDepositCents || depositCents)}</span>
            </div>
            {primaryService?.pricing_note ? (
              <div style={{ marginTop: 10, opacity: 0.75, fontSize: 14 }}>{primaryService.pricing_note}</div>
            ) : null}
          </div>

          {/* Client fields */}
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Full name</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Your name"
                style={{
                  padding: "14px 14px",
                  borderRadius: 14,
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "inherit",
                  fontSize: 16,
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Email</span>
              <input
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="you@email.com"
                style={{
                  padding: "14px 14px",
                  borderRadius: 14,
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "inherit",
                  fontSize: 16,
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Phone</span>
              <input
                value={clientPhone}
                onChange={(e) => setClientPhone(prettyPhone(e.target.value))}
                placeholder="(520) 555-1234"
                style={{
                  padding: "14px 14px",
                  borderRadius: 14,
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "inherit",
                  fontSize: 16,
                }}
              />
            </label>
          </div>

          <div style={{ marginTop: 18 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={reminderOptIn}
                onChange={(e) => setReminderOptIn(e.target.checked)}
              />
              Send me reminders about this appointment
            </label>

          {reminderOptIn ? (
             <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Reminder method</div>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
             <input
              type="radio"
              name="reminderPreference"
              checked={reminderPreference === "email"}
              onChange={() => setReminderPreference("email")}
            />
            Email
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="radio"
                name="reminderPreference"
                checked={reminderPreference === "text"}
                onChange={() => setReminderPreference("text")}
              />
              Text
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="radio"
                name="reminderPreference"
                checked={reminderPreference === "both"}
                onChange={() => setReminderPreference("both")}
              />
              Both
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="radio"
                name="reminderPreference"
                checked={reminderPreference === "none"}
                onChange={() => setReminderPreference("none")}
              />
              None
            </label>
            </div>
          ) : null}
            </div>

          {/* Stripe */}
          <div style={{ marginTop: 16 }}>
            {piLoading ? <div style={{ opacity: 0.8 }}>Starting secure payment…</div> : null}
            {piError ? <div style={{ color: "#fca5a5", fontWeight: 800 }}>{piError}</div> : null}

            {/* No deposit: skip stripe */}
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
                        stylistId,
                        serviceId: primaryServiceId,
                        dayDate,
                        startTime: selectedTime,
                        clientName: clientName.trim(),
                        clientEmail: clientEmail.trim(),
                        clientPhone: onlyDigits(clientPhone),
                        addonServiceIds: addonIds,
                        notes: "",
                        stripePaymentIntentId: null,
                        depositCents: computedDepositCents || depositCents,
                        totalCents: computedTotalCents || totalCents,
                      }),
                    });

                    const json = (await r.json()) as CreateBookingOk | CreateBookingErr;
                    if (!r.ok || "error" in json) {
                      const msg = "error" in json ? json.details || json.error : `HTTP ${r.status}`;
                      throw new Error(msg);
                    }

                    setSuccessMsg("Booking confirmed.");
                  } catch (e) {
                    setSubmitError(e instanceof Error ? e.message : "Failed to create booking.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              />
            ) : clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: { theme: "night" },
                }}
              >
                <StripePayAndBook
                  disabled={!clientInfoValid || submitting}
                  submitting={submitting}
                  setSubmitting={setSubmitting}
                  setSubmitError={setSubmitError}
                  setSuccessMsg={setSuccessMsg}
                  payload={{
                    stylistId,
                    serviceId: primaryServiceId,
                    dayDate,
                    startTime: selectedTime,
                    clientName: clientName.trim(),
                    clientEmail: clientEmail.trim(),
                    clientPhone: onlyDigits(clientPhone),
                    addonServiceIds: addonIds,
                    depositCents: computedDepositCents || depositCents,
                    totalCents: computedTotalCents || totalCents,
                    paymentIntentId,
                  }}
                />
              </Elements>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.75 }}>
                Payment isn’t ready yet. If this stays stuck, go back and re-select the time.
              </div>
            )}
          </div>

          {submitError ? <div style={{ marginTop: 12, color: "#fca5a5", fontWeight: 800 }}>{submitError}</div> : null}
          {successMsg ? <div style={{ marginTop: 12, color: "#86efac", fontWeight: 900 }}>{successMsg}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

function NoDepositConfirm(props: {
  disabled: boolean;
  submitting: boolean;
  onConfirm: () => Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void props.onConfirm()}
      disabled={props.disabled}
      style={{
        marginTop: 14,
        padding: "14px 18px",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        background: "white",
        color: "#111827",
        fontWeight: 900,
        fontSize: 18,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        width: "100%",
      }}
    >
      {props.submitting ? "Booking…" : "Confirm booking"}
    </button>
  );
}

function StripePayAndBook(props: {
  disabled: boolean;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  setSubmitError: (v: string | null) => void;
  setSuccessMsg: (v: string | null) => void;
  payload: {
    stylistId: string;
    serviceId: string;
    dayDate: string;
    startTime: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    addonServiceIds: string[];
    depositCents: number;
    totalCents: number;
    paymentIntentId: string | null;
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

      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (result.error) throw new Error(result.error.message || "Payment failed.");

      // Booking create after payment confirmation
      const r = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stylistId: props.payload.stylistId,
          serviceId: props.payload.serviceId,
          dayDate: props.payload.dayDate,
          startTime: props.payload.startTime,
          clientName: props.payload.clientName,
          clientEmail: props.payload.clientEmail,
          clientPhone: props.payload.clientPhone,
          addonServiceIds: props.payload.addonServiceIds,
          notes: "",
          stripePaymentIntentId: props.payload.paymentIntentId,
          depositCents: props.payload.depositCents,
          totalCents: props.payload.totalCents,
        }),
      });

      const json = (await r.json()) as CreateBookingOk | CreateBookingErr;
      if (!r.ok || "error" in json) {
        const msg = "error" in json ? json.details || json.error : `HTTP ${r.status}`;
        throw new Error(msg);
      }

      props.setSuccessMsg("Deposit paid. Booking confirmed.");
    } catch (e) {
      props.setSubmitError(e instanceof Error ? e.message : "Payment or booking failed.");
    } finally {
      props.setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          border: "1px solid #334155",
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <PaymentElement />
      </div>

      <button
        type="button"
        onClick={() => void handlePayAndBook()}
        disabled={props.disabled || props.submitting}
        style={{
          padding: "14px 18px",
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          background: "white",
          color: "#111827",
          fontWeight: 900,
          fontSize: 18,
          cursor: props.disabled || props.submitting ? "not-allowed" : "pointer",
          opacity: props.disabled || props.submitting ? 0.6 : 1,
          width: "100%",
        }}
      >
        {props.submitting ? "Processing…" : "Pay deposit + book"}
      </button>
    </div>
  );
}




