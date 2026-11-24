#!/usr/bin/env bash
# Build + servidor de TESTE: banco local isolado (Postgres 54329 + PostgREST 54330), nunca o real.
set -euo pipefail
cd "$(dirname "$0")"
VITE_SB_URL=http://localhost:4181 npx vite build --outDir dist-test --emptyOutDir >/dev/null
if grep -rq 'zwofofifmxhyxzpbrgud.supabase.co/rest' dist-test/assets/ && ! grep -rq 'localhost:4181' dist-test/assets/; then echo 'ERRO: build de teste aponta para o real'; exit 1; fi
echo "build de teste ok (dist-test)"
