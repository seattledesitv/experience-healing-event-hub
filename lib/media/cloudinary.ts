import { v2 as cloudinary } from "cloudinary";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getCloudinary() {
  cloudinary.config({
    cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: requireEnv("CLOUDINARY_API_KEY"),
    api_secret: requireEnv("CLOUDINARY_API_SECRET"),
    secure: true,
  });

  return cloudinary;
}

export function eventMediaFolder(eventId?: string) {
  return eventId ? `experience-healing/events/${eventId}` : "experience-healing/events/drafts";
}
