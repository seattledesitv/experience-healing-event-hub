"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const channels = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "eventbrite", label: "Eventbrite" },
  { id: "humanitix", label: "Humanitix" },
  { id: "wix", label: "Wix" },
];

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function toIso(input: string) {
  return input ? new Date(input).toISOString() : null;
}

export default function NewEventPage() {
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["instagram", "linkedin", "wix"]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImagePublicId, setCoverImagePublicId] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggleChannel(channel: string) {
    setSelectedChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel],
    );
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        window.location.href = "/login";
        return;
      }

      const signResponse = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId }),
      });
      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.error || "Unable to prepare upload");

      const upload = new FormData();
      upload.append("file", file);
      upload.append("api_key", signed.apiKey);
      upload.append("timestamp", String(signed.timestamp));
      upload.append("signature", signed.signature);
      upload.append("folder", signed.folder);

      const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
        { method: "POST", body: upload },
      );
      const result = await cloudinaryResponse.json();
      if (!cloudinaryResponse.ok) throw new Error(result?.error?.message || "Cloudinary upload failed");

      setCoverImageUrl(result.secure_url);
      setCoverImagePublicId(result.public_id);
      setMessage("Image uploaded successfully.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const title = value(form, "title");
      if (!title) throw new Error("Event title is required.");

      const pricingType = value(form, "pricing_type") || "free";
      const price = Number(value(form, "price"));
      if (pricingType === "paid" && (!Number.isFinite(price) || price <= 0)) {
        throw new Error("Enter a ticket price greater than 0 for a paid event.");
      }

      const payload = {
        title,
        short_description: value(form, "short_description") || null,
        description: value(form, "description") || null,
        start_at: toIso(value(form, "start_at")),
        end_at: toIso(value(form, "end_at")),
        venue_name: value(form, "venue_name") || null,
        address_line1: value(form, "address_line1") || null,
        address_line2: value(form, "address_line2") || null,
        city: value(form, "city") || null,
        state: value(form, "state") || null,
        postal_code: value(form, "postal_code") || null,
        country: value(form, "country") || "US",
        registration_url: value(form, "registration_url") || null,
        is_free: pricingType !== "paid",
        price_cents: pricingType === "paid" ? Math.round(price * 100) : null,
        currency: value(form, "currency") || "USD",
        capacity: value(form, "capacity") ? Number(value(form, "capacity")) : null,
        cover_image_url: coverImageUrl || null,
        cover_image_public_id: coverImagePublicId || null,
        instagram_caption: value(form, "instagram_caption") || null,
        linkedin_caption: value(form, "linkedin_caption") || null,
        hashtags: value(form, "hashtags") || null,
        status: "draft" as const,
        created_by: userData.user.id,
      };

      let savedId = eventId;
      if (savedId) {
        const { error: updateError } = await supabase.from("events").update(payload).eq("id", savedId);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase.from("events").insert(payload).select("id").single();
        if (insertError) throw insertError;
        savedId = inserted.id;
        setEventId(inserted.id);
      }

      const publicationRows = channels.map((channel) => ({
        event_id: savedId!,
        channel: channel.id,
        enabled: selectedChannels.includes(channel.id),
        status: selectedChannels.includes(channel.id) ? "pending" : "not_selected",
      }));

      const { error: publicationError } = await supabase.from("event_publications").upsert(publicationRows, { onConflict: "event_id,channel" });
      if (publicationError) throw publicationError;

      setMessage("Draft saved successfully. You can now review the event.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Event Studio</p>
        <h1>Create once. Publish everywhere.</h1>
        <p className="lede">Build the master Experience Healing event, upload one source image to Cloudinary, and select the publishing destinations.</p>
      </section>

      <form className="panel eventForm" onSubmit={saveDraft}>
        <div className="formSection">
          <div><p className="eyebrow">1. Event details</p><h2>Core information</h2></div>
          <label>Event title<input name="title" placeholder="Sound Healing & Meditation" required /></label>
          <label>Short description<input name="short_description" placeholder="A calming evening of guided healing and sound." /></label>
          <label>Full description<textarea name="description" rows={7} placeholder="Tell guests what to expect..." /></label>
          <div className="twoCol">
            <label>Starts<input name="start_at" type="datetime-local" /></label>
            <label>Ends<input name="end_at" type="datetime-local" /></label>
          </div>
        </div>

        <div className="formSection">
          <div><p className="eyebrow">2. Location & registration</p><h2>Where people join</h2></div>
          <label>Venue name<input name="venue_name" placeholder="Experience Healing Studio" /></label>
          <label>Address line 1<input name="address_line1" placeholder="123 Main Street" /></label>
          <label>Address line 2<input name="address_line2" placeholder="Suite / Unit (optional)" /></label>
          <div className="threeCol">
            <label>City<input name="city" /></label>
            <label>State<input name="state" defaultValue="WA" /></label>
            <label>ZIP<input name="postal_code" /></label>
          </div>
          <div className="twoCol">
            <label>Country<input name="country" defaultValue="US" /></label>
            <label>Capacity<input name="capacity" type="number" min="1" placeholder="Optional" /></label>
          </div>
          <label>Registration URL<input name="registration_url" type="url" placeholder="https://..." /></label>
        </div>

        <div className="formSection">
          <div><p className="eyebrow">3. Pricing</p><h2>Free or paid event</h2></div>
          <div className="threeCol">
            <label>Pricing type<select name="pricing_type" defaultValue="free"><option value="free">Free / RSVP</option><option value="paid">Paid / Ticketed</option></select></label>
            <label>Ticket price<input name="price" type="number" min="0" step="0.01" placeholder="25.00" /></label>
            <label>Currency<select name="currency" defaultValue="USD"><option value="USD">USD</option><option value="CAD">CAD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option></select></label>
          </div>
          <p className="mutedText">For paid events, enter the standard/general-admission ticket price. Wix and Eventbrite will use this when their ticket definitions are created.</p>
        </div>

        <div className="formSection">
          <div><p className="eyebrow">4. Media</p><h2>Event image</h2></div>
          <div className="uploadBox">
            <strong>Upload event flyer or photo</strong>
            <span>Stored in Cloudinary and reused for each publishing destination.</span>
            <input type="file" accept="image/*" onChange={uploadImage} disabled={uploading} />
            {uploading ? <small>Uploading...</small> : null}
            {coverImageUrl ? <img className="eventPreviewImage" src={coverImageUrl} alt="Event flyer preview" /> : null}
          </div>
        </div>

        <div className="formSection">
          <div><p className="eyebrow">5. Social copy</p><h2>Customize by channel</h2></div>
          <label>Instagram caption<textarea name="instagram_caption" rows={5} placeholder="Instagram-ready caption..." /></label>
          <label>LinkedIn caption<textarea name="linkedin_caption" rows={5} placeholder="LinkedIn-ready copy..." /></label>
          <label>Hashtags<input name="hashtags" placeholder="#ExperienceHealing #Wellness #Seattle" /></label>
        </div>

        <div className="formSection">
          <div><p className="eyebrow">6. Destinations</p><h2>Select where to publish</h2></div>
          <div className="channelGrid">
            {channels.map((channel) => {
              const selected = selectedChannels.includes(channel.id);
              return (
                <button className={`channel channelButton ${selected ? "selected" : ""}`} type="button" key={channel.id} onClick={() => toggleChannel(channel.id)}>
                  <strong>{channel.label}</strong><small>{selected ? "Selected" : "Not selected"}</small>
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="formError">{error}</p> : null}
        {message ? <p className="formSuccess">{message}</p> : null}

        <div className="formActions">
          <button className="secondaryButton" type="submit" disabled={saving}>{saving ? "Saving..." : "Save draft"}</button>
          <button className="primaryButton" type="button" disabled={!eventId} onClick={() => eventId && (window.location.href = `/events/${eventId}?mode=review`)}>Review event</button>
        </div>
      </form>
    </main>
  );
}
