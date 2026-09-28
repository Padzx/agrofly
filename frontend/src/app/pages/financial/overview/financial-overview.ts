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

import { Card } from
  '../../../shared/ui/card/card';

import { FinancialOverviewDto } from
  '../../../core/financial/financial-overview.model';

import { FinancialOverviewService } from
  '../../../core/financial/financial-overview.service';

interface FinancialIndicator {
  label: string;
  value: string;
  description: string;
}

type LoadingState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'unavailable';

@Component({
  selector: 'app-financial-overview',
  imports: [Card],
  templateUrl: './financial-overview.html',
  styleUrl: './financial-overview.scss',
})
export class FinancialOverview implements OnInit {

  private readonly financialService =
    inject(FinancialOverviewService);

  private readonly destroyRef = inject(DestroyRef);

  private readonly snapshot =
    signal<FinancialOverviewDto | null>(null);

  readonly state = signal<LoadingState>('loading');

  readonly statusLabel = computed(() => {
    switch (this.state()) {
      case 'loading':
        return 'Carregando dados';

      case 'ready':
        return 'Dados atualizados';

      case 'empty':
        return 'Sem lançamentos';

      default:
        return 'Dados indisponíveis';
    }
  });

  readonly emptyTitle = computed(() =>
    this.state() === 'unavailable'
      ? 'Integração financeira indisponível'
      : 'Projeção ainda não disponível'
  );

  readonly indicators = computed<FinancialIndicator[]>(
    () => {
      const data = this.snapshot()?.financial;

      return [
        {
          label: 'Receita líquida',
          value: this.money(data?.netRevenue),
          description: 'Receita no período selecionado',
        },
        {
          label: 'Custos operacionais',
          value: this.money(data?.operatingCosts),
          description: 'Custos consolidados da operação',
        },
        {
          label: 'Resultado operacional',
          value: this.money(data?.operatingResult),
          description: 'Resultado do período',
        },
        {
          label: 'Margem operacional',
          value: this.percentage(
            data?.operatingMargin
          ),
          description: 'Margem sobre a receita',
        },
      ];
    }
  );

  readonly cashIndicators = computed<FinancialIndicator[]>(
    () => {
      const data = this.snapshot()?.financial;

      return [
        {
          label: 'Saldo disponível',
          value: this.money(data?.cashBalance),
          description: 'Saldo financeiro consolidado',
        },
        {
          label: 'Recebimentos em atraso',
          value: this.money(data?.overdueReceivables),
          description: 'Valores vencidos e não recebidos',
        },
      ];
    }
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');

    this.financialService
      .getOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
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

  private percentage(
    value: number | null | undefined
  ): string {
    if (value == null) {
      return '— %';
    }

    return (
      value.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      }) + '%'
    );
  }
}
