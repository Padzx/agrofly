export type DreCode =
  | 'grossRevenue'
  | 'revenueDeductions'
  | 'netRevenue'
  | 'serviceCosts'
  | 'grossProfit'
  | 'administrativeExpenses'
  | 'commercialExpenses'
  | 'otherOperatingResult'
  | 'operatingResult'
  | 'financialResult'
  | 'profitBeforeTaxes'
  | 'incomeTaxes'
  | 'netProfit';

export type DreCostCode =
  | 'fuel'
  | 'crew'
  | 'maintenance'
  | 'mobilization'
  | 'other';

export interface FinancialDreDto {
  status: 'READY' | 'EMPTY';

  // Competência no formato YYYY-MM.
  competence: string;

  // Deduções e despesas são valores negativos.
  values: Partial<Record<DreCode, number | null>>;

  // Custos por categoria, expressos como valores positivos.
  costBreakdown?: Partial<
    Record<DreCostCode, number | null>
  >;

  updatedAt: string | null;
}
