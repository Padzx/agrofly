import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  Card
} from '../../../shared/ui/card/card';

import {
  CashFlowAssumptions
} from '../../../core/financial/financial-cash-flow.model';

import {
  FinancialCashFlowService
} from '../../../core/financial/financial-cash-flow.service';

@Component({
  selector: 'app-financial-cash-flow',
  standalone: true,
  imports: [Card],
  templateUrl: './financial-cash-flow.html',
  styleUrl: './financial-cash-flow.scss',
  changeDetection:
    ChangeDetectionStrategy.OnPush
})
export class FinancialCashFlow {

  private readonly service =
    inject(FinancialCashFlowService);

  readonly year =
    signal(
      new Date().getFullYear()
    );

  readonly assumptions =
    this.service.assumptions;

  readonly cashFlow =
    computed(() =>
      this.service.calculate(
        this.year()
      )
    );

  readonly summary =
    computed(() =>
      this.cashFlow().summary
    );

  readonly months =
    computed(() =>
      this.cashFlow().months
    );

  readonly reconciliation =
    computed(() =>
      this.cashFlow().reconciliation
    );

  readonly outflowBreakdown =
    computed(() => {

      const months =
        this.months();

      return {
        pilotCommission:
          months.reduce(
            (total, month) =>
              total
              + month.pilotCommission,
            0
          ),

        taxes:
          months.reduce(
            (total, month) =>
              total + month.taxes,
            0
          ),

        variableCosts:
          months.reduce(
            (total, month) =>
              total
              + month.variableCosts,
            0
          ),

        fixedCosts:
          months.reduce(
            (total, month) =>
              total + month.fixedCosts,
            0
          ),

        groundTeamLogistics:
          months.reduce(
            (total, month) =>
              total
              + month.groundTeamLogistics,
            0
          ),

        interest:
          months.reduce(
            (total, month) =>
              total + month.interest,
            0
          ),

        amortization:
          months.reduce(
            (total, month) =>
              total + month.amortization,
            0
          )
      };
    });

  setYear(
    value: string
  ): void {

    const parsed =
      Number(value);

    if (
      !Number.isInteger(parsed)
      || parsed < 2000
      || parsed > 2100
    ) {
      return;
    }

    this.year.set(parsed);
  }

  updateAssumption(
    field: keyof CashFlowAssumptions,
    value: string
  ): void {

    const parsed =
      Number(
        value.replace(',', '.')
      );

    this.service.updateAssumption(
      field,
      parsed
    );
  }

  money(
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
