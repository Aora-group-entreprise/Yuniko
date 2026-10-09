alter table public.comments
  add column if not exists client_mutation_id text;

create unique index if not exists comments_client_mutation_id_uidx
  on public.comments (client_mutation_id)
  where client_mutation_id is not null;
