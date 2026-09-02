-- Yuniko media bucket for Supabase Storage.
-- Run this in the Supabase SQL editor after creating the project.
-- The API uploads with the server-only service-role key; public posts use public URLs.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;
