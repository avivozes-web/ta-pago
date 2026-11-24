#!/usr/bin/env bash
# Publica no GitHub Pages (branch gh-pages): testa, gera dist e envia só o dist.
set -euo pipefail
cd "$(dirname "$0")"
if [ -n "${VITE_SB_URL:-}" ] || [ -n "${TP_TEST:-}" ]; then echo 'ERRO: variáveis de teste ligadas; não publico.'; exit 1; fi
npm test
npm run build
touch dist/.nojekyll
cp dist/index.html dist/404.html
grep -rq 'zwofofifmxhyxzpbrgud' dist/assets/ || { echo 'ERRO: build sem o projeto real'; exit 1; }
if grep -rq 'localhost:4181' dist/assets/; then echo 'ERRO: build de teste'; exit 1; fi
TMP=$(mktemp -d)
git worktree add -f "$TMP" gh-pages 2>/dev/null || git worktree add -f -B gh-pages "$TMP"
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r dist/. "$TMP"/
cd "$TMP"
git add -A
git -c user.name="avivozes-web" -c user.email="avivozes-web@users.noreply.github.com" commit -qm "deploy $(date -Iseconds)" || echo "nada mudou"
git push -q origin gh-pages
cd - >/dev/null
git worktree remove --force "$TMP"
echo "Publicado: https://avivozes-web.github.io/ta-pago/"
