import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function eventbriteFetch(path: string, token: string) {
  const response = await fetch(`https://www.eventbriteapi.com/v3${path}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.EVENTBRITE_PRIVATE_TOKEN;
  if (!token) {
    return NextResponse.json({ connected: false, error: "EVENTBRITE_PRIVATE_TOKEN is not configured." }, { status: 400 });
  }

  const userResult = await eventbriteFetch("/users/me/", token);
  if (!userResult.response.ok) {
    return NextResponse.json({
      connected: false,
      error: userResult.payload?.error_description || userResult.payload?.error || userResult.payload?.status_code || `Eventbrite user validation failed (${userResult.response.status}).`,
    }, { status: userResult.response.status });
  }

  const orgResult = await eventbriteFetch("/users/me/organizations/", token);
  if (!orgResult.response.ok) {
    return NextResponse.json({
      connected: false,
      error: orgResult.payload?.error_description || orgResult.payload?.error || `Eventbrite organization lookup failed (${orgResult.response.status}).`,
    }, { status: orgResult.response.status });
  }

  const organizations = Array.isArray(orgResult.payload?.organizations) ? orgResult.payload.organizations : [];
  if (!organizations.length) {
    return NextResponse.json({ connected: false, error: "The Eventbrite account has no accessible organizations." }, { status: 404 });
  }

  const configuredOrganizationId = process.env.EVENTBRITE_ORGANIZATION_ID || null;
  const selectedOrganization = configuredOrganizationId
    ? organizations.find((organization: { id?: string }) => organization.id === configuredOrganizationId) || null
    : organizations.length === 1 ? organizations[0] : null;

  return NextResponse.json({
    connected: true,
    user: {
      id: userResult.payload?.id || null,
      name: userResult.payload?.name || null,
      firstName: userResult.payload?.first_name || null,
      lastName: userResult.payload?.last_name || null,
      emails: userResult.payload?.emails || [],
    },
    organization: selectedOrganization ? {
      id: selectedOrganization.id,
      name: selectedOrganization.name || null,
    } : null,
    organizations: organizations.map((organization: { id?: string; name?: string }) => ({
      id: organization.id || null,
      name: organization.name || null,
    })),
    needsOrganizationSelection: !selectedOrganization,
  });
}
