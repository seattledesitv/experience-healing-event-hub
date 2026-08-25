"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("display_name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    setLoading(true); setError(""); setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (signUpError) setError(signUpError.message);
    else setMessage("Account created. After email verification, an existing super admin must approve your access before you can use the Event Hub.");
    setLoading(false);
  }

  return (
    <main className="authPage">
      <section className="authBrandPanel">
        <div className="brandMark large">EH</div>
        <p className="eyebrow">Experience Healing</p>
        <h1>Event Hub</h1>
        <p>Compassionate care. Thoughtful organization. One place to manage every event and publishing destination.</p>
        <div className="healingTagline">Heal your past · Restore your present · Embrace your future</div>
      </section>
      <section className="authCardWrap">
        <form className="panel authForm" onSubmit={handleSubmit}>
          <div><p className="eyebrow">Request access</p><h2>Create an account</h2><p className="mutedText">New accounts remain pending until approved by a super admin.</p></div>
          <label>Name<input name="display_name" required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" minLength={8} required /></label>
          {error ? <p className="formError">{error}</p> : null}
          {message ? <p className="formSuccess">{message}</p> : null}
          <button className="primaryButton" disabled={loading}>{loading ? "Creating..." : "Create account"}</button>
          <Link className="secondaryButton inlineButton fullButton" href="/login">Back to sign in</Link>
        </form>
      </section>
    </main>
  );
}
