import Link from "next/link";
import Image from "next/image";
import { supabaseServerPublic } from "@/lib/supabase-server-public";

type StylistRow = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
};

export default async function StylistsIndexPage() {
  const sb = supabaseServerPublic();

  const { data, error } = await sb
    .from("stylists")
    .select("id, display_name, bio, photo_url, is_active")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  const stylists = (data ?? []) as StylistRow[];

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Stylists</h1>
      <p style={{ marginTop: 8, color: "#374151" }}>
        Select a stylist to view their services and availability.
      </p>

      {error ? (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          Error loading stylists: {error.message}
        </div>
      ) : null}

      {stylists.length === 0 ? (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            color: "#374151",
          }}
        >
          No active stylists found.
        </div>
      ) : (
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {stylists.map((s) => (
            <Link
              key={s.id}
              href={`/stylists/${s.id}`}
              style={{
                textDecoration: "none",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 14,
                color: "#111827",
                background: "white",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {s.photo_url ? (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      overflow: "hidden",
                      border: "1px solid #e5e7eb",
                      flexShrink: 0,
                    }}
                  >
                    <Image
                      src={s.photo_url}
                      alt={s.display_name}
                      width={56}
                      height={56}
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 900,
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {s.display_name?.[0]?.toUpperCase() ?? "S"}
                  </div>
                )}

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {s.display_name}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: "#4b5563",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 220,
                    }}
                  >
                    {s.bio ?? ""}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 13,
                  color: "#374151",
                }}
              >
                <span>View profile</span>
                <span style={{ fontWeight: 800 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
