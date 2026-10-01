alter table public.messages
  add column if not exists media_path text,
  add column if not exists media_name text,
  add column if not exists media_size integer,
  add column if not exists media_mime_type text;

create index if not exists messages_media_path_idx on public.messages(media_path);

create table if not exists public.message_rate_limits (
  user_id integer primary key references public.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  message_count integer not null default 0,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.message_rate_limits enable row level security;

create index if not exists reports_message_lookup_idx
  on public.reports(reporter_id,target_type,target_id,status);