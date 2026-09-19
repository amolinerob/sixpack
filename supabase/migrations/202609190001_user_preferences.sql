-- Ejecutar en el SQL Editor de Supabase. No modifica datos existentes.
begin;

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  accent_color text not null check (accent_color in ('green', 'turquoise', 'blue', 'violet', 'pink', 'orange')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_preferences_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_user_preferences_updated_at();

alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own on public.user_preferences
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own on public.user_preferences
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists user_preferences_delete_own on public.user_preferences;
create policy user_preferences_delete_own on public.user_preferences
for delete to authenticated using ((select auth.uid()) = user_id);

-- La clave primaria ya crea el índice necesario para user_id y las policies.
commit;
