#!/usr/bin/env bash
set -euo pipefail

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code no está instalado. Instálalo antes de continuar." >&2
  exit 1
fi

export CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
mkdir -p "$CLAUDE_CONFIG_DIR"

echo "Iniciando login de Claude Code."
echo "Abre en tu computadora la URL que mostrará Claude y completa el login."
echo "La sesión se guardará en: $CLAUDE_CONFIG_DIR"

exec claude auth login
