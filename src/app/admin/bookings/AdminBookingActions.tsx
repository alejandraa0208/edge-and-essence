"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function runAction(action: "cancel" | "no_show" | "mark_remaining_paid") {
    try {
      if (action === "cancel") {
        const reason =
          window.prompt("Enter cancellation reason:", "Cancelled by admin") || "";
        if (!reason.trim()) return;

        setLoadingAction(action);

        const res = await fetch("/api/admin/bookings/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            bookingId,
            reason,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          alert(json?.error || "Failed to cancel booking");
          return;
        }

        if (json.lateCancel) {
          alert(
            `Late cancellation applied. Remaining balance due: $${(
              json.cancellationFeeCents / 100
            ).toFixed(2)}`
          );
        }

        router.refresh();
        return;
      }

      if (action === "no_show") {
        const confirmNoShow = window.confirm(
          "Mark this booking as a no-show? This will apply the remaining balance as due."
        );
        if (!confirmNoShow) return;

        setLoadingAction(action);

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

        if (!res.ok) {
          alert(json?.error || "Failed to mark no-show");
          return;
        }

        alert(
          `No-show recorded. Remaining balance due: $${(
            json.noShowFeeCents / 100
          ).toFixed(2)}`
        );

        router.refresh();
        return;
      }

      if (action === "mark_remaining_paid") {
        if (remainingCents <= 0) {
          alert("No remaining balance to mark as paid.");
          return;
        }

        const paymentMethod =
          window.prompt(
            "How was the remaining balance paid? (cash, zelle, cashapp, apple_cash, stripe, other)",
            "cash"
          ) || "";

        if (!paymentMethod.trim()) return;

        const notes =
          window.prompt("Optional notes for payment:", "") || "";

        setLoadingAction(action);

        const res = await fetch("/api/admin/bookings/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            bookingId,
            paymentMethod,
            notes,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          alert(json?.error || "Failed to mark remaining as paid");
          return;
        }

        alert(
          `Remaining balance marked paid: $${(
            json.remainingPaidCents / 100
          ).toFixed(2)}`
        );

        router.refresh();
      }
    } finally {
      setLoadingAction(null);
    }
  }

  const isCancelled =
    (status ?? "").toLowerCase() === "cancelled" ||
    (status ?? "").toLowerCase() === "canceled";

  const isCompleted = (status ?? "").toLowerCase() === "completed";
  const isNoShow = (status ?? "").toLowerCase() === "no_show";

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => runAction("cancel")}
        disabled={!!loadingAction || isCancelled || isCompleted}
        style={buttonStyle("#3f1111", "#fecaca")}
      >
        {loadingAction === "cancel" ? "Cancelling..." : "Cancel"}
      </button>

      <button
        type="button"
        onClick={() => runAction("no_show")}
        disabled={!!loadingAction || isNoShow || isCompleted}
        style={buttonStyle("#3f2b07", "#fde68a")}
      >
        {loadingAction === "no_show" ? "Saving..." : "No Show"}
      </button>

      <button
        type="button"
        onClick={() => runAction("mark_remaining_paid")}
        disabled={!!loadingAction || isCompleted || remainingCents <= 0}
        style={buttonStyle("#052e16", "#86efac")}
      >
        {loadingAction === "mark_remaining_paid"
          ? "Saving..."
          : "Mark Remaining Paid"}
      </button>
    </div>
  );
}

function buttonStyle(background: string, color: string): React.CSSProperties {
  return {
    background,
    color,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  };
}