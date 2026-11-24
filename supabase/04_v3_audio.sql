-- v3 (23/11/2026 23h): mês novo quando recebe antes, botões rápidos, lembrete da noite
alter table public.tp_households add column if not exists cycle_starts jsonb not null default '{}';  -- {"2026-12":"2026-12-10"} início real do ciclo (recebeu antes)
alter table public.tp_households add column if not exists quick_buttons jsonb;                       -- null = sugestões iniciais; [{label,description,category_id,payment,card_id}]
alter table public.tp_households add column if not exists quick_hidden text[] not null default '{}'; -- atalhos do histórico que ela escondeu
alter table public.tp_households add column if not exists reminder_hour text not null default '19:00'; -- lembrete da noite no Início
