import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';

import {
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import { Subscription } from 'rxjs';

import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';

import {
  DreCode,
  DreRowType,
  DreViewMode,
  FinancialDreDto
} from '../../../core/financial/financial-dre.model';

import {
  FinancialDreService
} from '../../../core/financial/financial-dre.service';

type LoadingState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'unavailable';

interface DreDefinition {
  code: DreCode;
  label: string;
  type: DreRowType;
}

@Component({
  selector: 'app-financial-dre',
  standalone: true,
  imports: [
    Card,
    Button
  ],
  templateUrl: './financial-dre.html',
  styleUrl: './financial-dre.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinancialDre implements OnInit {

  private readonly service =
    inject(FinancialDreService);

  private readonly destroyRef =
    inject(DestroyRef);

  private request?: Subscription;

  readonly competence =
    signal(this.currentMonth());

  readonly state =
    signal<LoadingState>('loading');

  readonly viewMode =
    signal<DreViewMode>('total');

  private readonly snapshot =
    signal<FinancialDreDto | null>(null);

  private readonly definitions: DreDefinition[] = [
    {
      code: 'grossRevenue',
      label: 'Receita bruta',
      type: 'normal'
    },
    {
      code: 'revenueTaxes',
      label: '(−) Impostos sobre receita',
      type: 'deduction'
    },
    {
      code: 'netRevenue',
      label: 'Receita líquida',
      type: 'subtotal'
    },
    {
      code: 'pilotCommission',
      label: '(−) Comissão do piloto',
      type: 'deduction'
    },
    {
      code: 'fuelCosts',
      label: '(−) Combustível custeado pela AgroFly',
      type: 'deduction'
    },
    {
      code: 'maintenanceReserve',
      label: '(−) Manutenção e reservas',
      type: 'deduction'
    },
    {
      code: 'otherVariableCosts',
      label: '(−) Pneus, peças, óleo e demais variáveis',
      type: 'deduction'
    },
    {
      code: 'contributionMargin',
      label: 'Margem de contribuição',
      type: 'subtotal'
    },
    {
      code: 'fixedCosts',
      label: '(−) Custos fixos',
      type: 'deduction'
    },
    {
      code: 'ebitda',
      label: 'EBITDA',
      type: 'subtotal'
    },
    {
      code: 'depreciation',
      label: '(−) Depreciação',
      type: 'deduction'
    },
    {
      code: 'ebit',
      label: 'EBIT',
      type: 'subtotal'
    },
    {
      code: 'interest',
      label: '(−) Juros',
      type: 'deduction'
    },
    {
      code: 'netProfit',
      label: 'Resultado líquido',
      type: 'result'
    }
  ];

  readonly hectares = computed(
    () => this.snapshot()?.hectares ?? 0
  );

  readonly grossRevenue = computed(
    () => this.value('grossRevenue')
  );

  readonly contributionMarginPerHa = computed(
    () =>
      this.valuePerHa(
        this.value('contributionMargin')
      )
  );

  readonly depreciationPerHa = computed(
    () =>
      this.valuePerHa(
        this.value('depreciation')
      )
  );

  readonly rows = computed(() =>
    this.definitions.map(definition => {
      const rawValue =
        this.value(definition.code);

      return {
        ...definition,
        rawValue,
        total: this.money(rawValue),
        perHa: this.money(
          this.valuePerHa(rawValue)
        ),
        percent:
          this.percentageOfRevenue(rawValue),
        display:
          this.displayValue(rawValue)
      };
    })
  );

  readonly indicators = computed(() => [
    {
      label: 'Receita bruta',
      value: this.money(
        this.value('grossRevenue')
      ),
      helper:
        `${this.number(this.hectares())} ha`
    },
    {
      label: 'Margem de contribuição',
      value: this.money(
        this.contributionMarginPerHa()
      ),
      helper: 'por hectare'
    },
    {
      label: 'EBITDA',
      value: this.money(
        this.value('ebitda')
      ),
      helper: this.percentageOfRevenue(
        this.value('ebitda')
      )
    },
    {
      label: 'Resultado líquido',
      value: this.money(
        this.value('netProfit')
      ),
      helper: this.percentageOfRevenue(
        this.value('netProfit')
      )
    }
  ]);

  readonly statusLabel = computed(() => {
    switch (this.state()) {
      case 'loading':
        return 'Carregando';

      case 'ready':
        return 'Cenário carregado';

      case 'empty':
        return 'Sem lançamentos';

      default:
        return 'Dados indisponíveis';
    }
  });

  ngOnInit(): void {
    this.load();
  }

  setViewMode(
    mode: DreViewMode
  ): void {
    this.viewMode.set(mode);
  }

  setCompetence(
    value: string
  ): void {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ) {
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
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
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
        }
      });
  }

  private value(
    code: DreCode
  ): number {
    return (
      this.snapshot()?.values[code]
      ?? 0
    );
  }

  private displayValue(
    value: number
  ): string {
    switch (this.viewMode()) {
      case 'perHa':
        return this.money(
          this.valuePerHa(value)
        );

      case 'percent':
        return this.percentageOfRevenue(
          value
        );

      default:
        return this.money(value);
    }
  }

  private valuePerHa(
    value: number
  ): number {
    const hectares =
      this.hectares();

    if (hectares <= 0) {
      return 0;
    }

    return value / hectares;
  }

  private percentageOfRevenue(
    value: number
  ): string {
    const revenue =
      this.grossRevenue();

    if (revenue === 0) {
      return '0,0%';
    }

    return new Intl.NumberFormat(
      'pt-BR',
      {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }
    ).format(
      value / revenue
    );
  }

  private currentMonth(): string {
    const now = new Date();

    const year =
      now.getFullYear();

    const month =
      String(
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

    return new Intl.NumberFormat(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL'
      }
    ).format(value);
  }

  private number(
    value: number
  ): string {
    return new Intl.NumberFormat(
      'pt-BR',
      {
        maximumFractionDigits: 0
      }
    ).format(value);
  }
}
