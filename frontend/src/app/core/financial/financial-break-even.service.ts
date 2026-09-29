import { Injectable } from '@angular/core';

import {
  FinancialScenario
} from './financial-scenario.model';

import {
  BreakEvenResult,
  ProfitTarget
} from './financial-break-even.model';

@Injectable({
  providedIn: 'root'
})
export class FinancialBreakEvenService {

  calculate(
    scenario: FinancialScenario
  ): BreakEvenResult {

    const variableCostPerHa =
      scenario.fuelCostPerHa
      + scenario.maintenanceReservePerHa
      + scenario.otherVariableCostPerHa;

    const contributionMarginPerHa =
      scenario.pricePerHa
      - scenario.pilotCommissionPerHa
      - scenario.taxesPerHa
      - variableCostPerHa;

    /*
     * Igual à lógica da planilha:
     *
     * custos fixos operacionais
     * + depreciação
     * + juros
     */
    const fixedCostsAnnual =
      scenario.operatingFixedCostsAnnual
      + scenario.depreciationAnnual
      + scenario.interestAnnual;

    const breakEvenHectares =
      contributionMarginPerHa > 0
        ? fixedCostsAnnual
          / contributionMarginPerHa
        : 0;

    const breakEvenHours =
      scenario.productivityHaPerHour > 0
        ? breakEvenHectares
          / scenario.productivityHaPerHour
        : 0;

    const safetyMarginHectares =
      scenario.projectedHectares
      - breakEvenHectares;

    const safetyMarginPercent =
      scenario.projectedHectares > 0
        ? safetyMarginHectares
          / scenario.projectedHectares
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
    scenario: FinancialScenario,
    targetProfit: number
  ): ProfitTarget {

    const variableCostPerHa =
      scenario.fuelCostPerHa
      + scenario.maintenanceReservePerHa
      + scenario.otherVariableCostPerHa;

    const contributionMarginPerHa =
      scenario.pricePerHa
      - scenario.pilotCommissionPerHa
      - scenario.taxesPerHa
      - variableCostPerHa;

    const fixedCostsAnnual =
      scenario.operatingFixedCostsAnnual
      + scenario.depreciationAnnual
      + scenario.interestAnnual;

    const requiredHectares =
      contributionMarginPerHa > 0
        ? (
            fixedCostsAnnual
            + targetProfit
          ) / contributionMarginPerHa
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
