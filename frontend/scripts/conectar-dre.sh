#!/usr/bin/env bash
set -euo pipefail

if [[ "$(git branch --show-current)" != "feature/financial" ]]; then
  echo "ERRO: entre na branch feature/financial."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
from datetime import datetime
import shutil

root = Path("src/app")

base = root / "pages/financial/dre"
core = root / "core/financial"

component = base / "financial-dre.ts"
template = base / "financial-dre.html"
styles = base / "financial-dre.scss"

model = core / "financial-dre.model.ts"
service = core / "financial-dre.service.ts"

routes = root / "app.routes.ts"
config = root / "app.config.ts"

# Validar antes de modificar.

for path in [component, template, styles, routes, config]:
    if not path.is_file():
        raise SystemExit(f"Arquivo não encontrado: {path}")

for path in [model, service]:
    if path.exists():
        raise SystemExit(
            f"{path} já existe. Atualização interrompida."
        )

if "export class FinancialDre" not in component.read_text():
    raise SystemExit("Componente DRE diferente do esperado.")

route_content = routes.read_text()

if (
    "path: 'financeiro/dre'" not in route_content
    or "component: FinancialDre" not in route_content
):
    raise SystemExit("A rota da DRE ainda não está configurada.")

if "provideHttpClient()" not in config.read_text():
    raise SystemExit(
        "Configure provideHttpClient() em app.config.ts."
    )

# ==========================================
# 1. MODELO DE DADOS
# ==========================================

model_content = r"""export type DreCode =
  | 'grossRevenue'
  | 'revenueDeductions'
  | 'netRevenue'
  | 'serviceCosts'
  | 'grossProfit'
  | 'administrativeExpenses'
  | 'commercialExpenses'
  | 'otherOperatingResult'
  | 'operatingResult'
  | 'financialResult'
  | 'profitBeforeTaxes'
  | 'incomeTaxes'
  | 'netProfit';

export type DreCostCode =
  | 'fuel'
  | 'crew'
  | 'maintenance'
  | 'mobilization'
  | 'other';

export interface FinancialDreDto {
  status: 'READY' | 'EMPTY';

  // Competência no formato YYYY-MM.
  competence: string;

  // Deduções e despesas são valores negativos.
  values: Partial<Record<DreCode, number | null>>;

  // Custos por categoria, expressos como valores positivos.
  costBreakdown?: Partial<
    Record<DreCostCode, number | null>
  >;

  updatedAt: string | null;
}
"""

# ==========================================
# 2. SERVIÇO HTTP
# ==========================================

service_content = r"""import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  FinancialDreDto,
} from './financial-dre.model';

@Injectable({
  providedIn: 'root',
})
export class FinancialDreService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/v1/financial/dre';

  getDre(competence: string): Observable<FinancialDreDto> {
    const params = new HttpParams()
      .set('competence', competence);

    return this.http.get<FinancialDreDto>(
      this.endpoint,
      { params }
    );
  }
}
"""

# ==========================================
# 3. COMPONENTE
# ==========================================

component_content = r"""import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { takeUntilDestroyed } from
  '@angular/core/rxjs-interop';

import { Subscription } from 'rxjs';

import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';

import {
  DreCode,
  DreCostCode,
  FinancialDreDto,
} from '../../../core/financial/financial-dre.model';

import {
  FinancialDreService,
} from '../../../core/financial/financial-dre.service';

type LoadingState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'unavailable';

type DreRowType =
  | 'normal'
  | 'deduction'
  | 'subtotal'
  | 'result';

@Component({
  selector: 'app-financial-dre',
  imports: [Card, Button],
  templateUrl: './financial-dre.html',
  styleUrl: './financial-dre.scss',
})
export class FinancialDre implements OnInit {
  private readonly service = inject(FinancialDreService);
  private readonly destroyRef = inject(DestroyRef);

  private request?: Subscription;

  readonly competence = signal(this.currentMonth());
  readonly state = signal<LoadingState>('loading');

  private readonly snapshot =
    signal<FinancialDreDto | null>(null);

  private readonly definitions: {
    code: DreCode;
    label: string;
    type: DreRowType;
  }[] = [
    { code: 'grossRevenue', label: 'Receita bruta', type: 'normal' },
    { code: 'revenueDeductions', label: '(−) Deduções da receita', type: 'deduction' },
    { code: 'netRevenue', label: 'Receita líquida', type: 'subtotal' },
    { code: 'serviceCosts', label: '(−) Custos dos serviços prestados', type: 'deduction' },
    { code: 'grossProfit', label: 'Lucro bruto', type: 'subtotal' },
    { code: 'administrativeExpenses', label: '(−) Despesas administrativas', type: 'deduction' },
    { code: 'commercialExpenses', label: '(−) Despesas comerciais', type: 'deduction' },
    { code: 'otherOperatingResult', label: '(+/−) Outras receitas e despesas operacionais', type: 'normal' },
    { code: 'operatingResult', label: 'Resultado operacional', type: 'subtotal' },
    { code: 'financialResult', label: '(+/−) Resultado financeiro', type: 'normal' },
    { code: 'profitBeforeTaxes', label: 'Resultado antes dos tributos sobre o lucro', type: 'subtotal' },
    { code: 'incomeTaxes', label: '(−) Tributos sobre o lucro', type: 'deduction' },
    { code: 'netProfit', label: 'Resultado líquido', type: 'result' },
  ];

  readonly rows = computed(() =>
    this.definitions.map(row => ({
      ...row,
      value: this.money(
        this.snapshot()?.values[row.code]
      ),
    }))
  );

  readonly indicators = computed(() => {
    const values = this.snapshot()?.values;

    const items: {
      code: DreCode;
      label: string;
    }[] = [
      { code: 'netRevenue', label: 'Receita líquida' },
      { code: 'grossProfit', label: 'Lucro bruto' },
      { code: 'operatingResult', label: 'Resultado operacional' },
      { code: 'netProfit', label: 'Resultado líquido' },
    ];

    return items.map(item => ({
      ...item,
      value: this.money(values?.[item.code]),
    }));
  });

  private readonly costDefinitions: {
    code: DreCostCode;
    label: string;
  }[] = [
    { code: 'fuel', label: 'Combustível custeado pela AgroFly' },
    { code: 'crew', label: 'Tripulação' },
    { code: 'maintenance', label: 'Manutenção' },
    { code: 'mobilization', label: 'Mobilização' },
    { code: 'other', label: 'Demais custos operacionais' },
  ];

  readonly costs = computed(() =>
    this.costDefinitions.map(item => ({
      ...item,
      value: this.money(
        this.snapshot()?.costBreakdown?.[item.code]
      ),
    }))
  );

  readonly statusLabel = computed(() => {
    switch (this.state()) {
      case 'loading':
        return 'Carregando';
      case 'ready':
        return 'Dados atualizados';
      case 'empty':
        return 'Sem lançamentos';
      default:
        return 'Dados indisponíveis';
    }
  });

  ngOnInit(): void {
    this.load();
  }

  setCompetence(value: string): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
      return;
    }

    this.competence.set(value);
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();

    this.snapshot.set(null);
    this.state.set('loading');

    this.request = this.service
      .getDre(this.competence())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.snapshot.set(data);

          this.state.set(
            data.status === 'EMPTY'
              ? 'empty'
              : 'ready'
          );
        },
        error: () => {
          this.snapshot.set(null);
          this.state.set('unavailable');
        },
      });
  }

  private currentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(
      now.getMonth() + 1
    ).padStart(2, '0');

    return `${year}-${month}`;
  }

  private money(
    value: number | null | undefined
  ): string {
    if (value == null) {
      return 'R$ —';
    }

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }
}
"""

# ==========================================
# 4. TEMPLATE
# ==========================================

template_content = r"""<section class="page-heading">
  <div>
    <p class="eyebrow">GESTÃO FINANCEIRA</p>
    <h1>DRE Gerencial</h1>
    <p class="muted">
      Demonstração dos resultados por competência.
    </p>
  </div>

  <div class="dre-toolbar">
    <label for="dre-competence">Competência</label>

    <input
      #monthInput
      id="dre-competence"
      type="month"
      [value]="competence()"
      [disabled]="state() === 'loading'"
    />

    <ui-button
      variant="secondary"
      size="sm"
      [loading]="state() === 'loading'"
      (pressed)="setCompetence(monthInput.value)"
    >
      Aplicar
    </ui-button>
  </div>
</section>

<div class="dre-status" role="status">
  {{ statusLabel() }}
</div>

@if (state() === 'unavailable') {
  <section class="dre-feedback">
    <ui-card>
      <h2>Não foi possível carregar a DRE</h2>
      <p class="muted">
        A API financeira está indisponível
        ou ainda não foi implementada.
      </p>

      <ui-button
        variant="secondary"
        (pressed)="load()"
      >
        Tentar novamente
      </ui-button>
    </ui-card>
  </section>
}

<section class="financial-section">
  <h2 class="section-title">Indicadores do resultado</h2>

  <div class="metrics">
    @for (item of indicators(); track item.code) {
      <ui-card>
        <div class="metric">
          <span class="metric__label">
            {{ item.label }}
          </span>

          <strong class="metric__value">
            {{ item.value }}
          </strong>
        </div>
      </ui-card>
    }
  </div>
</section>

<section class="financial-section">
  <ui-card>
    <div class="report-heading">
      <div>
        <h2>Demonstrativo de resultado</h2>
        <p class="muted">
          Valores por competência
        </p>
      </div>
      <span class="report-badge">Gerencial</span>
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
          @for (row of rows(); track row.code) {
            <tr
              [class]="
                'dre-table__row dre-table__row--'
                + row.type
              "
            >
              <th scope="row">{{ row.label }}</th>
              <td>{{ row.value }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (state() === 'empty') {
      <p class="report-note">
        Não existem lançamentos nesta competência.
      </p>
    }
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
      @for (cost of costs(); track cost.code) {
        <div class="cost-category">
          <span>{{ cost.label }}</span>
          <strong>{{ cost.value }}</strong>
        </div>
      }
    </div>

    <p class="report-note">
      Combustível fornecido gratuitamente pela
      fazenda não gera automaticamente uma
      despesa para a AgroFly.
    </p>
  </ui-card>
</section>
"""

# ==========================================
# 5. ESTILOS COMPLEMENTARES
# ==========================================

additional_scss = """
/* Filtro e estados da DRE */

.dre-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.dre-toolbar label {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.dre-toolbar input {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
}

.dre-status {
  margin-bottom: 20px;
  color: var(--muted);
  font-size: 0.75rem;
}

.dre-feedback {
  margin-bottom: 24px;
}

.dre-feedback h2 {
  margin-top: 0;
  font-size: 1rem;
}

.dre-feedback ui-button {
  margin-top: 12px;
}
"""

# ==========================================
# 6. BACKUP E GRAVAÇÃO
# ==========================================

timestamp = datetime.now().strftime(
    "%Y%m%d-%H%M%S-%f"
)

backup = (
    Path.home()
    / "agrofly-backups"
    / "dre"
    / timestamp
)

backup.mkdir(parents=True, exist_ok=True)

for path in [component, template, styles]:
    shutil.copy2(path, backup / path.name)

core.mkdir(parents=True, exist_ok=True)

model.write_text(model_content, encoding="utf-8")
service.write_text(service_content, encoding="utf-8")

component.write_text(
    component_content,
    encoding="utf-8"
)

template.write_text(
    template_content,
    encoding="utf-8"
)

current_styles = styles.read_text(encoding="utf-8")

if "/* Filtro e estados da DRE */" not in current_styles:
    styles.write_text(
        current_styles + "\n" + additional_scss,
        encoding="utf-8"
    )

print("Modelo e serviço DRE criados.")
print("Componente DRE atualizado.")
print(f"Backups: {backup}")
PY

echo
echo "Compilando o Angular..."
npm run build
