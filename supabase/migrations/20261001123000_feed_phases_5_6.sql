create table if not exists public.feed_rank_configs (
  variant text primary key check (variant in ('A','B')),
  engagement_weight numeric not null,
  velocity_weight numeric not null,
  freshness_weight numeric not null,
  relevance_weight numeric not null,
  personalization_weight numeric not null,
  quality_weight numeric not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.feed_rank_configs
  (variant, engagement_weight, velocity_weight, freshness_weight, relevance_weight, personalization_weight, quality_weight)
values
  ('A',0.30,0.20,0.15,0.20,0.10,0.05),
  ('B',0.25,0.20,0.15,0.20,0.15,0.05)
on conflict (variant) do update set
  engagement_weight=excluded.engagement_weight,
  velocity_weight=excluded.velocity_weight,
  freshness_weight=excluded.freshness_weight,
  relevance_weight=excluded.relevance_weight,
  personalization_weight=excluded.personalization_weight,
  quality_weight=excluded.quality_weight,
  updated_at=now();

alter table public.feed_rank_configs enable row level security;

alter table public.post_distribution
  add column if not exists second_chance_used boolean not null default false,
  add column if not exists second_chance_at timestamptz,
  add column if not exists stage_started_at timestamptz not null default now();

create index if not exists post_distribution_country_idx on public.post_distribution using gin(countries);
create index if not exists post_distribution_status_eval_idx on public.post_distribution(status,last_eval_at);
create index if not exists post_stats_score_idx on public.post_stats(score desc);
create index if not exists user_affinity_target_idx on public.user_affinity(target_user_id,score desc);
create index if not exists user_topic_affinity_topic_idx on public.user_topic_affinity(topic,score desc);
create index if not exists post_engagements_user_post_idx on public.post_engagements(user_id,post_id);

create or replace function public.refresh_yuniko_post_stats()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.post_stats(
    post_id, impressions, likes, comments, saves, shares, completion_rate, score, updated_at
  )
  select
    post_row.id,
    greatest(0, coalesce((select sum(e.view_count) from public.post_engagements e where e.post_id=post_row.id),0)),
    greatest(0, coalesce((select count(*) from public.likes l where l.post_id=post_row.id),0)),
    greatest(0, coalesce((select count(*) from public.comments c where c.post_id=post_row.id),0)),
    greatest(0, coalesce((select count(*) from public.saves s where s.post_id=post_row.id),0)),
    greatest(0, coalesce((select count(*) from public.shares sh where sh.post_id=post_row.id),0)),
    coalesce((select avg(e.completion_rate) from public.post_engagements e where e.post_id=post_row.id),0),
    coalesce((
      greatest(0, coalesce((select count(*) from public.likes l where l.post_id=post_row.id),0)) +
      3*greatest(0, coalesce((select count(*) from public.comments c where c.post_id=post_row.id),0)) +
      4*greatest(0, coalesce((select count(*) from public.saves s where s.post_id=post_row.id),0)) +
      5*greatest(0, coalesce((select count(*) from public.shares sh where sh.post_id=post_row.id),0))
    )::numeric / greatest(1,coalesce((select sum(e.view_count) from public.post_engagements e where e.post_id=post_row.id),0)),0),
    now()
  from public.posts p
  where p.deleted_at is null
  on conflict (post_id) do update set
    impressions=excluded.impressions, likes=excluded.likes, comments=excluded.comments,
    saves=excluded.saves, shares=excluded.shares, completion_rate=excluded.completion_rate,
    score=excluded.score, updated_at=now();
end;
$$;

create or replace function public.evaluate_yuniko_post_distribution()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  post_row record;
  current_stage integer;
  current_countries text[];
  creator_country text;
  candidate_country record;
  new_countries text[];
  impressions numeric;
  likes_count numeric;
  comments_count numeric;
  saves_count numeric;
  shares_count numeric;
  er numeric;
  v_velocity numeric;
  age_hours numeric;
  rolling_er numeric;
  rolling_velocity numeric;
  pass boolean;
  stage_max_hours numeric;
begin
  perform public.refresh_yuniko_post_stats();

  for post_row in
    select
      post_data.id, post_data.user_id, post_data.created_at, post_data.media_type, post_data.hashtags,
      coalesce(s.impressions,0) impressions,
      coalesce(s.likes,0) likes_count,
      coalesce(s.comments,0) comments_count,
      coalesce(s.saves,0) saves_count,
      coalesce(s.shares,0) shares_count
    from public.posts post_data
    left join public.post_stats s on s.post_id=post_data.id
    where post_data.is_world_feed=true and post_data.deleted_at is null
  loop
    select lower(trim(u.country)) into creator_country
    from public.users u where u.id=post_row.user_id;

    if creator_country is null or creator_country='' then
      creator_country := 'world';
    end if;

    impressions := greatest(0,post_row.impressions);
    er := (post_row.likes_count+post_row.comments_count+post_row.saves_count+post_row.shares_count)/greatest(1,impressions);
    age_hours := greatest(0.01,extract(epoch from (now()-post_row.created_at))/3600);
    v_velocity := er/greatest(0.01,age_hours);

    select coalesce(percentile_cont(0.5) within group(order by
      (s.likes+s.comments+s.saves+s.shares)/greatest(1,s.impressions)),0)
      into rolling_er
    from public.post_stats s
    join public.posts rp on rp.id=s.post_id
    join public.users ru on ru.id=rp.user_id
    where lower(coalesce(ru.country,''))=creator_country
      and coalesce(rp.media_type,'')=coalesce(post_row.media_type,'')
      and rp.created_at > now()-interval '7 days';

    select coalesce(percentile_cont(0.5) within group(order by
      ((s.likes+s.comments+s.saves+s.shares)/greatest(1,s.impressions)) /
      greatest(0.01,extract(epoch from (now()-rp.created_at))/3600)),0)
      into rolling_velocity
    from public.post_stats s
    join public.posts rp on rp.id=s.post_id
    join public.users ru on ru.id=rp.user_id
    where lower(coalesce(ru.country,''))=creator_country
      and coalesce(rp.media_type,'')=coalesce(post_row.media_type,'')
      and rp.created_at > now()-interval '7 days';

    select coalesce(d.stage,1),coalesce(d.countries,array[creator_country]),coalesce(d.second_chance_used,false)
      into current_stage,current_countries,pass
    from public.post_distribution d where d.post_id=post_row.id;

    if not found then
      current_stage := 1;
      pass := false;
      select array_agg(country order by score desc nulls last)
        into new_countries
      from (
        select lower(trim(u.country)) country,
          (
            0.40 * least(1.0, count(*) filter(where f.following_id=post_row.user_id)::numeric / greatest(1,count(*))) +
            0.20 * least(1.0,coalesce(avg(ua.score) filter(where ua.target_user_id=post_row.user_id),0)) +
            0.15 * least(1.0,coalesce(avg(uta.score),0))
          ) score
        from public.users u
        left join public.follows f on f.follower_id=u.id and f.following_id=post_row.user_id
        left join public.user_affinity ua on ua.user_id=u.id and ua.target_user_id=post_row.user_id
        left join public.user_topic_affinity uta on uta.user_id=u.id
          and post_row.hashtags is not null
          and position(lower(uta.topic) in lower(post_row.hashtags))>0
        where u.country is not null and lower(trim(u.country))<>creator_country
        group by lower(trim(u.country))
        order by score desc nulls last
        limit 2
      ) ranked_countries;
      current_countries := array[creator_country] || coalesce(new_countries,'{}'::text[]);
      insert into public.post_distribution(post_id,stage,countries,last_eval_at,impressions_at_stage,engagement_rate,velocity,status,second_chance_used,stage_started_at)
      values(post_row.id,1,current_countries,now(),impressions,er,v_velocity,'active',false,now())
      on conflict(post_id) do nothing;
    end if;

    if current_stage between 1 and 3 then
      stage_max_hours := case current_stage when 1 then 6 when 2 then 12 else 24 end;
      pass := impressions >= case current_stage when 1 then 2300 when 2 then 1500 else 4000 end
        and (case when impressions < 300
          then (
            (er*impressions + 1.96*1.96/2 -
             1.96*sqrt(greatest(0,(er*impressions)*(1-(er*impressions)/greatest(1,impressions))/greatest(1,impressions) + 1.96*1.96/(4*greatest(1,impressions)))) )
            /(1+1.96*1.96/greatest(1,impressions))
          )
          else er end) >= greatest(
            case current_stage when 1 then 0.06 when 2 then 0.05 else 0.04 end,coalesce(rolling_er,0))
        and v_velocity >= greatest(case current_stage when 1 then 0.04 when 2 then 0.03 else 0.02 end,coalesce(rolling_velocity,0));

      if pass then
        if current_stage=1 then current_stage:=2;
        elsif current_stage=2 then current_stage:=3;
        else current_stage:=4;
        end if;

        select array_agg(c.country order by c.score desc nulls last)
          into new_countries
        from (
          select
            lower(trim(u.country)) country,
            (
              0.40 * least(1.0, count(*) filter(where f.following_id=post_row.user_id)::numeric / greatest(1,count(*))) +
              0.25 * 0.0 +
              0.20 * least(1.0,coalesce(avg(ua.score) filter(where ua.target_user_id=post_row.user_id),0)) +
              0.15 * least(1.0,coalesce(avg(uta.score),0))
            ) score
          from public.users u
          left join public.follows f on f.follower_id=u.id and f.following_id=post_row.user_id
          left join public.user_affinity ua on ua.user_id=u.id and ua.target_user_id=post_row.user_id
          left join public.user_topic_affinity uta on uta.user_id=u.id
            and post_row.hashtags is not null
            and position(lower(uta.topic) in lower(post_row.hashtags))>0
          where u.country is not null and lower(trim(u.country))<>creator_country
          group by lower(trim(u.country))
        ) c
        where c.country is not null
        limit greatest(0, (case current_stage when 2 then 4 when 3 then 6 else 999999 end));

        current_countries := (
          select array_agg(distinct x)
          from unnest(array_append(current_countries,creator_country)) x
          where x is not null
        );
        if new_countries is not null then
          current_countries := (
            select array_agg(distinct x)
            from unnest(current_countries || new_countries) x
          );
        end if;

        update public.post_distribution
        set stage=current_stage,countries=current_countries,last_eval_at=now(),
            impressions_at_stage=impressions,engagement_rate=er,velocity=v_velocity,
            status='active',stage_started_at=now()
        where post_id=post_row.id;
      elsif now() >= coalesce((select stage_started_at from public.post_distribution where post_id=post_row.id),post_row.created_at)
            + stage_max_hours * interval '1 hour' then
        if not (select second_chance_used from public.post_distribution where post_id=post_row.id) then
          update public.post_distribution
          set status='held',second_chance_at=now()+interval '12 hours',
              last_eval_at=now(),second_chance_used=true
          where post_id=post_row.id;
        else
          update public.post_distribution
          set status='stopped',last_eval_at=now()
          where post_id=post_row.id;
        end if;
      else
        update public.post_distribution
        set last_eval_at=now(),engagement_rate=er,velocity=v_velocity
        where post_id=post_row.id;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.refresh_yuniko_post_stats() from public, anon, authenticated;
revoke all on function public.evaluate_yuniko_post_distribution() from public, anon, authenticated;
grant execute on function public.refresh_yuniko_post_stats() to postgres;
grant execute on function public.evaluate_yuniko_post_distribution() to postgres;

select cron.unschedule(jobid) from cron.job where jobname='yuniko-feed-distribution-5m';
select cron.schedule('yuniko-feed-distribution-5m','*/5 * * * *','select public.evaluate_yuniko_post_distribution();');

do $$
begin
  perform public.evaluate_yuniko_post_distribution();
exception when others then
  raise notice 'Initial Yuniko distribution evaluation skipped: %', sqlerrm;
end $$;
