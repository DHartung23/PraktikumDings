-- Create profiles table
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  height numeric default 0,
  weight numeric default 0,
  age integer default 0,
  gender text check (gender in ('male', 'female', 'other', '')) default '',
  primary key (id)
);

-- Enable RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile."
  on profiles for select
  using ( auth.uid() = id );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Create a trigger to automatically create a profile for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

-- Drop trigger if it exists to allow re-running
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insert profile for existing users that don't have one yet
insert into public.profiles (id)
select id from auth.users
where not exists (select 1 from public.profiles where id = auth.users.id);

-- Create daily_stats table
create table public.daily_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null on delete cascade,
  date_str text not null,
  steps integer default 0,
  unique (user_id, date_str)
);

-- Enable RLS for daily_stats
alter table public.daily_stats enable row level security;

create policy "Users can view their own daily stats."
  on daily_stats for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own daily stats."
  on daily_stats for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own daily stats."
  on daily_stats for update
  using ( auth.uid() = user_id );
