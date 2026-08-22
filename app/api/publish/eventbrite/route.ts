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
  const response = await fetch("https://www.eventbriteapi.com/v3/users/me/organizations/", { cache: "no-store", headers: eventbriteHeaders(token) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_description || payload?.error || `Eventbrite organization lookup failed (${response.status}).`);
  const organizations = Array.isArray(payload?.organizations) ? payload.organizations : [];
  if (organizations.length !== 1) throw new Error("Set EVENTBRITE_ORGANIZATION_ID because more than one Eventbrite organization is available.");
  return organizations[0].id as string;
}

async function createVenue(token: string, organizationId: string, event: Record<string, any>) {
  if (!event.venue_name && !event.address_line1 && !event.city) return null;
  const response = await fetch(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/venues/`, {
    method: "POST",
    headers: eventbriteHeaders(token),
    cache: "no-store",
    body: JSON.stringify({
      venue: {
        name: event.venue_name || event.address_line1 || event.city || "Event venue",
        address: {
          address_1: event.address_line1 || undefined,
          address_2: event.address_line2 || undefined,
          city: event.city || undefined,
          region: event.state || undefined,
          postal_code: event.postal_code || undefined,
          country: event.country || "US",
        },
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_description || payload?.error || `Eventbrite venue creation failed (${response.status}).`);
  return payload?.id || null;
}

async function uploadEventbriteLogo(token: string, imageUrl: string) {
  const instructionsResponse = await fetch("https://www.eventbriteapi.com/v3/media/upload/?type=image-event-logo", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const instructions = await instructionsResponse.json().catch(() => ({}));
  if (!instructionsResponse.ok) throw new Error(instructions?.error_description || instructions?.error || `Eventbrite media instructions failed (${instructionsResponse.status}).`);

  const sourceResponse = await fetch(imageUrl, { cache: "no-store" });
  if (!sourceResponse.ok) throw new Error("Unable to download the event image for Eventbrite.");
  const bytes = await sourceResponse.arrayBuffer();
  const mimeType = sourceResponse.headers.get("content-type") || "image/jpeg";
  const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";

  const form = new FormData();
  for (const [key, value] of Object.entries(instructions.upload_data || {})) form.append(key, String(value));
  form.append(instructions.file_parameter_name || "file", new Blob([bytes], { type: mimeType }), `event-image.${extension}`);

  const uploadResponse = await fetch(instructions.upload_url, { method: "POST", body: form });
  if (!uploadResponse.ok) throw new Error(`Eventbrite image binary upload failed (${uploadResponse.status}).`);

  const notifyResponse = await fetch("https://www.eventbriteapi.com/v3/media/upload/", {
    method: "POST",
    headers: eventbriteHeaders(token),
    body: JSON.stringify({ upload_token: instructions.upload_token }),
    cache: "no-store",
  });
  const media = await notifyResponse.json().catch(() => ({}));
  if (!notifyResponse.ok) throw new Error(media?.error_description || media?.error || `Eventbrite media finalize failed (${notifyResponse.status}).`);
  if (!media?.id) throw new Error("Eventbrite did not return a media ID after image upload.");
  return media.id as string;
}

async function ensureTicketClass(token: string, eventId: string, event: Record<string, any>) {
  const listResponse = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`, {
    cache: "no-store",
    headers: eventbriteHeaders(token),
  });
  const listPayload = await listResponse.json().catch(() => ({}));
  if (!listResponse.ok) throw new Error(listPayload?.error_description || listPayload?.error || `Eventbrite ticket lookup failed (${listResponse.status}).`);

  const existing = Array.isArray(listPayload?.ticket_classes) ? listPayload.ticket_classes[0] : null;
  const paid = event.is_free === false;
  const priceCents = Number(event.price_cents || 0);
  if (paid && priceCents <= 0) throw new Error("Paid Eventbrite events require a ticket price greater than 0.");

  const ticketClass = {
    name: "General Admission",
    description: event.short_description || undefined,
    quantity_total: event.capacity || 100,
    minimum_quantity: 1,
    maximum_quantity: Math.min(event.capacity || 10, 10),
    ...(paid
      ? { free: false, cost: `${event.currency || "USD"},${priceCents}` }
      : { free: true }),
  };

  const url = existing?.id
    ? `https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/${existing.id}/`
    : `https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`;

  const response = await fetch(url, {
    method: "POST",
    headers: eventbriteHeaders(token),
    cache: "no-store",
    body: JSON.stringify({ ticket_class: ticketClass }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_description || payload?.error || `Eventbrite ticket setup failed (${response.status}).`);
  return payload?.id || existing?.id || null;
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

    const organizationId = await resolveOrganizationId(token);
    const [venueId, logoId] = await Promise.all([
      createVenue(token, organizationId, event),
      event.cover_image_url ? uploadEventbriteLogo(token, event.cover_image_url) : Promise.resolve(null),
    ]);

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
        venue_id: venueId || undefined,
        logo_id: logoId || undefined,
      },
    };

    let response: Response;
    if (action === "update" && publication.external_id) {
      response = await fetch(`https://www.eventbriteapi.com/v3/events/${publication.external_id}/`, {
        method: "POST", headers, cache: "no-store", body: JSON.stringify(eventBody),
      });
    } else {
      response = await fetch(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`, {
        method: "POST", headers, cache: "no-store", body: JSON.stringify(eventBody),
      });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error_description || payload?.error || `Eventbrite ${action} failed (${response.status}).`);

    const externalId = payload?.id || publication.external_id;
    if (!externalId) throw new Error("Eventbrite did not return an event ID.");
    const ticketClassId = await ensureTicketClass(token, externalId, event);
    const externalUrl = payload?.url || publication.external_url || null;

    await supabase.from("event_publications").update({
      status: "published", external_id: externalId, external_url: externalUrl, published_at: new Date().toISOString(), last_error: null,
    }).eq("id", publication.id);

    return NextResponse.json({
      published: true,
      draft: true,
      id: externalId,
      url: externalUrl,
      action: publication.external_id ? "updated" : "created",
      venueId,
      logoId,
      ticketClassId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eventbrite operation failed.";
    await supabase.from("event_publications").update({ status: "failed", last_error: message }).eq("id", publication.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
