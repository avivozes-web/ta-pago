-- v5 fase 3 (25/11/2026): pausar hábito, apelido, amigo financeiro, sino, análises, tutoriais
alter table public.tp_habits add column if not exists paused_from date;
alter table public.tp_habits add column if not exists paused_until date;

alter table public.tp_households add column if not exists nickname text;
alter table public.tp_households add column if not exists habits_paused_from date;
alter table public.tp_households add column if not exists habits_paused_until date;
alter table public.tp_households add column if not exists analyses_asked boolean not null default false;
alter table public.tp_households add column if not exists analyses_on boolean not null default true;
alter table public.tp_households add column if not exists analyses_weekly boolean;
alter table public.tp_households add column if not exists analyses_weekly_dow int check (analyses_weekly_dow between 0 and 6);
alter table public.tp_households add column if not exists analyses_monthly boolean;
alter table public.tp_households add column if not exists analyses_monthly_day int check (analyses_monthly_day between 1 and 28);
alter table public.tp_households add column if not exists inbox_ignored text[] not null default '{}';
alter table public.tp_households add column if not exists inbox_seen text[] not null default '{}';
alter table public.tp_households add column if not exists tutorials_seen text[] not null default '{}';
