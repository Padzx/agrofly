export interface FinancialScenario {
  projectedHectares: number;

  pricePerHa: number;

  productivityHaPerHour: number;

  pilotCommissionPerHa: number;

  taxesPerHa: number;

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

  depreciationAnnual: number;

  interestAnnual: number;
}
