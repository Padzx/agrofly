export interface ProfitTarget {
  targetProfit: number;

  requiredHectares: number;

  requiredHours: number;

  requiredRevenue: number;
}

export interface BreakEvenResult {
  contributionMarginPerHa: number;

  breakEvenHectares: number;

  breakEvenHours: number;

  projectedHectares: number;

  safetyMarginHectares: number;

  safetyMarginPercent: number;
}
