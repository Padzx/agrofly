export type DreCode =
  | 'grossRevenue'
  | 'revenueTaxes'
  | 'netRevenue'
  | 'pilotCommission'
  | 'fuelCosts'
  | 'maintenanceReserve'
  | 'otherVariableCosts'
  | 'contributionMargin'
  | 'fixedCosts'
  | 'ebitda'
  | 'depreciation'
  | 'ebit'
  | 'interest'
  | 'netProfit';

export type DreRowType =
  | 'normal'
  | 'deduction'
  | 'subtotal'
  | 'result';

export type DreViewMode =
  | 'total'
  | 'perHa'
  | 'percent';

export interface FinancialDreDto {
  status: 'READY' | 'EMPTY';

  competence: string;

  hectares: number;

  values: Partial<
    Record<DreCode, number | null>
  >;

  updatedAt: string | null;
}
