export type CostNature =
  | 'OPERATING'
  | 'ADMINISTRATIVE'
  | 'COMMERCIAL';

export type CostCategory =
  | 'FUEL'
  | 'CREW'
  | 'MAINTENANCE'
  | 'PARTS'
  | 'MOBILIZATION'
  | 'ADMIN'
  | 'SALES'
  | 'OTHER';

export interface CostPeriod {
  start: string;
  end: string;
}

export interface CreateCostRecord {
  competence: string;
  description: string;
  nature: CostNature;
  category: CostCategory;
  amount: number;
  aircraftRef: string | null;
  contractRef: string | null;
}

export interface CostRecord extends CreateCostRecord {
  id: string;
  source: 'PREVIEW' | 'API';
}

export interface CostsSummary {
  operatingCosts: number | null;
  administrativeExpenses: number | null;
  commercialExpenses: number | null;
  totalExpenses: number | null;
  costPerHectare: number | null;
}

export interface CategoryTotal {
  category: CostCategory;
  total: number;
}

export interface FinancialCostsDto {
  status: 'READY' | 'EMPTY';
  source: 'PREVIEW' | 'API';
  period: CostPeriod;
  summary: CostsSummary;
  categoryTotals: CategoryTotal[];
  records: CostRecord[];
  updatedAt: string | null;
}
