import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import {
  FinancialDreDto
} from './financial-dre.model';

@Injectable({
  providedIn: 'root'
})
export class FinancialDreService {

  getDre(
    competence: string
  ): Observable<FinancialDreDto> {

    const grossRevenue = 1_960_000;

    const revenueTaxes = -117_600;

    const netRevenue =
      grossRevenue + revenueTaxes;

    const pilotCommission = -313_600;

    /*
     * Combustível só representa despesa financeira
     * quando for responsabilidade da AgroFly.
     */
    const fuelCosts = 0;

    const maintenanceReserve = -169_254;

    const otherVariableCosts = -18_375;

    const contributionMargin =
      netRevenue
      + pilotCommission
      + fuelCosts
      + maintenanceReserve
      + otherVariableCosts;

    const fixedCosts = -416_000;

    const ebitda =
      contributionMargin + fixedCosts;

    const depreciation = -42_000;

    const ebit =
      ebitda + depreciation;

    const interest = 0;

    const netProfit =
      ebit + interest;

    return of({
      status: 'READY',

      competence,

      hectares: 49_000,

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
