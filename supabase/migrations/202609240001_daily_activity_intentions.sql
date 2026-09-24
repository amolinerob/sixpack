-- Copiar TODO este archivo en Supabase SQL Editor y ejecutarlo una vez.
-- No modifica perfiles, actividades, objetivos ni datos existentes.
begin;

create table if not exists public.daily_activity_intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  intention_date date not null,
  activity_type text not null check (activity_type in ('CrossFit', 'Caminata', 'Bicicleta', 'Descanso')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, intention_date, activity_type)
);
-- La restricción única también indexa la consulta por usuario y fecha.

create or replace function public.set_daily_activity_intentions_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_activity_intentions_updated_at on public.daily_activity_intentions;
create trigger daily_activity_intentions_updated_at
before update on public.daily_activity_intentions
for each row execute function public.set_daily_activity_intentions_updated_at();

alter table public.daily_activity_intentions enable row level security;
revoke all on table public.daily_activity_intentions from public, anon, authenticated;
grant select, insert, update, delete on table public.daily_activity_intentions to authenticated;

drop policy if exists daily_activity_intentions_select_own on public.daily_activity_intentions;
create policy daily_activity_intentions_select_own on public.daily_activity_intentions
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists daily_activity_intentions_insert_own on public.daily_activity_intentions;
create policy daily_activity_intentions_insert_own on public.daily_activity_intentions
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists daily_activity_intentions_update_own on public.daily_activity_intentions;
create policy daily_activity_intentions_update_own on public.daily_activity_intentions
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists daily_activity_intentions_delete_own on public.daily_activity_intentions;
create policy daily_activity_intentions_delete_own on public.daily_activity_intentions
for delete to authenticated using ((select auth.uid()) = user_id);

-- Reemplazo atómico del conjunto del día: evita borrar el plan si falla un insert.
-- Invoker: conserva RLS, no usa service_role ni eleva privilegios.
create or replace function public.set_daily_activity_intentions(p_user_id uuid, p_date date, p_types text[])
returns setof public.daily_activity_intentions
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_date is null or p_types is null or exists (
    select 1 from unnest(p_types) as t(value)
    where value is null or value not in ('CrossFit', 'Caminata', 'Bicicleta', 'Descanso')
  ) then
    raise exception 'Planificación inválida' using errcode = '22023';
  end if;
  if 'Descanso' = any(p_types) and exists (select 1 from unnest(p_types) as t(value) where value <> 'Descanso') then
    raise exception 'Descanso no puede combinarse con actividades' using errcode = '22023';
  end if;
  -- Serializa guardados simultáneos del mismo usuario y fecha entre dispositivos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_date::text, 0));
  delete from public.daily_activity_intentions
    where user_id = p_user_id and intention_date = p_date and not (activity_type = any(p_types));
  insert into public.daily_activity_intentions (user_id, intention_date, activity_type)
    select p_user_id, p_date, value from (select distinct unnest(p_types) as value) as types
    on conflict (user_id, intention_date, activity_type) do nothing;
  return query select * from public.daily_activity_intentions
    where user_id = p_user_id and intention_date = p_date order by activity_type;
end;
$$;
revoke all on function public.set_daily_activity_intentions(uuid, date, text[]) from public, anon, authenticated;
grant execute on function public.set_daily_activity_intentions(uuid, date, text[]) to authenticated;

commit;
