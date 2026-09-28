#!/usr/bin/env bash
set -euo pipefail

cd ~/Desktop/agrofly/frontend

if [[ "$(git branch --show-current)" != "feature/financial" ]]; then
  echo "ERRO: utilize a branch feature/financial."
  exit 1
fi

BASE="src/app/pages/financial/costs"
CORE="src/app/core/financial"
ROUTES="src/app/app.routes.ts"

# Validar a estrutura antes de criar arquivos.

python3 - <<'PY'
from pathlib import Path
import re

root = Path("src/app")
routes = root / "app.routes.ts"
config = root / "app.config.ts"

targets = [
    root / "pages/financial/costs/financial-costs.ts",
    root / "pages/financial/costs/financial-costs.html",
    root / "pages/financial/costs/financial-costs.scss",
    root / "core/financial/financial-costs.model.ts",
    root / "core/financial/financial-costs.service.ts",
]

for path in targets:
    if path.exists():
        raise SystemExit(
            f"Arquivo já existente: {path}. "
            "Atualização interrompida para não sobrescrever código."
        )

if not routes.is_file() or not config.is_file():
    raise SystemExit("Rotas ou configuração Angular não encontradas.")

content = routes.read_text(encoding="utf-8")

pattern = (
    r"path:\s*'financeiro/custos'\s*,\s*"
    r"component:\s*ComingSoon\b"
)

if len(re.findall(pattern, content)) != 1:
    raise SystemExit(
        "A rota financeiro/custos não corresponde "
        "à estrutura esperada."
    )

if not re.search(
    r"^import\s+\{\s*ComingSoon\s*\}\s+from\s+"
    r"['\"][^'\"]+['\"]\s*;",
    content,
    re.MULTILINE
):
    raise SystemExit(
        "Importação ComingSoon não encontrada."
    )

if not re.search(
    r"provideHttpClient\s*\(",
    config.read_text(encoding="utf-8")
):
    raise SystemExit(
        "HttpClient não está configurado em app.config.ts."
    )

print("Estrutura validada.")
PY

# Criar backup antes de modificar as rotas.

BACKUP="$HOME/agrofly-backups/costs/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
cp "$ROUTES" "$BACKUP/app.routes.ts"

mkdir -p "$BASE" "$CORE"

# ==========================================
# 1. MODELO DE DADOS
# ==========================================

cat > "$CORE/financial-costs.model.ts" <<'EOF'
export type CostNature =
  | 'OPERATING'
  | 'ADMINISTRATIVE'
  | 'COMMERCIAL';

export type CostCategory =
  | 'FUEL'
  | 'CREW'
  | 'MAINTENANCE'
  | 'PARTS'
  | 'MOBILIZATION'
  | 'ADMIN'
  | 'SALES'
  | 'OTHER';

export interface CostPeriod {
  start: string;
  end: string;
}

export interface CreateCostRecord {
  competence: string;
  description: string;
  nature: CostNature;
  category: CostCategory;
  amount: number;
  aircraftRef: string | null;
  contractRef: string | null;
}

export interface CostRecord extends CreateCostRecord {
  id: string;
  source: 'PREVIEW' | 'API';
}

export interface CostsSummary {
  operatingCosts: number | null;
  administrativeExpenses: number | null;
  commercialExpenses: number | null;
  totalExpenses: number | null;
  costPerHectare: number | null;
}

export interface CategoryTotal {
  category: CostCategory;
  total: number;
}

export interface FinancialCostsDto {
  status: 'READY' | 'EMPTY';
  source: 'PREVIEW' | 'API';
  period: CostPeriod;
  summary: CostsSummary;
  categoryTotals: CategoryTotal[];
  records: CostRecord[];
  updatedAt: string | null;
}
EOF

# ==========================================
# 2. SERVIÇO
# ==========================================

cat > "$CORE/financial-costs.service.ts" <<'EOF'
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';

import {
  CostPeriod,
  CostRecord,
  CreateCostRecord,
  CostCategory,
  FinancialCostsDto,
} from './financial-costs.model';

@Injectable({
  providedIn: 'root',
})
export class FinancialCostsService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/v1/financial/costs';

  // Desativaremos este modo somente
  // quando o backend estiver implementado.
  readonly previewMode = true;

  private records: CostRecord[] = [];
  private nextId = 0;

  getCosts(period: CostPeriod): Observable<FinancialCostsDto> {
    if (!this.previewMode) {
      const params = new HttpParams()
        .set('start', period.start)
        .set('end', period.end);

      return this.http.get<FinancialCostsDto>(
        this.endpoint,
        { params }
      );
    }

    const filtered = this.records.filter(record =>
      record.competence >= period.start &&
      record.competence <= period.end
    );

    const operating = this.sum(
      filtered.filter(item => item.nature === 'OPERATING')
    );

    const administrative = this.sum(
      filtered.filter(item => item.nature === 'ADMINISTRATIVE')
    );

    const commercial = this.sum(
      filtered.filter(item => item.nature === 'COMMERCIAL')
    );

    const groups = new Map<CostCategory, number>();

    for (const record of filtered) {
      groups.set(
        record.category,
        (groups.get(record.category) ?? 0) + record.amount
      );
    }

    const categoryTotals = [...groups.entries()]
      .map(([category, total]) => ({
        category,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    const hasRecords = filtered.length > 0;

    return of({
      status: hasRecords ? 'READY' : 'EMPTY',
      source: 'PREVIEW',
      period,
      summary: {
        operatingCosts: hasRecords ? operating : null,
        administrativeExpenses: hasRecords
          ? administrative : null,
        commercialExpenses: hasRecords
          ? commercial : null,
        totalExpenses: hasRecords
          ? operating + administrative + commercial
          : null,

        // Depende dos hectares executados
        // registrados no módulo operacional.
        costPerHectare: null,
      },
      categoryTotals,
      records: filtered,
      updatedAt: null,
    });
  }

  createCost(
    draft: CreateCostRecord
  ): Observable<CostRecord> {
    if (!this.previewMode) {
      return this.http.post<CostRecord>(
        this.endpoint,
        draft
      );
    }

    const record: CostRecord = {
      ...draft,
      id: `preview-${++this.nextId}`,
      source: 'PREVIEW',
    };

    this.records = [record, ...this.records];

    return of(record);
  }

  deleteCost(id: string): Observable<void> {
    if (!this.previewMode) {
      return this.http.delete<void>(
        `${this.endpoint}/${encodeURIComponent(id)}`
      );
    }

    this.records = this.records.filter(
      record => record.id !== id
    );

    return of(undefined);
  }

  private sum(records: CostRecord[]): number {
    return records.reduce(
      (total, record) => total + record.amount,
      0
    );
  }
}
EOF

# ==========================================
# 3. COMPONENTE
# ==========================================

cat > "$BASE/financial-costs.ts" <<'EOF'
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';

import {
  CostCategory,
  CostNature,
  CostRecord,
  CreateCostRecord,
  FinancialCostsDto,
} from '../../../core/financial/financial-costs.model';

import {
  FinancialCostsService,
} from '../../../core/financial/financial-costs.service';

type ViewState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error';

interface CategoryOption {
  code: CostCategory;
  label: string;
  natures: CostNature[];
}

@Component({
  selector: 'app-financial-costs',
  imports: [Card, Button, FormsModule],
  templateUrl: './financial-costs.html',
  styleUrl: './financial-costs.scss',
})
export class FinancialCosts implements OnInit {
  private readonly service = inject(FinancialCostsService);
  private readonly destroyRef = inject(DestroyRef);

  private request?: Subscription;

  readonly startMonth = signal(this.currentMonth());
  readonly endMonth = signal(this.currentMonth());

  readonly state = signal<ViewState>('loading');
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly feedback = signal('');

  readonly natureFilter = signal('ALL');
  readonly categoryFilter = signal('ALL');
  readonly search = signal('');

  readonly snapshot =
    signal<FinancialCostsDto | null>(null);

  readonly natureOptions = [
    { code: 'OPERATING', label: 'Custos operacionais' },
    { code: 'ADMINISTRATIVE', label: 'Despesas administrativas' },
    { code: 'COMMERCIAL', label: 'Despesas comerciais' },
  ];

  readonly categories: CategoryOption[] = [
    {
      code: 'FUEL',
      label: 'Combustível pago pela AgroFly',
      natures: ['OPERATING'],
    },
    {
      code: 'CREW',
      label: 'Tripulação',
      natures: ['OPERATING'],
    },
    {
      code: 'MAINTENANCE',
      label: 'Manutenção',
      natures: ['OPERATING'],
    },
    {
      code: 'PARTS',
      label: 'Peças e materiais',
      natures: ['OPERATING'],
    },
    {
      code: 'MOBILIZATION',
      label: 'Mobilização',
      natures: ['OPERATING'],
    },
    {
      code: 'ADMIN',
      label: 'Administrativo',
      natures: ['ADMINISTRATIVE'],
    },
    {
      code: 'SALES',
      label: 'Comercial',
      natures: ['COMMERCIAL'],
    },
    {
      code: 'OTHER',
      label: 'Outros',
      natures: [
        'OPERATING',
        'ADMINISTRATIVE',
        'COMMERCIAL',
      ],
    },
  ];

  draft = this.emptyDraft();

  readonly summary = computed(
    () => this.snapshot()?.summary
  );

  readonly filteredRecords = computed(() => {
    const records = this.snapshot()?.records ?? [];
    const nature = this.natureFilter();
    const category = this.categoryFilter();
    const search = this.search().trim().toLowerCase();

    return records.filter(record =>
      (nature === 'ALL' || record.nature === nature) &&
      (category === 'ALL' || record.category === category) &&
      (
        !search ||
        record.description.toLowerCase().includes(search) ||
        (record.aircraftRef ?? '').toLowerCase().includes(search) ||
        (record.contractRef ?? '').toLowerCase().includes(search)
      )
    );
  });

  readonly categoryTotals = computed(
    () => this.snapshot()?.categoryTotals ?? []
  );

  readonly maxCategoryTotal = computed(
    () => Math.max(
      1,
      ...this.categoryTotals().map(item => item.total)
    )
  );

  readonly statusLabel = computed(() => {
    if (this.state() === 'loading') {
      return 'Carregando';
    }

    if (this.state() === 'error') {
      return 'Dados indisponíveis';
    }

    if (this.snapshot()?.source === 'PREVIEW') {
      return 'Modo de pré-visualização';
    }

    return this.state() === 'empty'
      ? 'Sem lançamentos'
      : 'Dados atualizados';
  });

  get availableCategories(): CategoryOption[] {
    return this.categories.filter(
      category => category.natures.includes(
        this.draft.nature
      )
    );
  }

  ngOnInit(): void {
    this.load();
  }

  applyPeriod(start: string, end: string): void {
    const valid = /^\d{4}-(0[1-9]|1[0-2])$/;

    if (
      !valid.test(start) ||
      !valid.test(end) ||
      start > end
    ) {
      this.feedback.set(
        'Informe um período válido.'
      );
      return;
    }

    this.feedback.set('');
    this.startMonth.set(start);
    this.endMonth.set(end);
    this.load();
  }

  onNatureChange(): void {
    this.draft.category =
      this.availableCategories[0]?.code ?? 'OTHER';
  }

  toggleForm(): void {
    this.showForm.update(value => !value);
  }

  load(): void {
    this.request?.unsubscribe();

    this.state.set('loading');

    this.request = this.service
      .getCosts({
        start: this.startMonth(),
        end: this.endMonth(),
      })
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
          this.state.set('error');
        },
      });
  }

  saveDraft(): void {
    const value = Number(this.draft.amount);

    if (
      this.saving() ||
      !this.draft.description.trim() ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(
        this.draft.competence
      )
    ) {
      this.feedback.set(
        'Preencha os campos obrigatórios corretamente.'
      );
      return;
    }

    const validCategory = this.categories.some(
      item =>
        item.code === this.draft.category &&
        item.natures.includes(this.draft.nature)
    );

    if (!validCategory) {
      this.feedback.set(
        'Selecione uma categoria compatível.'
      );
      return;
    }

    const payload: CreateCostRecord = {
      ...this.draft,
      description: this.draft.description.trim(),
      amount: value,
      aircraftRef: this.draft.aircraftRef?.trim() || null,
      contractRef: this.draft.contractRef?.trim() || null,
    };

    this.saving.set(true);
    this.feedback.set('');

    this.service
      .createCost(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.draft = this.emptyDraft();
          this.feedback.set(
            'Rascunho adicionado à pré-visualização.'
          );
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.feedback.set(
            'Não foi possível registrar o lançamento.'
          );
        },
      });
  }

  removeRecord(record: CostRecord): void {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);

    this.service
      .deleteCost(record.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.feedback.set('Lançamento removido.');
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.feedback.set(
            'Não foi possível remover o lançamento.'
          );
        },
      });
  }

  categoryLabel(code: CostCategory): string {
    return this.categories.find(
      item => item.code === code
    )?.label ?? code;
  }

  natureLabel(code: CostNature): string {
    return this.natureOptions.find(
      item => item.code === code
    )?.label ?? code;
  }

  barWidth(value: number): number {
    return value / this.maxCategoryTotal() * 100;
  }

  money(value: number | null | undefined): string {
    if (value == null) {
      return 'R$ —';
    }

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  private emptyDraft(): CreateCostRecord {
    return {
      competence: this.currentMonth(),
      description: '',
      nature: 'OPERATING',
      category: 'FUEL',
      amount: 0,
      aircraftRef: null,
      contractRef: null,
    };
  }

  private currentMonth(): string {
    const now = new Date();

    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
    ].join('-');
  }
}
EOF

# ==========================================
# 4. TEMPLATE
# ==========================================

cat > "$BASE/financial-costs.html" <<'EOF'
<section class="page-heading">
  <div>
    <p class="eyebrow">GESTÃO FINANCEIRA</p>
    <h1>Custos e Despesas</h1>
    <p class="muted">
      Controle e distribuição dos gastos da AgroFly.
    </p>
  </div>

  <ui-button
    variant="secondary"
    (pressed)="toggleForm()"
  >
    {{ showForm() ? 'Fechar formulário' : 'Novo lançamento' }}
  </ui-button>
</section>

<div class="preview-notice">
  <strong>Pré-visualização do frontend</strong>
  <p>
    Os lançamentos adicionados aqui são temporários.
    Não são salvos no banco de dados nem enviados à
    DRE, ao Fluxo de Caixa ou às Contas a Pagar.
  </p>
</div>

<section class="filters" aria-label="Filtros por período">
  <div class="field">
    <label for="cost-start">Período inicial</label>
    <input
      #startInput
      id="cost-start"
      type="month"
      [value]="startMonth()"
    />
  </div>

  <div class="field">
    <label for="cost-end">Período final</label>
    <input
      #endInput
      id="cost-end"
      type="month"
      [value]="endMonth()"
    />
  </div>

  <ui-button
    variant="secondary"
    size="sm"
    (pressed)="applyPeriod(startInput.value, endInput.value)"
  >
    Aplicar período
  </ui-button>
</section>

@if (feedback()) {
  <p class="feedback" role="status">
    {{ feedback() }}
  </p>
}

@if (showForm()) {
  <section class="financial-section">
    <ui-card>
      <h2>Novo lançamento de teste</h2>

      <form
        #costForm="ngForm"
        class="entry-form"
        (ngSubmit)="saveDraft()"
      >
        <div class="field field--wide">
          <label for="cost-description">
            Descrição
          </label>

          <input
            id="cost-description"
            name="description"
            type="text"
            required
            maxlength="120"
            [(ngModel)]="draft.description"
            placeholder="Ex.: manutenção da aeronave"
          />
        </div>

        <div class="field">
          <label for="cost-competence">
            Competência
          </label>

          <input
            id="cost-competence"
            name="competence"
            type="month"
            required
            [(ngModel)]="draft.competence"
          />
        </div>

        <div class="field">
          <label for="cost-nature">
            Classificação
          </label>

          <select
            id="cost-nature"
            name="nature"
            [(ngModel)]="draft.nature"
            (ngModelChange)="onNatureChange()"
          >
            @for (option of natureOptions; track option.code) {
              <option [value]="option.code">
                {{ option.label }}
              </option>
            }
          </select>
        </div>

        <div class="field">
          <label for="cost-category">
            Categoria
          </label>

          <select
            id="cost-category"
            name="category"
            [(ngModel)]="draft.category"
          >
            @for (
              category of availableCategories;
              track category.code
            ) {
              <option [value]="category.code">
                {{ category.label }}
              </option>
            }
          </select>
        </div>

        <div class="field">
          <label for="cost-amount">
            Valor (R$)
          </label>

          <input
            id="cost-amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            [(ngModel)]="draft.amount"
          />
        </div>

        <div class="field">
          <label for="cost-aircraft">
            Aeronave (opcional)
          </label>

          <input
            id="cost-aircraft"
            name="aircraftRef"
            type="text"
            [(ngModel)]="draft.aircraftRef"
            placeholder="Código da aeronave"
          />
        </div>

        <div class="field">
          <label for="cost-contract">
            Contrato (opcional)
          </label>

          <input
            id="cost-contract"
            name="contractRef"
            type="text"
            [(ngModel)]="draft.contractRef"
            placeholder="Código do contrato"
          />
        </div>

        <p class="form-note">
          Combustível fornecido gratuitamente pelo cliente
          deve ser registrado em Frota, e não como custo.
        </p>

        <div class="form-actions">
          <button
            class="action-button"
            type="submit"
            [disabled]="costForm.invalid || saving()"
          >
            Adicionar rascunho
          </button>
        </div>
      </form>
    </ui-card>
  </section>
}

<section class="financial-section">
  <div class="section-heading">
    <h2>Resumo do período</h2>
    <span class="status-chip">{{ statusLabel() }}</span>
  </div>

  <div class="metrics">
    <ui-card>
      <div class="metric">
        <span class="metric__label">Custos operacionais</span>
        <strong class="metric__value">
          {{ money(summary()?.operatingCosts) }}
        </strong>
      </div>
    </ui-card>

    <ui-card>
      <div class="metric">
        <span class="metric__label">
          Despesas administrativas
        </span>
        <strong class="metric__value">
          {{ money(summary()?.administrativeExpenses) }}
        </strong>
      </div>
    </ui-card>

    <ui-card>
      <div class="metric">
        <span class="metric__label">
          Despesas comerciais
        </span>
        <strong class="metric__value">
          {{ money(summary()?.commercialExpenses) }}
        </strong>
      </div>
    </ui-card>

    <ui-card>
      <div class="metric">
        <span class="metric__label">Total de gastos</span>
        <strong class="metric__value">
          {{ money(summary()?.totalExpenses) }}
        </strong>
      </div>
    </ui-card>
  </div>

  <p class="section-note">
    Os indicadores consideram todo o período selecionado.
    O custo por hectare será disponibilizado quando
    houver integração com os hectares executados.
  </p>
</section>

<section class="financial-section">
  <ui-card>
    <div class="panel-heading">
      <h2>Distribuição por categoria</h2>
      <p class="muted">
        Composição dos custos e despesas do período
      </p>
    </div>

    @if (categoryTotals().length > 0) {
      <div class="distribution">
        @for (
          item of categoryTotals();
          track item.category
        ) {
          <div class="distribution__item">
            <div class="distribution__heading">
              <span>
                {{ categoryLabel(item.category) }}
              </span>
              <strong>{{ money(item.total) }}</strong>
            </div>

            <div class="distribution__track">
              <div
                class="distribution__bar"
                [style.width.%]="barWidth(item.total)"
              ></div>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="empty-state">
        <h3>Sem custos registrados</h3>
        <p>
          Adicione um lançamento de teste para
          visualizar a distribuição por categoria.
        </p>
      </div>
    }
  </ui-card>
</section>

<section class="financial-section">
  <ui-card>
    <div class="panel-heading">
      <h2>Lançamentos</h2>
      <p class="muted">
        Consulte os gastos classificados no período.
      </p>
    </div>

    <div class="list-filters">
      <div class="field">
        <label for="cost-search">Pesquisar</label>
        <input
          #searchInput
          id="cost-search"
          type="search"
          placeholder="Descrição, aeronave ou contrato"
          [value]="search()"
          (input)="search.set(searchInput.value)"
        />
      </div>

      <div class="field">
        <label for="nature-filter">Classificação</label>
        <select
          #natureInput
          id="nature-filter"
          [value]="natureFilter()"
          (change)="natureFilter.set(natureInput.value)"
        >
          <option value="ALL">Todas</option>

          @for (option of natureOptions; track option.code) {
            <option [value]="option.code">
              {{ option.label }}
            </option>
          }
        </select>
      </div>

      <div class="field">
        <label for="category-filter">Categoria</label>
        <select
          #categoryInput
          id="category-filter"
          [value]="categoryFilter()"
          (change)="categoryFilter.set(categoryInput.value)"
        >
          <option value="ALL">Todas</option>

          @for (category of categories; track category.code) {
            <option [value]="category.code">
              {{ category.label }}
            </option>
          }
        </select>
      </div>
    </div>

    @if (filteredRecords().length > 0) {
      <div class="table-container">
        <table class="cost-table">
          <thead>
            <tr>
              <th>Competência</th>
              <th>Descrição</th>
              <th>Classificação</th>
              <th>Categoria</th>
              <th>Vinculação</th>
              <th>Valor</th>
              <th>Ação</th>
            </tr>
          </thead>

          <tbody>
            @for (
              record of filteredRecords();
              track record.id
            ) {
              <tr>
                <td>{{ record.competence }}</td>
                <td>{{ record.description }}</td>
                <td>{{ natureLabel(record.nature) }}</td>
                <td>{{ categoryLabel(record.category) }}</td>

                <td>
                  {{ record.aircraftRef || record.contractRef || '—' }}
                </td>

                <td>{{ money(record.amount) }}</td>

                <td>
                  <button
                    class="table-action"
                    type="button"
                    [disabled]="saving()"
                    (click)="removeRecord(record)"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="empty-state">
        <h3>Nenhum lançamento encontrado</h3>
        <p>
          Não existem registros para os filtros
          selecionados.
        </p>
      </div>
    }
  </ui-card>
</section>
EOF

# ==========================================
# 5. SCSS
# ==========================================

cat > "$BASE/financial-costs.scss" <<'EOF'
@use '../../../../styles/breakpoints' as bp;

:host {
  display: block;
}

.page-heading,
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
}

.page-heading {
  margin-bottom: 24px;
}

.page-heading h1 {
  margin: 4px 0 8px;
}

.page-heading p {
  margin: 0;
}

.preview-notice {
  padding: 15px 18px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--primary);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.preview-notice strong {
  font-size: .8rem;
}

.preview-notice p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: .76rem;
  line-height: 1.6;
}

.filters,
.list-filters,
.entry-form {
  display: grid;
  gap: 14px;
}

.filters {
  grid-template-columns: repeat(2, minmax(0, 200px)) auto;
  align-items: end;
  margin-top: 24px;
}

.list-filters {
  grid-template-columns: 2fr 1fr 1fr;
  margin: 22px 0;
}

.entry-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.field--wide,
.form-note,
.form-actions {
  grid-column: 1 / -1;
}

.field label {
  color: var(--muted);
  font-size: .75rem;
  font-weight: 600;
}

.field input,
.field select {
  width: 100%;
  min-width: 0;
  min-height: 43px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: .82rem;
}

.field input:focus,
.field select:focus {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.form-note,
.section-note {
  color: var(--muted);
  font-size: .76rem;
  line-height: 1.6;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.action-button {
  min-height: 42px;
  padding: 0 19px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--primary);
  color: var(--bg);
  font-weight: 700;
  cursor: pointer;
}

.action-button:disabled,
.table-action:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.feedback {
  color: var(--primary);
  font-size: .78rem;
  margin: 14px 0;
}

.financial-section {
  margin: 28px 0;
}

.section-heading {
  margin-bottom: 16px;
}

.section-heading h2,
.panel-heading h2 {
  margin: 0;
  font-size: 1rem;
}

.status-chip {
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: .72rem;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 15px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.metric__label {
  color: var(--muted);
  font-size: .75rem;
}

.metric__value {
  color: var(--text);
  font-size: clamp(1.35rem, 2vw, 1.9rem);
  overflow-wrap: anywhere;
}

.panel-heading {
  margin-bottom: 22px;
}

.panel-heading p {
  margin: 7px 0 0;
}

.distribution {
  display: grid;
  gap: 21px;
}

.distribution__heading {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 10px;
  font-size: .78rem;
}

.distribution__track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--border);
}

.distribution__bar {
  height: 100%;
  border-radius: 999px;
  background: var(--primary);
}

.table-container {
  width: 100%;
  overflow-x: auto;
}

.cost-table {
  width: 100%;
  border-collapse: collapse;
}

.cost-table th,
.cost-table td {
  padding: 13px 11px;
  border-bottom: 1px solid var(--border);
  font-size: .76rem;
  text-align: left;
}

.cost-table th {
  color: var(--muted);
  font-size: .71rem;
  white-space: nowrap;
}

.cost-table td:nth-last-child(2),
.cost-table th:nth-last-child(2) {
  text-align: right;
  white-space: nowrap;
}

.table-action {
  padding: 7px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 25px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  text-align: center;
}

.empty-state h3 {
  margin: 0 0 7px;
  font-size: .9rem;
}

.empty-state p {
  max-width: 400px;
  margin: 0;
  color: var(--muted);
  font-size: .78rem;
}

@include bp.tablet {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .list-filters {
    grid-template-columns: 1fr 1fr;
  }
}

@include bp.mobile {
  .metrics,
  .entry-form,
  .list-filters,
  .filters {
    grid-template-columns: 1fr;
  }

  .field--wide,
  .form-note,
  .form-actions {
    grid-column: auto;
  }

  .form-actions {
    justify-content: stretch;
  }

  .action-button {
    width: 100%;
  }
}
EOF

# ==========================================
# 6. ATUALIZAR SOMENTE A ROTA
# ==========================================

python3 - <<'PY'
from pathlib import Path
import re

path = Path("src/app/app.routes.ts")
content = path.read_text(encoding="utf-8")

new_import = (
    "import { FinancialCosts } from "
    "'./pages/financial/costs/financial-costs';"
)

anchor = re.search(
    r"^import\s+\{\s*ComingSoon\s*\}\s+from\s+"
    r"['\"][^'\"]+['\"]\s*;",
    content,
    re.MULTILINE
)

if not anchor:
    raise SystemExit("Importação ComingSoon não encontrada.")

pattern = re.compile(
    r"(path:\s*'financeiro/custos'\s*,\s*)"
    r"component:\s*ComingSoon\b"
)

if len(pattern.findall(content)) != 1:
    raise SystemExit("Rota financeiro/custos inesperada.")

updated = (
    content[:anchor.end()]
    + "\n"
    + new_import
    + content[anchor.end():]
)

updated, count = pattern.subn(
    lambda match:
        match.group(1) + "component: FinancialCosts",
    updated,
    count=1
)

if count != 1:
    raise SystemExit("Falha ao substituir a rota.")

path.write_text(updated, encoding="utf-8")

print("Rota /financeiro/custos atualizada.")
PY

echo
echo "Backup das rotas: $BACKUP"
echo "Compilando o frontend..."

npm run build

echo
echo "Implementação concluída."
git status --short
