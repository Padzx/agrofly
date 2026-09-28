#!/usr/bin/env bash
set -euo pipefail

cd ~/Desktop/agrofly/frontend

if [[ "$(git branch --show-current)" != "feature/financial" ]]; then
  echo "ERRO: entre na branch feature/financial."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
from datetime import datetime
import re
import shutil

root = Path("src/app")
base = root / "pages/financial/dre"
routes = root / "app.routes.ts"

files = {
    "ts": base / "financial-dre.ts",
    "html": base / "financial-dre.html",
    "scss": base / "financial-dre.scss",
}

# Verificações antes de modificar o projeto.

if not routes.is_file():
    raise SystemExit("Arquivo app.routes.ts não encontrado.")

for path in files.values():
    if path.exists():
        raise SystemExit(
            f"O arquivo {path} já existe. "
            "Nenhum arquivo será sobrescrito."
        )

original = routes.read_text(encoding="utf-8")

route_pattern = re.compile(
    r"(path:\s*'financeiro/dre'\s*,\s*)"
    r"component:\s*ComingSoon\b"
)

if len(route_pattern.findall(original)) != 1:
    raise SystemExit(
        "A rota financeiro/dre não corresponde "
        "à estrutura esperada."
    )

import_anchor = (
    "import { ComingSoon } from "
    "'./pages/coming-soon/coming-soon';"
)

if import_anchor not in original:
    raise SystemExit(
        "Importação ComingSoon não encontrada."
    )

# =====================================
# COMPONENTE TYPESCRIPT
# =====================================

ts = """import { Component } from '@angular/core';
import { Card } from '../../../shared/ui/card/card';

type DreRowType =
  | 'normal'
  | 'deduction'
  | 'subtotal'
  | 'result';

interface DreRow {
  id: string;
  label: string;
  type: DreRowType;
}

@Component({
  selector: 'app-financial-dre',
  imports: [Card],
  templateUrl: './financial-dre.html',
  styleUrl: './financial-dre.scss',
})
export class FinancialDre {

  readonly indicators = [
    'Receita líquida',
    'Lucro bruto',
    'Resultado operacional',
    'Resultado líquido',
  ];

  readonly rows: DreRow[] = [
    {
      id: 'grossRevenue',
      label: 'Receita bruta',
      type: 'normal',
    },
    {
      id: 'revenueDeductions',
      label: '(−) Deduções e tributos sobre receita',
      type: 'deduction',
    },
    {
      id: 'netRevenue',
      label: 'Receita líquida',
      type: 'subtotal',
    },
    {
      id: 'serviceCosts',
      label: '(−) Custos dos serviços prestados',
      type: 'deduction',
    },
    {
      id: 'grossProfit',
      label: 'Lucro bruto',
      type: 'subtotal',
    },
    {
      id: 'administrativeExpenses',
      label: '(−) Despesas administrativas',
      type: 'deduction',
    },
    {
      id: 'commercialExpenses',
      label: '(−) Despesas comerciais',
      type: 'deduction',
    },
    {
      id: 'otherOperatingResult',
      label: '(+/−) Outras receitas e despesas operacionais',
      type: 'normal',
    },
    {
      id: 'operatingResult',
      label: 'Resultado operacional',
      type: 'subtotal',
    },
    {
      id: 'financialResult',
      label: '(+/−) Resultado financeiro',
      type: 'normal',
    },
    {
      id: 'profitBeforeTaxes',
      label: 'Resultado antes dos tributos sobre lucro',
      type: 'subtotal',
    },
    {
      id: 'incomeTaxes',
      label: '(−) Tributos sobre o lucro',
      type: 'deduction',
    },
    {
      id: 'netProfit',
      label: 'Resultado líquido',
      type: 'result',
    },
  ];
}
"""

# =====================================
# TEMPLATE
# =====================================

html = """<section class="page-heading">
  <div>
    <p class="eyebrow">GESTÃO FINANCEIRA</p>

    <h1>DRE Gerencial</h1>

    <p class="muted">
      Acompanhe a formação do resultado
      econômico da AgroFly.
    </p>
  </div>

  <span class="status-chip">
    Aguardando integração
  </span>
</section>

<section
  class="financial-section"
  aria-labelledby="dre-indicators"
>
  <h2 id="dre-indicators" class="section-title">
    Indicadores do resultado
  </h2>

  <div class="metrics">
    @for (indicator of indicators; track indicator) {
      <ui-card>
        <div class="metric">
          <span class="metric__label">
            {{ indicator }}
          </span>

          <strong class="metric__value">
            R$ —
          </strong>

          <span class="metric__note">
            Sem dados disponíveis
          </span>
        </div>
      </ui-card>
    }
  </div>
</section>

<section
  class="financial-section"
  aria-labelledby="dre-report"
>
  <ui-card>
    <div class="report-heading">
      <div>
        <h2 id="dre-report">
          Demonstrativo de resultado
        </h2>

        <p class="muted">
          Valores por competência
        </p>
      </div>

      <span class="report-badge">
        Gerencial
      </span>
    </div>

    <div class="table-container">
      <table class="dre-table">
        <thead>
          <tr>
            <th scope="col">Descrição</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>

        <tbody>
          @for (row of rows; track row.id) {
            <tr
              [class]="
                'dre-table__row dre-table__row--'
                + row.type
              "
            >
              <th scope="row">
                {{ row.label }}
              </th>

              <td>R$ —</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <p class="report-note">
      O demonstrativo será preenchido
      quando os lançamentos financeiros
      estiverem integrados.
    </p>
  </ui-card>
</section>

<section class="financial-section">
  <ui-card>
    <div class="report-heading">
      <div>
        <h2>Detalhamento dos custos</h2>

        <p class="muted">
          Custos operacionais por categoria
        </p>
      </div>
    </div>

    <div class="cost-categories">
      @for (
        category of [
          'Combustível custeado pela AgroFly',
          'Tripulação',
          'Manutenção',
          'Mobilização',
          'Demais custos operacionais'
        ];
        track category
      ) {
        <div class="cost-category">
          <span>{{ category }}</span>
          <strong>R$ —</strong>
        </div>
      }
    </div>

    <p class="report-note">
      O combustível fornecido gratuitamente
      pela fazenda será registrado em Frota,
      sem gerar automaticamente uma despesa.
    </p>
  </ui-card>
</section>
"""

# =====================================
# SCSS
# =====================================

scss = """@use '../../../../styles/breakpoints' as bp;

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

.status-chip,
.report-badge {
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

.section-title {
  margin: 0 0 15px;
  font-size: 1rem;
}

.metrics {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
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
  font-size: clamp(1.4rem, 2vw, 1.9rem);
  line-height: 1.2;
}

.metric__note {
  color: var(--muted);
  font-size: 0.72rem;
}

.report-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
  margin-bottom: 22px;
}

.report-heading h2 {
  margin: 0 0 5px;
  font-size: 1.05rem;
}

.report-heading p {
  margin: 0;
}

.table-container {
  width: 100%;
  overflow-x: auto;
}

.dre-table {
  width: 100%;
  border-collapse: collapse;
}

.dre-table th,
.dre-table td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 0.82rem;
}

.dre-table thead th {
  color: var(--muted);
  text-align: left;
  font-size: 0.72rem;
}

.dre-table td,
.dre-table thead th:last-child {
  text-align: right;
  white-space: nowrap;
}

.dre-table tbody th {
  text-align: left;
  font-weight: 500;
}

.dre-table__row--deduction {
  color: var(--muted);
}

.dre-table__row--subtotal {
  background: rgba(94, 224, 182, 0.04);
}

.dre-table__row--subtotal th,
.dre-table__row--subtotal td {
  font-weight: 800;
}

.dre-table__row--result {
  background: rgba(94, 224, 182, 0.09);
  color: var(--primary);
}

.dre-table__row--result th,
.dre-table__row--result td {
  font-weight: 800;
  font-size: 0.95rem;
}

.cost-categories {
  display: grid;
  gap: 0;
}

.cost-category {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  padding: 13px 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
}

.cost-category strong {
  white-space: nowrap;
}

.report-note {
  margin: 20px 0 0;
  color: var(--muted);
  font-size: 0.75rem;
}

@include bp.tablet {
  .metrics {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }
}

@include bp.mobile {
  .metrics {
    grid-template-columns: 1fr;
  }

  .report-heading {
    flex-direction: column;
  }
}
"""

# =====================================
# ATUALIZAR ROTAS
# =====================================

import_line = (
    "import { FinancialDre } from "
    "'./pages/financial/dre/financial-dre';"
)

updated_routes = original.replace(
    import_anchor,
    import_anchor + "\n" + import_line,
    1,
)

updated_routes, count = route_pattern.subn(
    r"\1component: FinancialDre",
    updated_routes,
    count=1,
)

if count != 1:
    raise SystemExit("Falha ao atualizar rota DRE.")

# =====================================
# BACKUP E GRAVAÇÃO
# =====================================

timestamp = datetime.now().strftime(
    "%Y%m%d-%H%M%S"
)

backup_dir = Path("/tmp/agrofly-backups") / timestamp
backup_dir.mkdir(parents=True, exist_ok=True)

shutil.copy2(
    routes,
    backup_dir / "app.routes.ts"
)

base.mkdir(parents=True, exist_ok=True)

files["ts"].write_text(ts, encoding="utf-8")
files["html"].write_text(html, encoding="utf-8")
files["scss"].write_text(scss, encoding="utf-8")

routes.write_text(
    updated_routes,
    encoding="utf-8"
)

print("Componente DRE criado.")
print("Rota /financeiro/dre atualizada.")
print(f"Backup: {backup_dir}")
PY

echo
echo "Compilando o Angular..."
npm run build
