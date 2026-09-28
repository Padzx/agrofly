#!/usr/bin/env bash
set -euo pipefail

if [[ "$(git branch --show-current)" != "feature/financial" ]]; then
  echo "ERRO: entre na branch feature/financial."
  exit 1
fi

BASE="src/app/pages/financial/overview"
ROUTES="src/app/app.routes.ts"

if [[ ! -f "$ROUTES" ]]; then
  echo "ERRO: arquivo de rotas não encontrado."
  exit 1
fi

for file in \
  "$BASE/financial-overview.ts" \
  "$BASE/financial-overview.html" \
  "$BASE/financial-overview.scss"
do
  if [[ -e "$file" ]]; then
    echo "ERRO: o arquivo $file já existe."
    echo "Nenhum arquivo será sobrescrito."
    exit 1
  fi
done

# Verificar a estrutura das rotas antes de criar arquivos.

python3 - <<'PY'
from pathlib import Path
import re

content = Path("src/app/app.routes.ts").read_text()

if not re.search(
    r"path:\s*'financeiro'\s*,\s*component:\s*ComingSoon",
    content
):
    raise SystemExit(
        "A rota /financeiro não corresponde à estrutura esperada."
    )

if "import { ComingSoon }" not in content:
    raise SystemExit(
        "A importação ComingSoon não foi encontrada."
    )
PY

mkdir -p "$BASE"

# ==========================================
# COMPONENTE
# ==========================================

cat > "$BASE/financial-overview.ts" <<'EOF'
import { Component } from '@angular/core';
import { Card } from '../../../shared/ui/card/card';

interface FinancialIndicator {
  label: string;
  value: string;
  description: string;
}

@Component({
  selector: 'app-financial-overview',
  imports: [Card],
  templateUrl: './financial-overview.html',
  styleUrl: './financial-overview.scss',
})
export class FinancialOverview {
  readonly indicators: FinancialIndicator[] = [
    {
      label: 'Receita líquida',
      value: 'R$ —',
      description: 'Receita no período selecionado',
    },
    {
      label: 'Custos operacionais',
      value: 'R$ —',
      description: 'Custos consolidados da operação',
    },
    {
      label: 'Resultado operacional',
      value: 'R$ —',
      description: 'Resultado do período',
    },
    {
      label: 'Margem operacional',
      value: '— %',
      description: 'Margem sobre a receita',
    },
  ];

  readonly cashIndicators: FinancialIndicator[] = [
    {
      label: 'Saldo disponível',
      value: 'R$ —',
      description: 'Saldo financeiro consolidado',
    },
    {
      label: 'Recebimentos em atraso',
      value: 'R$ —',
      description: 'Valores vencidos e não recebidos',
    },
  ];
}
EOF

# ==========================================
# TEMPLATE
# ==========================================

cat > "$BASE/financial-overview.html" <<'EOF'
<section class="page-heading">
  <div>
    <p class="eyebrow">GESTÃO FINANCEIRA</p>
    <h1>Financeiro</h1>

    <p class="muted">
      Acompanhe os resultados e a posição financeira
      da AgroFly em um único lugar.
    </p>
  </div>

  <span class="status-chip">
    Aguardando dados
  </span>
</section>

<section
  class="financial-section"
  aria-labelledby="performance-title"
>
  <div class="section-heading">
    <h2 id="performance-title">
      Desempenho financeiro
    </h2>
  </div>

  <div class="metrics">
    @for (indicator of indicators; track indicator.label) {
      <ui-card>
        <div class="metric">
          <span class="metric__label">
            {{ indicator.label }}
          </span>

          <strong class="metric__value">
            {{ indicator.value }}
          </strong>

          <p class="metric__description">
            {{ indicator.description }}
          </p>
        </div>
      </ui-card>
    }
  </div>
</section>

<section
  class="financial-section"
  aria-labelledby="cash-title"
>
  <div class="section-heading">
    <h2 id="cash-title">Posição financeira</h2>
  </div>

  <div class="cash-grid">
    @for (
      indicator of cashIndicators;
      track indicator.label
    ) {
      <ui-card>
        <div class="metric">
          <span class="metric__label">
            {{ indicator.label }}
          </span>

          <strong class="metric__value">
            {{ indicator.value }}
          </strong>

          <p class="metric__description">
            {{ indicator.description }}
          </p>
        </div>
      </ui-card>
    }
  </div>
</section>

<section
  class="financial-section"
  aria-labelledby="cash-flow-title"
>
  <ui-card>
    <div class="section-heading">
      <h2 id="cash-flow-title">
        Projeção do fluxo de caixa
      </h2>
    </div>

    <div class="empty-state">
      <h3>Nenhum dado financeiro disponível</h3>

      <p>
        A projeção será apresentada quando os
        primeiros lançamentos financeiros forem
        registrados no sistema.
      </p>
    </div>
  </ui-card>
</section>
EOF

# ==========================================
# ESTILOS
# ==========================================

cat > "$BASE/financial-overview.scss" <<'EOF'
@use '../../../../styles/breakpoints' as bp;

:host {
  display: block;
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;

  gap: 20px;
  margin-bottom: 30px;
}

.page-heading h1 {
  margin: 4px 0 8px;
}

.page-heading .muted {
  max-width: 650px;
  margin: 0;
}

.status-chip {
  padding: 7px 12px;

  border: 1px solid var(--border);
  border-radius: 999px;

  color: var(--muted);
  background: var(--surface);

  font-size: 0.72rem;
  font-weight: 700;
}

.financial-section {
  margin-bottom: 28px;
}

.section-heading {
  margin-bottom: 15px;
}

.section-heading h2 {
  margin: 0;
  font-size: 1rem;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 15px;
}

.cash-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px;
}

.metric {
  display: flex;
  flex-direction: column;

  gap: 8px;
  min-width: 0;
}

.metric__label {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.metric__value {
  color: var(--text);

  font-size: clamp(1.5rem, 2vw, 2rem);
  font-weight: 800;

  line-height: 1.2;
  letter-spacing: -0.025em;
}

.metric__description {
  margin: 0;

  color: var(--muted);
  font-size: 0.74rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  min-height: 220px;
  padding: 30px;

  border: 1px dashed var(--border);
  border-radius: var(--radius-md);

  text-align: center;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 0.95rem;
}

.empty-state p {
  max-width: 410px;
  margin: 0;

  color: var(--muted);
  font-size: 0.8rem;
}

@include bp.tablet {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@include bp.mobile {
  .metrics,
  .cash-grid {
    grid-template-columns: 1fr;
  }

  .page-heading {
    flex-direction: column;
  }
}
EOF

# ==========================================
# ATUALIZAR ROTA
# ==========================================

python3 - <<'PY'
from pathlib import Path
from datetime import datetime
import re
import shutil

path = Path("src/app/app.routes.ts")
content = path.read_text()

new_import = (
    "import { FinancialOverview } from "
    "'./pages/financial/overview/financial-overview';"
)

pattern = re.compile(
    r"(path:\s*'financeiro'\s*,\s*)"
    r"component:\s*ComingSoon\b"
)

updated, count = pattern.subn(
    r"\1component: FinancialOverview",
    content
)

if count != 1:
    raise SystemExit(
        "Não foi possível atualizar a rota financeira."
    )

import_match = re.search(
    r"^import \{ ComingSoon \} from .*?;$",
    updated,
    re.MULTILINE
)

if not import_match:
    raise SystemExit(
        "Não foi possível localizar o ponto de importação."
    )

updated = (
    updated[:import_match.end()]
    + "\n"
    + new_import
    + updated[import_match.end():]
)

backup = Path("/tmp") / (
    "agrofly-routes-"
    + datetime.now().strftime("%Y%m%d-%H%M%S")
    + ".ts"
)

shutil.copy2(path, backup)
path.write_text(updated)

print(f"Backup das rotas: {backup}")
print("Rota /financeiro atualizada.")
PY

echo
echo "Verificando a compilação..."
npm run build
