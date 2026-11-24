#!/usr/bin/env bash
# Publica no GitHub Pages (branch gh-pages): testa, gera dist e envia só o dist.
set -euo pipefail
cd "$(dirname "$0")"
npm test
npm run build
touch dist/.nojekyll
cp dist/index.html dist/404.html
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
