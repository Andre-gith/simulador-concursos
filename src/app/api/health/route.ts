export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ status: "ok", version: process.env.APP_VERSION || "development", time: new Date().toISOString(), environment: process.env.NODE_ENV === "production" ? "production" : "non-production" }, { headers: { "cache-control": "no-store" } });
}
