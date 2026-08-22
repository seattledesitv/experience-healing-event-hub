import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function eventbriteHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function eventbriteUtc(value: string) {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function resolveOrganizationId(token: string) {
  if (process.env.EVENTBRITE_ORGANIZATION_ID) return process.env.EVENTBRITE_ORGANIZATION_ID;
  const response = await fetch("https://www.eventbriteapi.com/v3/users/me/organizations/", {
    cache: "no-store", headers: eventbriteHeaders(token),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_description || payload?.error || `Eventbrite organization lookup failed (${response.status}).`);
  const organizations = Array.isArray(payload?.organizations) ? payload.organizations : [];
  if (organizations.length !== 1) throw new Error("Set EVENTBRITE_ORGANIZATION_ID because more than one Eventbrite organization is available.");
  return organizations[0].id as string;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const action = body.action === "delete" || body.action === "update" ? body.action : "create";
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  const token = process.env.EVENTBRITE_PRIVATE_TOKEN;
  if (!token) return NextResponse.json({ error: "Eventbrite private token is not configured." }, { status: 400 });

  const [{ data: event, error: eventError }, { data: publication, error: publicationError }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single(),
    supabase.from("event_publications").select("id,enabled,status,external_id,external_url").eq("event_id", eventId).eq("channel", "eventbrite").single(),
  ]);

  if (eventError || !event) return NextResponse.json({ error: eventError?.message || "Event not found." }, { status: 404 });
  if (publicationError || !publication) return NextResponse.json({ error: publicationError?.message || "Eventbrite publication record not found." }, { status: 404 });
  if (!publication.enabled && action !== "delete") return NextResponse.json({ error: "Eventbrite is not selected for this event." }, { status: 400 });

  const headers = eventbriteHeaders(token);

  try {
    if (action === "delete") {
      if (!publication.external_id) return NextResponse.json({ deleted: true, alreadyDeleted: true });
      const response = await fetch(`https://www.eventbriteapi.com/v3/events/${publication.external_id}/`, { method: "DELETE", headers, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error_description || payload?.error || `Eventbrite delete failed (${response.status}).`);
      await supabase.from("event_publications").update({ status: "pending", external_id: null, external_url: null, published_at: null, last_error: null }).eq("id", publication.id);
      return NextResponse.json({ deleted: true });
    }

    if (!event.start_at || !event.end_at) return NextResponse.json({ error: "Start and end date/time are required for Eventbrite." }, { status: 400 });

    const eventBody = {
      event: {
        name: { html: event.title },
        description: { html: event.description || event.short_description || event.title },
        start: { utc: eventbriteUtc(event.start_at), timezone: event.timezone || "America/Los_Angeles" },
        end: { utc: eventbriteUtc(event.end_at), timezone: event.timezone || "America/Los_Angeles" },
        currency: event.currency || "USD",
        listed: false,
        shareable: false,
        online_event: false,
        capacity: event.capacity || undefined,
      },
    };

    let response: Response;
    if (action === "update" && publication.external_id) {
      response = await fetch(`https://www.eventbriteapi.com/v3/events/${publication.external_id}/`, {
        method: "POST", headers, cache: "no-store", body: JSON.stringify(eventBody),
      });
    } else {
      const organizationId = await resolveOrganizationId(token);
      response = await fetch(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`, {
        method: "POST", headers, cache: "no-store", body: JSON.stringify(eventBody),
      });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error_description || payload?.error || `Eventbrite ${action} failed (${response.status}).`);

    const externalId = payload?.id || publication.external_id;
    if (!externalId) throw new Error("Eventbrite did not return an event ID.");
    const externalUrl = payload?.url || publication.external_url || null;
    await supabase.from("event_publications").update({
      status: "published", external_id: externalId, external_url: externalUrl, published_at: new Date().toISOString(), last_error: null,
    }).eq("id", publication.id);

    return NextResponse.json({ published: true, draft: true, id: externalId, url: externalUrl, action: publication.external_id ? "updated" : "created" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eventbrite operation failed.";
    await supabase.from("event_publications").update({ status: "failed", last_error: message }).eq("id", publication.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
