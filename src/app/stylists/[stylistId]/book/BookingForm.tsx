"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function BookingForm({
  stylistId,
  stylistName,
  services,
}: {
  stylistId: string;
  stylistName: string;
  services: ServiceOption[];
}) {
  // Step flow (A): service -> date/time -> client info
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [primaryServiceId, setPrimaryServiceId] = useState<string>(
    services[0]?.id ?? ""
  );

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

  const formatMoney = (cents: number | null | undefined) => {
    if (cents == null) return "";
    return (cents / 100).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });
  };

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
        const json = await r.json();
        if (!r.ok) {
          throw new Error(json?.error ? `${json.error}` : `HTTP ${r.status}`);
        }
        return json;
      })
      .then((json) => {
        // expects { slots: [{ time: "11:00 AM", squeeze: false }, ...] }
        setSlots(Array.isArray(json.slots) ? json.slots : []);
      })
      .catch((e) => setSlotsError(e?.message ?? "Failed to load availability"))
      .finally(() => setLoadingSlots(false));
  }, [step, dayDate, totalMinutes, stylistId]);

  const categories = useMemo(() => {
    // group services by category for the primary dropdown + add-ons list
    const grouped = new Map<string, ServiceOption[]>();
    for (const s of services) {
      const cat = s.category?.trim() || "Other";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(s);
    }
    // sort categories and services
    const sortedCats = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
    return sortedCats.map((cat) => ({
      cat,
      items: (grouped.get(cat) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [services]);

  // --- UI ---
  return (
    <section style={{ marginTop: 18 }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>
        Book with {stylistName}
      </h1>

      {/* STEP 1 */}
      {step === 1 ? (
        <div style={{ marginTop: 20, maxWidth: 780 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 12px 0" }}>
            Select a service
          </h2>

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
                Deposit: {formatMoney(primaryService?.deposit_cents ?? null) || "$0.00"}
              </span>
            </div>
            {primaryService?.pricing_note ? (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 14 }}>
                {primaryService.pricing_note}
              </div>
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

          <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!primaryServiceId}
              style={{
                padding: "14px 22px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                fontWeight: 900,
                fontSize: 18,
                cursor: !primaryServiceId ? "not-allowed" : "pointer",
                opacity: !primaryServiceId ? 0.6 : 1,
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

          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "14px 0 12px 0" }}>
            Pick a date and time
          </h2>

          <label style={{ display: "grid", gap: 8, maxWidth: 320 }}>
            <span style={{ fontWeight: 800 }}>Date</span>
            <input
              type="date"
              value={dayDate}
              onChange={(e) => setDayDate(e.target.value)} // produces YYYY-MM-DD
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
                {slotsError ? (
                  <div style={{ color: "#fca5a5", fontWeight: 800 }}>{slotsError}</div>
                ) : null}

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
              disabled={!dayDate || !selectedTime}
              style={{
                padding: "14px 22px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                fontWeight: 900,
                fontSize: 18,
                cursor: !dayDate || !selectedTime ? "not-allowed" : "pointer",
                opacity: !dayDate || !selectedTime ? 0.6 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {/* STEP 3 (placeholder for client info + deposit) */}
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

          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "14px 0 12px 0" }}>
            Your info + deposit
          </h2>

          <div style={{ opacity: 0.8, lineHeight: 1.6 }}>
            Selected date: <b>{dayDate}</b>
            <br />
            Selected time: <b>{selectedTime}</b>
            <br />
            Total time: <b>{totalMinutes} min</b>
          </div>

          <div style={{ marginTop: 16, opacity: 0.75 }}>
            Next step: client info fields + Stripe deposit capture (we’ll wire it).
          </div>
        </div>
      ) : null}
    </section>
  );
}





