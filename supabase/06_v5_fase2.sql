-- v5 fase 2 (25/11/2026): gasolina/combustível (só no app), fixo de um mês, Posso comprar?, metas do mês, planejamento 3/6/12
alter table public.tp_fixed add column if not exists only_cycle text;
alter table public.tp_households add column if not exists buy_rule_pct numeric(5,2) not null default 90;
alter table public.tp_households add column if not exists buy_interest_pct numeric(5,2) not null default 3;
alter table public.tp_households add column if not exists buy_inbox jsonb not null default '[]';
alter table public.tp_invest_goals add column if not exists deadline text;
alter table public.tp_invest_goals add column if not exists monthly_amount numeric(12,2);

create table if not exists public.tp_month_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  cycle_key text not null,
  name text not null,
  target numeric(12,2),
  kind text not null default 'livre' check (kind in ('livre','guardar','gastar_menos')),
  done_manual boolean not null default false,
  skipped boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.tp_month_goals enable row level security;
drop policy if exists tp_month_goals_hh on public.tp_month_goals;
create policy tp_month_goals_hh on public.tp_month_goals for all to anon, authenticated
  using (household_id = public.tp_my_household()) with check (household_id = public.tp_my_household());
grant select, insert, update, delete on public.tp_month_goals to anon, authenticated;
