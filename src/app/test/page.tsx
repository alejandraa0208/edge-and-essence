"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";

export default function TestPage() {
  const [stylists, setStylists] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("stylists")
        .select("id, display_name, bio, photo_url")
        .eq("is_active", true);

      if (error) setError(error.message);
      setStylists(data ?? []);
    };
    run();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Supabase Test</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <pre>{JSON.stringify(stylists, null, 2)}</pre>
      <p>If you see [] with no error, the connection works.</p>
    </main>
  );
}
