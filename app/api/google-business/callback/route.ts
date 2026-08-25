import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char] || char);
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("google_business_oauth_state")?.value;
  const oauthError = url.searchParams.get("error");

  if (oauthError) return NextResponse.json({ error: oauthError }, { status: 400 });
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid Google OAuth callback state." }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Google Business OAuth credentials are incomplete." }, { status: 400 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) {
    return NextResponse.json({ error: tokenPayload?.error_description || tokenPayload?.error || "Google token exchange failed." }, { status: 502 });
  }

  const accessToken = tokenPayload.access_token as string | undefined;
  const refreshToken = tokenPayload.refresh_token as string | undefined;
  if (!accessToken) return NextResponse.json({ error: "Google did not return an access token." }, { status: 502 });

  const googleHeaders = { Authorization: `Bearer ${accessToken}` };
  const accountsResponse = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: googleHeaders,
    cache: "no-store",
  });
  const accountsPayload = await accountsResponse.json().catch(() => ({}));

  let accountName = "";
  let accountDisplay = "";
  let locations: Array<{ name?: string; title?: string; storefrontAddress?: unknown }> = [];

  if (accountsResponse.ok && Array.isArray(accountsPayload.accounts) && accountsPayload.accounts.length) {
    const account = accountsPayload.accounts[0];
    accountName = account.name || "";
    accountDisplay = account.accountName || account.type || accountName;

    if (accountName) {
      const locationsUrl = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`);
      locationsUrl.searchParams.set("readMask", "name,title,storefrontAddress");
      locationsUrl.searchParams.set("pageSize", "100");
      const locationsResponse = await fetch(locationsUrl, { headers: googleHeaders, cache: "no-store" });
      const locationsPayload = await locationsResponse.json().catch(() => ({}));
      if (locationsResponse.ok && Array.isArray(locationsPayload.locations)) locations = locationsPayload.locations;
    }
  }

  const accountId = accountName.replace(/^accounts\//, "");
  const rows = locations.map((location) => {
    const locationId = (location.name || "").replace(/^locations\//, "");
    return `<tr><td>${escapeHtml(location.title || "Business location")}</td><td><code>${escapeHtml(locationId)}</code></td></tr>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Business connected</title><style>body{font-family:Arial,sans-serif;background:#f5fbfe;color:#163247;margin:0;padding:40px}.card{max-width:900px;margin:auto;background:#fff;border:1px solid #d8edf7;border-radius:22px;padding:32px;box-shadow:0 16px 50px rgba(21,79,111,.08)}h1{margin-top:0;color:#0d6fa5}code{background:#eef8fc;padding:4px 7px;border-radius:7px;word-break:break-all}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:12px;border-bottom:1px solid #e5eef2;text-align:left}.secret{padding:16px;background:#fff8e8;border:1px solid #f1d38a;border-radius:12px;margin:18px 0}.muted{color:#607786}</style></head><body><div class="card"><p>Experience Healing Event Hub</p><h1>Google Business authorization succeeded</h1><p><strong>Account:</strong> ${escapeHtml(accountDisplay || accountName || "Connected Google Business account")}</p><p><strong>GOOGLE_BUSINESS_ACCOUNT_ID</strong><br><code>${escapeHtml(accountId || "No account ID returned")}</code></p>${refreshToken ? `<div class="secret"><strong>GOOGLE_BUSINESS_REFRESH_TOKEN</strong><p class="muted">Copy this now into Vercel. Do not share it in chat or screenshots.</p><code>${escapeHtml(refreshToken)}</code></div>` : `<div class="secret"><strong>No refresh token returned.</strong><p class="muted">Re-run Connect Google Business; the flow uses prompt=consent to request a refresh token.</p></div>`}<h2>Locations</h2>${locations.length ? `<table><thead><tr><th>Business</th><th>GOOGLE_BUSINESS_LOCATION_ID</th></tr></thead><tbody>${rows}</tbody></table>` : `<p>No locations were returned. This can indicate Business Profile API access is not yet approved for the Cloud project.</p>`}<p style="margin-top:26px"><a href="/settings/connections">Return to Connections</a></p></div></body></html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, private" },
  });
  response.cookies.delete("google_business_oauth_state");
  return response;
}
