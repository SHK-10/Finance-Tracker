-- Run this in the Supabase SQL Editor.
-- user_app_data stores full local records; feature tables mirror their rows
-- using the same app account and authenticated user ownership.

-- One application profile per Supabase Auth user.
create table if not exists public.users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create/update the public profile as part of Supabase Auth registration.
-- This also works when email confirmation means signup returns no session.
create or replace function public.handle_new_folio_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (user_id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_folio_auth_user_created on auth.users;
create trigger on_folio_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_folio_user();

-- Backfill accounts created before this trigger was installed.
insert into public.users (user_id, email, full_name)
select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (user_id) do update
  set email = excluded.email,
      full_name = case when excluded.full_name <> '' then excluded.full_name else public.users.full_name end,
      updated_at = now();

create table if not exists public.user_app_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, storage_key)
);

-- Shared row shape keeps feature records flexible while preserving ownership
-- and separation between Personal, Family, and custom in-app accounts.
create table if not exists public.account_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, record_id)
);

create table if not exists public.transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, record_id)
);

create table if not exists public.budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, record_id)
);

create table if not exists public.financial_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, record_id)
);

create table if not exists public.financial_plan_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, record_id)
);

create table if not exists public.net_worth_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, record_id)
);

create table if not exists public.loans (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, record_id)
);

create table if not exists public.recurring_transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, record_id)
);

create table if not exists public.reminders (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, record_id)
);

-- Apply owner-only row security to every table.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'users', 'user_app_data', 'account_profiles', 'transactions', 'budgets',
    'financial_goals', 'financial_plan_settings', 'net_worth_entries', 'loans',
    'recurring_transactions', 'reminders'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Users manage their own Folio rows" on public.%I', table_name);
    execute format(
      'create policy "Users manage their own Folio rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

-- The app uses Realtime for the key/value sync table. Add it only if needed.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_app_data'
  ) then
    alter publication supabase_realtime add table public.user_app_data;
  end if;
end $$;
