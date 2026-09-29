import {
  Injectable,
  computed,
  signal
} from '@angular/core';

import {
  FinancialScenario
} from './financial-scenario.model';

@Injectable({
  providedIn: 'root'
})
export class FinancialScenarioService {

  private readonly initialValue:
    FinancialScenario = {

      projectedHectares: 49_000,

      pricePerHa: 40,

      productivityHaPerHour: 120,

      pilotCommissionPerHa: 6.40,

      taxesPerHa: 2.40,

      fuelCostPerHa: 0,

      /*
       * Valores mais precisos preservam
       * os totais da planilha do cliente.
       */
      maintenanceReservePerHa:
        169_254 / 49_000,

      otherVariableCostPerHa:
        18_375 / 49_000,

      operatingFixedCostsAnnual:
        416_000,

      baseFixedCostsAnnual:
        314_000,

      groundTeamLogisticsAnnual:
        102_000,

      depreciationAnnual:
        42_000,

      interestAnnual:
        0
    };

  readonly scenario =
    signal<FinancialScenario>({
      ...this.initialValue
    });

  readonly variableCostPerHa =
    computed(() => {

      const scenario =
        this.scenario();

      return (
        scenario.fuelCostPerHa
        + scenario.maintenanceReservePerHa
        + scenario.otherVariableCostPerHa
      );
    });

  readonly contributionMarginPerHa =
    computed(() => {

      const scenario =
        this.scenario();

      return (
        scenario.pricePerHa
        - scenario.taxesPerHa
        - scenario.pilotCommissionPerHa
        - this.variableCostPerHa()
      );
    });

  readonly breakEvenFixedCostsAnnual =
    computed(() => {

      const scenario =
        this.scenario();

      return (
        scenario.operatingFixedCostsAnnual
        + scenario.depreciationAnnual
        + scenario.interestAnnual
      );
    });

  readonly projectedFlightHours =
    computed(() => {

      const scenario =
        this.scenario();

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
    field: keyof FinancialScenario,
    value: number
  ): void {

    if (
      Number.isNaN(value)
      || value < 0
    ) {
      return;
    }

    this.scenario.update(current => {

      const next: FinancialScenario = {
        ...current,
        [field]: value
      };

      /*
       * Custos fixos operacionais da DRE
       * precisam permanecer sincronizados
       * com seu detalhamento.
       */
      if (
        field === 'baseFixedCostsAnnual'
        || field === 'groundTeamLogisticsAnnual'
      ) {
        next.operatingFixedCostsAnnual =
          next.baseFixedCostsAnnual
          + next.groundTeamLogisticsAnnual;
      }

      return next;
    });
  }

  reset(): void {

    this.scenario.set({
      ...this.initialValue
    });
  }
}
