import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServerPublic } from "@/lib/supabase-server-public";
import BookingForm from "./BookingForm";

type ServiceOption = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
  deposit_cents: number | null;
  category: string | null;
  pricing_note: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  category: string | null;
  duration_minutes: number;
};

type StylistServiceJoinRow = {
  service_id: string;
  price_cents: number | null;
  deposit_cents: number | null;
  duration_minutes: number | null;
  pricing_note: string | null;

  // IMPORTANT: can be object OR array depending on Supabase/schema cache
  services: ServiceRow | ServiceRow[] | null;
};

function pickJoinedService(
  joined: ServiceRow | ServiceRow[] | null | undefined
): ServiceRow | null {
  if (!joined) return null;
  if (Array.isArray(joined)) return joined[0] ?? null;
  return joined;
}

export default async function StylistBookPage({
  params,
}: {
  params: Promise<{ stylistId: string }>;
}) {
  const { stylistId } = await params;

  const sb = supabaseServerPublic();

  const { data: stylist, error: stylistErr } = await sb
    .from("stylists")
    .select("id, display_name, is_active")
    .eq("id", stylistId)
    .single();

  if (stylistErr || !stylist || stylist.is_active === false) {
    notFound();
  }

  const { data: rows, error: rowsErr } = await sb
    .from("stylist_services")
    .select(
      `
      service_id,
      price_cents,
      deposit_cents,
      duration_minutes,
      pricing_note,
      services:service_id (
        id,
        name,
        category,
        duration_minutes
      )
    `
    )
    .eq("stylist_id", stylistId)
    .eq("is_active", true);

  if (rowsErr) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "red" }}>Error loading services: {rowsErr.message}</p>
      </main>
    );
  }

  const joined = (rows ?? []) as unknown as StylistServiceJoinRow[];

  const services: ServiceOption[] = joined
    .map((r) => {
      const s = pickJoinedService(r.services);
      if (!s) return null;

      return {
        id: s.id,
        name: s.name,
        category: s.category ?? null,
        duration_minutes: (r.duration_minutes ?? s.duration_minutes) ?? 0,
        price_cents: r.price_cents ?? null,
        deposit_cents: r.deposit_cents ?? null,
        pricing_note: r.pricing_note ?? null,
      };
    })
    .filter((x): x is ServiceOption => x !== null)
    .sort((a, b) => {
      const ca = (a.category ?? "Other").toLowerCase();
      const cb = (b.category ?? "Other").toLowerCase();
      if (ca !== cb) return ca.localeCompare(cb);
      return a.name.localeCompare(b.name);
    });

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Link href={`/stylists/${stylistId}`} style={{ textDecoration: "none" }}>
        ← Back to {stylist.display_name}
      </Link>

      <BookingForm
        stylistId={stylistId}
        stylistName={stylist.display_name}
        services={services}
      />

      {services.length === 0 ? (
        <p style={{ marginTop: 16, color: "#6b7280" }}>
          This stylist doesn’t have services assigned yet.
        </p>
      ) : null}
    </main>
  );
}
