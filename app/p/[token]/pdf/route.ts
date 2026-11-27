import { headers } from "next/headers";
import { publicPdfUrl } from "@/lib/data/abnahme-public";
import { istPublicToken } from "@/lib/abnahme/public-token";
import { istGesperrt, meldeFehlversuch } from "@/lib/abnahme/public-rate-limit";

export const dynamic = "force-dynamic";

/** PDF-Download über den Token: Weiterleitung auf eine kurzlebige Signed URL (Bucket bleibt privat). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unbekannt";
  const neutral = () => new Response("Link ungültig oder deaktiviert", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  if (istGesperrt(ip)) return neutral();
  const url = istPublicToken(token) ? await publicPdfUrl(token).catch(() => null) : null;
  if (!url) {
    meldeFehlversuch(ip);
    return neutral();
  }
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } });
}
