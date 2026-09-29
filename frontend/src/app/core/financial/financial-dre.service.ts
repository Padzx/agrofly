import {
  inject,
  Injectable
} from '@angular/core';

import {
  Observable,
  of
} from 'rxjs';

import {
  FinancialDreDto
} from './financial-dre.model';

import {
  FinancialScenarioService
} from './financial-scenario.service';

@Injectable({
  providedIn: 'root'
})
export class FinancialDreService {

  private readonly financialScenario =
    inject(FinancialScenarioService);

  getDre(
    competence: string
  ): Observable<FinancialDreDto> {

    const scenario =
      this.financialScenario.scenario();

    const hectares =
      scenario.projectedHectares;

    const grossRevenue =
      hectares
      * scenario.pricePerHa;

    const revenueTaxes =
      -(
        grossRevenue
        * scenario.revenueTaxRate
      );

    const netRevenue =
      grossRevenue
      + revenueTaxes;

    const pilotCommission =
      -(
        hectares
        * scenario.pilotCommissionPerHa
      );

    const fuelCosts =
      -(
        hectares
        * scenario.fuelCostPerHa
      );

    const maintenanceReserve =
      -(
        hectares
        * scenario.maintenanceReservePerHa
      );

    const otherVariableCosts =
      -(
        hectares
        * scenario.otherVariableCostPerHa
      );

    const contributionMargin =
      netRevenue
      + pilotCommission
      + fuelCosts
      + maintenanceReserve
      + otherVariableCosts;

    const fixedCosts =
      -scenario.operatingFixedCostsAnnual;

    const ebitda =
      contributionMargin
      + fixedCosts;

    const depreciation =
      -scenario.depreciationAnnual;

    const ebit =
      ebitda
      + depreciation;

    const interest =
      -scenario.interestAnnual;

    const netProfit =
      ebit
      + interest;

    return of({
      status: 'READY',

      competence,

      hectares,

      values: {
        grossRevenue,
        revenueTaxes,
        netRevenue,

        pilotCommission,
        fuelCosts,
        maintenanceReserve,
        otherVariableCosts,

        contributionMargin,

        fixedCosts,
        ebitda,

        depreciation,
        ebit,

        interest,
        netProfit
      },

      updatedAt:
        new Date().toISOString()
    });
  }
}
