import {
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
