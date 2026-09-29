import { Injectable } from '@angular/core';

import {
  SeasonMonthAllocation,
  SeasonMonthProjection,
  SeasonPlanningAssumptions
} from './financial-season-planning.model';

@Injectable({
  providedIn: 'root'
})
export class FinancialSeasonPlanningService {

  readonly initialAssumptions:
    SeasonPlanningAssumptions = {

      projectedHectares: 49_000,

      pricePerHa: 40,

      productivityHaPerHour: 120,

      pilotCommissionPerHa: 6.40,

      taxesPerHa: 2.40,

      variableCostPerHa: 3.83
    };

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
    assumptions: SeasonPlanningAssumptions,
    allocation: SeasonMonthAllocation
  ): SeasonMonthProjection {

    const hectares =
      assumptions.projectedHectares
      * allocation.percentage
      / 100;

    const flightHours =
      assumptions.productivityHaPerHour > 0
        ? hectares
          / assumptions.productivityHaPerHour
        : 0;

    const grossRevenue =
      hectares
      * assumptions.pricePerHa;

    const pilotCommission =
      hectares
      * assumptions.pilotCommissionPerHa;

    const taxes =
      hectares
      * assumptions.taxesPerHa;

    const variableCosts =
      hectares
      * assumptions.variableCostPerHa;

    const contributionMargin =
      grossRevenue
      - pilotCommission
      - taxes
      - variableCosts;

    return {
      month: allocation.month,

      percentage:
        allocation.percentage,

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
    assumptions: SeasonPlanningAssumptions,
    allocation: SeasonMonthAllocation[]
  ): SeasonMonthProjection[] {

    return allocation.map(item =>
      this.calculateMonth(
        assumptions,
        item
      )
    );
  }
}
