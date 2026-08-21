import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCloudinary, eventMediaFolder } from "@/lib/media/cloudinary";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const timestamp = Math.round(Date.now() / 1000);
    const folder = eventMediaFolder(body?.eventId);
    const cloudinary = getCloudinary();
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      requireEnv("CLOUDINARY_API_SECRET"),
    );

    return NextResponse.json({
      timestamp,
      folder,
      signature,
      cloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
      apiKey: requireEnv("CLOUDINARY_API_KEY"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
