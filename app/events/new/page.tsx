"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { renderTemplate, unresolvedPlaceholders } from "@/lib/template-render";

const channels = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "eventbrite", label: "Eventbrite" },
  { id: "wix", label: "Wix" },
];

type Template = {
  id: string;
  name: string;
  description: string | null;
  facebook_caption: string | null;
  instagram_caption: string | null;
  linkedin_caption: string | null;
  hashtags: string | null;
};

type Preview = {
  title: string;
  description: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  hashtags: string;
};

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function toIso(input: string) {
  return input ? new Date(input).toISOString() : null;
}

function valuesFromForm(form: FormData) {
  return {
    event_title: value(form, "title"),
    start_at: value(form, "start_at"),
    end_at: value(form, "end_at"),
    venue: value(form, "venue_name"),
    city: value(form, "city"),
    state: value(form, "state"),
    postal_code: value(form, "postal_code"),
    registration_url: value(form, "registration_url"),
    instagram_handle: "@srimanjuexphealing",
  };
}

export default function NewEventPage() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const formRef = useRef<HTMLFormElement | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [templateLoading, setTemplateLoading] = useState(Boolean(templateId));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["facebook", "instagram", "linkedin", "wix"]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImagePublicId, setCoverImagePublicId] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!templateId) { setTemplateLoading(false); return; }
    const supabase = createSupabaseBrowserClient();
    supabase.from("post_templates").select("id,name,description,facebook_caption,instagram_caption,linkedin_caption,hashtags").eq("id", templateId).single().then(({ data, error }) => {
      if (error) setError(`Unable to load template: ${error.message}`);
      else setTemplate(data as Template);
      setTemplateLoading(false);
    });
  }, [templateId]);

  function updatePreview() {
    if (!template || !formRef.current) { setPreview(null); return; }
    const form = new FormData(formRef.current);
    const baseVars = valuesFromForm(form);
    const title = renderTemplate(value(form, "title") || template.name, baseVars);
    const vars = { ...baseVars, event_title: title };
    setPreview({
      title,
      description: renderTemplate(template.description, vars),
      facebook: renderTemplate(template.facebook_caption, vars),
      instagram: renderTemplate(template.instagram_caption, vars),
      linkedin: renderTemplate(template.linkedin_caption, vars),
      hashtags: renderTemplate(template.hashtags, vars),
    });
  }

  function toggleChannel(channel: string) {
    setSelectedChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(""); setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { window.location.href = "/login"; return; }
      const signResponse = await fetch("/api/cloudinary/sign", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ eventId }) });
      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.error || "Unable to prepare upload");
      const upload = new FormData();
      upload.append("file", file); upload.append("api_key", signed.apiKey); upload.append("timestamp", String(signed.timestamp)); upload.append("signature", signed.signature); upload.append("folder", signed.folder);
      const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: "POST", body: upload });
      const result = await cloudinaryResponse.json();
      if (!cloudinaryResponse.ok) throw new Error(result?.error?.message || "Cloudinary upload failed");
      setCoverImageUrl(result.secure_url); setCoverImagePublicId(result.public_id); setMessage("Image uploaded successfully.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed");
    } finally { setUploading(false); }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(""); setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { window.location.href = "/login"; return; }

      const titlePattern = value(form, "title");
      if (!titlePattern) throw new Error("Event title is required.");
      if (titlePattern.includes("{{month}}") && !value(form, "start_at")) throw new Error("Choose the event start date so {{month}} can be filled in the event title.");

      const pricingType = value(form, "pricing_type") || "free";
      const price = Number(value(form, "price"));
      if (pricingType === "paid" && (!Number.isFinite(price) || price <= 0)) throw new Error("Enter a ticket price greater than 0 for a paid event.");

      const baseVars = valuesFromForm(form);
      const title = template ? renderTemplate(titlePattern, baseVars) : titlePattern;
      const vars = { ...baseVars, event_title: title };
      const rendered = {
        description: template ? renderTemplate(value(form, "description"), vars) : value(form, "description"),
        facebook: template ? renderTemplate(value(form, "facebook_caption"), vars) : value(form, "facebook_caption"),
        instagram: template ? renderTemplate(value(form, "instagram_caption"), vars) : value(form, "instagram_caption"),
        linkedin: template ? renderTemplate(value(form, "linkedin_caption"), vars) : value(form, "linkedin_caption"),
        hashtags: template ? renderTemplate(value(form, "hashtags"), vars) : value(form, "hashtags"),
      };
      const unresolved = unresolvedPlaceholders([title, ...Object.values(rendered)].join("\n"));
      if (unresolved.length) throw new Error(`Fill the event fields required by these template placeholders or remove them: ${unresolved.join(", ")}`);

      const payload = {
        title,
        short_description: value(form, "short_description") || null,
        description: rendered.description || null,
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
        facebook_caption: rendered.facebook || null,
        instagram_caption: rendered.instagram || null,
        linkedin_caption: rendered.linkedin || null,
        hashtags: rendered.hashtags || null,
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
        savedId = inserted.id; setEventId(inserted.id);
      }
      const publicationRows = channels.map((channel) => ({ event_id: savedId!, channel: channel.id, enabled: selectedChannels.includes(channel.id), status: selectedChannels.includes(channel.id) ? "pending" : "not_selected" }));
      const { error: publicationError } = await supabase.from("event_publications").upsert(publicationRows, { onConflict: "event_id,channel" });
      if (publicationError) throw publicationError;
      setMessage("Draft saved successfully with template placeholders resolved. You can now review the event.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft");
    } finally { setSaving(false); }
  }

  if (templateLoading) return <main className="shell"><section className="panel"><p>Loading template...</p></section></main>;

  return (
    <main className="shell">
      <section className="hero"><div><p className="eyebrow">Event Studio</p><h1>Create once. Publish everywhere.</h1><p className="lede">Build the master Experience Healing event, upload one source image, and select only the destinations you actively use.</p></div><Link className="secondaryButton inlineButton" href="/templates">Post templates</Link></section>
      {template ? <section className="panel"><p className="eyebrow">Template applied</p><h2>{template.name}</h2><p className="mutedText">The template title is copied into the event title. You can use {{"{{month}}"}} in that title and it will be replaced from the event start date when saved.</p></section> : null}
      <form ref={formRef} key={template?.id || "blank"} className="panel eventForm" onSubmit={saveDraft} onChange={updatePreview}>
        <div className="formSection"><div><p className="eyebrow">1. Event details</p><h2>Core information</h2></div><label>Event title<input name="title" defaultValue={template?.name || ""} placeholder="{{month}} Full Moon Women's Healing Circle" required /></label><p className="mutedText">When using a template, its title is copied here. Example: {"{{month}}"} Full Moon Women's Healing Circle.</p><label>Short description<input name="short_description" placeholder="A calming evening of guided healing and connection." /></label><label>Full description<textarea name="description" rows={9} defaultValue={template?.description || ""} placeholder="Tell guests what to expect..." /></label><div className="twoCol"><label>Starts<input name="start_at" type="datetime-local" /></label><label>Ends<input name="end_at" type="datetime-local" /></label></div></div>
        <div className="formSection"><div><p className="eyebrow">2. Location & registration</p><h2>Where people join</h2></div><label>Venue name<input name="venue_name" placeholder="Experience Healing Studio" /></label><label>Address line 1<input name="address_line1" placeholder="123 Main Street" /></label><label>Address line 2<input name="address_line2" placeholder="Suite / Unit (optional)" /></label><div className="threeCol"><label>City<input name="city" /></label><label>State<input name="state" defaultValue="WA" /></label><label>ZIP<input name="postal_code" /></label></div><div className="twoCol"><label>Country<input name="country" defaultValue="US" /></label><label>Capacity<input name="capacity" type="number" min="1" placeholder="Optional" /></label></div><label>Registration URL<input name="registration_url" type="url" placeholder="https://..." /></label></div>
        <div className="formSection"><div><p className="eyebrow">3. Pricing</p><h2>Free or paid event</h2></div><div className="threeCol"><label>Pricing type<select name="pricing_type" defaultValue="free"><option value="free">Free / RSVP</option><option value="paid">Paid / Ticketed</option></select></label><label>Ticket price<input name="price" type="number" min="0" step="0.01" placeholder="25.00" /></label><label>Currency<select name="currency" defaultValue="USD"><option value="USD">USD</option><option value="CAD">CAD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option></select></label></div><p className="mutedText">For paid events, enter the standard/general-admission ticket price. Wix and Eventbrite will use this when their ticket definitions are created.</p></div>
        <div className="formSection"><div><p className="eyebrow">4. Media</p><h2>Event image</h2></div><div className="uploadBox"><strong>Upload event flyer or photo</strong><span>Stored in Cloudinary and reused for each publishing destination.</span><input type="file" accept="image/*" onChange={uploadImage} disabled={uploading} />{uploading ? <small>Uploading...</small> : null}{coverImageUrl ? <img className="eventPreviewImage" src={coverImageUrl} alt="Event flyer preview" /> : null}</div></div>
        <div className="formSection"><div><p className="eyebrow">5. Social copy</p><h2>Customize by channel</h2></div><label>Facebook caption<textarea name="facebook_caption" rows={7} defaultValue={template?.facebook_caption || ""} placeholder="Facebook-ready copy..." /></label><label>Instagram caption<textarea name="instagram_caption" rows={8} defaultValue={template?.instagram_caption || ""} placeholder="Instagram-ready caption..." /></label><label>LinkedIn caption<textarea name="linkedin_caption" rows={7} defaultValue={template?.linkedin_caption || ""} placeholder="LinkedIn-ready copy..." /></label><label>Hashtags<input name="hashtags" defaultValue={template?.hashtags || ""} placeholder="#ExperienceHealing #Wellness #Seattle" /></label></div>
        {template ? <div className="formSection"><div><p className="eyebrow">6. Rendered preview</p><h2>What will be saved</h2></div>{preview ? <div className="reviewCopy"><h3>Event title</h3><p>{preview.title || "Enter an event start date to render the title."}</p><h3>Instagram</h3><p style={{ whiteSpace: "pre-wrap" }}>{preview.instagram || "No Instagram copy in this template."}</p><h3>Master description</h3><p style={{ whiteSpace: "pre-wrap" }}>{preview.description || "No master description."}</p><h3>Hashtags</h3><p>{preview.hashtags || "No hashtags."}</p></div> : <p className="mutedText">Start entering the event date/time, location and registration URL to render the template.</p>}</div> : null}
        <div className="formSection"><div><p className="eyebrow">{template ? "7" : "6"}. Destinations</p><h2>Select where to publish</h2></div><div className="channelGrid">{channels.map((channel) => { const selected = selectedChannels.includes(channel.id); return <button className={`channel channelButton ${selected ? "selected" : ""}`} type="button" key={channel.id} onClick={() => toggleChannel(channel.id)}><strong>{channel.label}</strong><small>{selected ? "Selected" : "Not selected"}</small></button>; })}</div></div>
        {error ? <p className="formError">{error}</p> : null}{message ? <p className="formSuccess">{message}</p> : null}
        <div className="formActions"><button className="secondaryButton" type="submit" disabled={saving}>{saving ? "Saving..." : "Save draft"}</button><button className="primaryButton" type="button" disabled={!eventId} onClick={() => eventId && (window.location.href = `/events/${eventId}?mode=review`)}>Review event</button></div>
      </form>
    </main>
  );
}
