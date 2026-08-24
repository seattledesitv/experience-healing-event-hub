alter table public.events
add column if not exists facebook_caption text;

alter table public.event_publications
drop constraint if exists event_publications_channel_check;

alter table public.event_publications
add constraint event_publications_channel_check
check (channel in ('facebook','instagram','linkedin','eventbrite','humanitix','wix'));
