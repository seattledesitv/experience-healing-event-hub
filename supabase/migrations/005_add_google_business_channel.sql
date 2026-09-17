alter table public.event_publications
drop constraint if exists event_publications_channel_check;

alter table public.event_publications
add constraint event_publications_channel_check
check (channel in ('facebook','instagram','linkedin','eventbrite','humanitix','wix','google_business'));

insert into public.event_publications (event_id, channel, enabled, status)
select e.id, 'google_business', false, 'not_selected'::public.publish_status
from public.events e
where not exists (
  select 1 from public.event_publications p
  where p.event_id = e.id and p.channel = 'google_business'
);
