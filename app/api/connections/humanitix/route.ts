import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.HUMANITIX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ connected: false, error: "Humanitix API key is not configured." }, { status: 400 });
  }

  const response = await fetch("https://api.humanitix.com/v1/events", {
    cache: "no-store",
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({
      connected: false,
      error: payload?.message || payload?.error || `Humanitix returned ${response.status}.`,
      status: response.status,
    }, { status: response.status });
  }

  const events = Array.isArray(payload) ? payload : Array.isArray(payload?.events) ? payload.events : [];

  return NextResponse.json({
    connected: true,
    eventCount: events.length,
    events: events.slice(0, 5).map((event: Record<string, unknown>) => ({
      id: event.id || event._id || null,
      name: event.name || event.title || null,
      url: event.url || event.eventUrl || null,
    })),
  });
}
