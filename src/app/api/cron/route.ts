export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const res = await fetch(`${baseUrl}/api/jobs/send-reminders`, {
    method: "GET",
    headers: {
      "x-cron-secret": process.env.CRON_SECRET ?? "",
    },
  });

  const json = await res.json();
  return Response.json({ ok: true, reminders: json });
}