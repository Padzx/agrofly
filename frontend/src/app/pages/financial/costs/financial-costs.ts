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

import {
  FinancialScenarioService
} from '../../../core/financial/financial-scenario.service';

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

  private readonly financialScenario =
    inject(FinancialScenarioService);
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


  readonly scenario =
    this.financialScenario.scenario;

  readonly variableCostPerHa =
    this.financialScenario.variableCostPerHa;

  readonly projectedVariableCosts =
    computed(() =>
      this.variableCostPerHa()
      * this.scenario().projectedHectares
    );

  readonly totalOperatingFixedCosts =
    computed(() =>
      this.scenario().baseFixedCostsAnnual
      + this.scenario().groundTeamLogisticsAnnual
    );

  readonly economicCostPerHa =
    computed(() => {

      const scenario =
        this.scenario();

      if (scenario.projectedHectares <= 0) {
        return 0;
      }

      return (
        this.variableCostPerHa()
        + scenario.pilotCommissionPerHa
        + (
            this.totalOperatingFixedCosts()
            / scenario.projectedHectares
          )
      );
    });

  readonly totalProjectedCosts =
    computed(() => {

      const scenario =
        this.scenario();

      const pilot =
        scenario.pilotCommissionPerHa
        * scenario.projectedHectares;

      return (
        this.projectedVariableCosts()
        + pilot
        + this.totalOperatingFixedCosts()
      );
    });

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

  updateScenarioField(
    field:
      | 'fuelCostPerHa'
      | 'maintenanceReservePerHa'
      | 'otherVariableCostPerHa'
      | 'pilotCommissionPerHa'
      | 'baseFixedCostsAnnual'
      | 'groundTeamLogisticsAnnual',
    value: string
  ): void {

    const parsed =
      Number(
        value.replace(',', '.')
      );

    if (
      Number.isNaN(parsed)
      || parsed < 0
    ) {
      return;
    }

    this.financialScenario.updateField(
      field,
      parsed
    );
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
