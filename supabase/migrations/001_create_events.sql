create extension if not exists "pgcrypto";

create type public.event_status as enum ('draft','ready','publishing','published','archived');
create type public.publish_status as enum ('not_selected','pending','publishing','published','failed','manual_action_required');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  short_description text,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  timezone text not null default 'America/Los_Angeles',
  venue_name text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text default 'US',
  event_type text,
  is_free boolean not null default true,
  price_cents integer,
  currency text default 'USD',
  registration_url text,
  capacity integer,
  cover_image_url text,
  cover_image_public_id text,
  instagram_caption text,
  linkedin_caption text,
  hashtags text,
  status public.event_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_publications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  channel text not null check (channel in ('instagram','linkedin','eventbrite','humanitix','wix')),
  enabled boolean not null default false,
  status public.publish_status not null default 'not_selected',
  external_id text,
  external_url text,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, channel)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();

create trigger event_publications_set_updated_at before update on public.event_publications
for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.event_publications enable row level security;

create policy "authenticated users can manage events"
on public.events for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can manage event publications"
on public.event_publications for all
to authenticated
using (true)
with check (true);
