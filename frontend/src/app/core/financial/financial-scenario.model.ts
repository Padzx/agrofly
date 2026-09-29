export interface FinancialScenario {
  projectedHectares: number;

  pricePerHa: number;

  productivityHaPerHour: number;

  pilotCommissionPerHa: number;

  /*
   * Alíquota efetiva utilizada nas projeções
   * sobre a receita bruta.
   *
   * Ex.: 0.06 = 6%
   */
  revenueTaxRate: number;

  /*
   * Combustível representa custo financeiro
   * somente quando pago pela AgroFly.
   */
  fuelCostPerHa: number;

  maintenanceReservePerHa: number;

  otherVariableCostPerHa: number;

  /*
   * Custos fixos operacionais, sem depreciação
   * e sem juros.
   */
  operatingFixedCostsAnnual: number;

  /*
   * Detalhamento utilizado no fluxo de caixa.
   *
   * A soma dos dois deve corresponder aos
   * custos fixos operacionais da DRE.
   */
  baseFixedCostsAnnual: number;

  groundTeamLogisticsAnnual: number;

  depreciationAnnual: number;

  interestAnnual: number;
}
