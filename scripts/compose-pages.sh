#!/usr/bin/env bash
# Compõe .pages/ para o GitHub Pages:
#   - web/dist  -> raiz do Pages
#   - cada app  -> .pages/apps/<path>, em QUALQUER profundidade (apps/x/dist OU apps/x/y/dist)
# Fonte única: usado por `yarn compose:pages` e pelo workflow pages.yml (DRY).
set -uo pipefail

rm -rf .pages
mkdir -p .pages/apps

# Site principal na raiz
if [ -d web/dist ]; then
  cp -r web/dist/* .pages/
fi

# Cada dist de app, aninhado ou não (exclui node_modules pra não copiar dist de deps)
while IFS= read -r dist_dir; do
  rel="${dist_dir#apps/}"   # ex.: kafka-viz/dist  |  ohara/front/dist
  rel="${rel%/dist}"        # ex.: kafka-viz       |  ohara/front
  mkdir -p ".pages/apps/${rel}"
  cp -r "${dist_dir}"/* ".pages/apps/${rel}/" 2>/dev/null || true
done < <(find apps -type d -name dist -not -path '*/node_modules/*' 2>/dev/null)

# SPA: 404 = index
[ -f .pages/index.html ] && cp .pages/index.html .pages/404.html
# impede o GitHub de rodar Jekyll no artefato (serve os arquivos como estão)
touch .pages/.nojekyll

echo "compose-pages: composto. index.html encontrados:"
find .pages/apps -maxdepth 3 -name index.html 2>/dev/null | sed 's/^/  /'
