-- Ejecutar completo en Supabase SQL Editor DESPUES de 202609240001.
-- Amplia el CHECK y el validador del guardado atomico. Conserva tabla, datos y RLS.
begin;

alter table public.daily_activity_intentions
  drop constraint if exists daily_activity_intentions_activity_type_check;
alter table public.daily_activity_intentions
  add constraint daily_activity_intentions_activity_type_check
  check (activity_type in ('CrossFit', 'Caminata', 'Carrera', 'Bicicleta', 'Descanso'));

create or replace function public.set_daily_activity_intentions(p_user_id uuid, p_date date, p_types text[])
returns setof public.daily_activity_intentions
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_date is null or p_types is null or exists (
    select 1 from unnest(p_types) as t(value)
    where value is null or value not in ('CrossFit', 'Caminata', 'Carrera', 'Bicicleta', 'Descanso')
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

commit;
