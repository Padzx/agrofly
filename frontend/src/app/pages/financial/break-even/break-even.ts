import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  BreakEvenScenario
} from '../../../core/financial/financial-break-even.model';

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

  private readonly service =
    inject(FinancialBreakEvenService);

  readonly scenario =
    signal<BreakEvenScenario>({
      ...this.service.initialScenario
    });

  readonly result = computed(() =>
    this.service.calculate(
      this.scenario()
    )
  );

  readonly profitTargets = computed(() =>
    [
      100000,
      200000,
      300000,
      500000
    ].map(target =>
      this.service.calculateProfitTarget(
        this.scenario(),
        target
      )
    )
  );

  readonly projectedHours = computed(() => {

    const scenario = this.scenario();

    if (
      scenario.productivityHaPerHour <= 0
    ) {
      return 0;
    }

    return (
      scenario.projectedHectares
      / scenario.productivityHaPerHour
    );
  });

  updateField(
    field: keyof BreakEvenScenario,
    value: string
  ): void {

    const numericValue =
      Number(
        value
          .replace(',', '.')
      );

    if (
      Number.isNaN(numericValue)
      || numericValue < 0
    ) {
      return;
    }

    this.scenario.update(
      current => ({
        ...current,
        [field]: numericValue
      })
    );
  }

  resetScenario(): void {

    this.scenario.set({
      ...this.service.initialScenario
    });
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

  percent(
    value: number
  ): string {

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
