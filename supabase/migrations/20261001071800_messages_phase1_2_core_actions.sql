alter table public.messages
  add column if not exists reply_to_message_id integer,
  add column if not exists forwarded_from_message_id integer,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.messages
  alter column delivered_at drop default,
  alter column delivered_at drop not null;

alter table public.messages
  add constraint messages_reply_to_message_fk
    foreign key (reply_to_message_id) references public.messages(id) on delete set null,
  add constraint messages_forwarded_from_message_fk
    foreign key (forwarded_from_message_id) references public.messages(id) on delete set null;

create index if not exists messages_reply_to_idx on public.messages(reply_to_message_id);
create index if not exists messages_forwarded_from_idx on public.messages(forwarded_from_message_id);
create index if not exists messages_conversation_id_id_idx on public.messages(conversation_id,id);

create table if not exists public.message_reactions (
  message_id integer not null references public.messages(id) on delete cascade,
  user_id integer not null references public.users(id) on delete cascade,
  reaction text not null check (char_length(reaction) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (message_id,user_id)
);
alter table public.message_reactions enable row level security;
create index if not exists message_reactions_message_idx on public.message_reactions(message_id);
create index if not exists message_reactions_user_idx on public.message_reactions(user_id);

create table if not exists public.message_deletions (
  message_id integer not null references public.messages(id) on delete cascade,
  user_id integer not null references public.users(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  primary key (message_id,user_id)
);
alter table public.message_deletions enable row level security;
create index if not exists message_deletions_user_idx on public.message_deletions(user_id);

alter table public.conversation_members
  add column if not exists last_active_at timestamptz,
  add column if not exists typing_at timestamptz;

create index if not exists conversation_members_active_idx on public.conversation_members(conversation_id,last_active_at);
