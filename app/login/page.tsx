"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="authPage">
      <section className="authBrandPanel">
        <div className="brandMark large">EH</div>
        <p className="eyebrow">Experience Healing</p>
        <h1>Event Hub</h1>
        <p>Manage events, publishing, and community outreach from one calm, organized workspace.</p>
        <div className="healingTagline">Restoring hearts · Renewing minds · Transforming lives</div>
      </section>

      <section className="authCardWrap">
        <form className="panel authForm" onSubmit={handleSubmit}>
          <div><p className="eyebrow">Welcome back</p><h2>Sign in</h2><p className="mutedText">Approved team members can access the Event Hub.</p></div>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error ? <p className="formError">{error}</p> : null}
          <button className="primaryButton" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
          <div className="authDivider"><span>New to the Event Hub?</span></div>
          <Link className="secondaryButton inlineButton fullButton" href="/signup">Create an account</Link>
        </form>
      </section>
    </main>
  );
}
