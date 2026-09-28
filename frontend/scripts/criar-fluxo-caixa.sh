#!/usr/bin/env bash
set -euo pipefail

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
base = root / "pages/financial/cash-flow"
core = root / "core/financial"
routes = root / "app.routes.ts"
config = root / "app.config.ts"

files = {
    "model": core / "financial-cash-flow.model.ts",
    "service": core / "financial-cash-flow.service.ts",
    "component": base / "financial-cash-flow.ts",
    "template": base / "financial-cash-flow.html",
    "styles": base / "financial-cash-flow.scss",
}

# Validar antes de modificar.

if not routes.is_file() or not config.is_file():
    raise SystemExit("Rotas ou configuração Angular ausentes.")

for path in files.values():
    if path.exists():
        raise SystemExit(
            f"Arquivo já existente: {path}. "
            "Nenhum arquivo será sobrescrito."
        )

config_content = config.read_text(encoding="utf-8")

if not re.search(
    r"provideHttpClient\s*\(",
    config_content
):
    raise SystemExit(
        "HttpClient ainda não está configurado."
    )

original = routes.read_text(encoding="utf-8")

pattern = re.compile(
    r"(path:\s*'financeiro/fluxo-caixa'\s*,\s*)"
    r"component:\s*ComingSoon\b"
)

if len(pattern.findall(original)) != 1:
    raise SystemExit(
        "Rota financeiro/fluxo-caixa diferente do esperado."
    )

anchor = (
    "import { ComingSoon } from "
    "'./pages/coming-soon/coming-soon';"
)

if anchor not in original:
    raise SystemExit("Importação ComingSoon não encontrada.")

# ==========================================
# MODELO
# ==========================================

model = """export interface CashFlowPeriod {
  start: string;
  end: string;
}

export type MovementKind = 'INFLOW' | 'OUTFLOW';

export type MovementStatus =
  | 'SETTLED'
  | 'SCHEDULED';

export interface CashFlowMovement {
  id: string;
  description: string;
  category: string;
  kind: MovementKind;
  status: MovementStatus;
  expectedDate: string;
  settledDate: string | null;
  amount: number;
  contractId: string | null;
}

export interface CashFlowSummary {
  openingBalance: number | null;
  realizedInflows: number | null;
  realizedOutflows: number | null;
  closingBalance: number | null;
  expectedInflows: number | null;
  expectedOutflows: number | null;
  projectedBalance: number | null;
}

export interface CashFlowTimelinePoint {
  month: string;
  realizedInflows: number;
  realizedOutflows: number;
  expectedInflows: number;
  expectedOutflows: number;
}

export interface CashFlowDto {
  status: 'READY' | 'EMPTY';
  source: 'PREVIEW' | 'API';
  period: CashFlowPeriod;
  summary: CashFlowSummary;
  timeline: CashFlowTimelinePoint[];
  movements: CashFlowMovement[];
  updatedAt: string | null;
}
"""

# ==========================================
# SERVIÇO
# ==========================================

service = """import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';

import {
  CashFlowDto,
  CashFlowPeriod,
} from './financial-cash-flow.model';

@Injectable({
  providedIn: 'root',
})
export class FinancialCashFlowService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/v1/financial/cash-flow';

  // Mantemos o modo de pré-visualização
  // até começarmos a implementar o backend.
  private readonly previewMode = true;

  getCashFlow(
    period: CashFlowPeriod
  ): Observable<CashFlowDto> {
    if (this.previewMode) {
      return of({
        status: 'EMPTY',
        source: 'PREVIEW',
        period,
        summary: {
          openingBalance: null,
          realizedInflows: null,
          realizedOutflows: null,
          closingBalance: null,
          expectedInflows: null,
          expectedOutflows: null,
          projectedBalance: null,
        },
        timeline: [],
        movements: [],
        updatedAt: null,
      });
    }

    const params = new HttpParams()
      .set('start', period.start)
      .set('end', period.end);

    return this.http.get<CashFlowDto>(
      this.endpoint,
      { params }
    );
  }
}
"""

# ==========================================
# COMPONENTE
# ==========================================

component = """import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';

import {
  CashFlowDto,
  CashFlowPeriod,
  MovementStatus,
} from '../../../core/financial/financial-cash-flow.model';

import {
  FinancialCashFlowService,
} from '../../../core/financial/financial-cash-flow.service';

type ViewState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'unavailable';

type StatusFilter = MovementStatus | 'ALL';

@Component({
  selector: 'app-financial-cash-flow',
  imports: [Card, Button],
  templateUrl: './financial-cash-flow.html',
  styleUrl: './financial-cash-flow.scss',
})
export class FinancialCashFlow implements OnInit {
  private readonly service =
    inject(FinancialCashFlowService);

  private readonly destroyRef = inject(DestroyRef);

  private request?: Subscription;

  readonly startMonth = signal(this.currentMonth());
  readonly endMonth = signal(this.currentMonth());

  readonly state = signal<ViewState>('loading');
  readonly validationError = signal('');

  private readonly snapshot =
    signal<CashFlowDto | null>(null);

  readonly statusFilter =
    signal<StatusFilter>('ALL');

  readonly summary = computed(
    () => this.snapshot()?.summary
  );

  readonly timeline = computed(
    () => this.snapshot()?.timeline ?? []
  );

  readonly movements = computed(() => {
    const entries = this.snapshot()?.movements ?? [];
    const status = this.statusFilter();

    if (status === 'ALL') {
      return entries;
    }

    return entries.filter(
      movement => movement.status === status
    );
  });

  readonly statusLabel = computed(() => {
    if (this.state() === 'loading') {
      return 'Carregando';
    }

    if (this.state() === 'unavailable') {
      return 'Dados indisponíveis';
    }

    if (this.snapshot()?.source === 'PREVIEW') {
      return 'Prévia sem dados reais';
    }

    return this.state() === 'empty'
      ? 'Sem movimentações'
      : 'Dados atualizados';
  });

  readonly maxBar = computed(() => {
    const values = this.timeline().flatMap(point => [
      point.realizedInflows,
      point.realizedOutflows,
      point.expectedInflows,
      point.expectedOutflows,
    ]);

    return Math.max(1, ...values);
  });

  ngOnInit(): void {
    this.load();
  }

  applyPeriod(
    start: string,
    end: string
  ): void {
    const valid = /^\\\\d{4}-(0[1-9]|1[0-2])$/;

    if (
      !valid.test(start) ||
      !valid.test(end) ||
      start > end
    ) {
      this.validationError.set(
        'Informe um período inicial anterior ou igual ao final.'
      );
      return;
    }

    this.validationError.set('');
    this.startMonth.set(start);
    this.endMonth.set(end);

    this.load();
  }

  setStatus(value: string): void {
    if (
      value === 'ALL' ||
      value === 'SETTLED' ||
      value === 'SCHEDULED'
    ) {
      this.statusFilter.set(value);
    }
  }

  load(): void {
    this.request?.unsubscribe();

    this.snapshot.set(null);
    this.state.set('loading');

    const period = this.buildPeriod();

    this.request = this.service
      .getCashFlow(period)
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

  barHeight(value: number): number {
    return Math.max(
      2,
      Math.max(0, value) / this.maxBar() * 100
    );
  }

  money(
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

  displayDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  private currentMonth(): string {
    const now = new Date();

    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
    ].join('-');
  }

  private buildPeriod(): CashFlowPeriod {
    const start = this.startMonth();
    const end = this.endMonth();

    const [year, month] = end
      .split('-')
      .map(Number);

    const lastDay = new Date(
      year,
      month,
      0
    ).getDate();

    return {
      start: `${start}-01`,
      end: `${end}-${String(lastDay).padStart(2, '0')}`,
    };
  }
}
"""

# ==========================================
# TEMPLATE
# ==========================================

template = """<section class="page-heading">
  <div>
    <p class="eyebrow">GESTÃO FINANCEIRA</p>
    <h1>Fluxo de Caixa</h1>
    <p class="muted">
      Acompanhe entradas, saídas e a posição
      financeira da AgroFly.
    </p>
  </div>

  <span class="status-chip" role="status">
    {{ statusLabel() }}
  </span>
</section>

<section class="filters" aria-label="Filtros do fluxo de caixa">
  <div class="filter-field">
    <label for="cash-start">Período inicial</label>
    <input
      #startInput
      id="cash-start"
      type="month"
      [value]="startMonth()"
    />
  </div>

  <div class="filter-field">
    <label for="cash-end">Período final</label>
    <input
      #endInput
      id="cash-end"
      type="month"
      [value]="endMonth()"
    />
  </div>

  <ui-button
    variant="secondary"
    size="sm"
    [loading]="state() === 'loading'"
    (pressed)="applyPeriod(startInput.value, endInput.value)"
  >
    Aplicar filtros
  </ui-button>
</section>

@if (validationError()) {
  <p class="filter-error" role="alert">
    {{ validationError() }}
  </p>
}

@if (state() === 'unavailable') {
  <ui-card>
    <div class="feedback">
      <h2>Não foi possível carregar o fluxo de caixa</h2>
      <p class="muted">
        Verifique a conexão e tente novamente.
      </p>
      <ui-button variant="secondary" (pressed)="load()">
        Tentar novamente
      </ui-button>
    </div>
  </ui-card>
}

<section class="financial-section">
  <h2 class="section-title">Posição financeira</h2>

  <div class="metrics">
    <ui-card>
      <div class="metric">
        <span class="metric__label">Saldo inicial</span>
        <strong class="metric__value">
          {{ money(summary()?.openingBalance) }}
        </strong>
        <span class="metric__note">Início do período</span>
      </div>
    </ui-card>

    <ui-card>
      <div class="metric">
        <span class="metric__label">Entradas realizadas</span>
        <strong class="metric__value">
          {{ money(summary()?.realizedInflows) }}
        </strong>
        <span class="metric__note">Valores recebidos</span>
      </div>
    </ui-card>

    <ui-card>
      <div class="metric">
        <span class="metric__label">Saídas realizadas</span>
        <strong class="metric__value">
          {{ money(summary()?.realizedOutflows) }}
        </strong>
        <span class="metric__note">Valores pagos</span>
      </div>
    </ui-card>

    <ui-card>
      <div class="metric">
        <span class="metric__label">Saldo final</span>
        <strong class="metric__value">
          {{ money(summary()?.closingBalance) }}
        </strong>
        <span class="metric__note">Fim do período</span>
      </div>
    </ui-card>
  </div>
</section>

<section class="financial-section">
  <h2 class="section-title">Projeção financeira</h2>

  <div class="forecast-grid">
    <ui-card>
      <div class="metric">
        <span class="metric__label">Previsto a receber</span>
        <strong class="metric__value metric__value--small">
          {{ money(summary()?.expectedInflows) }}
        </strong>
      </div>
    </ui-card>

    <ui-card>
      <div class="metric">
        <span class="metric__label">Previsto a pagar</span>
        <strong class="metric__value metric__value--small">
          {{ money(summary()?.expectedOutflows) }}
        </strong>
      </div>
    </ui-card>

    <ui-card>
      <div class="metric">
        <span class="metric__label">Saldo projetado</span>
        <strong class="metric__value metric__value--small">
          {{ money(summary()?.projectedBalance) }}
        </strong>
      </div>
    </ui-card>
  </div>
</section>

<section class="financial-section">
  <ui-card>
    <div class="panel-heading">
      <div>
        <h2>Evolução do caixa</h2>
        <p class="muted">
          Entradas e saídas realizadas e previstas
        </p>
      </div>
    </div>

    @if (timeline().length > 0) {
      <div class="chart">
        @for (point of timeline(); track point.month) {
          <div class="chart__group">
            <div class="chart__bars">
              <span
                class="chart__bar chart__bar--in"
                [style.height.%]="barHeight(point.realizedInflows)"
                title="Entradas realizadas"
              ></span>
              <span
                class="chart__bar chart__bar--out"
                [style.height.%]="barHeight(point.realizedOutflows)"
                title="Saídas realizadas"
              ></span>
              <span
                class="chart__bar chart__bar--forecast-in"
                [style.height.%]="barHeight(point.expectedInflows)"
                title="Entradas previstas"
              ></span>
              <span
                class="chart__bar chart__bar--forecast-out"
                [style.height.%]="barHeight(point.expectedOutflows)"
                title="Saídas previstas"
              ></span>
            </div>
            <span class="chart__month">
              {{ point.month }}
            </span>
          </div>
        }
      </div>

      <div class="chart-legend">
        <span>Entradas realizadas</span>
        <span>Saídas realizadas</span>
        <span>Entradas previstas</span>
        <span>Saídas previstas</span>
      </div>
    } @else {
      <div class="empty-state">
        <h3>Sem dados para o gráfico</h3>
        <p>
          A evolução será apresentada quando
          existirem movimentações no período.
        </p>
      </div>
    }
  </ui-card>
</section>

<section class="financial-section">
  <ui-card>
    <div class="panel-heading">
      <div>
        <h2>Movimentações financeiras</h2>
        <p class="muted">
          Histórico e programação de entradas e saídas
        </p>
      </div>

      <div class="filter-field">
        <label for="movement-status">Situação</label>
        <select
          #statusSelect
          id="movement-status"
          [value]="statusFilter()"
          (change)="setStatus(statusSelect.value)"
        >
          <option value="ALL">Todas</option>
          <option value="SETTLED">Realizadas</option>
          <option value="SCHEDULED">Previstas</option>
        </select>
      </div>
    </div>

    @if (movements().length > 0) {
      <div class="table-container">
        <table class="movement-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Situação</th>
              <th>Valor</th>
            </tr>
          </thead>

          <tbody>
            @for (movement of movements(); track movement.id) {
              <tr>
                <td>
                  {{ displayDate(
                    movement.settledDate ?? movement.expectedDate
                  ) }}
                </td>
                <td>{{ movement.description }}</td>
                <td>{{ movement.category }}</td>
                <td>
                  {{ movement.kind === 'INFLOW'
                    ? 'Entrada' : 'Saída' }}
                </td>
                <td>
                  {{ movement.status === 'SETTLED'
                    ? 'Realizada' : 'Prevista' }}
                </td>
                <td>
                  {{ money(movement.amount) }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="empty-state">
        <h3>Nenhuma movimentação encontrada</h3>
        <p>
          Não existem registros para os filtros
          selecionados.
        </p>
      </div>
    }
  </ui-card>
</section>
"""

# ==========================================
# ESTILOS
# ==========================================

styles = """@use '../../../../styles/breakpoints' as bp;

:host {
  display: block;
}

.page-heading,
.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 18px;
}

.page-heading {
  margin-bottom: 24px;
}

.page-heading h1 {
  margin: 4px 0 6px;
}

.page-heading .muted {
  margin: 0;
}

.status-chip {
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  background: var(--surface);
  font-size: .72rem;
  font-weight: 700;
}

.filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.filter-field {
  display: grid;
  gap: 6px;
  min-width: 170px;
}

.filter-field label {
  font-size: .75rem;
  color: var(--muted);
  font-weight: 600;
}

.filter-field input,
.filter-field select {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
}

.filter-error {
  margin: 0 0 22px;
  color: var(--danger);
  font-size: .78rem;
}

.financial-section {
  margin: 28px 0;
}

.section-title,
.panel-heading h2 {
  margin: 0 0 15px;
  font-size: 1rem;
}

.metrics,
.forecast-grid {
  display: grid;
  gap: 15px;
}

.metrics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.forecast-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
}

.metric__label {
  color: var(--muted);
  font-size: .78rem;
  font-weight: 600;
}

.metric__value {
  font-size: clamp(1.4rem, 2vw, 1.9rem);
  color: var(--text);
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.metric__value--small {
  font-size: clamp(1.25rem, 1.7vw, 1.65rem);
}

.metric__note {
  font-size: .72rem;
  color: var(--muted);
}

.panel-heading {
  margin-bottom: 22px;
}

.panel-heading h2 {
  margin-bottom: 4px;
}

.panel-heading p {
  margin: 0;
}

/* Gráfico */

.chart {
  display: flex;
  gap: 18px;
  min-height: 240px;
  overflow-x: auto;
  padding: 20px 8px 0;
}

.chart__group {
  min-width: 95px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 12px;
}

.chart__bars {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 5px;
  height: 190px;
  border-bottom: 1px solid var(--border);
}

.chart__bar {
  width: 16px;
  min-height: 2px;
  border-radius: 4px 4px 0 0;
}

.chart__bar--in {
  background: var(--primary);
}

.chart__bar--out {
  background: var(--danger);
}

.chart__bar--forecast-in {
  background: var(--primary);
  opacity: .35;
}

.chart__bar--forecast-out {
  background: var(--danger);
  opacity: .35;
}

.chart__month {
  text-align: center;
  color: var(--muted);
  font-size: .75rem;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  margin-top: 24px;
  color: var(--muted);
  font-size: .72rem;
}

.empty-state {
  min-height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 25px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  text-align: center;
}

.empty-state h3 {
  margin: 0;
  font-size: .9rem;
}

.empty-state p {
  max-width: 390px;
  margin: 0;
  color: var(--muted);
  font-size: .77rem;
}

.table-container {
  overflow-x: auto;
}

.movement-table {
  width: 100%;
  border-collapse: collapse;
}

.movement-table th,
.movement-table td {
  padding: 13px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  font-size: .78rem;
}

.movement-table th {
  color: var(--muted);
  font-size: .71rem;
}

.movement-table th:last-child,
.movement-table td:last-child {
  text-align: right;
  white-space: nowrap;
}

.feedback {
  padding: 12px 0;
}

.feedback h2 {
  margin-top: 0;
}

.feedback ui-button {
  display: inline-block;
  margin-top: 15px;
}

@include bp.tablet {
  .metrics,
  .forecast-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@include bp.mobile {
  .metrics,
  .forecast-grid {
    grid-template-columns: 1fr;
  }

  .filters {
    display: grid;
    grid-template-columns: 1fr;
  }

  .filter-field {
    min-width: 0;
  }
}
"""

# ==========================================
# ATUALIZAR ROTAS
# ==========================================

new_import = (
    "import { FinancialCashFlow } from "
    "'./pages/financial/cash-flow/financial-cash-flow';"
)

updated = original.replace(
    anchor,
    anchor + "\\n" + new_import,
    1
)

updated, count = pattern.subn(
    r"\\1component: FinancialCashFlow",
    updated,
    count=1
)

if count != 1:
    raise SystemExit("Falha ao atualizar a rota.")

# ==========================================
# BACKUP E GRAVAÇÃO
# ==========================================

timestamp = datetime.now().strftime(
    "%Y%m%d-%H%M%S-%f"
)

backup = (
    Path.home()
    / "agrofly-backups"
    / "cash-flow"
    / timestamp
)

backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(routes, backup / routes.name)

base.mkdir(parents=True, exist_ok=True)
core.mkdir(parents=True, exist_ok=True)

contents = {
    "model": model,
    "service": service,
    "component": component,
    "template": template,
    "styles": styles,
}

for name, content in contents.items():
    files[name].write_text(
        content,
        encoding="utf-8"
    )
    print(f"Criado: {files[name]}")

routes.write_text(
    updated,
    encoding="utf-8"
)

print("Rota /financeiro/fluxo-caixa atualizada.")
print(f"Backup: {backup}")
PY

echo
echo "Compilando o Angular..."
npm run build
