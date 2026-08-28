create table if not exists public.post_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  facebook_caption text,
  instagram_caption text,
  linkedin_caption text,
  hashtags text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger post_templates_set_updated_at before update on public.post_templates
for each row execute function public.set_updated_at();

alter table public.post_templates enable row level security;

create policy "approved admins can manage post templates"
on public.post_templates for all
to authenticated
using (public.is_approved_user())
with check (public.is_approved_user());
