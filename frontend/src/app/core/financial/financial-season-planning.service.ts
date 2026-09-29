import { Injectable } from '@angular/core';

import {
  FinancialScenario
} from './financial-scenario.model';

import {
  SeasonMonthAllocation,
  SeasonMonthProjection
} from './financial-season-planning.model';

@Injectable({
  providedIn: 'root'
})
export class FinancialSeasonPlanningService {

  readonly initialAllocation:
    SeasonMonthAllocation[] = [

      { month: 1, percentage: 20 },
      { month: 2, percentage: 20 },
      { month: 3, percentage: 15 },
      { month: 4, percentage: 5 },

      { month: 5, percentage: 0 },
      { month: 6, percentage: 0 },
      { month: 7, percentage: 0 },
      { month: 8, percentage: 0 },

      { month: 9, percentage: 5 },
      { month: 10, percentage: 10 },
      { month: 11, percentage: 10 },
      { month: 12, percentage: 15 }
    ];

  calculateMonth(
    scenario: FinancialScenario,
    allocation: SeasonMonthAllocation
  ): SeasonMonthProjection {

    const hectares =
      scenario.projectedHectares
      * allocation.percentage
      / 100;

    const flightHours =
      scenario.productivityHaPerHour > 0
        ? hectares
          / scenario.productivityHaPerHour
        : 0;

    const grossRevenue =
      hectares
      * scenario.pricePerHa;

    const pilotCommission =
      hectares
      * scenario.pilotCommissionPerHa;

    const taxes =
      hectares
      * (scenario.pricePerHa * scenario.revenueTaxRate);

    const variableCostPerHa =
      scenario.fuelCostPerHa
      + scenario.maintenanceReservePerHa
      + scenario.otherVariableCostPerHa;

    const variableCosts =
      hectares
      * variableCostPerHa;

    const contributionMargin =
      grossRevenue
      - pilotCommission
      - taxes
      - variableCosts;

    return {
      month: allocation.month,
      percentage: allocation.percentage,

      hectares,
      flightHours,

      grossRevenue,
      pilotCommission,
      taxes,
      variableCosts,

      contributionMargin
    };
  }

  calculateSeason(
    scenario: FinancialScenario,
    allocation: SeasonMonthAllocation[]
  ): SeasonMonthProjection[] {

    return allocation.map(
      item =>
        this.calculateMonth(
          scenario,
          item
        )
    );
  }
}
