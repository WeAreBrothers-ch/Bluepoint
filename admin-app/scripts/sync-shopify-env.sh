#!/usr/bin/env bash
# Copie les identifiants Shopify de l'app (clé, secret, autorisations) vers Vercel
# (environnement de production). Aucune valeur n'est affichée.
# Usage, depuis admin-app/ : bash scripts/sync-shopify-env.sh
set -euo pipefail

cd "$(dirname "$0")/.."

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# `shopify app env show` affiche les variables : on les capture sans les imprimer.
shopify app env show </dev/null >"$TMP_DIR/env.txt" 2>/dev/null

read_var() {
  grep -E "^[[:space:]]*$1=" "$TMP_DIR/env.txt" | head -n 1 | sed -E "s/^[[:space:]]*$1=//"
}

push_var() {
  local name="$1" value="$2"
  if [ -z "$value" ]; then
    echo "✗ $name introuvable dans la configuration Shopify." >&2
    exit 1
  fi
  vercel env rm "$name" production --yes >/dev/null 2>&1 || true
  if ! printf '%s' "$value" | vercel env add "$name" production >/dev/null 2>&1; then
    echo "✗ Impossible d'enregistrer $name dans Vercel." >&2
    exit 1
  fi
  echo "✓ $name copiée vers Vercel (production)."
}

push_var SHOPIFY_API_KEY "$(read_var SHOPIFY_API_KEY)"
push_var SHOPIFY_API_SECRET "$(read_var SHOPIFY_API_SECRET)"
push_var SCOPES "$(read_var SCOPES)"
