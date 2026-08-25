create table if not exists public.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'pending' check (role in ('pending','admin','super_admin')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_access()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_access (user_id, email, display_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name'), 'pending')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_access on auth.users;
create trigger on_auth_user_created_access
after insert on auth.users
for each row execute function public.handle_new_user_access();

insert into public.user_access (user_id, email, display_name, role)
select id, email, coalesce(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name'), 'pending'
from auth.users
on conflict (user_id) do nothing;

-- Preserve the existing owner/admin workflow by promoting the oldest existing auth user.
update public.user_access
set role = 'super_admin', approved_at = now()
where user_id = (select id from auth.users order by created_at asc limit 1)
  and not exists (select 1 from public.user_access where role = 'super_admin');

create or replace function public.set_user_access_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_access_set_updated_at on public.user_access;
create trigger user_access_set_updated_at before update on public.user_access
for each row execute function public.set_user_access_updated_at();

alter table public.user_access enable row level security;

drop policy if exists "users can read own access" on public.user_access;
create policy "users can read own access"
on public.user_access for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "super admins can read all access" on public.user_access;
create policy "super admins can read all access"
on public.user_access for select
to authenticated
using (exists (
  select 1 from public.user_access me
  where me.user_id = auth.uid() and me.role = 'super_admin'
));

drop policy if exists "super admins can update access" on public.user_access;
create policy "super admins can update access"
on public.user_access for update
to authenticated
using (exists (
  select 1 from public.user_access me
  where me.user_id = auth.uid() and me.role = 'super_admin'
))
with check (role in ('pending','admin','super_admin'));
