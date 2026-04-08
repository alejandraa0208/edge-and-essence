import { Suspense } from "react";
import ConfirmedPageInner from "./ConfirmedPageInner";

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.4 }}>✦</div>
          <div style={{ fontWeight: 800, opacity: 0.6, color: "#f1f5f9" }}>Loading your confirmation...</div>
        </div>
      </div>
    }>
      <ConfirmedPageInner />
    </Suspense>
  );
}