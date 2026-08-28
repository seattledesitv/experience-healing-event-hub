"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { supportedTemplatePlaceholders } from "@/lib/template-render";

type Template = {
  id: string;
  name: string;
  description: string | null;
  facebook_caption: string | null;
  instagram_caption: string | null;
  linkedin_caption: string | null;
  hashtags: string | null;
};

const emptyTemplate = { name: "", description: "", facebook_caption: "", instagram_caption: "", linkedin_caption: "", hashtags: "" };
const sample = `[NEW CIRCLE] {{event_title}}\n\n📅 Date: {{event_date}} | {{event_time}}\n📍 Where: {{city}}, {{postal_code}}\n\nRegister now!\n➡️ {{instagram_handle}} OR {{registration_url}}\n\nJoin us for this healing circle and connect with like-minded women in a small, intentional group.`;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState(emptyTemplate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadTemplates() {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from("post_templates").select("id,name,description,facebook_caption,instagram_caption,linkedin_caption,hashtags").order("name");
    if (error) setError(error.message); else setTemplates((data || []) as Template[]);
    setLoading(false);
  }

  useEffect(() => { loadTemplates(); }, []);

  function beginEdit(template: Template) {
    setEditing(template);
    setForm({
      name: template.name,
      description: template.description || "",
      facebook_caption: template.facebook_caption || "",
      instagram_caption: template.instagram_caption || "",
      linkedin_caption: template.linkedin_caption || "",
      hashtags: template.hashtags || "",
    });
    setMessage(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditing(null); setForm(emptyTemplate); setMessage(""); setError("");
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true); setError(""); setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      facebook_caption: form.facebook_caption.trim() || null,
      instagram_caption: form.instagram_caption.trim() || null,
      linkedin_caption: form.linkedin_caption.trim() || null,
      hashtags: form.hashtags.trim() || null,
      created_by: userData.user?.id || null,
    };
    const result = editing
      ? await supabase.from("post_templates").update(payload).eq("id", editing.id)
      : await supabase.from("post_templates").insert(payload);
    if (result.error) setError(result.error.message);
    else { setMessage(editing ? "Template updated." : "Template saved."); resetForm(); await loadTemplates(); }
    setSaving(false);
  }

  async function deleteTemplate(template: Template) {
    if (!window.confirm(`Delete template “${template.name}”?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("post_templates").delete().eq("id", template.id);
    if (error) setError(error.message); else await loadTemplates();
  }

  const field = (key: keyof typeof emptyTemplate, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <main className="shell">
      <section className="hero compactHero">
        <div><p className="eyebrow">Reusable content</p><h1>Post templates</h1><p className="lede">Save reusable copy with dynamic fields for dates, locations, registration links and event details.</p></div>
        <Link className="secondaryButton inlineButton" href="/events/new">Create event</Link>
      </section>

      <section className="panel">
        <p className="eyebrow">Dynamic fields</p>
        <h2>Use placeholders for anything that changes</h2>
        <p className="mutedText">When a template is applied, the Event Hub replaces these placeholders using the event details. The rendered copy is saved into the event, so changing the template later will not modify an existing event.</p>
        <div className="channelGrid">
          {supportedTemplatePlaceholders.map((item) => <div className="channel" key={item}><strong>{item}</strong></div>)}
        </div>
        <div className="reviewCopy">
          <h3>Example</h3>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{sample}</pre>
        </div>
      </section>

      <form className="panel eventForm" onSubmit={saveTemplate}>
        <div className="formSection">
          <div><p className="eyebrow">{editing ? "Edit template" : "New template"}</p><h2>{editing ? editing.name : "Create reusable copy"}</h2></div>
          <label>Template name<input value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="Women's Full Moon Healing Circle" required /></label>
          <label>Master event description<textarea rows={10} value={form.description} onChange={(e) => field("description", e.target.value)} placeholder={sample} /></label>
          <label>Facebook caption<textarea rows={7} value={form.facebook_caption} onChange={(e) => field("facebook_caption", e.target.value)} placeholder="Facebook-ready copy with {{event_date}}, {{city}}, etc..." /></label>
          <label>Instagram caption<textarea rows={8} value={form.instagram_caption} onChange={(e) => field("instagram_caption", e.target.value)} placeholder={sample} /></label>
          <label>LinkedIn caption<textarea rows={7} value={form.linkedin_caption} onChange={(e) => field("linkedin_caption", e.target.value)} placeholder="LinkedIn-ready copy..." /></label>
          <label>Hashtags<input value={form.hashtags} onChange={(e) => field("hashtags", e.target.value)} placeholder="#experiencehealing #{{month_lower}} #healingcircle" /></label>
          <p className="mutedText">Use fixed hashtags for evergreen topics and placeholders such as <code>{"#{{month_lower}}"}</code> for values that change each event.</p>
          {error ? <p className="formError">{error}</p> : null}{message ? <p className="formSuccess">{message}</p> : null}
          <div className="formActions"><button className="primaryButton" disabled={saving}>{saving ? "Saving..." : editing ? "Update template" : "Save template"}</button>{editing ? <button className="secondaryButton" type="button" onClick={resetForm}>Cancel</button> : null}</div>
        </div>
      </form>

      <section className="panel">
        <div className="sectionHeading"><div><p className="eyebrow">Saved library</p><h2>Your templates</h2></div></div>
        {loading ? <p>Loading templates...</p> : templates.length === 0 ? <p className="mutedText">No templates yet.</p> : (
          <div className="publishList">
            {templates.map((template) => (
              <div className="publishChannel" key={template.id}>
                <div className="publishRow"><div><strong>{template.name}</strong><small>{template.description ? template.description.slice(0, 110) : "No master description"}</small></div></div>
                <div className="heroActions">
                  <Link className="primaryButton inlineButton smallButton" href={`/events/new?template=${template.id}`}>Use template</Link>
                  <button className="secondaryButton smallButton" type="button" onClick={() => beginEdit(template)}>Edit</button>
                  <button className="secondaryButton smallButton" type="button" onClick={() => deleteTemplate(template)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
