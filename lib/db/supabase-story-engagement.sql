-- Run this after the base Yuniko tables exist in Supabase/PostgreSQL.
create table if not exists story_views (
  id serial primary key,
  story_id integer not null references stories(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  viewed_at timestamp not null default now(),
  constraint story_views_story_user_idx unique (story_id, user_id)
);
create table if not exists story_reactions (
  id serial primary key,
  story_id integer not null references stories(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  emoji text not null,
  created_at timestamp not null default now(),
  constraint story_reactions_story_user_idx unique (story_id, user_id)
);
create table if not exists story_replies (
  id serial primary key,
  story_id integer not null references stories(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  text text not null,
  created_at timestamp not null default now()
);
