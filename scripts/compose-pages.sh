#!/usr/bin/env bash
# Compõe .pages/ para o GitHub Pages:
#   - web/dist  -> raiz do Pages
#   - cada app  -> .pages/apps/<path>, em QUALQUER profundidade (apps/x/dist OU apps/x/y/dist)
# Fonte única: usado por `yarn compose:pages` e pelo workflow pages.yml (DRY).
#
# Falha alto: sai com erro (e mensagem) se o build do site ou de um app não
# existe, está vazio, ou se qualquer cópia falhar. Rode depois do build.
set -euo pipefail

die() {
  echo "compose-pages: erro: $*" >&2
  exit 1
}

rm -rf .pages
mkdir -p .pages/apps

# Site principal na raiz
[ -d web/dist ] || die "web/dist não existe (rode o build antes)."
[ -s web/dist/index.html ] || die "web/dist/index.html não existe ou está vazio."
cp -r web/dist/* .pages/

# Cada dist de app, aninhado ou não (exclui node_modules pra não copiar dist de deps)
dist_dirs="$(find apps -type d -name dist -not -path '*/node_modules/*' | LC_ALL=C sort)"
[ -n "$dist_dirs" ] || die "nenhum apps/**/dist encontrado (rode o build antes)."
while IFS= read -r dist_dir; do
  rel="${dist_dir#apps/}"   # ex.: kafka-viz/dist  |  ohara/front/dist
  rel="${rel%/dist}"        # ex.: kafka-viz       |  ohara/front
  [ -n "$(ls -A "$dist_dir")" ] || die "${dist_dir} está vazio."
  mkdir -p ".pages/apps/${rel}"
  cp -r "${dist_dir}"/* ".pages/apps/${rel}/" || die "falha ao copiar ${dist_dir} para .pages/apps/${rel}."
done <<< "$dist_dirs"

# SPA: 404 = index
cp .pages/index.html .pages/404.html
# impede o GitHub de rodar Jekyll no artefato (serve os arquivos como estão)
touch .pages/.nojekyll

echo "compose-pages: composto. index.html encontrados:"
find .pages/apps -maxdepth 3 -name index.html | LC_ALL=C sort | sed 's/^/  /'
