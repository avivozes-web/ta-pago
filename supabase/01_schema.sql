-- Tá Pago! — tabelas com prefixo tp_ (não mexe em nada da Central)
create table if not exists public.tp_households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Casa',
  cycle_start_day int not null default 15 check (cycle_start_day between 1 and 28),
  cycle_naming text not null default 'start' check (cycle_naming in ('start','end')),
  month_cap numeric(12,2) not null default 0,
  leisure_max int not null default 3,
  max_phone_hours numeric(4,1),
  alerts jsonb not null default '{"cat90":true,"pace":true,"leisure":true,"card":true,"bills":true}',
  created_at timestamptz not null default now()
);
create table if not exists public.tp_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.tp_households(id) on delete cascade,
  display_name text not null default ''
);
create or replace function public.tp_my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.tp_members where user_id = auth.uid()
$$;
revoke all on function public.tp_my_household() from public, anon;
grant execute on function public.tp_my_household() to authenticated;

create table if not exists public.tp_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null, macro text not null default 'viver' check (macro in ('viver','crescer','curtir')),
  goal numeric(12,2), is_leisure boolean not null default false, is_invest boolean not null default false,
  sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.tp_keywords (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  word text not null, category_id uuid not null references public.tp_categories(id) on delete cascade,
  learned boolean not null default false, created_at timestamptz not null default now(),
  unique (household_id, word)
);
create table if not exists public.tp_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null, aliases text not null default '',
  closing_day int not null check (closing_day between 1 and 31), due_day int not null check (due_day between 1 and 31),
  limit_amount numeric(12,2) not null default 0, goal numeric(12,2),
  is_main boolean not null default false, phasing_out boolean not null default false,
  sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.tp_income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null, expected_amount numeric(12,2) not null default 0, is_salary boolean not null default false,
  aliases text not null default '', sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.tp_invest_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null, target numeric(12,2) not null default 0, place text not null default '', start_amount numeric(12,2) not null default 0,
  sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.tp_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  kind text not null check (kind in ('saida','entrada')),
  description text not null default '', amount numeric(12,2) not null check (amount >= 0),
  date date not null default current_date,
  category_id uuid references public.tp_categories(id) on delete set null,
  payment text check (payment in ('dinheiro','pix','debito','credito')),
  card_id uuid references public.tp_cards(id) on delete set null,
  bill_due date, installment_no int, installments int, group_id uuid, total_amount numeric(12,2),
  income_source_id uuid references public.tp_income_sources(id) on delete set null,
  is_advance boolean not null default false,
  invest_goal_id uuid references public.tp_invest_goals(id) on delete set null,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create index if not exists tp_tx_hh_date on public.tp_transactions(household_id, date);
create table if not exists public.tp_manual_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  card_id uuid not null references public.tp_cards(id) on delete cascade,
  due_date date not null, amount numeric(12,2) not null default 0, note text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.tp_fixed (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null, amount numeric(12,2) not null default 0, due_day int, variable boolean not null default false,
  category_id uuid references public.tp_categories(id) on delete set null, icon text not null default 'repeat', note text not null default '',
  sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.tp_fixed_paid (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  fixed_id uuid not null references public.tp_fixed(id) on delete cascade,
  cycle_key text not null, amount numeric(12,2) not null default 0, paid_on date not null default current_date,
  unique (fixed_id, cycle_key)
);
create table if not exists public.tp_wish_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null, sort int not null default 0
);
create table if not exists public.tp_wishlist (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  wish_category_id uuid references public.tp_wish_categories(id) on delete set null,
  name text not null, amount numeric(12,2) not null default 0, planned_month text, link text not null default '', note text not null default '',
  bought boolean not null default false, bought_on date, sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.tp_shop_sections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null, sort int not null default 0
);
create table if not exists public.tp_shop_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  section_id uuid not null references public.tp_shop_sections(id) on delete cascade,
  name text not null, qty text not null default '', price numeric(12,2), promo boolean not null default false, note text not null default '',
  sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.tp_shop_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  item_id uuid not null references public.tp_shop_items(id) on delete cascade, cycle_key text not null,
  unique (item_id, cycle_key)
);
create table if not exists public.tp_habits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null, routine text not null default 'manha' check (routine in ('manha','noite','dia')),
  kind text not null default 'check' check (kind in ('check','phone')),
  duration text not null default '', days int[] not null default '{0,1,2,3,4,5,6}', in_grid boolean not null default true,
  sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.tp_habit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  habit_id uuid not null references public.tp_habits(id) on delete cascade, day date not null, done boolean not null default true,
  unique (habit_id, day)
);
create table if not exists public.tp_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null, freq text not null default 'semanal' check (freq in ('diaria','semanal','quinzenal','mensal','urgente')),
  weekday int, month_day int, anchor_date date not null default current_date, due_date date,
  sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.tp_task_done (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  task_id uuid not null references public.tp_tasks(id) on delete cascade, day date not null, done_on date not null default current_date,
  unique (task_id, day)
);

do $$
declare t text;
begin
  foreach t in array array['tp_categories','tp_keywords','tp_cards','tp_income_sources','tp_invest_goals','tp_transactions','tp_manual_bills','tp_fixed','tp_fixed_paid','tp_wish_categories','tp_wishlist','tp_shop_sections','tp_shop_items','tp_shop_checks','tp_habits','tp_habit_logs','tp_tasks','tp_task_done'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_hh', t);
    execute format('create policy %I on public.%I for all to authenticated using (household_id = public.tp_my_household()) with check (household_id = public.tp_my_household())', t||'_hh', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
alter table public.tp_households enable row level security;
drop policy if exists tp_households_sel on public.tp_households;
create policy tp_households_sel on public.tp_households for select to authenticated using (id = public.tp_my_household());
drop policy if exists tp_households_upd on public.tp_households;
create policy tp_households_upd on public.tp_households for update to authenticated using (id = public.tp_my_household()) with check (id = public.tp_my_household());
grant select, update on public.tp_households to authenticated;
revoke all on public.tp_households from anon;
alter table public.tp_members enable row level security;
drop policy if exists tp_members_sel on public.tp_members;
create policy tp_members_sel on public.tp_members for select to authenticated using (household_id = public.tp_my_household());
grant select on public.tp_members to authenticated;
revoke all on public.tp_members from anon;
