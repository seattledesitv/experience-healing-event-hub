create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  facebook_caption text,
  instagram_caption text,
  linkedin_caption text,
  google_business_caption text,
  hashtags text,
  link_url text,
  media_url text,
  media_public_id text,
  media_type text not null default 'image' check (media_type in ('image','video')),
  instagram_collaborators text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','ready','published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();

create table if not exists public.post_publications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  channel text not null check (channel in ('facebook','instagram','linkedin','google_business')),
  enabled boolean not null default true,
  status text not null default 'pending',
  external_id text,
  external_url text,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(post_id, channel)
);

create trigger post_publications_set_updated_at before update on public.post_publications for each row execute function public.set_updated_at();

alter table public.posts enable row level security;
alter table public.post_publications enable row level security;

create policy "approved users manage posts" on public.posts for all to authenticated using (public.is_approved_user()) with check (public.is_approved_user());
create policy "approved users manage post publications" on public.post_publications for all to authenticated using (public.is_approved_user()) with check (public.is_approved_user());
