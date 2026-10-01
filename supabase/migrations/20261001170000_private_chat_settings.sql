alter table public.conversation_members
  add column if not exists read_receipts_enabled boolean not null default true,
  add column if not exists nickname text;

create index if not exists conversation_members_read_receipts_idx on public.conversation_members(user_id,read_receipts_enabled);