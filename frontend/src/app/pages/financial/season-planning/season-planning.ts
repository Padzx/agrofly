import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  FinancialScenario
} from '../../../core/financial/financial-scenario.model';

import {
  FinancialScenarioService
} from '../../../core/financial/financial-scenario.service';

import {
  SeasonMonth,
  SeasonMonthAllocation
} from '../../../core/financial/financial-season-planning.model';

import {
  FinancialSeasonPlanningService
} from '../../../core/financial/financial-season-planning.service';

@Component({
  selector: 'app-season-planning',
  standalone: true,
  imports: [],
  templateUrl: './season-planning.html',
  styleUrl: './season-planning.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SeasonPlanning {

  private readonly seasonService =
    inject(FinancialSeasonPlanningService);

  private readonly financialScenario =
    inject(FinancialScenarioService);

  readonly scenario =
    this.financialScenario.scenario;

  readonly allocation =
    signal<SeasonMonthAllocation[]>(
      this.seasonService.initialAllocation.map(
        item => ({ ...item })
      )
    );

  readonly projection = computed(() =>
    this.seasonService.calculateSeason(
      this.scenario(),
      this.allocation()
    )
  );

  readonly allocationTotal = computed(() =>
    this.allocation().reduce(
      (total, item) =>
        total + item.percentage,
      0
    )
  );

  readonly allocationBalanced = computed(
    () =>
      Math.abs(
        this.allocationTotal() - 100
      ) < 0.001
  );

  readonly totalHectares = computed(() =>
    this.projection().reduce(
      (total, item) =>
        total + item.hectares,
      0
    )
  );

  readonly totalFlightHours = computed(() =>
    this.projection().reduce(
      (total, item) =>
        total + item.flightHours,
      0
    )
  );

  readonly totalRevenue = computed(() =>
    this.projection().reduce(
      (total, item) =>
        total + item.grossRevenue,
      0
    )
  );

  readonly totalContributionMargin =
    computed(() =>
      this.projection().reduce(
        (total, item) =>
          total + item.contributionMargin,
        0
      )
    );

  readonly contributionMarginPerHa =
    computed(() => {

      const hectares =
        this.totalHectares();

      if (hectares <= 0) {
        return 0;
      }

      return (
        this.totalContributionMargin()
        / hectares
      );
    });

  readonly variableCostPerHa =
    this.financialScenario.variableCostPerHa;

  updateAssumption(
    field: keyof FinancialScenario,
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

  updateMonthPercentage(
    month: SeasonMonth,
    value: string
  ): void {

    const parsed =
      Number(
        value.replace(',', '.')
      );

    if (
      Number.isNaN(parsed)
      || parsed < 0
      || parsed > 100
    ) {
      return;
    }

    this.allocation.update(
      current =>
        current.map(
          item =>
            item.month === month
              ? {
                  ...item,
                  percentage: parsed
                }
              : item
        )
    );
  }

  resetScenario(): void {

    this.financialScenario.reset();

    this.allocation.set(
      this.seasonService.initialAllocation.map(
        item => ({ ...item })
      )
    );
  }

  monthName(
    month: SeasonMonth
  ): string {

    const names: Record<
      SeasonMonth,
      string
    > = {
      1: 'Janeiro',
      2: 'Fevereiro',
      3: 'Março',
      4: 'Abril',
      5: 'Maio',
      6: 'Junho',
      7: 'Julho',
      8: 'Agosto',
      9: 'Setembro',
      10: 'Outubro',
      11: 'Novembro',
      12: 'Dezembro'
    };

    return names[month];
  }

  monthShort(
    month: SeasonMonth
  ): string {

    const names: Record<
      SeasonMonth,
      string
    > = {
      1: 'JAN',
      2: 'FEV',
      3: 'MAR',
      4: 'ABR',
      5: 'MAI',
      6: 'JUN',
      7: 'JUL',
      8: 'AGO',
      9: 'SET',
      10: 'OUT',
      11: 'NOV',
      12: 'DEZ'
    };

    return names[month];
  }

  currency(
    value: number
  ): string {

    return new Intl.NumberFormat(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL'
      }
    ).format(value);
  }

  number(
    value: number,
    digits = 0
  ): string {

    return new Intl.NumberFormat(
      'pt-BR',
      {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }
    ).format(value);
  }
}
