import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  FinancialScenario
} from '../../../core/financial/financial-scenario.model';

import {
  FinancialScenarioService
} from '../../../core/financial/financial-scenario.service';

import {
  FinancialBreakEvenService
} from '../../../core/financial/financial-break-even.service';

@Component({
  selector: 'app-financial-break-even',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './break-even.html',
  styleUrl: './break-even.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinancialBreakEven {

  private readonly breakEvenService =
    inject(FinancialBreakEvenService);

  private readonly financialScenario =
    inject(FinancialScenarioService);

  readonly scenario =
    this.financialScenario.scenario;

  readonly variableCostPerHa =
    this.financialScenario.variableCostPerHa;

  readonly fixedCostsAnnual =
    this.financialScenario.breakEvenFixedCostsAnnual;

  readonly result = computed(() =>
    this.breakEvenService.calculate(
      this.scenario()
    )
  );

  readonly profitTargets = computed(() =>
    [
      100_000,
      200_000,
      300_000,
      500_000
    ].map(target =>
      this.breakEvenService.calculateProfitTarget(
        this.scenario(),
        target
      )
    )
  );

  readonly projectedHours = computed(() => {
    const scenario = this.scenario();

    if (scenario.productivityHaPerHour <= 0) {
      return 0;
    }

    return (
      scenario.projectedHectares
      / scenario.productivityHaPerHour
    );
  });

  updateField(
    field: keyof FinancialScenario,
    value: string
  ): void {

    const numericValue =
      Number(value.replace(',', '.'));

    if (
      Number.isNaN(numericValue)
      || numericValue < 0
    ) {
      return;
    }

    this.financialScenario.updateField(
      field,
      numericValue
    );
  }

  resetScenario(): void {
    this.financialScenario.reset();
  }

  currency(value: number): string {
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

  percent(value: number): string {
    return new Intl.NumberFormat(
      'pt-BR',
      {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }
    ).format(value);
  }
}
