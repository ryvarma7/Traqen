-- Task links are free text (the name of a company or hackathon), not a pick from
-- rows that already exist — so you can tag a task with a job you haven't added yet.

alter table public.tasks rename column related_id to related_name;
alter table public.tasks alter column related_name type text using related_name::text;

-- Backfill the existing uuid links with the name they pointed at.
update public.tasks t
   set related_name = j.company
  from public.job_applications j
 where t.related_type = 'job'
   and j.user_id = t.user_id
   and t.related_name = j.id::text;

update public.tasks t
   set related_name = h.hackathon_name
  from public.hackathons h
 where t.related_type = 'hackathon'
   and h.user_id = t.user_id
   and t.related_name = h.id::text;

-- Links whose row has since been deleted would otherwise show a raw uuid.
update public.tasks
   set related_name = null, related_type = null
 where related_name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';