-- v5 fase 1 (25/11/2026): combustível moto/carro, apagar mês da wishlist, pagamento de cartão, empréstimo
alter table public.tp_transactions add column if not exists vehicle text;
alter table public.tp_households add column if not exists wish_hidden_months text[] not null default '{}';
alter table public.tp_categories add column if not exists exclude_from_spend boolean not null default false;

create table if not exists public.tp_loans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.tp_my_household() references public.tp_households(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  installments int not null default 1 check (installments >= 1),
  first_due date not null,
  category_id uuid references public.tp_categories(id) on delete set null,
  paid jsonb not null default '{}',
  note text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.tp_loans enable row level security;
drop policy if exists tp_loans_hh on public.tp_loans;
create policy tp_loans_hh on public.tp_loans for all to anon, authenticated using (household_id = public.tp_my_household()) with check (household_id = public.tp_my_household());
grant select, insert, update, delete on public.tp_loans to anon, authenticated;

-- Categoria que não conta como gasto (o pagamento da fatura; as compras já foram contadas)
update public.tp_categories
  set exclude_from_spend = true
  where lower(translate(name, 'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ', 'aaaaeeioooucAAAAEEIOOOUC')) like 'pagamento de cartao%';
insert into public.tp_categories (name, macro, exclude_from_spend, sort)
select 'Pagamento de cartão de crédito', 'viver', true, 80
where not exists (
  select 1 from public.tp_categories
  where lower(translate(name, 'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ', 'aaaaeeioooucAAAAEEIOOOUC')) like 'pagamento de cartao%'
);
