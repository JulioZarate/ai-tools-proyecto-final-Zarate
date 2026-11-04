#!/usr/bin/env bash
# Evidencia P12: introduce un error REAL de regla (concentración 70%) para que Actions falle y NO publique.
# Uso:
#   bash scripts/falla_deliberada.sh romper   → commit + push → la ejecución de Actions debe fallar en el paso 1
#   bash scripts/falla_deliberada.sh reparar  → commit + push → la ejecución pasa y despliega
set -euo pipefail
cd "$(dirname "$0")/.."
SKILL=skills/propuesta-portafolio/SKILL.md
case "${1:-}" in
  romper)
    sed -i.bak 's/"concentracion_max_instrumento": 0.40/"concentracion_max_instrumento": 0.70/' "$SKILL" && rm -f "$SKILL.bak"
    git add "$SKILL" && git commit -m "P12: falla deliberada — tope de concentración 70% (debe bloquear la publicación)"
    echo "Ahora: git push  → revisa la pestaña Actions (debe fallar en 'Controles previos al despliegue')." ;;
  reparar)
    sed -i.bak 's/"concentracion_max_instrumento": 0.70/"concentracion_max_instrumento": 0.40/' "$SKILL" && rm -f "$SKILL.bak"
    git add "$SKILL" && git commit -m "P12: corrige la falla deliberada — tope de concentración 40%"
    echo "Ahora: git push  → la ejecución debe pasar y desplegar." ;;
  *) echo "Uso: $0 romper|reparar"; exit 2 ;;
esac
