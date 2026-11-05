-- Create storage bucket for team logos
insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true);

-- Allow public read access to team logos
create policy "Team logos are publicly accessible"
on storage.objects
for select
using (bucket_id = 'team-logos');

-- Allow teams to upload their own logos (using token as folder name)
create policy "Teams can upload their own logos"
on storage.objects
for insert
with check (bucket_id = 'team-logos');

-- Allow teams to update their own logos
create policy "Teams can update their own logos"
on storage.objects
for update
using (bucket_id = 'team-logos');

-- Allow teams to delete their own logos
create policy "Teams can delete their own logos"
on storage.objects
for delete
using (bucket_id = 'team-logos');