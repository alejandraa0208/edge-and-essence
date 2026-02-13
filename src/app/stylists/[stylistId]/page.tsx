import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { supabaseServerPublic } from "@/lib/supabase-server-public";

type Stylist = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
};

export default async function StylistProfilePage({
  params,
}: {
  params: Promise<{ stylistId: string }>;
}) {
  const { stylistId } = await params;

  const sb = supabaseServerPublic();

  const { data, error } = await sb
    .from("stylists")
    .select("id, display_name, bio, photo_url, is_active")
    .eq("id", stylistId)
    .single();

  if (error || !data || data.is_active === false) {
    notFound();
  }

  const stylist = data as Stylist;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Link href="/stylists" style={{ textDecoration: "none" }}>
        ← Back to stylists
      </Link>

      <div
        style={{
          display: "flex",
          gap: 18,
          marginTop: 18,
          alignItems: "center",
        }}
      >
        {stylist.photo_url ? (
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 999,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
            }}
          >
            <Image
              src={stylist.photo_url}
              alt={stylist.display_name}
              width={92}
              height={92}
              style={{ objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 28,
            }}
          >
            {stylist.display_name?.[0]?.toUpperCase() ?? "S"}
          </div>
        )}

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>
            {stylist.display_name}
          </h1>

          <p style={{ marginTop: 8, marginBottom: 0, color: "#374151" }}>
            {stylist.bio ?? " "}
          </p>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Link
              href={`/stylists/${stylist.id}/book`}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "#111827",
                color: "white",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Book with {stylist.display_name}
            </Link>

            <Link
              href={`/stylists/${stylist.id}/book`}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              View availability
            </Link>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
          Portfolio
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              height: 200,
              border: "1px dashed #d1d5db",
              borderRadius: 14,
            }}
          />
          <div
            style={{
              height: 200,
              border: "1px dashed #d1d5db",
              borderRadius: 14,
            }}
          />
          <div
            style={{
              height: 200,
              border: "1px dashed #d1d5db",
              borderRadius: 14,
            }}
          />
          <div
            style={{
              height: 200,
              border: "1px dashed #d1d5db",
              borderRadius: 14,
            }}
          />
        </div>

        <p style={{ color: "#6b7280", marginTop: 10, fontSize: 13 }}>
          Next step: we’ll store stylist photos in Supabase Storage and render them here.
        </p>
      </section>
    </main>
  );
}
