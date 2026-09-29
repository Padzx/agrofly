import {
  inject,
  Injectable,
  signal
} from '@angular/core';

import {
  Observable,
  of
} from 'rxjs';

import {
  CashFlowAssumptions,
  CashFlowDto,
  CashFlowMonthProjection
} from './financial-cash-flow.model';

import {
  FinancialScenarioService
} from './financial-scenario.service';

import {
  FinancialSeasonStateService
} from './financial-season-state.service';

import {
  FinancialSeasonPlanningService
} from './financial-season-planning.service';

@Injectable({
  providedIn: 'root'
})
export class FinancialCashFlowService {

  private readonly financialScenario =
    inject(FinancialScenarioService);

  private readonly seasonState =
    inject(FinancialSeasonStateService);

  private readonly seasonPlanning =
    inject(FinancialSeasonPlanningService);

  readonly assumptions =
    signal<CashFlowAssumptions>({
      openingBalance: 0,
      receivableDelayMonths: 1,
      annualDebtAmortization: 0
    });

  updateAssumption(
    field: keyof CashFlowAssumptions,
    value: number
  ): void {

    if (Number.isNaN(value)) {
      return;
    }

    if (
      field !== 'openingBalance'
      && value < 0
    ) {
      return;
    }

    if (
      field === 'receivableDelayMonths'
      && (
        !Number.isInteger(value)
        || value < 0
        || value > 12
      )
    ) {
      return;
    }

    this.assumptions.update(
      current => ({
        ...current,
        [field]: value
      })
    );
  }

  calculate(
    year: number
  ): CashFlowDto {

    const scenario =
      this.financialScenario.scenario();

    const allocation =
      this.seasonState.allocation();

    const assumptions =
      this.assumptions();

    const season =
      this.seasonPlanning.calculateSeason(
        scenario,
        allocation
      );

    const fixedCostsMonthly =
      scenario.baseFixedCostsAnnual / 12;

    const interestMonthly =
      scenario.interestAnnual / 12;

    const amortizationMonthly =
      assumptions.annualDebtAmortization / 12;

    let cumulativeBalance =
      assumptions.openingBalance;

    let accountsReceivableBalance = 0;

    const months:
      CashFlowMonthProjection[] = [];

    for (
      let index = 0;
      index < 12;
      index++
    ) {

      const projection =
        season[index];

      const receiptSourceIndex =
        index
        - assumptions.receivableDelayMonths;

      const customerReceipts =
        receiptSourceIndex >= 0
          ? season[receiptSourceIndex]
              .grossRevenue
          : 0;

      const accountsReceivableChange =
        projection.grossRevenue
        - customerReceipts;

      accountsReceivableBalance +=
        accountsReceivableChange;

      const groundTeamLogistics =
        scenario.groundTeamLogisticsAnnual
        * allocation[index].percentage
        / 100;

      const totalOutflows =
        projection.pilotCommission
        + projection.taxes
        + projection.variableCosts
        + fixedCostsMonthly
        + groundTeamLogistics
        + interestMonthly
        + amortizationMonthly;

      const netCashFlow =
        customerReceipts
        - totalOutflows;

      cumulativeBalance +=
        netCashFlow;

      months.push({
        month: index + 1,

        monthLabel:
          this.monthLabel(index + 1),

        hectares:
          projection.hectares,

        revenueGenerated:
          projection.grossRevenue,

        customerReceipts,

        pilotCommission:
          projection.pilotCommission,

        taxes:
          projection.taxes,

        variableCosts:
          projection.variableCosts,

        fixedCosts:
          fixedCostsMonthly,

        groundTeamLogistics,

        interest:
          interestMonthly,

        amortization:
          amortizationMonthly,

        totalOutflows,

        netCashFlow,

        cumulativeBalance,

        accountsReceivableChange,

        accountsReceivableBalance
      });
    }

    const revenueGenerated =
      months.reduce(
        (total, month) =>
          total + month.revenueGenerated,
        0
      );

    const customerReceipts =
      months.reduce(
        (total, month) =>
          total + month.customerReceipts,
        0
      );

    const totalOutflows =
      months.reduce(
        (total, month) =>
          total + month.totalOutflows,
        0
      );

    const netCashGenerated =
      customerReceipts
      - totalOutflows;

    const accountsReceivable =
      months.at(-1)
        ?.accountsReceivableBalance
      ?? 0;

    const contributionMargin =
      season.reduce(
        (total, month) =>
          total
          + month.contributionMargin,
        0
      );

    const netProfit =
      contributionMargin
      - scenario.operatingFixedCostsAnnual
      - scenario.depreciationAnnual
      - scenario.interestAnnual;

    const cashGenerated =
      netProfit
      + scenario.depreciationAnnual
      - assumptions.annualDebtAmortization
      - accountsReceivable;

    return {
      status: 'READY',

      source: 'PREVIEW',

      period: {
        year
      },

      assumptions: {
        ...assumptions
      },

      summary: {
        openingBalance:
          assumptions.openingBalance,

        revenueGenerated,

        customerReceipts,

        totalOutflows,

        netCashGenerated,

        closingBalance:
          assumptions.openingBalance
          + netCashGenerated,

        accountsReceivable
      },

      months,

      reconciliation: {
        netProfit,

        depreciation:
          scenario.depreciationAnnual,

        amortization:
          assumptions.annualDebtAmortization,

        accountsReceivableIncrease:
          accountsReceivable,

        cashGenerated
      },

      updatedAt:
        new Date().toISOString()
    };
  }

  getCashFlow(
    year: number
  ): Observable<CashFlowDto> {

    return of(
      this.calculate(year)
    );
  }

  private monthLabel(
    month: number
  ): string {

    const labels = [
      'JAN',
      'FEV',
      'MAR',
      'ABR',
      'MAI',
      'JUN',
      'JUL',
      'AGO',
      'SET',
      'OUT',
      'NOV',
      'DEZ'
    ];

    return labels[month - 1];
  }
}
