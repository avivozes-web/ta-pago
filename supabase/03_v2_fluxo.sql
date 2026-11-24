-- v2 (23/11/2026 22h): salários recorrentes, wishlist por mês, cheque especial, fluxo de caixa
alter table public.tp_income_sources add column if not exists rates jsonb not null default '[]';  -- [{"from":"2026-12","amount":2800}] vale daqui pra frente
alter table public.tp_households add column if not exists wish_months text[] not null default '{}'; -- meses que ela adicionou na wishlist
alter table public.tp_transactions add column if not exists for_cycle text; -- ciclo forçado (ex.: salário recebido antes do dia 15)
create table if not exists public.tp_overdraft (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null default 'Cheque especial BB',
  limit_amount numeric(12,2) not null default 200,
  used_amount numeric(12,2) not null default 0 check (used_amount >= 0),
  pay_date date,
  sort int not null default 0, created_at timestamptz not null default now()
);
alter table public.tp_overdraft enable row level security;
drop policy if exists tp_overdraft_hh on public.tp_overdraft;
create policy tp_overdraft_hh on public.tp_overdraft for all to anon, authenticated using (household_id = public.tp_my_household()) with check (household_id = public.tp_my_household());
grant select, insert, update, delete on public.tp_overdraft to anon, authenticated;
insert into public.tp_overdraft (name, limit_amount, used_amount)
select 'Cheque especial BB', 200, 0 where not exists (select 1 from public.tp_overdraft);
