"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UserAccess = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: "pending" | "admin" | "super_admin";
  created_at: string;
  approved_at: string | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadUsers() {
    const supabase = createSupabaseBrowserClient();
    const { data, error: queryError } = await supabase
      .from("user_access")
      .select("user_id,email,display_name,role,created_at,approved_at")
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setUsers((data || []) as UserAccess[]);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function setRole(user: UserAccess, role: UserAccess["role"]) {
    if (role === "super_admin" && !window.confirm(`Make ${user.email || user.display_name || "this user"} a super admin?`)) return;
    setBusy(user.user_id); setError("");
    const supabase = createSupabaseBrowserClient();
    const { data: me } = await supabase.auth.getUser();
    const { error: updateError } = await supabase
      .from("user_access")
      .update({ role, approved_at: role === "pending" ? null : new Date().toISOString(), approved_by: me.user?.id || null })
      .eq("user_id", user.user_id);
    if (updateError) setError(updateError.message);
    else await loadUsers();
    setBusy(null);
  }

  return (
    <main className="shell appShellPage">
      <section className="pageHeader">
        <div><p className="eyebrow">Administration</p><h1>Users & Access</h1><p className="lede">Approve new accounts and manage who can administer the Experience Healing Event Hub.</p></div>
      </section>

      <section className="panel">
        <div className="sectionHeading"><div><p className="eyebrow">Access requests</p><h2>Team accounts</h2></div><span className="countBadge">{users.filter((u) => u.role === "pending").length} pending</span></div>
        {loading ? <p>Loading users...</p> : null}
        {error ? <p className="formError">{error}</p> : null}
        <div className="userTable">
          {users.map((user) => (
            <div className="userRow" key={user.user_id}>
              <div><strong>{user.display_name || "Unnamed user"}</strong><span>{user.email || "No email"}</span></div>
              <span className={`statusPill status-${user.role}`}>{user.role.replace("_", " ")}</span>
              <div className="userActions">
                {user.role === "pending" ? <button className="primaryButton smallButton" disabled={busy === user.user_id} onClick={() => setRole(user, "admin")}>Approve as admin</button> : null}
                {user.role === "admin" ? <button className="secondaryButton smallButton" disabled={busy === user.user_id} onClick={() => setRole(user, "pending")}>Revoke access</button> : null}
                {user.role !== "super_admin" ? <button className="secondaryButton smallButton" disabled={busy === user.user_id} onClick={() => setRole(user, "super_admin")}>Make super admin</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
