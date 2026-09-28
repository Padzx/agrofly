export interface CashFlowPeriod {
  start: string;
  end: string;
}

export type MovementKind = 'INFLOW' | 'OUTFLOW';

export type MovementStatus =
  | 'SETTLED'
  | 'SCHEDULED';

export interface CashFlowMovement {
  id: string;
  description: string;
  category: string;
  kind: MovementKind;
  status: MovementStatus;
  expectedDate: string;
  settledDate: string | null;
  amount: number;
  contractId: string | null;
}

export interface CashFlowSummary {
  openingBalance: number | null;
  realizedInflows: number | null;
  realizedOutflows: number | null;
  closingBalance: number | null;
  expectedInflows: number | null;
  expectedOutflows: number | null;
  projectedBalance: number | null;
}

export interface CashFlowTimelinePoint {
  month: string;
  realizedInflows: number;
  realizedOutflows: number;
  expectedInflows: number;
  expectedOutflows: number;
}

export interface CashFlowDto {
  status: 'READY' | 'EMPTY';
  source: 'PREVIEW' | 'API';
  period: CashFlowPeriod;
  summary: CashFlowSummary;
  timeline: CashFlowTimelinePoint[];
  movements: CashFlowMovement[];
  updatedAt: string | null;
}
