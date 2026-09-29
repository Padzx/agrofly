import { Injectable } from '@angular/core';

import {
  BreakEvenResult,
  BreakEvenScenario,
  ProfitTarget
} from './financial-break-even.model';

@Injectable({
  providedIn: 'root'
})
export class FinancialBreakEvenService {

  readonly initialScenario: BreakEvenScenario = {
    fixedCostsAnnual: 458000,

    pricePerHa: 40,
    variableCostPerHa: 3.83,
    pilotCommissionPerHa: 6.40,
    taxesPerHa: 2.40,

    projectedHectares: 49000,

    // 49.000 ha / 408,3 h ≈ 120 ha/h
    productivityHaPerHour: 120
  };

  calculate(
    scenario: BreakEvenScenario
  ): BreakEvenResult {

    const contributionMarginPerHa =
      scenario.pricePerHa
      - scenario.variableCostPerHa
      - scenario.pilotCommissionPerHa
      - scenario.taxesPerHa;

    const breakEvenHectares =
      contributionMarginPerHa > 0
        ? scenario.fixedCostsAnnual / contributionMarginPerHa
        : 0;

    const breakEvenHours =
      scenario.productivityHaPerHour > 0
        ? breakEvenHectares / scenario.productivityHaPerHour
        : 0;

    const safetyMarginHectares =
      scenario.projectedHectares - breakEvenHectares;

    const safetyMarginPercent =
      scenario.projectedHectares > 0
        ? safetyMarginHectares / scenario.projectedHectares
        : 0;

    return {
      contributionMarginPerHa,
      breakEvenHectares,
      breakEvenHours,

      projectedHectares:
        scenario.projectedHectares,

      safetyMarginHectares,
      safetyMarginPercent
    };
  }

  calculateProfitTarget(
    scenario: BreakEvenScenario,
    targetProfit: number
  ): ProfitTarget {

    const margin =
      scenario.pricePerHa
      - scenario.variableCostPerHa
      - scenario.pilotCommissionPerHa
      - scenario.taxesPerHa;

    const requiredHectares =
      margin > 0
        ? (
            scenario.fixedCostsAnnual
            + targetProfit
          ) / margin
        : 0;

    const requiredHours =
      scenario.productivityHaPerHour > 0
        ? requiredHectares
          / scenario.productivityHaPerHour
        : 0;

    return {
      targetProfit,
      requiredHectares,
      requiredHours,

      requiredRevenue:
        requiredHectares
        * scenario.pricePerHa
    };
  }
}
