import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function organizationIdFromUrn(urn: string) {
  const match = urn.match(/urn:li:organization:(\d+)$/);
  return match?.[1] || urn;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const organizationUrn = process.env.LINKEDIN_ORGANIZATION_URN;
  const version = process.env.LINKEDIN_API_VERSION || "202606";

  if (!token || !organizationUrn) {
    return NextResponse.json({
      connected: false,
      error: "LinkedIn credentials are not fully configured in the environment.",
    }, { status: 400 });
  }

  const organizationId = organizationIdFromUrn(organizationUrn);
  const response = await fetch(`https://api.linkedin.com/rest/organizations/${organizationId}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": version,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({
      connected: false,
      error: payload?.message || payload?.serviceErrorCode || `LinkedIn returned ${response.status}.`,
      status: response.status,
    }, { status: response.status });
  }

  return NextResponse.json({
    connected: true,
    organization: {
      id: payload.id || organizationId,
      urn: payload.$URN || organizationUrn,
      name: payload.localizedName || null,
      vanityName: payload.vanityName || null,
    },
    apiVersion: version,
  });
}
