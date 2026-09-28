export interface FinancialOverviewDto {
  status: 'READY' | 'EMPTY';

  period: {
    start: string;
    end: string;
  };

  financial: {
    netRevenue: number | null;
    operatingCosts: number | null;
    operatingResult: number | null;
    operatingMargin: number | null;

    cashBalance: number | null;
    overdueReceivables: number | null;
  };

  updatedAt: string | null;
}
