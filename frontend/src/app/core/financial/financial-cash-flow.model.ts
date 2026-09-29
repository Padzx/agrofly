export interface CashFlowPeriod {
  year: number;
}

export interface CashFlowAssumptions {
  openingBalance: number;

  /**
   * Prazo entre a competência da receita
   * e o efetivo recebimento.
   *
   * 0 = mesmo mês
   * 1 = mês seguinte
   */
  receivableDelayMonths: number;

  /**
   * Amortização reduz caixa,
   * mas não é despesa da DRE.
   */
  annualDebtAmortization: number;
}

export interface CashFlowMonthProjection {
  month: number;
  monthLabel: string;

  hectares: number;

  revenueGenerated: number;
  customerReceipts: number;

  pilotCommission: number;
  taxes: number;
  variableCosts: number;

  fixedCosts: number;
  groundTeamLogistics: number;
  interest: number;
  amortization: number;

  totalOutflows: number;

  netCashFlow: number;
  cumulativeBalance: number;

  accountsReceivableChange: number;
  accountsReceivableBalance: number;
}

export interface CashFlowSummary {
  openingBalance: number;

  revenueGenerated: number;
  customerReceipts: number;

  totalOutflows: number;

  netCashGenerated: number;
  closingBalance: number;

  accountsReceivable: number;
}

export interface CashFlowReconciliation {
  netProfit: number;

  depreciation: number;

  amortization: number;

  accountsReceivableIncrease: number;

  cashGenerated: number;
}

export interface CashFlowDto {
  status: 'READY' | 'EMPTY';

  source: 'PREVIEW' | 'API';

  period: CashFlowPeriod;

  assumptions: CashFlowAssumptions;

  summary: CashFlowSummary;

  months: CashFlowMonthProjection[];

  reconciliation: CashFlowReconciliation;

  updatedAt: string | null;
}
