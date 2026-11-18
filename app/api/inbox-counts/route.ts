import { NextResponse } from "next/server";
import { getInboxCounts } from "@/lib/data/inbox-counts";

export const dynamic = "force-dynamic";

/** Aktuelle Zähler für das Polling der Shell (nur CEO/Admin liefern echte Werte). */
export async function GET() {
  const counts = await getInboxCounts();
  return NextResponse.json(counts, { headers: { "Cache-Control": "no-store" } });
}
