-- AutoCoach: schéma Supabase
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_premium boolean not null default false,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.garages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  hp integer not null check (hp > 0),
  weight integer not null check (weight > 0),
  zero100 numeric(5,2) not null check (zero100 > 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.garages enable row level security;

create policy "profiles own row" on public.profiles for select using (auth.uid() = id);
create policy "users read own garages" on public.garages for select using (auth.uid() = user_id);
create policy "users insert own garages" on public.garages for insert with check (auth.uid() = user_id);
create policy "users delete own garages" on public.garages for delete using (auth.uid() = user_id);

-- Le webhook utilise la service role et contourne RLS.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
