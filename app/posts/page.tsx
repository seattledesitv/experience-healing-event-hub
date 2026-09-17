"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Post = { id: string; title: string; media_type: string; status: string; created_at: string };

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]); const [error, setError] = useState("");
  useEffect(() => { const supabase = createSupabaseBrowserClient(); supabase.from("posts").select("id,title,media_type,status,created_at").order("created_at", { ascending: false }).then(({ data, error }) => { if (error) setError(error.message); else setPosts((data || []) as Post[]); }); }, []);
  return <main className="shell"><section className="hero"><div><p className="eyebrow">Publishing Studio</p><h1>Posts</h1><p className="lede">Create one image or video post, customize the copy by platform, add supported collaborators, and publish from one place.</p></div><Link className="primaryButton inlineButton" href="/posts/new">+ Create Post</Link></section>
    {error ? <section className="panel"><p className="formError">{error}</p><p className="mutedText">If this is the first time opening Publishing Studio, run migration 006 in Supabase.</p></section> : null}
    <section className="panel"><div className="publishList">{posts.length ? posts.map((post) => <Link href={`/posts/${post.id}`} className="publishChannel" key={post.id}><div className="publishRow"><div><strong>{post.title}</strong><small>{post.media_type} · {new Date(post.created_at).toLocaleString()}</small></div><span className={`statusPill status-${post.status}`}>{post.status}</span></div></Link>) : <div><h2>No posts yet</h2><p className="mutedText">Create your first social post independently from Events.</p></div>}</div></section>
  </main>;
}
