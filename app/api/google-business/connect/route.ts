import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({
      error: "Google Business OAuth is not fully configured. Set GOOGLE_BUSINESS_CLIENT_ID and GOOGLE_BUSINESS_REDIRECT_URI.",
    }, { status: 400 });
  }

  const state = crypto.randomUUID();
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "https://www.googleapis.com/auth/business.manage");
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("include_granted_scopes", "true");
  auth.searchParams.set("state", state);

  const response = NextResponse.redirect(auth);
  response.cookies.set("google_business_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 600,
    path: "/",
  });
  return response;
}
