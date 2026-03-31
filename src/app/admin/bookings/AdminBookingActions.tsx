"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "confirm" | "cancel" | "no_show" | "mark_remaining_paid";

type ModalState =
  | { type: "cancel" }
  | { type: "no_show" }
  | { type: "mark_remaining_paid" }
  | null;

export default function AdminBookingActions({
  bookingId,
  status,
  remainingCents,
}: {
  bookingId: string;
  status: string | null;
  remainingCents: number;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<Action | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // form fields
  const [cancelReason, setCancelReason] = useState("Cancelled by admin");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  const isCancelled = ["cancelled", "canceled", "cancelled_refunded", "cancelled_late", "cancelled_refund_failed"].includes((status ?? "").toLowerCase());
  const isCompleted = (status ?? "").toLowerCase() === "completed";
  const isNoShow = (status ?? "").toLowerCase() === "no_show";
  const isConfirmed = (status ?? "").toLowerCase() === "confirmed";

  async function runAction(action: Action, payload?: Record<string, string>) {
    try {
      setLoadingAction(action);
      setError(null);
      setSuccess(null);

      if (action === "confirm") {
        const res = await fetch("/api/admin/bookings/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, bookingId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to confirm booking");
        setSuccess("Booking confirmed.");
        router.refresh();
        return;
      }

      if (action === "cancel") {
        const res = await fetch("/api/bookings/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, reason: payload?.reason }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to cancel booking");
        const msg = json.is48Plus
          ? "Booking cancelled. Deposit refunded."
          : "Late cancellation applied. Deposit kept.";
        setSuccess(msg);
        setModal(null);
        router.refresh();
        return;
      }

      if (action === "no_show") {
        const res = await fetch("/api/admin/bookings/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            bookingId,
            reason: "No-show. Remaining balance is due.",
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to mark no-show");
        const fee = json.noShowFeeCents
          ? ` Fee: $${(json.noShowFeeCents / 100).toFixed(2)}`
          : "";
        setSuccess(`No-show recorded.${fee}`);
        setModal(null);
        router.refresh();
        return;
      }

      if (action === "mark_remaining_paid") {
        if (remainingCents <= 0) {
          setError("No remaining balance to mark as paid.");
          return;
        }
        const res = await fetch("/api/admin/bookings/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            bookingId,
            paymentMethod: payload?.paymentMethod || "cash",
            notes: payload?.notes || "",
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to mark remaining as paid");
        const amt = json.remainingPaidCents
          ? ` $${(json.remainingPaidCents / 100).toFixed(2)} recorded.`
          : "";
        setSuccess(`Remaining balance paid.${amt}`);
        setModal(null);
        router.refresh();
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div>
      {/* ── Action buttons ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>

        {/* Confirm */}
        <ActionBtn
          label="Confirm"
          loadingLabel="Confirming..."
          loading={loadingAction === "confirm"}
          disabled={!!loadingAction || isConfirmed || isCancelled || isCompleted || isNoShow}
          bg="#0c2a1a"
          color="#86efac"
          onClick={() => runAction("confirm")}
        />

        {/* Cancel */}
        <ActionBtn
          label="Cancel"
          loadingLabel="Cancelling..."
          loading={loadingAction === "cancel"}
          disabled={!!loadingAction || isCancelled || isCompleted || isNoShow}
          bg="#2a0c0c"
          color="#fca5a5"
          onClick={() => setModal({ type: "cancel" })}
        />

        {/* No Show */}
        <ActionBtn
          label="No Show"
          loadingLabel="Saving..."
          loading={loadingAction === "no_show"}
          disabled={!!loadingAction || isNoShow || isCompleted || isCancelled}
          bg="#2a1f04"
          color="#fde68a"
          onClick={() => setModal({ type: "no_show" })}
        />

        {/* Mark Remaining Paid */}
        <ActionBtn
          label="Mark Remaining Paid"
          loadingLabel="Saving..."
          loading={loadingAction === "mark_remaining_paid"}
          disabled={!!loadingAction || isCompleted || remainingCents <= 0}
          bg="#0c1f2a"
          color="#7dd3fc"
          onClick={() => setModal({ type: "mark_remaining_paid" })}
        />
      </div>

      {/* ── Feedback ── */}
      {error && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(127,29,29,0.3)", border: "1px solid #7f1d1d", color: "#fca5a5", fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(5,46,22,0.4)", border: "1px solid #166534", color: "#86efac", fontSize: 13, fontWeight: 700 }}>
          {success}
        </div>
      )}

      {/* ── Cancel modal ── */}
      {modal?.type === "cancel" && (
        <Modal
          title="Cancel Booking"
          description="This will cancel the appointment. If within 48 hours, the deposit will be kept."
          onClose={() => setModal(null)}
          onConfirm={() => runAction("cancel", { reason: cancelReason })}
          confirmLabel="Cancel Booking"
          confirmColor="#fca5a5"
          loading={loadingAction === "cancel"}
          danger
        >
          <FieldLabel>Reason</FieldLabel>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            style={textareaStyle}
          />
        </Modal>
      )}

      {/* ── No-show modal ── */}
      {modal?.type === "no_show" && (
        <Modal
          title="Mark as No-Show"
          description={`The remaining balance of $${(remainingCents / 100).toFixed(2)} will be recorded as due.`}
          onClose={() => setModal(null)}
          onConfirm={() => runAction("no_show")}
          confirmLabel="Mark No-Show"
          confirmColor="#fde68a"
          loading={loadingAction === "no_show"}
          danger
        >
          <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
            This will update the booking status to <b>no_show</b> and flag the remaining balance for charge.
          </div>
        </Modal>
      )}

      {/* ── Mark remaining paid modal ── */}
      {modal?.type === "mark_remaining_paid" && (
        <Modal
          title="Mark Remaining Paid"
          description={`Record payment of $${(remainingCents / 100).toFixed(2)} remaining balance.`}
          onClose={() => setModal(null)}
          onConfirm={() => runAction("mark_remaining_paid", { paymentMethod, notes: paymentNotes })}
          confirmLabel="Record Payment"
          confirmColor="#86efac"
          loading={loadingAction === "mark_remaining_paid"}
        >
          <FieldLabel>Payment method</FieldLabel>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={selectStyle}
          >
            {["cash", "zelle", "cashapp", "apple_cash", "stripe", "other"].map((m) => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1).replace("_", " ")}</option>
            ))}
          </select>

          <FieldLabel style={{ marginTop: 12 }}>Notes (optional)</FieldLabel>
          <textarea
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            rows={2}
            placeholder="Any additional notes..."
            style={textareaStyle}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({
  title,
  description,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  confirmColor,
  loading,
  danger,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmColor: string;
  loading: boolean;
  danger?: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />

      {/* Panel */}
      <div style={{ position: "relative", background: "#0b1220", border: `1px solid ${danger ? "#7f1d1d" : "#334155"}`, borderRadius: 16, padding: "24px 22px", width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
        {description && <div style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>{description}</div>}

        {children}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{ flex: 1, padding: "10px", borderRadius: 10, background: "transparent", border: "1px solid #334155", color: "inherit", fontWeight: 800, cursor: "pointer", fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{ flex: 2, padding: "10px", borderRadius: 10, background: danger ? "rgba(127,29,29,0.4)" : "rgba(5,46,22,0.4)", border: `1px solid ${confirmColor}`, color: confirmColor, fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ActionBtn({ label, loadingLabel, loading, disabled, bg, color, onClick }: {
  label: string; loadingLabel: string; loading: boolean;
  disabled: boolean; bg: string; color: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg, color, border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.6, marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase", ...style }}>
      {children}
    </div>
  );
}

const textareaStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1px solid #334155", background: "#0d1a2a",
  color: "inherit", fontSize: 14, resize: "vertical",
  fontFamily: "inherit", boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1px solid #334155", background: "#0d1a2a",
  color: "inherit", fontSize: 14, cursor: "pointer",
  appearance: "none", boxSizing: "border-box",
};