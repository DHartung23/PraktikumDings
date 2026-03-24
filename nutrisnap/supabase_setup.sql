-- Create a table for meals
create table meals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  image_url text not null,
  analysis_result jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table meals enable row level security;

create policy "Users can insert their own meals."
  on meals for insert
  with check ( auth.uid() = user_id );

create policy "Users can view their own meals."
  on meals for select
  using ( auth.uid() = user_id );

create policy "Users can update their own meals."
  on meals for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own meals."
  on meals for delete
  using ( auth.uid() = user_id );

-- Setup Storage for food images
insert into storage.buckets (id, name, public) values ('food-images', 'food-images', true);

-- Storage RLS policies
create policy "Anyone can view food images"
  on storage.objects for select
  using ( bucket_id = 'food-images' );

create policy "Authenticated users can upload food images"
  on storage.objects for insert
  with check ( bucket_id = 'food-images' and auth.role() = 'authenticated' );
  
create policy "Users can update their own food images"
  on storage.objects for update
  using ( bucket_id = 'food-images' and auth.uid() = owner )
  with check ( bucket_id = 'food-images' and auth.uid() = owner );

create policy "Users can delete their own food images"
  on storage.objects for delete
  using ( bucket_id = 'food-images' and auth.uid() = owner );
