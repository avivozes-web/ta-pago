# Tá Pago!

App pessoal (PWA) da Isa e do Hiago: dinheiro (ciclo do dia 15 ao 14), casa e rotina.

- React + Vite + TypeScript, PWA instalável (vite-plugin-pwa).
- Dados no Supabase (projeto compartilhado com a Central, tabelas com prefixo `tp_`). RLS: cada tabela só mostra as linhas da casa de quem está logado (`tp_my_household()`).
- A chave usada no app é a **publishable** (pública por natureza). A service role **não** entra no repositório.
- `supabase/01_schema.sql`: estrutura e políticas. Os dados iniciais da Isa ficam só fora do repositório.

## Rodar

```bash
npm ci
npm test        # regras de ciclo, fatura e leitura de lançamento
npm run dev     # http://localhost:5180/ta-pago/
```

## Publicar

Push na `main` → GitHub Actions (`.github/workflows/pages.yml`) testa, gera `dist` e publica no GitHub Pages.
Settings → Pages → Source: **GitHub Actions**.

## Regras principais

- Ciclo: do dia 15 ao dia 14, com o nome do mês em que começa (15/11–14/12 = Novembro). Muda em Ajustes.
- Fatura do cartão: entra no ciclo com o nome do mês em que **vence** (vence 05/12 → Dezembro).
- Adiantamento de salário: conta no ciclo do salário que ele adianta; o salário desse ciclo mostra o que falta receber.
- Categorias por palavras (sem IA): quando ela troca a categoria, o app aprende a palavra.
